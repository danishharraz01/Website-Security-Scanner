/**
 * Remediation guidance: risk ratings, copy-ready configuration examples and
 * references. The wording (impact, outcome-specific advice, cautions) lives in
 * lib/i18n.ts under `checks.<id>`; everything here is language-neutral.
 *
 * Nothing here affects scanning or scoring: risk is a separate, presentational
 * judgement about how serious a non-passing result typically is.
 */
import type { CheckId, CheckResult } from "./checks";
import { format, type Dict } from "./i18n";

export type Risk = "high" | "medium" | "low";

export interface Snippet {
  label: string;
  code: string;
}

export interface Reference {
  label: string;
  url: string;
}

/**
 * Typical risk of each non-passing outcome, keyed by check and detail code
 * (see lib/checks.ts). Passing outcomes have no risk.
 */
const RISK: Record<CheckId, Record<string, Risk>> = {
  https: { fail: "high" },
  httpRedirect: { none: "medium", eventual: "low", unreachable: "low" },
  hsts: { missing: "medium", invalid: "medium", zero: "medium", notHttps: "medium", short: "low" },
  csp: { missing: "medium", weak: "medium", reportOnly: "low" },
  clickjacking: { missing: "medium", frameAncestorsWildcard: "medium", allowFrom: "low", invalid: "low" },
  nosniff: { missing: "low", invalid: "low" },
  referrer: { missing: "low", weak: "low", invalid: "low" },
  cookies: { missingSecure: "high", missingOther: "medium" },
  serverLeak: { version: "low", poweredBy: "low" },
};

const RISK_RANK: Record<Risk, number> = { high: 0, medium: 1, low: 2 };

export function riskOf(check: CheckResult): Risk | null {
  if (check.status === "pass") return null;
  return RISK[check.id]?.[check.detail] ?? (check.status === "fail" ? "medium" : "low");
}

/** Non-passing checks, most urgent first: by risk, then by points at stake. */
export function prioritise(checks: CheckResult[]): CheckResult[] {
  return checks
    .filter((c) => c.status !== "pass")
    .sort((a, b) => {
      const r = RISK_RANK[riskOf(a)!] - RISK_RANK[riskOf(b)!];
      return r !== 0 ? r : b.weight - b.earned - (a.weight - a.earned);
    });
}

/** The recommendation for this specific outcome (e.g. "short max-age"), with its params filled in. */
export function adviceFor(t: Dict, check: CheckResult): string {
  const advice = t.checks[check.id].advice as Record<string, string>;
  return format(advice[check.detail] ?? "", check.params);
}

export function findingFor(t: Dict, check: CheckResult): string {
  const details = t.checks[check.id].details as Record<string, string>;
  return format(details[check.detail] ?? "", check.params);
}

const OWASP_HEADERS: Reference = {
  label: "OWASP Secure Headers Project",
  url: "https://owasp.org/www-project-secure-headers/",
};

export const REFERENCES: Record<CheckId, Reference[]> = {
  https: [
    { label: "OWASP Transport Layer Security Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html" },
    { label: "Mozilla SSL Configuration Generator", url: "https://ssl-config.mozilla.org/" },
  ],
  httpRedirect: [
    { label: "OWASP HTTP Strict Transport Security Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html" },
  ],
  hsts: [
    { label: "RFC 6797: HTTP Strict Transport Security", url: "https://www.rfc-editor.org/rfc/rfc6797" },
    { label: "OWASP HTTP Strict Transport Security Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html" },
  ],
  csp: [
    { label: "OWASP Content Security Policy Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html" },
    { label: "Google CSP Evaluator", url: "https://csp-evaluator.withgoogle.com/" },
  ],
  clickjacking: [
    { label: "OWASP Clickjacking Defense Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html" },
  ],
  nosniff: [
    { label: "MDN: X-Content-Type-Options", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options" },
    OWASP_HEADERS,
  ],
  referrer: [
    { label: "MDN: Referrer-Policy", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy" },
    OWASP_HEADERS,
  ],
  cookies: [
    { label: "OWASP Session Management Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html" },
    { label: "MDN: Set-Cookie", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie" },
  ],
  serverLeak: [
    OWASP_HEADERS,
  ],
};

export const REMEDIATION: Record<CheckId, Snippet[]> = {
  https: [
    { label: "Let's Encrypt (Certbot, nginx)", code: "sudo certbot --nginx -d example.com -d www.example.com" },
    { label: "nginx", code: "ssl_protocols TLSv1.2 TLSv1.3;" },
  ],
  httpRedirect: [
    {
      label: "nginx",
      code: "server {\n    listen 80;\n    server_name example.com www.example.com;\n    return 301 https://example.com$request_uri;\n}",
    },
    {
      label: "Apache",
      code: "<VirtualHost *:80>\n    ServerName example.com\n    ServerAlias www.example.com\n    Redirect permanent / https://example.com/\n</VirtualHost>",
    },
  ],
  hsts: [
    { label: "nginx", code: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;' },
    { label: "Apache", code: 'Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"' },
  ],
  csp: [
    {
      label: "nginx",
      code:
        "# Step 1: monitor only, review the reports\n" +
        "add_header Content-Security-Policy-Report-Only \"default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; report-uri /csp-report\" always;\n" +
        "# Step 2: once clean, enforce the same policy\n" +
        "add_header Content-Security-Policy \"default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'\" always;",
    },
    {
      label: "Apache",
      code:
        "# Step 1: monitor only, review the reports\n" +
        "Header always set Content-Security-Policy-Report-Only \"default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; report-uri /csp-report\"\n" +
        "# Step 2: once clean, enforce the same policy\n" +
        "Header always set Content-Security-Policy \"default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'\"",
    },
  ],
  clickjacking: [
    {
      label: "nginx",
      code: "add_header X-Frame-Options \"SAMEORIGIN\" always;\n# And in your Content-Security-Policy: frame-ancestors 'self'",
    },
    { label: "Apache", code: 'Header always set X-Frame-Options "SAMEORIGIN"' },
  ],
  nosniff: [
    { label: "nginx", code: 'add_header X-Content-Type-Options "nosniff" always;' },
    { label: "Apache", code: 'Header always set X-Content-Type-Options "nosniff"' },
  ],
  referrer: [
    { label: "nginx", code: 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;' },
    { label: "Apache", code: 'Header always set Referrer-Policy "strict-origin-when-cross-origin"' },
  ],
  cookies: [{ label: "HTTP", code: "Set-Cookie: __Host-session=<value>; Path=/; Secure; HttpOnly; SameSite=Lax" }],
  serverLeak: [
    { label: "nginx", code: "server_tokens off;\n# Behind a reverse proxy, also strip upstream headers:\nproxy_hide_header X-Powered-By;" },
    { label: "Apache", code: "ServerTokens Prod\nServerSignature Off\nHeader always unset X-Powered-By" },
    { label: "PHP (php.ini)", code: "expose_php = Off" },
  ],
};

/** Logical grouping used by the results view and the report, in display order. */
export const CHECK_GROUPS: { id: "transport" | "browser" | "exposure"; checks: CheckId[] }[] = [
  { id: "transport", checks: ["https", "httpRedirect", "hsts"] },
  { id: "browser", checks: ["csp", "clickjacking", "nosniff", "referrer"] },
  { id: "exposure", checks: ["cookies", "serverLeak"] },
];
