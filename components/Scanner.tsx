"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { Results } from "./Results";
import { AlertIcon, BrowserIcon, EyeOffIcon, LinkIcon, LockIcon, RefreshIcon, ShieldIcon } from "./Icons";
import { format, type ErrorKey } from "@/lib/i18n";
import { addScan, findPrevious, useHistory, useHydrated } from "@/lib/history";
import { CHECK_GROUPS } from "@/lib/remediation";
import { CHECK_WEIGHTS } from "@/lib/checks";
import type { ScanReport } from "@/lib/scanner";

const MAX_INPUT = 2048;
/** Server budget is 8s fetch + headroom (maxDuration 20s); give up a little after that. */
const CLIENT_TIMEOUT_MS = 25_000;

/** Errors where simply trying again can help (as opposed to fixing the URL). */
const RETRYABLE = new Set<ErrorKey>(["timeout", "connection_failed", "dns_failed", "internal", "network", "rate_limited"]);

const GROUP_ICONS = { transport: LockIcon, browser: BrowserIcon, exposure: EyeOffIcon };

/** Best-effort hostname for the "Scanning …" message. Display only; the server does the real parsing. */
function displayHost(value: string): string {
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`).host || value;
  } catch {
    return value;
  }
}

function isReport(data: unknown): data is ScanReport {
  return typeof data === "object" && data !== null && "checks" in data && Array.isArray((data as ScanReport).checks);
}

export function Scanner({ viewId }: { viewId: string | null }) {
  const { t } = useLanguage();
  const router = useRouter();
  const history = useHistory();
  const hydrated = useHydrated();
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanningHost, setScanningHost] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState("");
  // The scan made in this page view. A saved scan (?id=) is shown when there is none.
  const [current, setCurrent] = useState<{ id: string; report: ScanReport } | null>(null);
  // Store the error CODE, not the text, so it re-translates when the language changes.
  const [error, setError] = useState<ErrorKey | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const saved = !current && viewId ? history.find((e) => e.id === viewId) : undefined;
  const shown = current ?? saved ?? null;
  const previous = shown ? findPrevious(history, shown.id, shown.report) : undefined;
  const missingSaved = hydrated && !current && !loading && !error && viewId !== null && !saved;
  // Until saved history can be read, do not flash the empty state for a ?id= link.
  const pendingSaved = !hydrated && viewId !== null;

  async function runScan(value: string) {
    if (loading) return;
    if (!value) return setError("invalid_url");
    if (value.length > MAX_INPUT) return setError("url_too_long");

    setLoading(true);
    setError(null);
    setCurrent(null);
    setAnnouncement("");
    setLastSubmitted(value);
    setScanningHost(displayHost(value));
    if (viewId) router.replace("/", { scroll: false });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
        signal: controller.signal,
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !isReport(data)) {
        const code = data && typeof data === "object" && "error" in data ? String(data.error) : "internal";
        setError(code in t.errors ? (code as ErrorKey) : "internal");
      } else {
        const id = addScan(data);
        setCurrent({ id, report: data });
        setAnnouncement(format(t.states.announceDone, { grade: data.grade, score: data.score }));
      }
    } catch (err) {
      setError(err instanceof DOMException && err.name === "AbortError" ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runScan(url.trim());
  }

  function startOver() {
    setCurrent(null);
    setError(null);
    setAnnouncement("");
    if (viewId) router.replace("/", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
    inputRef.current?.focus({ preventScroll: true });
  }

  const compact = loading || shown !== null || error !== null;

  return (
    <>
      <section className={`hero${compact ? " hero-compact" : ""}`} aria-labelledby="hero-title">
        <p className="eyebrow">
          <ShieldIcon size={14} />
          {t.hero.eyebrow}
        </p>
        <h1 id="hero-title">{t.hero.title}</h1>
        <p className="tagline">{t.meta.tagline}</p>
        <p className="hero-desc">{t.hero.description}</p>

        <form className="scan-form" onSubmit={onSubmit} noValidate>
          <label htmlFor="url" className="sr-only">
            {t.form.label}
          </label>
          <div className="input-wrap">
            <LinkIcon className="input-icon" size={18} />
            <input
              ref={inputRef}
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
              aria-describedby="scan-hint"
              aria-invalid={error !== null && !RETRYABLE.has(error) ? true : undefined}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-scan" disabled={loading || url.trim() === ""}>
            {loading && <span className="spinner" aria-hidden="true" />}
            {loading ? t.form.scanning : t.form.submit}
          </button>
        </form>
        <p id="scan-hint" className="hint">
          <AlertIcon size={14} />
          {t.form.hint}
        </p>
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {loading ? format(t.states.scanningTitle, { host: scanningHost }) : announcement}
      </p>

      {loading && (
        <section className="panel state-loading" aria-busy="true">
          <div className="state-head">
            <span className="radar" aria-hidden="true" />
            <div>
              <h2>{format(t.states.scanningTitle, { host: scanningHost })}</h2>
              <p>{t.states.scanningDesc}</p>
            </div>
          </div>
          <div className="skeleton-grid" aria-hidden="true">
            <div className="skeleton skeleton-tall" />
            <div className="skeleton-stack">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          </div>
        </section>
      )}

      {!loading && error && (
        <section className="panel state-error" role="alert">
          <span className="state-error-icon" aria-hidden="true">
            <AlertIcon size={22} />
          </span>
          <div className="state-error-body">
            <h2>{t.states.errorTitle}</h2>
            <p>{t.errors[error]}</p>
            {lastSubmitted && <p className="mono muted">{lastSubmitted}</p>}
            <div className="btn-row">
              {RETRYABLE.has(error) && lastSubmitted && (
                <button type="button" className="btn btn-primary" onClick={() => void runScan(lastSubmitted)}>
                  <RefreshIcon size={16} />
                  {t.states.retry}
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.focus()}>
                {t.states.editUrl}
              </button>
            </div>
          </div>
        </section>
      )}

      {!loading && !error && missingSaved && (
        <div className="notice" role="status">
          {t.states.notFound}
        </div>
      )}

      {!loading && !error && shown && (
        <Results
          key={shown.id}
          report={shown.report}
          previous={previous?.report}
          savedAt={current ? null : shown.report.scannedAt}
          focusOnMount={current !== null}
          onNewScan={startOver}
        />
      )}

      {!loading && !error && !shown && !pendingSaved && (
        <section className="panel state-empty" aria-labelledby="empty-title">
          <h2 id="empty-title">{t.states.emptyTitle}</h2>
          <p className="muted">{format(t.states.emptyDesc, { count: Object.keys(CHECK_WEIGHTS).length })}</p>
          <div className="check-catalog">
            {CHECK_GROUPS.map((g) => {
              const GroupIcon = GROUP_ICONS[g.id];
              return (
                <div key={g.id} className="catalog-group">
                  <h3>
                    <GroupIcon size={16} />
                    {t.groups[g.id].title}
                  </h3>
                  <ul>
                    {g.checks.map((id) => (
                      <li key={id}>
                        <span>{t.checks[id].title}</span>
                        <span className="catalog-weight">{format(t.about.points, { weight: CHECK_WEIGHTS[id] })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
