"use client";

import { useLanguage } from "./LanguageProvider";
import type { Lang } from "@/lib/i18n";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "ms", label: "BM" },
  { value: "en", label: "EN" },
];

export function Header() {
  const { lang, t, setLang } = useLanguage();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <span className="brand">
          <svg className="brand-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t.header.brand}
        </span>
        <div className="lang-toggle" role="group" aria-label={t.header.toggleLabel}>
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={lang === o.value ? "active" : ""}
              aria-pressed={lang === o.value}
              onClick={() => setLang(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
