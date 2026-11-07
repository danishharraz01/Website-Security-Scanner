import { NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { MAX_URL_LENGTH, parseUserUrl, ScanError, type ScanErrorCode } from "@/lib/ssrf";

// Needs Node.js APIs (node:http, node:dns), so not the Edge runtime.
export const runtime = "nodejs";
// Every scan is live; never cache responses.
export const dynamic = "force-dynamic";
// 8s fetch budget (main fetch and HTTP probe run in parallel) plus headroom.
export const maxDuration = 20;

/** Request bodies are tiny ({"url": "..."}); anything bigger is rejected before parsing. */
const MAX_BODY_BYTES = MAX_URL_LENGTH + 512;

const STATUS_FOR: Partial<Record<ScanErrorCode, number>> = {
  rate_limited: 429,
  bad_request: 400,
  invalid_url: 400,
  url_too_long: 400,
  bad_protocol: 400,
  bad_port: 400,
  credentials: 400,
  blocked_ip: 400,
  timeout: 504,
  internal: 500,
};

function errorResponse(code: ScanErrorCode, headers?: Record<string, string>) {
  return NextResponse.json(
    { error: code },
    { status: STATUS_FOR[code] ?? 502, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export async function POST(request: Request) {
  // 1. Rate limit first, before doing any work.
  const limit = rateLimit(getClientIp(request.headers));
  if (!limit.ok) {
    return errorResponse("rate_limited", { "Retry-After": String(limit.retryAfterSec) });
  }

  // 2. Input validation: body size, JSON shape, then URL rules.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return errorResponse("bad_request");

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return errorResponse("bad_request");
    body = JSON.parse(text);
  } catch {
    return errorResponse("bad_request");
  }
  if (typeof body !== "object" || body === null || !("url" in body)) {
    return errorResponse("bad_request");
  }

  try {
    const url = parseUserUrl((body as { url: unknown }).url);
    // 3. Scan. All SSRF checks happen inside (lib/ssrf.ts and lib/fetcher.ts).
    const report = await runScan(url);
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ScanError) return errorResponse(err.code);
    // Unexpected error: log it server-side, but never leak internals to the client.
    console.error("scan failed", err);
    return errorResponse("internal");
  }
}
