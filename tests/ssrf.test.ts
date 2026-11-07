import { describe, expect, it } from "vitest";
import {
  isPublicIp,
  parseUserUrl,
  resolvePublicAddresses,
  ScanError,
  type Resolver,
} from "@/lib/ssrf";
import { pinnedLookup, safeFetch, type Transport } from "@/lib/fetcher";

/** Asserts that `fn` throws a ScanError with the given code. */
function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ScanError);
    expect((err as ScanError).code).toBe(code);
    return;
  }
  throw new Error(`expected ScanError(${code}) but nothing was thrown`);
}

async function expectCodeAsync(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ScanError);
  await expect(promise).rejects.toMatchObject({ code });
}

const fakeResolver =
  (answers: Record<string, string[]>): Resolver =>
  async (host) => {
    const ips = answers[host];
    if (!ips) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };

describe("isPublicIp", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8", // IPv4-mapped public address is fine
  ])("allows public address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  it.each([
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback range"],
    ["0.0.0.0", "unspecified (routes to localhost on Linux)"],
    ["10.0.0.1", "private 10/8"],
    ["172.16.0.1", "private 172.16/12"],
    ["172.31.255.255", "private 172.16/12 upper end"],
    ["192.168.1.1", "private 192.168/16"],
    ["169.254.169.254", "link-local / cloud metadata"],
    ["100.64.0.1", "carrier-grade NAT"],
    ["192.0.2.1", "documentation TEST-NET-1"],
    ["198.51.100.1", "documentation TEST-NET-2"],
    ["203.0.113.1", "documentation TEST-NET-3"],
    ["224.0.0.1", "multicast"],
    ["240.0.0.1", "reserved"],
    ["255.255.255.255", "broadcast"],
    ["::1", "IPv6 loopback"],
    ["::", "IPv6 unspecified"],
    ["fe80::1", "IPv6 link-local"],
    ["fe80::1%eth0", "IPv6 link-local with zone id"],
    ["fc00::1", "IPv6 unique local"],
    ["fd12:3456::1", "IPv6 unique local"],
    ["ff02::1", "IPv6 multicast"],
    ["2001:db8::1", "IPv6 documentation"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
    ["::ffff:7f00:1", "IPv4-mapped loopback (hex form)"],
    ["::ffff:169.254.169.254", "IPv4-mapped metadata"],
    ["::ffff:10.0.0.1", "IPv4-mapped private"],
    ["::127.0.0.1", "deprecated IPv4-compatible loopback"],
    ["64:ff9b::7f00:1", "NAT64 wrapping 127.0.0.1"],
    ["2002:7f00:1::", "6to4 wrapping 127.0.0.1"],
    ["not-an-ip", "garbage"],
    ["", "empty"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });
});

describe("parseUserUrl", () => {
  it("accepts a normal https URL", () => {
    expect(parseUserUrl("https://example.com/path").toString()).toBe("https://example.com/path");
  });

  it("adds https:// when the scheme is missing", () => {
    expect(parseUserUrl("example.com").toString()).toBe("https://example.com/");
  });

  it("trims whitespace and drops the fragment", () => {
    expect(parseUserUrl("  https://example.com/#frag  ").toString()).toBe("https://example.com/");
  });

  it("allows explicit ports 80 and 443", () => {
    expect(() => parseUserUrl("http://example.com:80/")).not.toThrow();
    expect(() => parseUserUrl("https://example.com:443/")).not.toThrow();
  });

  it.each([
    ["file:///etc/passwd", "bad_protocol"],
    ["ftp://example.com/", "bad_protocol"],
    ["gopher://example.com/", "bad_protocol"],
    ["ws://example.com/", "bad_protocol"],
    ["https://example.com:8080/", "bad_port"],
    ["http://example.com:22/", "bad_port"],
    ["localhost:6379", "bad_port"],
    ["https://user:pass@example.com/", "credentials"],
    ["https://admin@example.com/", "credentials"],
    ["https://example.com@169.254.169.254/", "credentials"],
    ["", "invalid_url"],
    ["   ", "invalid_url"],
    ["https://", "invalid_url"],
    ["https://exa mple.com", "invalid_url"],
    ["https://exa\nmple.com/", "invalid_url"],
    ["https://example.com/a\tb", "invalid_url"],
    [`https://example.com/${"a".repeat(2100)}`, "url_too_long"],
  ])("rejects %s with %s", (input, code) => {
    expectCode(() => parseUserUrl(input), code);
  });

  it("rejects non-string input", () => {
    expectCode(() => parseUserUrl(123), "invalid_url");
    expectCode(() => parseUserUrl(null), "invalid_url");
    expectCode(() => parseUserUrl({ url: "x" }), "invalid_url");
  });

  it("normalises obfuscated IPv4 forms so they can be checked", () => {
    // The WHATWG URL parser turns all of these into 127.0.0.1.
    for (const input of ["http://2130706433/", "http://0x7f000001/", "http://0177.0.0.1/", "http://127.1/"]) {
      expect(parseUserUrl(input).hostname).toBe("127.0.0.1");
    }
  });
});

