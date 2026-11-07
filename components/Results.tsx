"use client";

import { useLanguage } from "./LanguageProvider";
import { format } from "@/lib/i18n";
import type { ScanReport } from "@/lib/scanner";
import type { CheckResult } from "@/lib/checks";

/*
 * Note on XSS: header values from the scanned site (evidence, cookie names)
 * are rendered as React text nodes, which React escapes automatically.
 * We never use dangerouslySetInnerHTML with remote data.
 */

function CheckItem({ check }: { check: CheckResult }) {
  const { t } = useLanguage();
  const text = t.checks[check.id];
  const detail = (text.details as Record<string, string>)[check.detail] ?? "";

  return (
    <li className={`check check-${check.status}`}>
      <div className="check-head">
        <span className={`pill pill-${check.status}`}>{t.results.status[check.status]}</span>
        <h3>{text.title}</h3>
        <span className="points">
          {format(t.results.points, { earned: check.earned, weight: check.weight })}
        </span>
      </div>
      <p className="check-detail">{format(detail, check.params)}</p>
      <p className="check-explain">{text.explain}</p>
      {check.evidence && (
        <details className="evidence">
          <summary>{t.results.evidence}</summary>
          <pre>{check.evidence}</pre>
        </details>
      )}
      {check.status !== "pass" && (
        <p className="fix">
          <strong>{t.results.howToFix}:</strong> {text.fix}
        </p>
      )}
    </li>
  );
}

export function Results({ report }: { report: ScanReport }) {
  const { t, lang } = useLanguage();
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const c of report.checks) counts[c.status]++;

  const scannedAt = new Date(report.scannedAt).toLocaleString(lang === "ms" ? "ms-MY" : "en-GB");

  return (
    <section className="results">
      <div className="summary-card">
        <div className={`grade grade-${report.grade}`} aria-label={`${t.results.grade} ${report.grade}`}>
          {report.grade}
        </div>
        <div className="summary-body">
          <p className="score">
            {t.results.score}: <strong>{report.score}</strong> {t.results.outOf}
          </p>
          <p className="grade-note">{t.results.gradeNote[report.grade]}</p>
          <p className="counts">{format(t.results.summary, counts)}</p>
        </div>
      </div>

      <dl className="meta">
        <div className="meta-wide">
          <dt>{t.results.finalUrl}</dt>
          <dd className="url">{report.finalUrl}</dd>
        </div>
        <div>
          <dt>{t.results.redirects}</dt>
          <dd>{report.redirectCount}</dd>
        </div>
        <div>
          <dt>{t.results.statusCode}</dt>
          <dd>{report.statusCode}</dd>
        </div>
        <div>
          <dt>{t.results.duration}</dt>
          <dd>{(report.durationMs / 1000).toFixed(1)} s</dd>
        </div>
        <div>
          <dt>{t.results.scannedAt}</dt>
          <dd>{scannedAt}</dd>
        </div>
      </dl>

      <h2>{t.results.checks}</h2>
      <ul className="checks">
        {report.checks.map((c) => (
          <CheckItem key={c.id} check={c} />
        ))}
      </ul>
    </section>
  );
}
