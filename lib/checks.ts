/**
 * Security header checks. Each check is a pure function of the response
 * data, which keeps them easy to test and reason about.
 *
 * Checks return a translation key (`detail`) plus params instead of text, so
 * the client can render them in Bahasa Melayu or English (see lib/i18n.ts).
 */
import type { IncomingHttpHeaders } from "node:http";

export type Status = "pass" | "warn" | "fail";

export type CheckId =
  | "https"
  | "httpRedirect"
  | "hsts"
  | "csp"
  | "clickjacking"
  | "nosniff"
  | "referrer"
  | "cookies"
  | "serverLeak";

/** Weights add up to 100, so the score is directly out of 100. */
export const CHECK_WEIGHTS: Record<CheckId, number> = {
  https: 20,
  httpRedirect: 10,
  hsts: 15,
  csp: 15,
  clickjacking: 10,
  nosniff: 10,
  referrer: 5,
  cookies: 10,
  serverLeak: 5,
};

export interface CheckResult {
  id: CheckId;
  status: Status;
  weight: number;
  earned: number;
  detail: string;
  params?: Record<string, string | number>;
  evidence?: string;
}

/** Outcome of probing http://host/ to see whether it upgrades to HTTPS. */
export type HttpProbe =
  | { kind: "direct" } // first response is a redirect straight to https://
  | { kind: "eventual" } // reaches https:// but only after extra http hops
  | { kind: "none" } // stays on plain http
  | { kind: "unreachable" }; // port 80 closed / timed out

/** 6 months, in seconds. Shorter HSTS policies get a warning. */
export const HSTS_MIN_MAX_AGE = 15552000;

const MAX_EVIDENCE = 300;

function evidence(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.length > MAX_EVIDENCE ? `${value.slice(0, MAX_EVIDENCE)}…` : value;
}

/** Node joins repeated headers with ", " except set-cookie (array). Normalise to a string. */
function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const v = headers[name];
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function result(
  id: CheckId,
  status: Status,
  detail: string,
  params?: Record<string, string | number>,
  ev?: string,
): CheckResult {
  const weight = CHECK_WEIGHTS[id];
  // Pass = full points, warn = half, fail = zero.
  const earned = status === "pass" ? weight : status === "warn" ? weight / 2 : 0;
  return { id, status, weight, earned, detail, params, evidence: evidence(ev) };
}

/** Parses a CSP string into a map of directive -> source list (lower-cased). */
export function parseCsp(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of policy.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    // Per spec, only the first occurrence of a directive counts.
    if (!map.has(name)) map.set(name, tokens.slice(1).map((t) => t.toLowerCase()));
  }
  return map;
}

export function checkHttps(finalUrl: string): CheckResult {
  return new URL(finalUrl).protocol === "https:"
    ? result("https", "pass", "pass", undefined, finalUrl)
    : result("https", "fail", "fail", undefined, finalUrl);
}

export function checkHttpRedirect(probe: HttpProbe): CheckResult {
  switch (probe.kind) {
    case "direct":
      return result("httpRedirect", "pass", "direct");
    case "eventual":
      return result("httpRedirect", "warn", "eventual");
    case "unreachable":
      return result("httpRedirect", "warn", "unreachable");
    default:
      return result("httpRedirect", "fail", "none");
  }
}

export function checkHsts(headers: IncomingHttpHeaders, isHttps: boolean): CheckResult {
  // Browsers ignore HSTS sent over plain HTTP, so it only counts on HTTPS.
  if (!isHttps) return result("hsts", "fail", "notHttps");
  const value = header(headers, "strict-transport-security");
  if (!value) return result("hsts", "fail", "missing");

  const match = /max-age\s*=\s*"?(\d+)"?/i.exec(value);
  if (!match) return result("hsts", "fail", "invalid", undefined, value);
  const maxAge = Number(match[1]);
  const days = Math.floor(maxAge / 86400);
  if (maxAge === 0) return result("hsts", "fail", "zero", undefined, value);
  if (maxAge < HSTS_MIN_MAX_AGE) return result("hsts", "warn", "short", { days }, value);
  return result("hsts", "pass", "pass", { days }, value);
}

export function checkCsp(headers: IncomingHttpHeaders): CheckResult {
  const value = header(headers, "content-security-policy");
  if (!value) {
    const reportOnly = header(headers, "content-security-policy-report-only");
    return reportOnly
      ? result("csp", "warn", "reportOnly", undefined, reportOnly)
      : result("csp", "fail", "missing");
  }

  const directives = parseCsp(value);
  // The directive that actually governs scripts: script-src, falling back to default-src.
  const scriptSources = directives.get("script-src") ?? directives.get("default-src");
  const issues: string[] = [];

  if (!scriptSources) {
    issues.push("no script-src/default-src");
  } else {
    if (scriptSources.includes("'unsafe-inline'")) issues.push("'unsafe-inline'");
    if (scriptSources.includes("'unsafe-eval'")) issues.push("'unsafe-eval'");
    if (scriptSources.includes("*")) issues.push("*");
  }
  // A bare wildcard anywhere (e.g. "default-src *", "connect-src *") is also flagged.
  if (!issues.includes("*")) {
    for (const sources of directives.values()) {
      if (sources.includes("*")) {
        issues.push("*");
        break;
      }
    }
  }

  return issues.length > 0
    ? result("csp", "warn", "weak", { issues: issues.join(", ") }, value)
    : result("csp", "pass", "pass", undefined, value);
}

