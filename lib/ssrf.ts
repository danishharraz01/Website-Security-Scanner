/**
 * SSRF (Server-Side Request Forgery) protection.
 *
 * This app fetches URLs that strangers type in, from *our* server. Without
 * protection, an attacker could make our server request internal resources it
 * can reach but they cannot, for example:
 *   - http://169.254.169.254/  (cloud metadata service -> leaks credentials)
 *   - http://localhost:3000/   (services bound to loopback)
 *   - http://10.0.0.5/admin    (private network hosts)
 *
 * Defence layers implemented here:
 *   1. Strict URL validation (scheme, port, no credentials, length).
 *   2. DNS resolution + IP allow-listing: every resolved address must be a
 *      public unicast IP. Private, loopback, link-local, CGNAT, multicast,
 *      reserved, documentation ranges etc. are all rejected.
 *   3. IPv4-mapped / IPv4-compatible IPv6 addresses are unwrapped and checked
 *      as IPv4, so "::ffff:127.0.0.1" cannot sneak past.
 *   4. The fetcher (lib/fetcher.ts) connects to the exact IPs validated here
 *      (DNS pinning) and re-runs all checks on every redirect hop.
 */
import ipaddr from "ipaddr.js";
import { lookup } from "node:dns/promises";

/** Max length of the URL a user can submit. Long URLs are a cheap DoS vector and never needed here. */
export const MAX_URL_LENGTH = 2048;
/** RFC 1035: a full domain name is at most 253 characters. */
const MAX_HOSTNAME_LENGTH = 253;
/** Only the standard web ports. Blocks port-scanning internal services (e.g. :22, :6379, :8080). */
const ALLOWED_PORTS = new Set([80, 443]);

export type ScanErrorCode =
  | "invalid_url"
  | "url_too_long"
  | "bad_protocol"
  | "bad_port"
  | "credentials"
  | "blocked_ip"
  | "dns_failed"
  | "too_many_redirects"
  | "invalid_redirect"
  | "timeout"
  | "tls_error"
  | "connection_failed"
  | "rate_limited"
  | "bad_request"
  | "internal";

/** An expected, user-facing error. `code` is translated on the client via lib/i18n.ts. */
export class ScanError extends Error {
  constructor(public readonly code: ScanErrorCode) {
    super(code);
    this.name = "ScanError";
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

/** Resolver signature so tests can inject fake DNS answers. */
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

/**
 * Returns true only if `address` is a globally routable unicast IP.
 *
 * We use an ALLOW-list ("unicast" only) instead of a block-list: ipaddr.js
 * classifies every special-purpose range (private, loopback, linkLocal,
 * carrierGradeNat, multicast, reserved, unspecified, broadcast, uniqueLocal,
 * 6to4, teredo, rfc6052/NAT64, ...) and anything that is not plain "unicast"
 * is refused. New special ranges therefore fail closed, not open.
 */
export function isPublicIp(address: string): boolean {
  // Strip an IPv6 zone index ("fe80::1%eth0") – the zone is irrelevant to the range check.
  const clean = address.split("%")[0];
  if (!ipaddr.isValid(clean)) return false;

  let addr: ipaddr.IPv4 | ipaddr.IPv6 = ipaddr.parse(clean);

  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      // "::ffff:127.0.0.1" is really 127.0.0.1. Unwrap it and judge the IPv4 address.
      addr = v6.toIPv4Address();
    } else if (v6.parts.slice(0, 6).every((p) => p === 0)) {
      // Deprecated IPv4-compatible form "::127.0.0.1" (first 96 bits zero).
      // Some stacks still route it to the embedded IPv4 address, so refuse it outright.
      return false;
    }
  }

  return addr.range() === "unicast";
}

/** Default resolver: asks the OS for ALL A and AAAA records. */
export const systemResolver: Resolver = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
};

/** URL.hostname wraps IPv6 literals in brackets ("[::1]"); remove them. */
export function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

/**
 * Validates an already-parsed URL. Used for the user's input AND for every
 * redirect target, because a public site can redirect to an internal one.
 */
export function assertSafeUrl(url: URL): void {
  // Only http/https. Blocks file:, ftp:, gopher:, data:, javascript: and friends.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScanError("bad_protocol");
  }
  // "https://user:pass@host" – credentials have no place in a scan and are a
  // classic trick for confusing URL parsers ("https://good.com@evil.com").
  if (url.username !== "" || url.password !== "") {
    throw new ScanError("credentials");
  }
  // URL.port is "" when the default port for the scheme is used.
  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port);
  if (!ALLOWED_PORTS.has(port)) {
    throw new ScanError("bad_port");
  }
  const host = stripBrackets(url.hostname);
  if (host.length === 0 || host.length > MAX_HOSTNAME_LENGTH) {
    throw new ScanError("invalid_url");
  }
}

/**
 * Parses and validates raw user input. Accepts "example.com" (assumes https).
 * Note: the WHATWG URL parser normalises tricky IPv4 spellings such as
 * "2130706433", "0x7f.1" or "0177.0.0.1" into "127.0.0.1", so the IP check
 * later sees the real address.
 */
export function parseUserUrl(raw: unknown): URL {
  if (typeof raw !== "string") throw new ScanError("invalid_url");
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new ScanError("invalid_url");
  if (trimmed.length > MAX_URL_LENGTH) throw new ScanError("url_too_long");
  // Reject control characters / whitespace inside the URL outright.
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) throw new ScanError("invalid_url");

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && trimmed.includes("://")
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ScanError("invalid_url");
  }
  assertSafeUrl(url);
  url.hash = ""; // fragments are never sent to the server anyway
  return url;
}

/**
 * Resolves `hostname` and returns its addresses ONLY if every single one is
 * public. If even one record is private we refuse: an attacker controlling DNS
 * could otherwise return [public, private] and hope we connect to the second.
 */
export async function resolvePublicAddresses(
  hostname: string,
  resolver: Resolver = systemResolver,
): Promise<ResolvedAddress[]> {
  const host = stripBrackets(hostname);

  // IP literal: no DNS involved, check it directly.
  if (ipaddr.isValid(host)) {
    if (!isPublicIp(host)) throw new ScanError("blocked_ip");
    return [{ address: host, family: host.includes(":") ? 6 : 4 }];
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(host);
  } catch {
    throw new ScanError("dns_failed");
  }
  if (addresses.length === 0) throw new ScanError("dns_failed");
  if (!addresses.every((a) => isPublicIp(a.address))) throw new ScanError("blocked_ip");
  return addresses;
}