describe("resolvePublicAddresses", () => {
  const resolver = fakeResolver({
    "example.com": ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"],
    "internal.example": ["10.0.0.5"],
    "mixed.example": ["93.184.216.34", "127.0.0.1"],
    "mapped.example": ["::ffff:127.0.0.1"],
    "metadata.example": ["169.254.169.254"],
    "empty.example": [],
  });

  it("returns addresses when all are public", async () => {
    const result = await resolvePublicAddresses("example.com", resolver);
    expect(result).toHaveLength(2);
  });

  it("blocks a hostname resolving to a private IP", async () => {
    await expectCodeAsync(resolvePublicAddresses("internal.example", resolver), "blocked_ip");
  });

  it("blocks when ANY record is private (mixed public + loopback)", async () => {
    await expectCodeAsync(resolvePublicAddresses("mixed.example", resolver), "blocked_ip");
  });

  it("blocks IPv4-mapped IPv6 DNS answers", async () => {
    await expectCodeAsync(resolvePublicAddresses("mapped.example", resolver), "blocked_ip");
  });

  it("blocks the cloud metadata address via DNS", async () => {
    await expectCodeAsync(resolvePublicAddresses("metadata.example", resolver), "blocked_ip");
  });

  it("blocks IP literals without asking DNS", async () => {
    const neverCalled: Resolver = async () => {
      throw new Error("resolver should not be called for IP literals");
    };
    await expectCodeAsync(resolvePublicAddresses("127.0.0.1", neverCalled), "blocked_ip");
    await expectCodeAsync(resolvePublicAddresses("[::1]", neverCalled), "blocked_ip");
    await expectCodeAsync(resolvePublicAddresses("[::ffff:7f00:1]", neverCalled), "blocked_ip");
  });

  it("reports dns_failed for unknown or empty answers", async () => {
    await expectCodeAsync(resolvePublicAddresses("nope.example", resolver), "dns_failed");
    await expectCodeAsync(resolvePublicAddresses("empty.example", resolver), "dns_failed");
  });
});

describe("safeFetch", () => {
  it("refuses to connect when DNS points at a private address", async () => {
    const resolver = fakeResolver({ "evil.example": ["192.168.0.1"] });
    await expectCodeAsync(safeFetch(new URL("http://evil.example/"), { resolver }), "blocked_ip");
  });

  it("refuses IP-literal loopback and metadata URLs", async () => {
    await expectCodeAsync(safeFetch(new URL("http://127.0.0.1/")), "blocked_ip");
    await expectCodeAsync(safeFetch(new URL("http://169.254.169.254/latest/meta-data/")), "blocked_ip");
    await expectCodeAsync(safeFetch(new URL("http://[::ffff:127.0.0.1]/")), "blocked_ip");
  });

  it("re-validates scheme and port on URLs it is asked to fetch", async () => {
    await expectCodeAsync(safeFetch(new URL("file:///etc/passwd")), "bad_protocol");
    await expectCodeAsync(safeFetch(new URL("http://example.com:6379/")), "bad_port");
  });
});

