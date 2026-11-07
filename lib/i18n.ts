/**
 * All user-facing text lives here, in Bahasa Melayu (ms) and English (en).
 * Placeholders like {days} are filled in with `format()`.
 *
 * The `en` object is typed as `Dict` (the shape of `ms`), so TypeScript fails
 * the build if a key is missing in either language.
 */

export type Lang = "ms" | "en";
export const DEFAULT_LANG: Lang = "ms";
export const LANG_STORAGE_KEY = "wss-lang";

const ms = {
  meta: {
    title: "Pengimbas Keselamatan Laman Web",
    tagline: "Semak pengepala keselamatan HTTP laman web anda dan dapatkan gred A–F dalam beberapa saat.",
  },
  header: {
    brand: "Pengimbas Keselamatan",
    toggleLabel: "Tukar bahasa",
  },
  form: {
    label: "URL laman web",
    placeholder: "contoh: https://example.com",
    submit: "Imbas",
    scanning: "Mengimbas…",
    hint: "Hanya imbas laman web milik anda atau yang anda ada kebenaran untuk uji.",
  },
  results: {
    grade: "Gred",
    score: "Skor",
    outOf: "/ 100",
    finalUrl: "URL akhir",
    redirects: "Ubah hala",
    statusCode: "Kod status",
    duration: "Masa imbasan",
    scannedAt: "Diimbas pada",
    checks: "Semakan",
    howToFix: "Cara membaiki",
    evidence: "Bukti",
    points: "{earned}/{weight} mata",
    summary: "{pass} lulus · {warn} amaran · {fail} gagal",
    status: { pass: "Lulus", warn: "Amaran", fail: "Gagal" },
    gradeNote: {
      A: "Cemerlang. Konfigurasi keselamatan yang kukuh.",
      B: "Baik. Ada sedikit ruang untuk penambahbaikan.",
      C: "Sederhana. Beberapa perlindungan penting masih tiada.",
      D: "Lemah. Banyak pengepala keselamatan tidak ditetapkan.",
      E: "Sangat lemah. Perlu tindakan segera.",
      F: "Gagal. Laman ini hampir tiada perlindungan pengepala keselamatan.",
    },
  },
  checks: {
    https: {
      title: "Menggunakan HTTPS",
      explain: "HTTPS menyulitkan trafik antara pelawat dan pelayan supaya tidak boleh dibaca atau diubah oleh pihak ketiga.",
      fix: "Pasang sijil TLS percuma (contohnya Let's Encrypt) dan hidangkan laman melalui https://.",
      details: {
        pass: "Laman akhir dihantar melalui HTTPS.",
        fail: "Laman akhir dihantar melalui HTTP biasa yang tidak disulitkan.",
      },
    },
    httpRedirect: {
      title: "HTTP diubah hala ke HTTPS",
      explain: "Pelawat yang menaip alamat tanpa https:// patut dihantar terus ke versi HTTPS yang selamat.",
      fix: "Tetapkan ubah hala 301/308 daripada http:// ke https:// pada pelayan web atau CDN anda.",
      details: {
        direct: "http:// terus diubah hala ke https://.",
        eventual: "Akhirnya sampai ke https://, tetapi hanya selepas beberapa lompatan HTTP yang tidak disulitkan.",
        none: "Versi http:// tidak diubah hala ke HTTPS.",
        unreachable: "Tidak dapat menyambung ke http:// (port 80 mungkin ditutup). Pastikan pelawat tetap sampai ke HTTPS.",
      },
    },
    hsts: {
      title: "Strict-Transport-Security (HSTS)",
      explain: "HSTS memberitahu pelayar untuk sentiasa menggunakan HTTPS bagi domain ini, sekali gus menghalang serangan SSL stripping.",
      fix: "Tambah pengepala: Strict-Transport-Security: max-age=31536000; includeSubDomains",
      details: {
        pass: "HSTS ditetapkan dengan max-age {days} hari.",
        short: "max-age hanya {days} hari. Disyorkan sekurang-kurangnya 6 bulan (180 hari).",
        missing: "Pengepala HSTS tiada.",
        invalid: "Pengepala HSTS tiada nilai max-age yang sah.",
        zero: "max-age=0 mematikan HSTS.",
        notHttps: "HSTS hanya berkesan melalui HTTPS, tetapi laman ini tidak menggunakan HTTPS.",
      },
    },
    csp: {
      title: "Content-Security-Policy (CSP)",
      explain: "CSP mengehadkan sumber skrip dan kandungan yang boleh dimuatkan, sekali gus mengurangkan kesan serangan XSS.",
      fix: "Tambah CSP yang ketat, contohnya: default-src 'self'; object-src 'none'; base-uri 'self'. Elakkan 'unsafe-inline', 'unsafe-eval' dan *; gunakan nonce atau hash untuk skrip sebaris.",
      details: {
        pass: "CSP ditetapkan tanpa sumber skrip yang berisiko.",
        weak: "CSP ditetapkan tetapi mengandungi nilai berisiko: {issues}.",
        reportOnly: "Hanya Content-Security-Policy-Report-Only ditetapkan. Ia melaporkan pelanggaran tetapi tidak menyekatnya.",
        missing: "Pengepala Content-Security-Policy tiada.",
      },
    },
    clickjacking: {
      title: "Perlindungan clickjacking",
      explain: "Menghalang laman lain daripada memaparkan laman anda dalam iframe tersembunyi untuk menipu pengguna supaya mengklik sesuatu.",
      fix: "Tambah CSP frame-ancestors 'self' (atau 'none') dan X-Frame-Options: DENY untuk pelayar lama.",
      details: {
        frameAncestors: "Dilindungi oleh arahan CSP frame-ancestors.",
        frameAncestorsWildcard: "frame-ancestors membenarkan * (semua laman), jadi tiada perlindungan.",
        xfo: "Dilindungi oleh X-Frame-Options: {value}.",
        allowFrom: "X-Frame-Options ALLOW-FROM sudah lapuk dan diabaikan oleh pelayar moden.",
        invalid: "Nilai X-Frame-Options tidak sah.",
        missing: "Tiada X-Frame-Options mahupun CSP frame-ancestors.",
      },
    },
    nosniff: {
      title: "X-Content-Type-Options",
      explain: "Nilai nosniff menghalang pelayar daripada meneka jenis kandungan, yang boleh menyebabkan fail dijalankan sebagai skrip.",
      fix: "Tambah pengepala: X-Content-Type-Options: nosniff",
      details: {
        pass: "X-Content-Type-Options: nosniff ditetapkan.",
        invalid: "Nilai X-Content-Type-Options tidak sah (mesti nosniff).",
        missing: "Pengepala X-Content-Type-Options tiada.",
      },
    },
    referrer: {
      title: "Referrer-Policy",
      explain: "Mengawal berapa banyak maklumat URL dihantar ke laman lain apabila pengguna mengklik pautan.",
      fix: "Tambah pengepala: Referrer-Policy: strict-origin-when-cross-origin (atau no-referrer).",
      details: {
        strict: "Polisi yang selamat digunakan: {value}.",
        weak: "Polisi {value} boleh membocorkan URL penuh ke laman lain.",
        invalid: "Nilai Referrer-Policy tidak dikenali.",
        missing: "Pengepala Referrer-Policy tiada. Pelayar akan guna nilai lalai.",
      },
    },
    cookies: {
      title: "Bendera kuki (Secure, HttpOnly, SameSite)",
      explain: "Bendera kuki melindungi kuki sesi daripada dicuri melalui rangkaian (Secure), JavaScript (HttpOnly) dan permintaan rentas laman (SameSite).",
      fix: "Tetapkan kuki dengan: Secure; HttpOnly; SameSite=Lax (atau Strict). Kuki yang perlu dibaca oleh JavaScript boleh tanpa HttpOnly.",
      details: {
        none: "Tiada kuki ditetapkan pada respons ini.",
        allGood: "Semua {count} kuki mempunyai Secure, HttpOnly dan SameSite.",
        missingSecure: "Kuki tanpa Secure (boleh dihantar melalui HTTP): {names}.",
        missingOther: "Kuki tanpa beberapa bendera: {names}.",
      },
    },
    serverLeak: {
      title: "Kebocoran versi pelayan",
      explain: "Pengepala seperti Server dan X-Powered-By boleh mendedahkan perisian dan versi, membantu penyerang mencari kelemahan yang diketahui.",
      fix: "Buang X-Powered-By dan sembunyikan nombor versi daripada pengepala Server (contohnya server_tokens off; dalam nginx).",
      details: {
        none: "Tiada pengepala yang mendedahkan perisian pelayan.",
        noVersion: "Nama pelayan dipaparkan tetapi tanpa nombor versi.",
        poweredBy: "X-Powered-By mendedahkan teknologi yang digunakan.",
        version: "Nombor versi perisian didedahkan dalam pengepala.",
      },
    },
  },
  errors: {
    invalid_url: "URL tidak sah. Cuba sesuatu seperti https://example.com.",
    url_too_long: "URL terlalu panjang (maksimum 2048 aksara).",
    bad_protocol: "Hanya URL http:// dan https:// dibenarkan.",
    bad_port: "Hanya port 80 dan 443 dibenarkan.",
    credentials: "URL dengan nama pengguna atau kata laluan tidak dibenarkan.",
    blocked_ip: "Alamat ini menghala ke rangkaian peribadi atau terpelihara dan disekat demi keselamatan.",
    dns_failed: "Nama domain tidak dapat ditemui.",
    too_many_redirects: "Terlalu banyak ubah hala (maksimum 5).",
    invalid_redirect: "Laman memberikan ubah hala yang tidak sah.",
    timeout: "Laman mengambil masa terlalu lama untuk menjawab (had 8 saat).",
    tls_error: "Sijil TLS laman ini tidak sah atau tidak dipercayai.",
    connection_failed: "Tidak dapat menyambung ke laman tersebut.",
    rate_limited: "Terlalu banyak imbasan. Had ialah 10 imbasan seminit. Cuba sebentar lagi.",
    bad_request: "Permintaan tidak sah.",
    internal: "Ralat tidak dijangka berlaku. Sila cuba lagi.",
    network: "Tidak dapat menghubungi pelayan pengimbas. Semak sambungan internet anda.",
  },
  footer: {
    disclaimer: "Hanya imbas laman web milik anda atau yang anda ada kebenaran bertulis untuk uji.",
    source: "Kod sumber",
  },
};

