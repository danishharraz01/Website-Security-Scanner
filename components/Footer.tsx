"use client";

import { useLanguage } from "./LanguageProvider";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="container">
        <p>⚠️ {t.footer.disclaimer}</p>
      </div>
    </footer>
  );
}
