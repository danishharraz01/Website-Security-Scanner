import { beforeEach, describe, expect, it } from "vitest";
import {
  CHECK_WEIGHTS,
  checkClickjacking,
  checkCookies,
  checkCsp,
  checkHsts,
  checkReferrer,
  checkServerLeak,
  toGrade,
} from "@/lib/checks";
import { RATE_LIMIT, rateLimit, resetRateLimit } from "@/lib/rateLimit";

describe("weights", () => {
  it("add up to 100", () => {
    expect(Object.values(CHECK_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("checkHsts", () => {
  it("passes with a long max-age", () => {
    expect(checkHsts({ "strict-transport-security": "max-age=63072000" }, true).status).toBe("pass");
  });
  it("warns below 6 months", () => {
    expect(checkHsts({ "strict-transport-security": "max-age=86400" }, true).status).toBe("warn");
  });
  it("fails when missing or not on https", () => {
    expect(checkHsts({}, true).status).toBe("fail");
    expect(checkHsts({ "strict-transport-security": "max-age=63072000" }, false).status).toBe("fail");
  });
});

describe("checkCsp", () => {
  it("passes a strict policy", () => {
    expect(checkCsp({ "content-security-policy": "default-src 'self'; object-src 'none'" }).status).toBe("pass");
  });
  it.each(["script-src 'self' 'unsafe-inline'", "default-src 'self' 'unsafe-eval'", "default-src *"])(
    "warns on %s",
    (policy) => {
      expect(checkCsp({ "content-security-policy": policy }).status).toBe("warn");
    },
  );
  it("fails when missing", () => {
    expect(checkCsp({}).status).toBe("fail");
  });
});

describe("checkClickjacking", () => {
  it("accepts X-Frame-Options or frame-ancestors", () => {
    expect(checkClickjacking({ "x-frame-options": "DENY" }).status).toBe("pass");
    expect(checkClickjacking({ "content-security-policy": "frame-ancestors 'none'" }).status).toBe("pass");
  });
  it("fails when missing", () => {
    expect(checkClickjacking({}).status).toBe("fail");
  });
});

describe("checkReferrer", () => {
  it("uses the last recognised value", () => {
    expect(checkReferrer({ "referrer-policy": "unsafe-url, strict-origin-when-cross-origin" }).status).toBe("pass");
    expect(checkReferrer({ "referrer-policy": "unsafe-url" }).status).toBe("warn");
  });
});

describe("checkCookies", () => {
  it("passes with no cookies or fully flagged cookies", () => {
    expect(checkCookies([], true).status).toBe("pass");
    expect(checkCookies(["sid=1; Secure; HttpOnly; SameSite=Lax"], true).status).toBe("pass");
  });
  it("fails when Secure is missing on https", () => {
    expect(checkCookies(["sid=1; HttpOnly; SameSite=Lax"], true).status).toBe("fail");
  });
  it("warns when HttpOnly or SameSite is missing", () => {
    expect(checkCookies(["sid=1; Secure"], true).status).toBe("warn");
  });
});

describe("checkServerLeak", () => {
  it("flags versions", () => {
    expect(checkServerLeak({ server: "nginx/1.25.3" }).status).toBe("fail");
    expect(checkServerLeak({ "x-powered-by": "PHP/8.2.1" }).status).toBe("fail");
  });
  it("tolerates a bare server name", () => {
    expect(checkServerLeak({ server: "cloudflare" }).status).toBe("pass");
  });
  it("warns on X-Powered-By without version", () => {
    expect(checkServerLeak({ "x-powered-by": "Express" }).status).toBe("warn");
  });
});

describe("toGrade", () => {
  it("maps score bands", () => {
    expect(toGrade(100)).toBe("A");
    expect(toGrade(85)).toBe("B");
    expect(toGrade(72)).toBe("C");
    expect(toGrade(60)).toBe("D");
    expect(toGrade(55)).toBe("E");
    expect(toGrade(10)).toBe("F");
  });
});

describe("rateLimit", () => {
  beforeEach(() => resetRateLimit());

  it(`allows ${RATE_LIMIT} requests per minute, then blocks`, () => {
    const now = 1_000_000;
    for (let i = 0; i < RATE_LIMIT; i++) expect(rateLimit("1.2.3.4", now + i).ok).toBe(true);
    const blocked = rateLimit("1.2.3.4", now + RATE_LIMIT);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    // A different IP is unaffected.
    expect(rateLimit("5.6.7.8", now).ok).toBe(true);
    // After the window passes, requests are allowed again.
    expect(rateLimit("1.2.3.4", now + 60_001).ok).toBe(true);
  });
});
