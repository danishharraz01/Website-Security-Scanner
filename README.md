<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo.png">
    <img src="public/logo-light.png" alt="SiteSentinel" width="420">
  </picture>
</p>

# SiteSentinel

**Know Your Website. Secure Your Digital Presence.**

A bilingual (Bahasa Melayu / English) web app that checks a website's HTTP security configuration and gives it a grade from **A to F** with a score out of 100.

Enter a URL. The server fetches it safely, inspects the response headers and cookies, and explains every finding with a fix tip.

Built with **Next.js (App Router)**, **TypeScript** and **Node.js**. No paid services. It runs on the Vercel free (Hobby) plan.

> ⚠️ **Disclaimer:** Only scan websites you own or have explicit permission to test. This tool sends ordinary HTTP requests, but scanning systems without permission may break laws or terms of service where you live. You are responsible for how you use it.

---

## Features

- Grade A–F and a score out of 100, weighted per check
- 9 security checks, each with a pass / warn / fail status, an explanation and a fix tip
- Results page with a large grade badge, final URL, redirect count, HTTP status and colour-coded checks (green / yellow / red)
- Full **BM / EN** interface with a header toggle. The choice is saved in `localStorage`, and BM is the default
- Hardened against **SSRF**, with DNS pinning, per-hop redirect validation, a timeout and rate limiting
- The app sends strong security headers itself, so it scores well when it scans itself
- Unit tests (Vitest) and a GitHub Actions CI pipeline (lint → typecheck → test → build)

## Checks and scoring

Pass = full points, warn = half, fail = 0. The weights add up to 100.

| Check | Weight | Pass | Warn | Fail |
|---|---:|---|---|---|
| Uses HTTPS | 20 | Final page served over `https://` | | Final page is plain `http://` |
| HTTP → HTTPS redirect | 10 | `http://host/` redirects straight to `https://` | Reaches HTTPS only after extra HTTP hops, or port 80 unreachable | Stays on HTTP |
| Strict-Transport-Security | 15 | `max-age` ≥ 6 months (15552000 s) | `max-age` < 6 months | Missing, invalid, `max-age=0`, or site not on HTTPS |
| Content-Security-Policy | 15 | Present, no risky script sources | Contains `'unsafe-inline'` / `'unsafe-eval'` in the script policy, a bare `*`, or is Report-Only | Missing |
| Clickjacking protection | 10 | `X-Frame-Options: DENY/SAMEORIGIN` or CSP `frame-ancestors` | Obsolete `ALLOW-FROM` or invalid value | Missing, or `frame-ancestors *` |
| X-Content-Type-Options | 10 | `nosniff` | | Missing or other value |
| Referrer-Policy | 5 | `no-referrer`, `same-origin`, `strict-origin`, `strict-origin-when-cross-origin` | Missing, or a leaky policy (`unsafe-url`, `origin`, …) | |
| Cookie flags | 10 | No cookies, or every cookie has `Secure`, `HttpOnly`, `SameSite` | Missing `HttpOnly` or `SameSite` | Missing `Secure` on HTTPS, or `SameSite=None` without `Secure` |
| Server / X-Powered-By leak | 5 | No leak, or a server name without a version | `X-Powered-By` present (no version) | Version numbers exposed (`nginx/1.25.3`, `PHP/8.2`, `X-AspNet-Version`, …) |

**Grades:** A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · E ≥ 50 · F < 50

Cookies are collected from **every** response in the redirect chain, because cookies set on a redirect still reach the browser.

## How SSRF is blocked

A scanner is an SSRF machine by design: strangers give it a URL and the **server** fetches it. Without protection, someone could make it request `http://169.254.169.254/` (cloud metadata and credentials), `http://localhost:…` or hosts on the private network. Defences live in [`lib/ssrf.ts`](lib/ssrf.ts) and [`lib/fetcher.ts`](lib/fetcher.ts):

