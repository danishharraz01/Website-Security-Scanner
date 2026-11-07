"use client";

import Image from "next/image";
import { useLanguage } from "./LanguageProvider";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p className="footer-brand">
          <Image src="/logo.png" alt={t.header.brand} width={71} height={28} className="footer-logo logo-dark" />
          <Image src="/logo-light.png" alt={t.header.brand} width={71} height={28} className="footer-logo logo-light" />
        </p>
        <p className="footer-note">© 2026 {t.header.brand}</p>
      </div>
    </footer>
  );
}
