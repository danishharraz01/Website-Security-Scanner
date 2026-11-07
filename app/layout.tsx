import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/components/LanguageProvider";
import { translations, DEFAULT_LANG } from "@/lib/i18n";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const t = translations[DEFAULT_LANG];

export const metadata: Metadata = {
  title: `${t.meta.title} — ${translations.en.meta.tagline}`,
  description: `${translations.en.meta.description} / ${t.meta.description}`,
  applicationName: t.meta.title,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme before React hydrates.
    <html lang={DEFAULT_LANG} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
