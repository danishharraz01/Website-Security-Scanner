"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_LANG, LANG_STORAGE_KEY, isLang, translations, type Dict, type Lang } from "@/lib/i18n";

/**
 * Language state lives in localStorage so the choice survives reloads.
 * localStorage can throw (private mode, blocked storage, sandboxed iframes),
 * so every access is wrapped in try/catch and falls back to the default.
 */
const listeners = new Set<() => void>();
let memoryLang: Lang | null = null; // used when localStorage is unavailable

function readLang(): Lang {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // storage unavailable: fall through
  }
  return memoryLang ?? DEFAULT_LANG;
}

function writeLang(lang: Lang): void {
  memoryLang = lang;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // storage unavailable: the in-memory value still works for this page view
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Keep other tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === LANG_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

interface LanguageContextValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server render always uses the default (BM); the client then switches to the stored choice.
  const lang = useSyncExternalStore(subscribe, readLang, () => DEFAULT_LANG);
  const setLang = useCallback((next: Lang) => writeLang(next), []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translations[lang].meta.title;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}
