"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { ThemeToggle } from "./ThemeToggle";
import { MenuIcon, XIcon } from "./Icons";
import type { Lang } from "@/lib/i18n";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "ms", label: "BM" },
  { value: "en", label: "EN" },
];

export function Header() {
  const { lang, t, setLang } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/", label: t.nav.scanner },
    { href: "/history", label: t.nav.history },
    { href: "/about", label: t.nav.about },
  ];

  return (
    <header
      className="site-header"
      onKeyDown={(e) => {
        if (e.key === "Escape" && menuOpen) setMenuOpen(false);
      }}
    >
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label={t.header.home} onClick={() => setMenuOpen(false)}>
          <Image src="/logo.png" alt="" width={102} height={40} priority className="brand-logo logo-dark" />
          <Image src="/logo-light.png" alt="" width={102} height={40} priority className="brand-logo logo-light" />
        </Link>

        <nav id="primary-nav" className={`primary-nav${menuOpen ? " is-open" : ""}`} aria-label={t.nav.label}>
          <ul>
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={active ? "active" : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="header-actions">
          <ThemeToggle label={t.header.themeLabel} />
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
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
