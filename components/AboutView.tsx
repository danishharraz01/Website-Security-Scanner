"use client";

import { useLanguage } from "./LanguageProvider";
import { LockIcon, ShieldIcon, InfoIcon } from "./Icons";
import { format } from "@/lib/i18n";
import { CHECK_WEIGHTS } from "@/lib/checks";
import { CHECK_GROUPS } from "@/lib/remediation";

/** Mirrors toGrade() in lib/checks.ts. */
const GRADE_SCALE = [
  { grade: "A", range: "90–100" },
  { grade: "B", range: "80–89" },
  { grade: "C", range: "70–79" },
  { grade: "D", range: "60–69" },
  { grade: "E", range: "50–59" },
  { grade: "F", range: "0–49" },
] as const;

export function AboutView() {
  const { t } = useLanguage();

  return (
    <article className="page about" aria-labelledby="about-title">
      <div className="page-head">
        <div>
          <h1 id="about-title">{t.about.title}</h1>
          <p className="muted lead">{t.about.intro}</p>
        </div>
      </div>

      <div className="about-grid">
        <section className="panel">
          <h2 className="panel-title">{t.about.howTitle}</h2>
          <ol className="steps">
            {t.about.howSteps.map((s, i) => (
              <li key={i}>
                <span className="step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <h2 className="panel-title">{t.about.scoringTitle}</h2>
          <p className="muted">{t.about.scoringDesc}</p>
          <h3 className="overline">{t.about.gradeScale}</h3>
          <ul className="grade-scale">
            {GRADE_SCALE.map((g) => (
              <li key={g.grade}>
                <span className={`grade-badge grade-badge-sm grade-${g.grade}`}>{g.grade}</span>
                <span className="mono">{g.range}</span>
                <span className="muted">{t.results.gradeLabel[g.grade]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel about-wide">
          <h2 className="panel-title">{t.about.checksTitle}</h2>
          <div className="weights">
            {CHECK_GROUPS.map((g) => (
              <div key={g.id}>
                <h3 className="overline">{t.groups[g.id].title}</h3>
                <ul>
                  {g.checks.map((id) => (
                    <li key={id}>
                      <div>
                        <strong>{t.checks[id].title}</strong>
                        <p className="muted small">{t.checks[id].explain}</p>
                      </div>
                      <span className="weight">{format(t.about.points, { weight: CHECK_WEIGHTS[id] })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">
            <LockIcon size={16} />
            {t.about.privacyTitle}
          </h2>
          <p className="muted">{t.about.privacyText}</p>
        </section>

        <section className="panel">
          <h2 className="panel-title">
            <InfoIcon size={16} />
            {t.about.limitsTitle}
          </h2>
          <p className="muted">{t.about.limitsText}</p>
        </section>

        <section className="panel about-wide callout">
          <ShieldIcon size={18} />
          <p>{t.footer.disclaimer}</p>
        </section>
      </div>
    </article>
  );
}
