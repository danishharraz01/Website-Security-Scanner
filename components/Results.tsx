"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "./LanguageProvider";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChevronIcon,
  CopyIcon,
  DownloadIcon,
  GlobeIcon,
  PlusIcon,
  RedirectIcon,
  ServerIcon,
  StatusIcon,
  TimerIcon,
} from "./Icons";
import { format, type Dict, type Lang } from "@/lib/i18n";
import { hostOf } from "@/lib/history";
import { PrintReport, reportId } from "./PrintReport";
import { CHECK_GROUPS, REFERENCES, REMEDIATION, adviceFor, riskOf } from "@/lib/remediation";
import type { ScanReport } from "@/lib/scanner";
import type { CheckResult, Status } from "@/lib/checks";

/*
 * Note on XSS: header values from the scanned site (evidence, cookie names)
 * are rendered as React text nodes, which React escapes automatically.
 * We never use dangerouslySetInnerHTML with remote data.
 */

type Filter = "all" | Status;
const SEVERITY: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function formatDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "ms" ? "ms-MY" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function countStatuses(checks: CheckResult[]) {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) counts[c.status]++;
  return counts;
}

function checkDetail(t: Dict, check: CheckResult): string {
  const detail = (t.checks[check.id].details as Record<string, string>)[check.detail] ?? "";
  return format(detail, check.params);
}

/* ---------- Score card ---------- */

