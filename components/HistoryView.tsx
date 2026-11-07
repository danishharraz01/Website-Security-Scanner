"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { formatDate } from "./Results";
import { HistoryIcon, PlusIcon, TrashIcon } from "./Icons";
import { format } from "@/lib/i18n";
import { MAX_HISTORY, clearHistory, findPrevious, hostOf, removeScan, useHistory, useHydrated } from "@/lib/history";

export function HistoryView() {
  const { t, lang } = useLanguage();
  const entries = useHistory();
  const hydrated = useHydrated();

  return (
    <section className="page" aria-labelledby="history-title">
      <div className="page-head">
        <div>
          <h1 id="history-title">{t.history.title}</h1>
          <p className="muted">{format(t.history.desc, { max: MAX_HISTORY })}</p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-danger"
            onClick={() => {
              if (window.confirm(t.history.confirmClear)) clearHistory();
            }}
          >
            <TrashIcon size={16} />
            {t.history.clearAll}
          </button>
        )}
      </div>

      {hydrated && entries.length === 0 && (
        <div className="panel empty-state">
          <span className="empty-icon" aria-hidden="true">
            <HistoryIcon size={26} />
          </span>
          <h2>{t.history.emptyTitle}</h2>
          <p className="muted">{t.history.emptyDesc}</p>
          <Link href="/" className="btn btn-primary">
            <PlusIcon size={16} />
            {t.history.startScan}
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <p className="muted small history-count">{format(t.history.count, { count: entries.length })}</p>
          <ul className="history-list">
            {entries.map((e) => {
              const r = e.report;
              const host = hostOf(r.inputUrl);
              const prev = findPrevious(entries, e.id, r);
              const delta = prev ? r.score - prev.report.score : null;
              const counts = { pass: 0, warn: 0, fail: 0 };
              for (const c of r.checks) counts[c.status]++;
              return (
                <li key={e.id} className="history-item">
                  <span className={`grade-badge grade-${r.grade}`} aria-hidden="true">
                    {r.grade}
                  </span>
                  <div className="history-main">
                    <Link href={`/?id=${encodeURIComponent(e.id)}`} className="history-link">
                      {host}
                      <span className="sr-only">
                        {" "}
                        — {t.results.grade} {r.grade}, {r.score} {t.results.outOf}
                      </span>
                    </Link>
                    <p className="mono muted history-url">{r.finalUrl}</p>
                    <p className="history-meta">
                      <span>{formatDate(r.scannedAt, lang)}</span>
                      <span className="dot-sep" aria-hidden="true" />
                      <span className="tone-pass">
                        {counts.pass} {t.results.passed.toLowerCase()}
                      </span>
                      <span className="tone-warn">
                        {counts.warn} {t.results.warnings.toLowerCase()}
                      </span>
                      <span className="tone-fail">
                        {counts.fail} {t.results.failed.toLowerCase()}
                      </span>
                    </p>
                  </div>
                  <div className="history-score">
                    <strong>
                      {r.score}
                      <small>/100</small>
                    </strong>
                    {delta === null ? (
                      <span className="muted small">{t.history.firstScan}</span>
                    ) : (
                      <span className={`delta delta-${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`} title={t.history.vsPrevious}>
                        {delta > 0 ? "+" : ""}
                        {delta}
                        <span className="sr-only"> {t.history.vsPrevious}</span>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn history-delete"
                    aria-label={format(t.history.deleteLabel, { host })}
                    title={format(t.history.deleteLabel, { host })}
                    onClick={() => removeScan(e.id)}
                  >
                    <TrashIcon size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
