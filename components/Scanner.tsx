"use client";

import { useState, type FormEvent } from "react";
import { useLanguage } from "./LanguageProvider";
import { Results } from "./Results";
import type { ScanReport } from "@/lib/scanner";
import type { ErrorKey } from "@/lib/i18n";

const MAX_INPUT = 2048;

export function Scanner() {
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ScanReport | null>(null);
  // Store the error CODE, not the text, so it re-translates when the language changes.
  const [error, setError] = useState<ErrorKey | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    const value = url.trim();
    if (!value) return setError("invalid_url");
    if (value.length > MAX_INPUT) return setError("url_too_long");

    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data !== "object" || "error" in data) {
        const code = data && typeof data === "object" && "error" in data ? String(data.error) : "internal";
        setError(code in t.errors ? (code as ErrorKey) : "internal");
      } else {
        setReport(data as ScanReport);
      }
    } catch {
      setError("network");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="hero">
        <h1>{t.meta.title}</h1>
        <p className="tagline">{t.meta.tagline}</p>

        <form className="scan-form" onSubmit={onSubmit} noValidate>
          <label htmlFor="url" className="sr-only">
            {t.form.label}
          </label>
          <input
            id="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={MAX_INPUT}
            placeholder={t.form.placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || url.trim() === ""}>
            {loading && <span className="spinner" aria-hidden="true" />}
            {loading ? t.form.scanning : t.form.submit}
          </button>
        </form>
        <p className="hint">{t.form.hint}</p>
      </section>

      <div aria-live="polite">
        {error && (
          <div className="error-box" role="alert">
            {t.errors[error]}
          </div>
        )}
        {report && <Results report={report} />}
      </div>
    </>
  );
}