describe("safeFetch redirect handling (simulated network)", () => {
  const resolver = fakeResolver({
    "public.example": ["93.184.216.34"],
    "other.example": ["93.184.216.35"],
    "internal.example": ["10.1.2.3"],
  });

  /** Fake transport: answers each URL from a table, records what it was asked to connect to. */
  function fakeTransport(routes: Record<string, { status: number; location?: string }>) {
    const calls: { url: string; addresses: string[] }[] = [];
    const transport: Transport = async (url, addresses) => {
      calls.push({ url: url.toString(), addresses: addresses.map((a) => a.address) });
      const route = routes[url.toString()] ?? { status: 200 };
      return { url: url.toString(), status: route.status, headers: route.location ? { location: route.location } : {} };
    };
    return { transport, calls };
  }

  it.each([
    ["http://169.254.169.254/latest/meta-data/", "blocked_ip"],
    ["http://127.0.0.1/", "blocked_ip"],
    ["http://[::1]/", "blocked_ip"],
    ["http://[::ffff:10.0.0.1]/", "blocked_ip"],
    ["http://internal.example/", "blocked_ip"],
    ["file:///etc/passwd", "bad_protocol"],
    ["gopher://public.example/", "bad_protocol"],
    ["http://public.example:22/", "bad_port"],
    ["https://user:pw@public.example/", "credentials"],
  ])("blocks a public site redirecting to %s", async (location, code) => {
    const { transport, calls } = fakeTransport({ "https://public.example/": { status: 302, location } });
    await expectCodeAsync(safeFetch(new URL("https://public.example/"), { resolver, transport }), code);
    // Only the first (public) hop was ever requested.
    expect(calls).toHaveLength(1);
  });

  it("follows relative and cross-host redirects to public hosts", async () => {
    const { transport, calls } = fakeTransport({
      "http://public.example/": { status: 301, location: "https://public.example/" },
      "https://public.example/": { status: 302, location: "/home" },
      "https://public.example/home": { status: 307, location: "https://other.example/x#frag" },
    });
    const res = await safeFetch(new URL("http://public.example/"), { resolver, transport });
    expect(res.finalUrl).toBe("https://other.example/x");
    expect(res.redirectCount).toBe(3);
    expect(calls.map((c) => c.url)).toEqual([
      "http://public.example/",
      "https://public.example/",
      "https://public.example/home",
      "https://other.example/x",
    ]);
  });

  it("allows exactly 5 redirects and rejects the 6th", async () => {
    const chain = (n: number) =>
      Object.fromEntries(
        Array.from({ length: n }, (_, i) => [`https://public.example/${i}`, { status: 302, location: `/${i + 1}` }]),
      );
    const ok = await safeFetch(new URL("https://public.example/0"), { resolver, transport: fakeTransport(chain(5)).transport });
    expect(ok.redirectCount).toBe(5);
    await expectCodeAsync(
      safeFetch(new URL("https://public.example/0"), { resolver, transport: fakeTransport(chain(6)).transport }),
      "too_many_redirects",
    );
  });

  it("connects only to the addresses that passed validation (DNS pinning)", async () => {
    // Simulated DNS rebinding: first answer is public, any later answer is loopback.
    let lookups = 0;
    const rebinding: Resolver = async () => {
      lookups++;
      return [{ address: lookups === 1 ? "93.184.216.34" : "127.0.0.1", family: 4 }];
    };
    const { transport, calls } = fakeTransport({});
    await safeFetch(new URL("https://rebind.example/"), { resolver: rebinding, transport });
    expect(lookups).toBe(1);
    expect(calls[0].addresses).toEqual(["93.184.216.34"]);
  });

  it("times out when the deadline passes", async () => {
    const slow: Transport = () => new Promise(() => {}); // never answers
    const slowResolver: Resolver = () => new Promise(() => {});
    await expectCodeAsync(safeFetch(new URL("https://slow.example/"), { resolver: slowResolver, transport: slow, timeoutMs: 50 }), "timeout");
  });
});

describe("pinnedLookup", () => {
  const addrs = [
    { address: "93.184.216.34", family: 4 as const },
    { address: "2606:2800:220:1::1", family: 6 as const },
  ];

  it("returns all pinned addresses when Node asks for all (Happy Eyeballs)", () =>
    new Promise<void>((done) => {
      const lookup = pinnedLookup(addrs) as unknown as (h: string, o: object, cb: (...a: unknown[]) => void) => void;
      lookup("anything.example", { all: true }, (err, list) => {
        expect(err).toBeNull();
        expect(list).toEqual(addrs);
        done();
      });
    }));

  it("returns the first pinned address otherwise, ignoring the hostname", () =>
    new Promise<void>((done) => {
      const lookup = pinnedLookup(addrs) as unknown as (h: string, o: object, cb: (...a: unknown[]) => void) => void;
      lookup("attacker-controlled.example", {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe("93.184.216.34");
        expect(family).toBe(4);
        done();
      });
    }));
});