function ScoreCard({ report }: { report: ScanReport }) {
  const { t } = useLanguage();
  const counts = countStatuses(report.checks);
  const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, report.score)) / 100);

  return (
    <div className={`panel score-card grade-${report.grade}`}>
      <div className="score-ring" role="img" aria-label={`${t.results.grade} ${report.grade}, ${t.results.score} ${report.score} ${t.results.outOf}`}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="ring-track" cx="60" cy="60" r={RING_RADIUS} />
          <circle
            className="ring-value"
            cx="60"
            cy="60"
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="ring-label" aria-hidden="true">
          <span className="ring-grade">{report.grade}</span>
          <span className="ring-score">
            {report.score}
            <small>/100</small>
          </span>
        </div>
      </div>

      <div className="score-body">
        <p className="overline">{t.results.securityScore}</p>
        <p className="score-headline">
          <span className="grade-chip">
            {t.results.grade} {report.grade}
          </span>
          {t.results.gradeLabel[report.grade]}
        </p>
        <p className="score-note">{t.results.gradeNote[report.grade]}</p>
        <div className="tally">
          <div className="tally-item tally-pass">
            <span className="tally-num">{counts.pass}</span>
            <span className="tally-label">{t.results.passed}</span>
          </div>
          <div className="tally-item tally-warn">
            <span className="tally-num">{counts.warn}</span>
            <span className="tally-label">{t.results.warnings}</span>
          </div>
          <div className="tally-item tally-fail">
            <span className="tally-num">{counts.fail}</span>
            <span className="tally-label">{t.results.failed}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Scan information ---------- */

function ScanInfo({ report }: { report: ScanReport }) {
  const { t, lang } = useLanguage();
  const statusTone = report.statusCode >= 200 && report.statusCode < 400 ? "ok" : "bad";

  return (
    <div className="panel info-panel">
      <h3 className="panel-title">{t.results.scanInfo}</h3>
      <dl className="info-grid">
        <div className="info-item info-wide">
          <dt>
            <GlobeIcon size={14} />
            {t.results.finalUrl}
          </dt>
          <dd className="mono url">{report.finalUrl}</dd>
        </div>
        <div className="info-item">
          <dt>
            <RedirectIcon size={14} />
            {t.results.redirects}
          </dt>
          <dd>{report.redirectCount}</dd>
        </div>
        <div className="info-item">
          <dt>
            <ServerIcon size={14} />
            {t.results.statusCode}
          </dt>
          <dd>
            <span className={`status-code status-${statusTone}`}>{report.statusCode}</span>
          </dd>
        </div>
        <div className="info-item">
          <dt>
            <TimerIcon size={14} />
            {t.results.duration}
          </dt>
          <dd>{format(t.results.seconds, { value: (report.durationMs / 1000).toFixed(1) })}</dd>
        </div>
        <div className="info-item">
          <dt>
            <CalendarIcon size={14} />
            {t.results.scannedAt}
          </dt>
          <dd>{formatDate(report.scannedAt, lang)}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ---------- Comparison ---------- */

function Comparison({ report, previous }: { report: ScanReport; previous: ScanReport }) {
  const { t, lang } = useLanguage();
  const delta = report.score - previous.score;
  const before = new Map(previous.checks.map((c) => [c.id, c.status]));
  const changes = report.checks
    .filter((c) => before.has(c.id) && before.get(c.id) !== c.status)
    .map((c) => {
      const from = before.get(c.id)!;
      return { id: c.id, from, to: c.status, improved: SEVERITY[c.status] > SEVERITY[from] };
    });
  const tone = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <section className="panel compare" aria-labelledby="compare-title">
      <div className="compare-head">
        <div>
          <h3 id="compare-title" className="panel-title">
            {t.compare.title}
          </h3>
          <p className="muted small">{format(t.compare.since, { date: formatDate(previous.scannedAt, lang) })}</p>
        </div>
        <div className="compare-score">
          <span className="compare-cell">
            <span className="overline">{t.compare.previous}</span>
            <strong>
              {previous.grade} · {previous.score}
            </strong>
          </span>
          <ArrowRightIcon size={16} className="muted" />
          <span className="compare-cell">
            <span className="overline">{t.compare.latest}</span>
            <strong>
              {report.grade} · {report.score}
            </strong>
          </span>
          <span className={`delta delta-${tone}`} aria-label={`${t.compare.scoreChange}: ${delta > 0 ? "+" : ""}${delta}`}>
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        </div>
      </div>
      {changes.length === 0 ? (
        <p className="muted small compare-none">{t.compare.unchanged}</p>
      ) : (
        <ul className="compare-list" aria-label={t.compare.changes}>
          {changes.map((c) => (
            <li key={c.id}>
              <span className="compare-name">{t.checks[c.id].title}</span>
              <span className="compare-flow">
                <span className={`pill pill-${c.from}`}>{t.results.status[c.from]}</span>
                <ArrowRightIcon size={14} className="muted" />
                <span className={`pill pill-${c.to}`}>{t.results.status[c.to]}</span>
              </span>
              <span className={`change change-${c.improved ? "up" : "down"}`}>
                {c.improved ? t.compare.improved : t.compare.regressed}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Check card ---------- */

function Snippet({ label, code }: { label: string; code: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context or permission denied): the code is still selectable.
    }
  }

  return (
    <div className="snippet">
      <div className="snippet-head">
        <span>{label}</span>
        <button type="button" className="btn-ghost btn-xs no-print" onClick={copy}>
          <CopyIcon size={13} />
          <span aria-live="polite">{copied ? t.results.copied : t.results.copy}</span>
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`disclosure${open ? " is-open" : ""}`}>
      <button type="button" className="disclosure-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <ChevronIcon size={16} className="disclosure-chevron" />
        {label}
      </button>
      <div id={id} className="disclosure-body" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

function CheckCard({ check, hidden }: { check: CheckResult; hidden: boolean }) {
  const { t } = useLanguage();
  const text = t.checks[check.id];
  const snippets = REMEDIATION[check.id] ?? [];
  const refs = REFERENCES[check.id] ?? [];
  const risk = riskOf(check);

  return (
    <li className={`check check-${check.status}${hidden ? " is-filtered" : ""}`}>
      <div className="check-top">
        <span className={`check-icon icon-${check.status}`} aria-hidden="true">
          <StatusIcon status={check.status} size={16} />
        </span>
        <div className="check-main">
          <h5>{text.title}</h5>
          <p className="check-detail">{checkDetail(t, check)}</p>
        </div>
        <div className="check-side">
          <span className={`pill pill-${check.status}`}>{t.results.status[check.status]}</span>
          {risk && (
            <span className={`risk risk-${risk}`}>
              {t.risk.label}: {t.risk[risk]}
            </span>
          )}
          <span className="points">
            {format(t.results.points, { earned: formatPoints(check.earned), weight: check.weight })}
          </span>
        </div>
      </div>

      <p className="check-explain">{text.explain}</p>

      {check.status !== "pass" && (
        <div className="fix">
          <p className="fix-title">{t.results.howToFix}</p>
          <p>{adviceFor(t, check)}</p>
          <p className="fix-impact">
            <strong>{t.results.impact}:</strong> {text.impact}
          </p>
          {text.caution && (
            <p className="fix-caution">
              <strong>{t.results.beforeDeploying}:</strong> {text.caution}
            </p>
          )}
          {(snippets.length > 0 || refs.length > 0) && (
            <Disclosure label={`${t.results.exampleConfig} · ${t.results.references}`}>
              <div className="snippets">
                {snippets.map((s) => (
                  <Snippet key={s.label} label={s.label} code={s.code} />
                ))}
              </div>
              {refs.length > 0 && (
                <ul className="fix-refs">
                  {refs.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer">
                        {r.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Disclosure>
          )}
        </div>
      )}

      <Disclosure label={t.results.evidence}>
        {check.evidence ? <pre className="evidence-pre">{check.evidence}</pre> : <p className="muted small">{t.results.noEvidence}</p>}
      </Disclosure>
    </li>
  );
}

/* ---------- Results ---------- */

export function Results({
  report,
  previous,
  savedAt,
  focusOnMount,
  onNewScan,
}: {
  report: ScanReport;
  previous?: ScanReport;
  /** Set when showing a scan from history rather than a fresh one. */
  savedAt: string | null;
  focusOnMount: boolean;
  onNewScan: () => void;
}) {
  const { t, lang } = useLanguage();
  const [filter, setFilter] = useState<Filter>("all");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const counts = countStatuses(report.checks);
  const host = hostOf(report.inputUrl);

  useEffect(() => {
    // Move focus (and the viewport) to the results after a fresh scan.
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  function exportPdf() {
    // Prints the formal report (components/PrintReport.tsx); the browser's "Save as PDF" creates the file.
    const original = document.title;
    document.title = `${t.report.fileName}-${host.replace(/[^a-z0-9.-]/gi, "_")}-${reportId(report)}`;
    const restore = () => {
      document.title = original;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: t.results.filterAll, count: report.checks.length },
    { value: "fail", label: t.results.failed, count: counts.fail },
    { value: "warn", label: t.results.warnings, count: counts.warn },
    { value: "pass", label: t.results.passed, count: counts.pass },
  ];

  const byId = new Map(report.checks.map((c) => [c.id, c]));
  const grouped = CHECK_GROUPS.map((g) => ({
    id: g.id,
    checks: g.checks
      .map((id) => byId.get(id))
      .filter((c): c is CheckResult => c !== undefined)
      .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status]),
  }));
  const visible = (c: CheckResult) => filter === "all" || c.status === filter;

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results-toolbar">
        <div className="results-heading">
          <h2 id="results-title" ref={headingRef} tabIndex={-1}>
            {t.results.title}
          </h2>
          <p className="mono muted results-host">{host}</p>
        </div>
        <div className="btn-row no-print">
          <button type="button" className="btn btn-secondary" onClick={exportPdf} title={t.results.exportHint}>
            <DownloadIcon size={16} />
            {t.results.exportPdf}
          </button>
          <button type="button" className="btn btn-primary" onClick={onNewScan}>
            <PlusIcon size={16} />
            {t.results.newScan}
          </button>
        </div>
      </div>

      {savedAt && (
        <p className="notice no-print">{format(t.results.viewingSaved, { date: formatDate(savedAt, lang) })}</p>
      )}

      <div className="overview">
        <ScoreCard report={report} />
        <ScanInfo report={report} />
      </div>

      {previous && <Comparison report={report} previous={previous} />}

      <div className="checks-header">
        <h3 className="section-title">
          {t.results.checks}
          <span className="muted small">{format(t.results.checksPassed, { pass: counts.pass, total: report.checks.length })}</span>
        </h3>
        <div className="filters no-print" role="group" aria-label={t.results.filterLabel}>
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`filter filter-${f.value}${filter === f.value ? " active" : ""}`}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className="filter-count">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {filter !== "all" && !report.checks.some(visible) && (
        <p className="muted empty-filter no-print">{t.results.noneInFilter}</p>
      )}

      {grouped.map((g) => {
        const groupHidden = !g.checks.some(visible);
        return (
          <section key={g.id} className={`check-group${groupHidden ? " is-filtered" : ""}`} aria-labelledby={`group-${g.id}`}>
            <div className="group-head">
              <h4 id={`group-${g.id}`}>{t.groups[g.id].title}</h4>
              <p>{t.groups[g.id].desc}</p>
            </div>
            <ul className="checks">
              {g.checks.map((c) => (
                <CheckCard key={c.id} check={c} hidden={!visible(c)} />
              ))}
            </ul>
          </section>
        );
      })}

      {/* Formal report document: hidden on screen, the only thing printed. */}
      <PrintReport report={report} t={t} lang={lang} />
    </section>
  );
}