1. **Input validation.** At most 2048 characters, no control characters or whitespace, and it must parse as a URL. The request body is size-capped before JSON parsing.
2. **Scheme allow-list.** Only `http:` and `https:` are allowed, so `file:`, `gopher:`, `ftp:`, `data:` and similar schemes are rejected.
3. **Port allow-list.** Only 80 and 443 are allowed, which blocks probes of internal services (`:22`, `:6379`, `:8080`, …).
4. **No credentials in URLs.** `user:pass@host` is rejected. This also defeats tricks like `https://good.com@evil.com`.
5. **DNS resolution and an IP allow-list.** Every A/AAAA record is resolved with [`ipaddr.js`](https://github.com/whitequark/ipaddr.js), and **all** of them must be in the `unicast` (public) range. Any private, loopback, link-local, CGNAT, multicast, broadcast, reserved, documentation, unique-local, 6to4, Teredo or NAT64 address causes a rejection. Because this is an allow-list, new special-purpose ranges fail closed.
6. **IPv4-mapped IPv6.** Addresses like `::ffff:127.0.0.1` are unwrapped and checked as IPv4. The deprecated IPv4-compatible form `::127.0.0.1` is rejected outright.
7. **DNS pinning.** Requests use `node:http(s)` with a custom `lookup` that returns **only the addresses that were just validated**. There is no second DNS query for an attacker to rebind. TLS still verifies the certificate against the real hostname (SNI).
8. **Manual redirects.** Redirects are never followed automatically. Every `Location` is resolved and then re-validated through steps 2–7 before it is requested. There are at most **5 redirects**.
9. **Timeout.** One **8-second** deadline covers DNS, connection and every hop. Only headers are read, and the body is never downloaded.
10. **Rate limit.** **10 scans per minute per IP**, using an in-memory sliding window.

Obfuscated IPv4 spellings (`2130706433`, `0x7f000001`, `0177.0.0.1`, `127.1`) are normalised to `127.0.0.1` by the WHATWG URL parser before the IP check runs.

## Tested attacks

Every row below is covered by an automated test in [`tests/ssrf.test.ts`](tests/ssrf.test.ts). Rows marked † were also checked by hand against the running production build (`next start`) through `POST /api/scan`.

| Attack | Example input | Result |
|---|---|---|
| Loopback † | `http://127.0.0.1`, `http://localhost` | `blocked_ip` |
| Cloud metadata † | `http://169.254.169.254/latest/meta-data/` | `blocked_ip` |
| Private networks † | `http://10.0.0.1`, `172.16.0.1`, `192.168.1.1` | `blocked_ip` |
| IPv6 loopback / link-local / ULA | `http://[::1]`, `fe80::1`, `fc00::1` | `blocked_ip` |
| IPv4-mapped IPv6 † | `http://[::ffff:127.0.0.1]/`, `::ffff:7f00:1` | `blocked_ip` |
| IPv4-compatible / NAT64 / 6to4 | `::127.0.0.1`, `64:ff9b::7f00:1`, `2002:7f00:1::` | `blocked_ip` |
| Decimal / hex / octal IP † | `http://2130706433`, `0x7f000001`, `0177.0.0.1` | normalised, then `blocked_ip` |
| `0.0.0.0` | `http://0.0.0.0` | `blocked_ip` |
| CGNAT / reserved / multicast | `100.64.0.1`, `240.0.0.1`, `224.0.0.1` | `blocked_ip` |
| Hostname resolving to private IP | `internal.example → 10.1.2.3` | `blocked_ip` |
| Mixed DNS answer | `→ [93.184.216.34, 127.0.0.1]` | `blocked_ip` (all records must be public) |
| Open redirect to metadata / loopback | public site `302 → http://169.254.169.254/` | `blocked_ip`, internal hop never requested |
| Redirect to another scheme | `302 → file:///etc/passwd`, `gopher://…` | `bad_protocol` |
| Redirect to another port | `302 → http://host:22/` | `bad_port` |
| DNS rebinding | 1st answer public, later answers `127.0.0.1` | Only one lookup; socket connects to the validated IP |
| Redirect loop / chain † | 6+ redirects | `too_many_redirects` |
| Non-http schemes † | `file:///etc/passwd`, `ftp://`, `ws://` | `bad_protocol` |
| Non-standard ports † | `https://example.com:8080`, `localhost:6379` | `bad_port` |
| Credentials in URL † | `https://a:b@example.com`, `https://good.com@169.254.169.254` | `credentials` |
| Oversized input | URL > 2048 chars, oversized body | `url_too_long` / `bad_request` |
| Slow server | No response | `timeout` after 8 s |
| Flooding † | 11 requests in a minute from one IP | `429 rate_limited` |
| Invalid TLS † | `https://self-signed.badssl.com/` | `tls_error` |

## Known limitations

- **DNS rebinding, residual risk.** DNS rebinding means a hostile DNS server answers a public IP during validation and an internal IP when the request is made. Pinning the validated IPs into the socket (step 7) removes this time-of-check/time-of-use gap for our own connection. Some risk remains outside our code: if the hosting platform routes outbound traffic through a proxy that resolves DNS again, or if an internal service is reachable on a *public* IP, pinning cannot help. In production, add network-level egress rules (deny private ranges) as a second layer.
- **Rate limiting is per instance.** The limiter is in memory. On Vercel, several serverless instances can run at once and each has its own counter, and cold starts reset it. Treat it as best-effort until a shared store is added (see roadmap).
- **Client IP.** The rate limiter trusts `x-real-ip` / `x-forwarded-for`. Vercel sets these at its edge, so clients cannot spoof them there. If you self-host behind a different proxy, make sure the proxy overwrites them.
- **This app's own CSP uses `script-src 'unsafe-inline'`.** The Next.js App Router streams hydration data in inline `<script>` tags. Removing `'unsafe-inline'` requires a per-request nonce, which forces dynamic rendering. So the app's self-scan should show a CSP **warning** while every other check passes (expected score 93, grade A). This is a deliberate, documented trade-off.
- **Header-only scan.** The scanner reads response headers from one `GET` of the given URL. It does not crawl, check TLS versions or ciphers, look for mixed content, or test for vulnerabilities such as XSS or SQL injection.
- **Bot protection.** Some sites (WAFs, Cloudflare challenges) return a `403` or a challenge page to automated clients. The grade then reflects that response, not the real page.
- **HTTP probe.** The HTTP → HTTPS check always probes `http://<host>/` on port 80. A site that closes port 80 gets a warning, not a failure.

## Run locally

Requirements: **Node.js 22.12+** (24 LTS recommended) and npm.

```bash
git clone https://github.com/<your-username>/Website-Security-Scanner.git
cd Website-Security-Scanner
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests
npm run build        # production build
npm start            # serve the production build
```

No environment variables are needed.

Note: when you run locally, the HSTS header is sent but browsers ignore it over plain `http://localhost`. That is expected.

## Deploy to Vercel (free plan)

1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Keep the defaults (Framework: **Next.js**, build command `next build`). No environment variables are needed.
4. Click **Deploy**.
5. Scan your own deployment, for example `https://your-app.vercel.app`, to see the app's own headers in action.

The scan API route runs on the **Node.js runtime** (it needs `node:http` and `node:dns`) with `maxDuration = 20`, which fits the Hobby plan.

Alternatively, with the CLI: `npm i -g vercel && vercel`.

## Project structure

```
app/
  api/scan/route.ts     POST /api/scan: rate limit, validation, scan
  layout.tsx, page.tsx  UI shell
  globals.css           dark, mobile-first styles
components/             Header (BM/EN toggle), Scanner form, Results, Footer, LanguageProvider
lib/
  ssrf.ts               URL validation, IP allow-list, DNS resolution
  fetcher.ts            safe fetch: DNS pinning, manual redirects, deadline
  checks.ts             the 9 checks, weights, grading
  scanner.ts            orchestrates a scan
  rateLimit.ts          10 req/min/IP sliding window
  i18n.ts               every BM/EN string (UI, checks, errors)
tests/                  Vitest: SSRF filter, redirects, pinning, checks, rate limit
next.config.ts          this app's own security headers, X-Powered-By removed
```

## Roadmap

- [ ] Shared rate limiting via a free-tier Redis/KV store, so limits hold across instances
- [ ] Nonce-based CSP via Next.js `proxy` to drop `'unsafe-inline'`
- [ ] More checks: `Permissions-Policy`, `Cross-Origin-*-Policy`, `security.txt`, mixed content, TLS version and certificate expiry
- [ ] Shareable result links and scan history
- [ ] Export the report as PDF / JSON
- [ ] HSTS preload list status
- [ ] Integration tests against a local test server
