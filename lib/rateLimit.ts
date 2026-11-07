/**
 * Simple in-memory sliding-window rate limiter: 10 scans per minute per IP.
 *
 * Why: every scan makes our server send outbound requests. Without a limit,
 * someone could use this app to hammer a third-party site or burn through
 * the free hosting quota.
 *
 * Limitation: memory is per server instance. On Vercel several instances may
 * run at once, so this is best-effort. See README roadmap (shared store such
 * as a free-tier Redis).
 */
export const RATE_LIMIT = 10;
export const RATE_WINDOW_MS = 60_000;
/** Hard cap on tracked IPs so the map itself cannot be used to exhaust memory. */
const MAX_TRACKED_IPS = 10_000;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

function prune(now: number): void {
  for (const [ip, times] of hits) {
    if (times.length === 0 || now - times[times.length - 1] >= RATE_WINDOW_MS) hits.delete(ip);
  }
}

export function rateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  if (hits.size >= MAX_TRACKED_IPS && !hits.has(ip)) {
    prune(now);
    if (hits.size >= MAX_TRACKED_IPS) {
      // Still full after pruning: fail closed rather than grow without bound.
      return { ok: false, remaining: 0, retryAfterSec: Math.ceil(RATE_WINDOW_MS / 1000) };
    }
  }

  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + RATE_WINDOW_MS - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }
  recent.push(now);
  hits.set(ip, recent);
  return { ok: true, remaining: RATE_LIMIT - recent.length, retryAfterSec: 0 };
}

/** Test helper. */
export function resetRateLimit(): void {
  hits.clear();
}

/**
 * Best-effort client IP. On Vercel, `x-real-ip` / `x-forwarded-for` are set by
 * Vercel's edge and cannot be spoofed by the client. If you self-host behind
 * another proxy, make sure it overwrites these headers, otherwise a client
 * could send a fake value to dodge the limit.
 */
export function getClientIp(headers: Headers): string {
  const real = headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return "unknown";
}
