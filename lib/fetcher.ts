/**
 * Safe HTTP fetcher used by the scanner.
 *
 * Why not plain `fetch()`?
 *   - fetch() follows redirects automatically. A public site could answer
 *     "302 Location: http://169.254.169.254/" and fetch would happily follow
 *     it into our cloud metadata service. We set redirects to manual and
 *     re-validate EVERY hop with the same SSRF rules as the first URL.
 *   - fetch() resolves DNS itself, AFTER our check. A hostile DNS server
 *     could answer "public IP" to our check and "127.0.0.1" a moment later to
 *     fetch (DNS rebinding). Using node:http(s) lets us pass a custom `lookup`
 *     that hands the socket the exact addresses we already validated, so
 *     there is no second, unchecked DNS query.
 *
 * Other limits:
 *   - At most MAX_REDIRECTS redirects.
 *   - One overall deadline (TIMEOUT_MS) for DNS + connect + all hops.
 *   - We read only the status line and headers, then destroy the socket;
 *     the body is never downloaded (no memory blow-up from huge pages).
 */
import http from "node:http";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { LookupFunction } from "node:net";
import {
  assertSafeUrl,
  resolvePublicAddresses,
  ScanError,
  systemResolver,
  type ResolvedAddress,
  type Resolver,
} from "./ssrf";

export const MAX_REDIRECTS = 5;
export const TIMEOUT_MS = 8000;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface Hop {
  url: string;
  status: number;
  headers: IncomingHttpHeaders;
}

export interface FetchResult {
  hops: Hop[];
  final: Hop;
  finalUrl: string;
  redirectCount: number;
}

/** Performs a single request. Injectable so tests can simulate redirects without a network. */
export type Transport = (url: URL, addresses: ResolvedAddress[], deadline: number) => Promise<Hop>;

export interface FetchOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  resolver?: Resolver;
  transport?: Transport;
}

/**
 * Builds a `lookup` function that never touches DNS: it just returns the
 * addresses we validated earlier ("DNS pinning"). Node may call lookup with
 * `{ all: true }` (Happy Eyeballs), so both callback shapes are supported.
 */
export function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    if (options && options.all) {
      callback(null, addresses.map((a) => ({ address: a.address, family: a.family })));
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  }) as unknown as LookupFunction;
}

/** Maps low-level Node/TLS errors to our user-facing error codes. */
function toScanError(err: unknown): ScanError {
  if (err instanceof ScanError) return err;
  const code = (err as { code?: string })?.code ?? "";
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(code)) return new ScanError("tls_error");
  return new ScanError("connection_failed");
}

/** Rejects with `timeout` once the shared deadline passes. */
function withDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new ScanError("timeout"));
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ScanError("timeout")), remaining);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Performs one request (no redirect following) and returns status + headers only. */
const requestOnce: Transport = (url, addresses, deadline) => {
  return new Promise<Hop>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new ScanError("timeout"));

    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        agent: false, // fresh connection: no socket reuse between hosts
        lookup: pinnedLookup(addresses), // connect ONLY to the validated IPs
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WebsiteSecurityScanner/1.0)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
        // TLS certificates ARE verified (rejectUnauthorized defaults to true).
      },
      (res) => {
        clearTimeout(timer);
        const hop: Hop = { url: url.toString(), status: res.statusCode ?? 0, headers: res.headers };
        res.destroy(); // we only need headers; never download the body
        resolve(hop);
      },
    );

    const timer = setTimeout(() => req.destroy(new ScanError("timeout")), remaining);
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(toScanError(err));
    });
    req.end();
  });
};

/**
 * Fetches `startUrl`, following up to `maxRedirects` redirects manually.
 * Every hop is re-validated (scheme, port, credentials, DNS -> public IP).
 */
export async function safeFetch(startUrl: URL, options: FetchOptions = {}): Promise<FetchResult> {
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const resolver = options.resolver ?? systemResolver;
  const transport = options.transport ?? requestOnce;
  const deadline = Date.now() + (options.timeoutMs ?? TIMEOUT_MS);

  const hops: Hop[] = [];
  let current = new URL(startUrl.toString());

  for (;;) {
    // Re-check the URL itself on every hop (a redirect could point to file://, :22, user:pass@...).
    assertSafeUrl(current);
    // Re-resolve and re-check the IPs on every hop (a redirect could point to an internal host).
    const addresses = await withDeadline(resolvePublicAddresses(current.hostname, resolver), deadline);
    const hop = await transport(current, addresses, deadline);
    hops.push(hop);

    const location = hop.headers.location;
    if (!REDIRECT_STATUSES.has(hop.status) || !location) {
      return { hops, final: hop, finalUrl: hop.url, redirectCount: hops.length - 1 };
    }

    if (hops.length > maxRedirects) throw new ScanError("too_many_redirects");

    try {
      // Location may be relative ("/login"), so resolve it against the current URL.
      current = new URL(location, current);
    } catch {
      throw new ScanError("invalid_redirect");
    }
    current.hash = "";
  }
}
