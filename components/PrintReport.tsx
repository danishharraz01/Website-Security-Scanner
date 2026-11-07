/**
 * The printable / PDF security assessment report.
 *
 * This is a separate document, not the dashboard restyled: it is hidden on
 * screen and is the only thing shown when printing (see the "Print report"
 * section of app/globals.css). The browser's "Save as PDF" produces the file,
 * so text stays selectable and searchable and no PDF library is needed.
 *
 * Running headers, footers and "Page X of Y" use CSS @page margin boxes. Their
 * text depends on the report (ID, host, language), so the @page rule is
 * generated here. Every value placed in it is escaped by cssString().
 *
 * All scan data is rendered as React text nodes (auto-escaped).
 */
import { format, type Dict, type Lang } from "@/lib/i18n";
import { CHECK_GROUPS, REFERENCES, REMEDIATION, adviceFor, findingFor, prioritise, riskOf, type Reference, type Risk } from "@/lib/remediation";
import type { CheckResult, Status } from "@/lib/checks";
import type { ScanReport } from "@/lib/scanner";

const SEVERITY: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Deterministic, human-readable report ID derived from the scan itself (target + scan time). */
export function reportId(report: ScanReport): string {
  let h = 0x811c9dc5;
  const seed = `${report.inputUrl}|${report.scannedAt}`;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const d = new Date(report.scannedAt);
  const ymd = Number.isNaN(d.getTime())
    ? "00000000"
    : `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `SS-${ymd}-${h.toString(36).toUpperCase().padStart(7, "0").slice(-6)}`;
}

/** Quotes a value for use inside a CSS `content:` string, so it cannot break out of the rule. */
function cssString(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&").replace(/[<>\r\n\u0000-\u001f]/g, "")}"`;
}

function formatDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "ms" ? "ms-MY" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function pts(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function StatusLabel({ status, t }: { status: Status; t: Dict }) {
  return <span className={`pr-status pr-status-${status}`}>{t.results.status[status]}</span>;
}

function RiskLabel({ risk, t }: { risk: Risk | null; t: Dict }) {
  if (!risk) return <span className="pr-muted">-</span>;
  return <span className={`pr-risk pr-risk-${risk}`}>{t.risk[risk]}</span>;
}

export function PrintReport({ report, t, lang }: { report: ScanReport; t: Dict; lang: Lang }) {
  const id = reportId(report);
  const host = hostOf(report.inputUrl);
  const generated = formatDateTime(new Date().toISOString(), lang);
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const c of report.checks) counts[c.status]++;

  // Same grouping and ordering as the dashboard; each finding gets a stable reference (e.g. 2.1.3).
  const byId = new Map(report.checks.map((c) => [c.id, c]));
  const groups = CHECK_GROUPS.map((g, gi) => ({
    id: g.id,
    num: `2.${gi + 1}`,
    checks: g.checks
      .map((cid) => byId.get(cid))
      .filter((c): c is CheckResult => c !== undefined)
      .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status])
      .map((c, ci) => ({ check: c, ref: `2.${gi + 1}.${ci + 1}` })),
  })).filter((g) => g.checks.length > 0);
  const refOf = new Map(groups.flatMap((g) => g.checks.map(({ check, ref }) => [check.id, ref] as const)));
  const priorities = prioritise(report.checks);

  // References are cited by number in each finding and listed once at the end (consultant-report style).
  const citations: Reference[] = [];
  const citeNo = new Map<string, number>();
  for (const g of groups) {
    for (const { check } of g.checks) {
      if (check.status === "pass") continue;
      for (const r of REFERENCES[check.id] ?? []) {
        if (!citeNo.has(r.url)) {
          citations.push(r);
          citeNo.set(r.url, citations.length);
        }
      }
    }
  }

  const pageCss = `@page {
  @top-left { content: ${cssString(`SiteSentinel  |  ${t.report.docType}`)}; }
  @top-right { content: ${cssString(`${t.report.reportId}: ${id}`)}; }
  @bottom-left { content: ${cssString(host)}; }
  @bottom-right { content: ${cssString(`${t.report.page} `)} counter(page) ${cssString(` ${t.report.of} `)} counter(pages); }
}
@page :first {
  @top-left { content: none; }
  @top-right { content: none; }
}`;

  const scope = (
    <section className="pr-section pr-scope">
      <div className="pr-keep">
        <h2>
          <span className="pr-secnum">3</span>
          {t.report.s3}
        </h2>
        <p>{t.report.scopeIntro}</p>
      </div>
      <ul>
        {t.report.scopeItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {/* Implementation note, references and the closing line form one block, so the last page never holds a stray fragment. */}
      <div className="pr-closing">
      <p>{t.report.implNote}</p>
      {citations.length > 0 && (
        <>
          <h3>{t.report.references}</h3>
          <ol className="pr-citations">
            {citations.map((r, i) => (
              <li key={r.url}>
                <span className="pr-cite-no">[{i + 1}]</span>
                <span>
                  {r.label}. <a href={r.url}>{r.url}</a>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
        <p className="pr-muted">
          {t.report.scoringNote} {t.report.riskNote}
        </p>
        <p className="pr-end">
          <span>
            SiteSentinel · {t.report.reportId} <span className="pr-mono">{id}</span>
          </span>
          <span>{t.report.endOfReport}</span>
        </p>
      </div>
    </section>
  );

  return (
    <div className="print-report" lang={lang}>
      <style media="print">{pageCss}</style>

      {/* ---------- Title block ---------- */}
      <header className="pr-title">
        <div className="pr-brandline">
          {/* eslint-disable-next-line @next/next/no-img-element -- print-only; next/image adds nothing here */}
          <img src="/logo-light.png" alt="SiteSentinel" className="pr-logo" />
          <span className="pr-doctype">{t.report.docType}</span>
        </div>
        <h1>{t.report.title}</h1>
        <table className="pr-kv pr-meta">
          <colgroup>
            <col className="pr-col-k" />
            <col />
            <col className="pr-col-k" />
            <col className="pr-col-v2" />
          </colgroup>
          <tbody>
            <tr>
              <th scope="row">{t.report.target}</th>
              <td className="pr-mono" colSpan={3}>
                {report.inputUrl}
              </td>
            </tr>
            <tr>
              <th scope="row">{t.report.reportId}</th>
              <td className="pr-mono">{id}</td>
              <th scope="row">{t.report.scanDate}</th>
              <td>{formatDateTime(report.scannedAt, lang)}</td>
            </tr>
            <tr>
              <th scope="row">{t.report.preparedBy}</th>
              <td>{t.report.preparedByValue}</td>
              <th scope="row">{t.report.generated}</th>
              <td>{generated}</td>
            </tr>
          </tbody>
        </table>
      </header>

      {/* ---------- 1. Executive summary ---------- */}
      <section className="pr-section">
        <h2>
          <span className="pr-secnum">1</span>
          {t.report.s1}
        </h2>

        <div className={`pr-summary grade-${report.grade}`}>
          <div className="pr-grade">
            <span className="pr-grade-label">{t.report.overallGrade}</span>
            <span className="pr-grade-letter">{report.grade}</span>
            <span className="pr-grade-score">
              {report.score} <small>/ 100</small>
            </span>
          </div>
          <div className="pr-assessment">
            <p className="pr-assessment-head">
              {t.report.assessment}: <strong>{t.results.gradeLabel[report.grade]}</strong>
            </p>
            <p>{t.results.gradeNote[report.grade]}</p>
            <p>{format(t.report.summaryLine, { total: report.checks.length, ...counts })}</p>
            <table className="pr-counts">
              <thead>
                <tr>
                  <th scope="col">{t.results.passed}</th>
                  <th scope="col">{t.results.warnings}</th>
                  <th scope="col">{t.results.failed}</th>
                  <th scope="col">{t.report.totalChecks}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-c-pass">{counts.pass}</td>
                  <td className="pr-c-warn">{counts.warn}</td>
                  <td className="pr-c-fail">{counts.fail}</td>
                  <td>{report.checks.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="pr-keep-next">{t.report.priorityTitle}</h3>
        {priorities.length === 0 ? (
          <p>{t.report.noActions}</p>
        ) : (
          <>
            <p className="pr-muted pr-intro">{t.report.priorityIntro}</p>
            <table className="pr-table pr-priority">
              <thead>
                <tr>
                  <th scope="col" className="pr-col-num">
                    {t.report.colPriority}
                  </th>
                  <th scope="col" className="pr-col-ref">
                    {t.report.colRef}
                  </th>
                  <th scope="col">{t.report.colFinding}</th>
                  <th scope="col" className="pr-col-risk">
                    {t.report.colRisk}
                  </th>
                </tr>
              </thead>
              <tbody>
                {priorities.map((c, i) => (
                  <tr key={c.id}>
                    <td>{i + 1}</td>
                    <td className="pr-mono">{refOf.get(c.id)}</td>
                    <td>
                      <strong>{t.checks[c.id].title}</strong>
                      <span className="pr-cell-sub">{findingFor(t, c)}</span>
                    </td>
                    <td>
                      <RiskLabel risk={riskOf(c)} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="pr-keep">
          <h3>{t.report.scanInfo}</h3>
          <table className="pr-kv pr-info">
            <colgroup>
              <col className="pr-col-k" />
              <col />
              <col className="pr-col-k" />
              <col className="pr-col-v2" />
            </colgroup>
            <tbody>
              <tr>
                <th scope="row">{t.report.finalUrl}</th>
                <td className="pr-mono" colSpan={3}>
                  {report.finalUrl}
                </td>
              </tr>
              <tr>
                <th scope="row">{t.results.redirects}</th>
                <td>{report.redirectCount}</td>
                <th scope="row">{t.results.statusCode}</th>
                <td className="pr-mono">{report.statusCode}</td>
              </tr>
              <tr>
                <th scope="row">{t.results.duration}</th>
                <td>{format(t.results.seconds, { value: (report.durationMs / 1000).toFixed(1) })}</td>
                <th scope="row">{t.results.scannedAt}</th>
                <td>{formatDateTime(report.scannedAt, lang)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="pr-keep-next">{t.report.findingsOverview}</h3>
        <table className="pr-table">
          <thead>
            <tr>
              <th scope="col" className="pr-col-ref">
                {t.report.colRef}
              </th>
              <th scope="col">{t.report.colCheck}</th>
              <th scope="col" className="pr-col-status">
                {t.report.colStatus}
              </th>
              <th scope="col" className="pr-col-risk">
                {t.report.colRisk}
              </th>
              <th scope="col" className="pr-col-pts">
                {t.report.colPoints}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) =>
              g.checks.map(({ check, ref }) => (
                <tr key={check.id}>
                  <td className="pr-mono">{ref}</td>
                  <td>{t.checks[check.id].title}</td>
                  <td>
                    <StatusLabel status={check.status} t={t} />
                  </td>
                  <td>
                    <RiskLabel risk={riskOf(check)} t={t} />
                  </td>
                  <td className="pr-col-pts">
                    {pts(check.earned)} / {check.weight}
                  </td>
                </tr>
              )),
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>{t.report.score}</td>
              <td className="pr-col-pts">{report.score} / 100</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* ---------- 2. Detailed findings ---------- */}
      <section className="pr-section pr-findings">
        {groups.map((g, gi) => (
          <div key={g.id} className="pr-group">
            {g.checks.map(({ check, ref }, ci) => {
              const text = t.checks[check.id];
              const risk = riskOf(check);
              const failing = check.status !== "pass";
              const snippets = failing ? (REMEDIATION[check.id] ?? []) : [];
              const refs = failing ? (REFERENCES[check.id] ?? []) : [];
              const isFirst = ci === 0;
              return (
                <article key={check.id} className={`pr-finding pr-finding-${check.status}`}>
                  {/* Unbreakable core; section/category headings travel with the first finding. */}
                  <div className="pr-finding-main">
                    {isFirst && gi === 0 && (
                      <h2>
                        <span className="pr-secnum">2</span>
                        {t.report.s2}
                      </h2>
                    )}
                    {isFirst && (
                      <h3>
                        <span className="pr-secnum">{g.num}</span>
                        {t.groups[g.id].title}
                      </h3>
                    )}
                    <header className="pr-finding-head">
                      <span className="pr-ref pr-mono">{ref}</span>
                      <h4>{text.title}</h4>
                      <StatusLabel status={check.status} t={t} />
                      <span className="pr-points">
                        {format(t.report.points, { earned: pts(check.earned), weight: check.weight })}
                      </span>
                    </header>
                    <dl className="pr-fields">
                      <dt>{t.report.finding}</dt>
                      <dd>{findingFor(t, check)}</dd>
                      {risk && (
                        <>
                          <dt>{t.risk.label}</dt>
                          <dd>
                            <RiskLabel risk={risk} t={t} />
                            <span className="pr-risk-impact">{text.impact}</span>
                          </dd>
                        </>
                      )}
                      <dt>{t.report.description}</dt>
                      <dd>{text.explain}</dd>
                      <dt>{t.report.evidence}</dt>
                      <dd>
                        {check.evidence ? (
                          <pre className="pr-code">{check.evidence}</pre>
                        ) : (
                          <span className="pr-muted">{t.results.noEvidence}</span>
                        )}
                      </dd>
                      <dt>{t.report.recommendation}</dt>
                      <dd>{failing ? adviceFor(t, check) : <span className="pr-muted">{t.report.noAction}</span>}</dd>
                      {failing && text.caution && (
                        <>
                          <dt>{t.report.beforeDeploying}</dt>
                          <dd className="pr-caution">{text.caution}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                  {(snippets.length > 0 || refs.length > 0) && (
                    <dl className="pr-fields pr-fields-extra">
                      {snippets.length > 0 && (
                        <>
                          <dt>{t.report.exampleConfig}</dt>
                          <dd>
                            {snippets.map((sn) => (
                              <div key={sn.label} className="pr-snippet">
                                <span className="pr-snippet-label">{sn.label}</span>
                                <pre className="pr-code">{sn.code}</pre>
                              </div>
                            ))}
                          </dd>
                        </>
                      )}
                      {refs.length > 0 && (
                        <>
                          <dt>{t.report.references}</dt>
                          <dd className="pr-refs">
                            {refs.map((r, i) => (
                              <span key={r.url}>
                                {i > 0 && "; "}[{citeNo.get(r.url)}] {r.label}
                              </span>
                            ))}
                          </dd>
                        </>
                      )}
                    </dl>
                  )}
                </article>
              );
            })}
          </div>
        ))}
      </section>

      {/* ---------- 3. Scope ---------- */}
      {scope}
    </div>
  );
}
