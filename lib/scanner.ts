/**
 * Runs a full scan: fetches the target (safely), probes HTTP->HTTPS upgrade,
 * runs every check and computes the score and grade.
 */
import {
  checkClickjacking,
  checkCookies,
  checkCsp,
  checkHsts,
  checkHttpRedirect,
  checkHttps,
  checkNosniff,
  checkReferrer,
  checkServerLeak,
  toGrade,
  type CheckResult,
  type Grade,
  type HttpProbe,
} from "./checks";
import { safeFetch, type FetchResult } from "./fetcher";
import { stripBrackets } from "./ssrf";

export interface ScanReport {
  inputUrl: string;
  finalUrl: string;
  redirectCount: number;
  statusCode: number;
  score: number;
  grade: Grade;
  checks: CheckResult[];
  scannedAt: string;
  durationMs: number;
}

/**
 * Requests http://<host>/ and classifies how (or whether) it upgrades to HTTPS.
 * Goes through the same safeFetch, so it gets exactly the same SSRF protection.
 */
async function probeHttp(hostname: string): Promise<HttpProbe> {
  const host = hostname.includes(":") ? `[${hostname}]` : hostname; // IPv6 literal
  let res: FetchResult;
  try {
    res = await safeFetch(new URL(`http://${host}/`));
  } catch {
    return { kind: "unreachable" };
  }
  const first = res.hops[0];
  const location = first.headers.location;
  if (location) {
    try {
      if (new URL(location, first.url).protocol === "https:") return { kind: "direct" };
    } catch {
      // invalid Location header: fall through
    }
  }
  return new URL(res.finalUrl).protocol === "https:" ? { kind: "eventual" } : { kind: "none" };
}

export async function runScan(url: URL): Promise<ScanReport> {
  const started = Date.now();

  // Main fetch and the HTTP probe run in parallel to keep the scan fast.
  // Errors from the main fetch (blocked IP, timeout, ...) propagate to the caller.
  const [main, probe] = await Promise.all([safeFetch(url), probeHttp(stripBrackets(url.hostname))]);

  const headers = main.final.headers;
  const isHttps = new URL(main.finalUrl).protocol === "https:";

  // Cookies set on ANY hop (including redirects) end up in the browser, so check them all.
  const setCookies = main.hops.flatMap((h) => h.headers["set-cookie"] ?? []);

  const checks: CheckResult[] = [
    checkHttps(main.finalUrl),
    checkHttpRedirect(probe),
    checkHsts(headers, isHttps),
    checkCsp(headers),
    checkClickjacking(headers),
    checkNosniff(headers),
    checkReferrer(headers),
    checkCookies(setCookies, isHttps),
    checkServerLeak(headers),
  ];

  const score = Math.round(checks.reduce((sum, c) => sum + c.earned, 0));

  return {
    inputUrl: url.toString(),
    finalUrl: main.finalUrl,
    redirectCount: main.redirectCount,
    statusCode: main.final.status,
    score,
    grade: toGrade(score),
    checks,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
}
