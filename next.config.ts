import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy for this app.
 *
 * - default-src 'self': only load resources from our own origin unless a
 *   directive below says otherwise.
 * - script-src: Next.js App Router streams its hydration data in small inline
 *   <script> tags, so 'unsafe-inline' is required unless we switch to a
 *   per-request nonce (see README roadmap). 'unsafe-eval' is only added in
 *   development because React's dev tooling needs it; production never has it.
 * - style-src 'unsafe-inline': Next.js may inject small inline styles (for
 *   example its route announcer and dev overlay). Inline styles cannot run
 *   code, so this is a much lower risk than inline scripts.
 * - connect-src 'self': the browser may only call our own API. In dev we also
 *   allow the hot-reload websocket.
 * - frame-ancestors 'none': nobody may embed this app in an iframe
 *   (modern clickjacking protection; X-Frame-Options below covers old browsers).
 * - object-src 'none', base-uri 'self', form-action 'self': close off plugin
 *   content, <base> tag hijacking and forms posting to other sites.
 * - upgrade-insecure-requests: any accidental http:// sub-resource is fetched
 *   over https instead.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  // Forces browsers to use HTTPS for 2 years, including subdomains.
  // (Browsers ignore this header on plain-HTTP responses, so it is safe in dev.)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: csp },
  // Legacy clickjacking protection for browsers that do not support frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops browsers from guessing ("sniffing") a different content type than declared.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send the origin (not the full path/query) to other sites, and nothing over http.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // This app needs none of these powerful browser features, so turn them off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Isolates our browsing context from cross-origin popups (defence against XS-Leaks).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Removes the "X-Powered-By: Next.js" header so we do not advertise our stack.
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