export type Dict = typeof ms;

const en: Dict = {
  meta: {
    title: "Website Security Scanner",
    tagline: "Check your website's HTTP security headers and get an A–F grade in seconds.",
  },
  header: {
    brand: "Security Scanner",
    toggleLabel: "Switch language",
  },
  form: {
    label: "Website URL",
    placeholder: "e.g. https://example.com",
    submit: "Scan",
    scanning: "Scanning…",
    hint: "Only scan websites you own or have permission to test.",
  },
  results: {
    grade: "Grade",
    score: "Score",
    outOf: "/ 100",
    finalUrl: "Final URL",
    redirects: "Redirects",
    statusCode: "Status code",
    duration: "Scan time",
    scannedAt: "Scanned at",
    checks: "Checks",
    howToFix: "How to fix",
    evidence: "Evidence",
    points: "{earned}/{weight} pts",
    summary: "{pass} passed · {warn} warnings · {fail} failed",
    status: { pass: "Pass", warn: "Warning", fail: "Fail" },
    gradeNote: {
      A: "Excellent. Strong security configuration.",
      B: "Good. A little room for improvement.",
      C: "Fair. Some important protections are missing.",
      D: "Weak. Many security headers are not set.",
      E: "Very weak. Needs urgent attention.",
      F: "Failing. This site has almost no security header protection.",
    },
  },
  checks: {
    https: {
      title: "Uses HTTPS",
      explain: "HTTPS encrypts traffic between visitors and the server so third parties cannot read or modify it.",
      fix: "Install a free TLS certificate (e.g. Let's Encrypt) and serve the site over https://.",
      details: {
        pass: "The final page is served over HTTPS.",
        fail: "The final page is served over plain, unencrypted HTTP.",
      },
    },
    httpRedirect: {
      title: "HTTP redirects to HTTPS",
      explain: "Visitors who type the address without https:// should be sent straight to the secure HTTPS version.",
      fix: "Configure a 301/308 redirect from http:// to https:// on your web server or CDN.",
      details: {
        direct: "http:// redirects straight to https://.",
        eventual: "Eventually reaches https://, but only after extra unencrypted HTTP hops.",
        none: "The http:// version does not redirect to HTTPS.",
        unreachable: "Could not connect over http:// (port 80 may be closed). Make sure visitors still reach HTTPS.",
      },
    },
    hsts: {
      title: "Strict-Transport-Security (HSTS)",
      explain: "HSTS tells browsers to always use HTTPS for this domain, which blocks SSL-stripping attacks.",
      fix: "Add the header: Strict-Transport-Security: max-age=31536000; includeSubDomains",
      details: {
        pass: "HSTS is set with a max-age of {days} days.",
        short: "max-age is only {days} days. At least 6 months (180 days) is recommended.",
        missing: "The HSTS header is missing.",
        invalid: "The HSTS header has no valid max-age value.",
        zero: "max-age=0 disables HSTS.",
        notHttps: "HSTS only works over HTTPS, but this site does not use HTTPS.",
      },
    },
    csp: {
      title: "Content-Security-Policy (CSP)",
      explain: "CSP restricts where scripts and content can be loaded from, which limits the damage of XSS attacks.",
      fix: "Add a strict CSP such as: default-src 'self'; object-src 'none'; base-uri 'self'. Avoid 'unsafe-inline', 'unsafe-eval' and *; use nonces or hashes for inline scripts.",
      details: {
        pass: "CSP is set without risky script sources.",
        weak: "CSP is set but contains risky values: {issues}.",
        reportOnly: "Only Content-Security-Policy-Report-Only is set. It reports violations but does not block them.",
        missing: "The Content-Security-Policy header is missing.",
      },
    },
    clickjacking: {
      title: "Clickjacking protection",
      explain: "Stops other sites from loading your page in a hidden iframe to trick users into clicking things.",
      fix: "Add CSP frame-ancestors 'self' (or 'none') plus X-Frame-Options: DENY for older browsers.",
      details: {
        frameAncestors: "Protected by the CSP frame-ancestors directive.",
        frameAncestorsWildcard: "frame-ancestors allows * (any site), so there is no protection.",
        xfo: "Protected by X-Frame-Options: {value}.",
        allowFrom: "X-Frame-Options ALLOW-FROM is obsolete and ignored by modern browsers.",
        invalid: "The X-Frame-Options value is invalid.",
        missing: "Neither X-Frame-Options nor CSP frame-ancestors is set.",
      },
    },
    nosniff: {
      title: "X-Content-Type-Options",
      explain: "nosniff stops browsers from guessing the content type, which could make a file run as a script.",
      fix: "Add the header: X-Content-Type-Options: nosniff",
      details: {
        pass: "X-Content-Type-Options: nosniff is set.",
        invalid: "Invalid X-Content-Type-Options value (must be nosniff).",
        missing: "The X-Content-Type-Options header is missing.",
      },
    },
    referrer: {
      title: "Referrer-Policy",
      explain: "Controls how much of the URL is sent to other sites when users follow a link.",
      fix: "Add the header: Referrer-Policy: strict-origin-when-cross-origin (or no-referrer).",
      details: {
        strict: "A safe policy is used: {value}.",
        weak: "The {value} policy can leak full URLs to other sites.",
        invalid: "The Referrer-Policy value is not recognised.",
        missing: "The Referrer-Policy header is missing. Browsers will use their default.",
      },
    },
    cookies: {
      title: "Cookie flags (Secure, HttpOnly, SameSite)",
      explain: "Cookie flags protect session cookies from theft over the network (Secure), by JavaScript (HttpOnly) and via cross-site requests (SameSite).",
      fix: "Set cookies with: Secure; HttpOnly; SameSite=Lax (or Strict). Cookies that JavaScript must read can skip HttpOnly.",
      details: {
        none: "No cookies are set on this response.",
        allGood: "All {count} cookies have Secure, HttpOnly and SameSite.",
        missingSecure: "Cookies without Secure (can be sent over HTTP): {names}.",
        missingOther: "Cookies missing some flags: {names}.",
      },
    },
    serverLeak: {
      title: "Server version leak",
      explain: "Headers like Server and X-Powered-By can reveal software and versions, helping attackers find known vulnerabilities.",
      fix: "Remove X-Powered-By and hide version numbers in the Server header (e.g. server_tokens off; in nginx).",
      details: {
        none: "No headers reveal the server software.",
        noVersion: "A server name is shown, but without a version number.",
        poweredBy: "X-Powered-By reveals the technology in use.",
        version: "Software version numbers are exposed in headers.",
      },
    },
  },
  errors: {
    invalid_url: "Invalid URL. Try something like https://example.com.",
    url_too_long: "URL is too long (maximum 2048 characters).",
    bad_protocol: "Only http:// and https:// URLs are allowed.",
    bad_port: "Only ports 80 and 443 are allowed.",
    credentials: "URLs containing a username or password are not allowed.",
    blocked_ip: "This address points to a private or reserved network and is blocked for security.",
    dns_failed: "The domain name could not be found.",
    too_many_redirects: "Too many redirects (maximum 5).",
    invalid_redirect: "The site returned an invalid redirect.",
    timeout: "The site took too long to respond (8 second limit).",
    tls_error: "The site's TLS certificate is invalid or untrusted.",
    connection_failed: "Could not connect to the site.",
    rate_limited: "Too many scans. The limit is 10 scans per minute. Please try again shortly.",
    bad_request: "Invalid request.",
    internal: "An unexpected error occurred. Please try again.",
    network: "Could not reach the scanner server. Check your internet connection.",
  },
  footer: {
    disclaimer: "Only scan websites you own or have written permission to test.",
    source: "Source code",
  },
};

export const translations: Record<Lang, Dict> = { ms, en };

export type CheckKey = keyof Dict["checks"];
export type ErrorKey = keyof Dict["errors"];

/** Replaces {name} placeholders with values from `params`. */
export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function isLang(value: unknown): value is Lang {
  return value === "ms" || value === "en";
}
