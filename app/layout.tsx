import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/components/LanguageProvider";
import { translations, DEFAULT_LANG } from "@/lib/i18n";
import "./globals.css";

const t = translations[DEFAULT_LANG];

export const metadata: Metadata = {
  title: t.meta.title,
  description: `${t.meta.tagline} / ${translations.en.meta.tagline}`,
};

export const viewport: Viewport = {
  themeColor: "#0b0f17",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LANG}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