export function checkClickjacking(headers: IncomingHttpHeaders): CheckResult {
  const csp = header(headers, "content-security-policy");
  const frameAncestors = csp ? parseCsp(csp).get("frame-ancestors") : undefined;
  if (frameAncestors) {
    // frame-ancestors overrides X-Frame-Options in modern browsers.
    const shown = `frame-ancestors ${frameAncestors.join(" ")}`;
    if (frameAncestors.includes("*")) return result("clickjacking", "fail", "frameAncestorsWildcard", undefined, shown);
    return result("clickjacking", "pass", "frameAncestors", undefined, shown);
  }

  const xfo = header(headers, "x-frame-options");
  if (!xfo) return result("clickjacking", "fail", "missing");
  const normalised = xfo.trim().toUpperCase();
  if (normalised === "DENY" || normalised === "SAMEORIGIN") {
    return result("clickjacking", "pass", "xfo", { value: normalised }, xfo);
  }
  if (normalised.startsWith("ALLOW-FROM")) return result("clickjacking", "warn", "allowFrom", undefined, xfo);
  return result("clickjacking", "warn", "invalid", undefined, xfo);
}

export function checkNosniff(headers: IncomingHttpHeaders): CheckResult {
  const value = header(headers, "x-content-type-options");
  if (!value) return result("nosniff", "fail", "missing");
  return value.trim().toLowerCase() === "nosniff"
    ? result("nosniff", "pass", "pass", undefined, value)
    : result("nosniff", "fail", "invalid", undefined, value);
}

const STRICT_REFERRER = new Set([
  "no-referrer",
  "same-origin",
  "strict-origin",
  "strict-origin-when-cross-origin",
]);
const WEAK_REFERRER = new Set(["no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "unsafe-url"]);

export function checkReferrer(headers: IncomingHttpHeaders): CheckResult {
  const value = header(headers, "referrer-policy");
  if (!value) return result("referrer", "warn", "missing");
  // The header may list fallbacks; browsers use the LAST value they understand.
  const tokens = value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const effective = [...tokens].reverse().find((t) => STRICT_REFERRER.has(t) || WEAK_REFERRER.has(t));
  if (!effective) return result("referrer", "warn", "invalid", undefined, value);
  return STRICT_REFERRER.has(effective)
    ? result("referrer", "pass", "strict", { value: effective }, value)
    : result("referrer", "warn", "weak", { value: effective }, value);
}

interface ParsedCookie {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
}

export function parseSetCookie(raw: string): ParsedCookie {
  const [pair, ...attrs] = raw.split(";");
  const name = (pair.split("=")[0] ?? "").trim().slice(0, 40) || "(unnamed)";
  let secure = false;
  let httpOnly = false;
  let sameSite: string | null = null;
  for (const attr of attrs) {
    const [k, v] = attr.split("=").map((s) => s.trim());
    const key = k.toLowerCase();
    if (key === "secure") secure = true;
    else if (key === "httponly") httpOnly = true;
    else if (key === "samesite") sameSite = (v ?? "").toLowerCase();
  }
  return { name, secure, httpOnly, sameSite };
}

const MAX_NAMES = 5;
function listNames(names: string[]): string {
  const unique = [...new Set(names)];
  return unique.length > MAX_NAMES
    ? `${unique.slice(0, MAX_NAMES).join(", ")} (+${unique.length - MAX_NAMES})`
    : unique.join(", ");
}

export function checkCookies(setCookies: string[], isHttps: boolean): CheckResult {
  if (setCookies.length === 0) return result("cookies", "pass", "none");
  const cookies = setCookies.map(parseSetCookie);

  // Missing Secure (on an HTTPS site) or SameSite=None without Secure lets the
  // cookie leak over plain HTTP: treated as a failure.
  const insecure = cookies.filter((c) => (isHttps && !c.secure) || (c.sameSite === "none" && !c.secure));
  if (insecure.length > 0) {
    return result("cookies", "fail", "missingSecure", { names: listNames(insecure.map((c) => c.name)) }, setCookies.join("\n"));
  }

  const missing: string[] = [];
  for (const c of cookies) {
    const flags: string[] = [];
    if (!c.httpOnly) flags.push("HttpOnly");
    if (!c.sameSite) flags.push("SameSite");
    if (flags.length > 0) missing.push(`${c.name} (${flags.join(", ")})`);
  }
  if (missing.length > 0) {
    return result("cookies", "warn", "missingOther", { names: listNames(missing) }, setCookies.join("\n"));
  }
  return result("cookies", "pass", "allGood", { count: cookies.length }, setCookies.join("\n"));
}

/** Headers that commonly reveal the server software. */
const LEAK_HEADERS = ["server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version", "x-generator"];

export function checkServerLeak(headers: IncomingHttpHeaders): CheckResult {
  const found: string[] = [];
  let hasVersion = false;
  for (const name of LEAK_HEADERS) {
    const value = header(headers, name);
    if (!value) continue;
    found.push(`${name}: ${value}`);
    // A digit next to a dot or slash looks like a version number (nginx/1.25.3, PHP/8.2).
    if (/\d+(\.\d+)+|\/\s*\d/.test(value) || name.startsWith("x-aspnet")) hasVersion = true;
  }
  const shown = found.join("\n");
  if (hasVersion) return result("serverLeak", "fail", "version", undefined, shown);
  if (header(headers, "x-powered-by")) return result("serverLeak", "warn", "poweredBy", undefined, shown);
  if (found.length > 0) return result("serverLeak", "pass", "noVersion", undefined, shown);
  return result("serverLeak", "pass", "none");
}

export type Grade = "A" | "B" | "C" | "D" | "E" | "F";

export function toGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  if (score >= 50) return "E";
  return "F";
}
