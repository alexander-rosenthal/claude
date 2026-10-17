import { useMemo, useState } from 'react';
import {
  MASTERY_THRESHOLDS,
  type CategoryResult,
  type GradeReport,
  type Mastery,
  type MasterySummary,
  type QuestionResult,
  type QuestionStatus,
  type ScaleResult,
  type TopicResult,
} from '../core/grader';
import { ROUTE_METHOD_LABEL } from '../core/routing';
import type { ScoreRange } from '../core/scoring';
import type { Exam, Topic } from '../core/types';
import { downloadText, rowsToCsv } from '../parsers/files';

const pct = (x: number) => `${Math.round(x * 100)}%`;

const STATUS_LABEL: Record<QuestionStatus, string> = { correct: 'Correct', incorrect: 'Incorrect', omitted: 'Omitted' };

const MASTERY_LABEL: Record<Mastery, string> = {
  mastered: 'Mastered',
  review: 'For review',
  instruction: 'For instruction',
};

const MASTERY_RANGE: Record<Mastery, string> = {
  mastered: `≥${MASTERY_THRESHOLDS.mastered * 100}%`,
  review: `${MASTERY_THRESHOLDS.review * 100}–${MASTERY_THRESHOLDS.mastered * 100 - 1}%`,
  instruction: `<${MASTERY_THRESHOLDS.review * 100}%`,
};

const topicLabel = (t: Topic) => (t.subskill ? `${t.skill} › ${t.subskill}` : t.skill);

/** "1.14" = Module 1, question 14 (the section's position within its score scale). */
function questionRef(exam: Exam, q: QuestionResult): string {
  const section = exam.sections.find((s) => s.id === q.sectionId)!;
  const group = exam.sections.filter((s) => s.scaleId === section.scaleId);
  return group.length > 1 ? `${group.indexOf(section) + 1}.${q.question.number}` : String(q.question.number);
}

function questionTip(exam: Exam, q: QuestionResult, showAnswers: boolean) {
  const section = exam.sections.find((s) => s.id === q.sectionId)!;
  const lines = [`${section.shortName} #${q.question.number} · ${STATUS_LABEL[q.status]}`];
  if (showAnswers) lines.push(`Your answer: ${q.response ?? '—'}`, `Correct: ${q.question.correct.join(' or ') || '—'}`);
  if (q.question.category !== 'Uncategorized') lines.push(q.question.category);
  for (const t of q.question.topics) lines.push(`· ${topicLabel(t)}`);
  return lines.join('\n');
}

function Legend() {
  return (
    <div className="legend">
      {(['correct', 'incorrect', 'omitted'] as QuestionStatus[]).map((s) => (
        <span key={s}>
          <i className={`sw-${s}`} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

interface TileProps {
  label: string;
  value: number;
  range?: ScoreRange | null;
  min: number;
  max: number;
  sub?: string;
  hero?: boolean;
}

function ScoreTile({ label, value, range, min, max, sub, hero }: TileProps) {
  const fill = ((value - min) / (max - min)) * 100;
  const isRange = range && range.lower !== range.upper;
  return (
    <div className={`tile${hero ? ' hero' : ''}`}>
      <div className="label">{label}</div>
      <div className={`value${isRange ? ' is-range' : ''}`}>{isRange ? `${range.lower}–${range.upper}` : value}</div>
      <div className="range">
        {min}–{max}
        {sub ? ` · ${sub}` : ''}
      </div>
      <div className="scale-track" aria-hidden>
        <span style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skills: domain → skill → subskill with mastery tiers
// ---------------------------------------------------------------------------

function MasteryBadge({ topic }: { topic: TopicResult }) {
  return (
    <span className={`badge m-${topic.mastery}`} title={`${MASTERY_LABEL[topic.mastery]} (${MASTERY_RANGE[topic.mastery]})`}>
      {pct(topic.tally.accuracy)}
    </span>
  );
}

function QuestionChips({ exam, questions, showAnswers }: { exam: Exam; questions: QuestionResult[]; showAnswers: boolean }) {
  // Missed first, then correct, each in test order.
  const missed = questions.filter((q) => q.status !== 'correct');
  const correct = questions.filter((q) => q.status === 'correct');
  return (
    <span className="chips">
      {[...missed, ...correct].map((q) => (
        <span
          key={q.question.id}
          className={`chip sw-${q.status} ${q.status}`}
          data-tip={questionTip(exam, q, showAnswers)}
          aria-label={`${questionRef(exam, q)} ${STATUS_LABEL[q.status]}`}
        >
          {questionRef(exam, q)}
        </span>
      ))}
    </span>
  );
}

function TopicRow({ topic, level, exam, chips, showAnswers }: { topic: TopicResult; level: 0 | 1 | 2; exam: Exam; chips: boolean; showAnswers: boolean }) {
  return (
    <div className={`topic-row level-${level}`}>
      <MasteryBadge topic={topic} />
      <span className="topic-name">{topic.name}</span>
      {chips && <QuestionChips exam={exam} questions={topic.questions} showAnswers={showAnswers} />}
      <span className="topic-count num">
        {topic.tally.correct} of {topic.tally.total}
      </span>
    </div>
  );
}

const byAccuracy = <T extends TopicResult>(items: T[]) => [...items].sort((a, b) => a.tally.accuracy - b.tally.accuracy);

function MasteryStrip({ summary }: { summary: MasterySummary }) {
  return (
    <div className="mastery-strip">
      {(['mastered', 'review', 'instruction'] as Mastery[]).map((m) => (
        <span key={m} className="mastery-item">
          <span className={`badge m-${m}`}>{summary[m]}</span>
          <span>
            {MASTERY_LABEL[m]} <span className="muted small">{MASTERY_RANGE[m]}</span>
          </span>
        </span>
      ))}
      <span className="muted small">{summary.total} topics</span>
    </div>
  );
}

function SkillsBreakdown({ exam, categories, summary, showAnswers }: { exam: Exam; categories: CategoryResult[]; summary: MasterySummary; showAnswers: boolean }) {
  const hasSkills = categories.some((c) => c.skills.length > 0);
  const untagged = hasSkills && categories.some((c) => c.questions.some((q) => q.question.topics.length === 0));
  return (
    <>
      <div className="card-head" style={{ marginBottom: 8 }}>
        <h3>{hasSkills ? 'Strengths and weaknesses' : 'By domain'} (weakest first)</h3>
        <span className="spacer" />
        <MasteryStrip summary={summary} />
      </div>
      <div className="topics">
        {byAccuracy(categories).map((c) => (
          <div className="topic-block" key={c.name}>
            {/* Domains show question chips only when there are no skills to carry them. */}
            <TopicRow topic={c} level={0} exam={exam} chips={c.skills.length === 0} showAnswers={showAnswers} />
            {byAccuracy(c.skills).map((s) => (
              <div key={s.name}>
                <TopicRow topic={s} level={1} exam={exam} chips showAnswers={showAnswers} />
                {byAccuracy(s.subskills).map((sub) => (
                  <TopicRow key={sub.name} topic={sub} level={2} exam={exam} chips showAnswers={showAnswers} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      {hasSkills && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Question chips read module.question (1.14 = Module 1, question 14), missed first. A question can count toward more than one skill
          {untagged ? '; questions without skill tags count only toward their domain' : ''}.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Score scale card
// ---------------------------------------------------------------------------

function ScaleSection({ exam, result, questions, showAnswers }: { exam: Exam; result: ScaleResult; questions: QuestionResult[]; showAnswers: boolean }) {
  const categorized = result.categories.some((c) => c.name !== 'Uncategorized');
  const score = result.range && result.range.lower !== result.range.upper ? `${result.range.lower}–${result.range.upper}` : result.scaled;
  return (
    <section className="card">
      <div className="card-head">
        <h2>{result.scale.name}</h2>
        <span className="secondary num">
          {score} · raw {result.raw}/{result.maxRaw} · {pct(result.tally.accuracy)}
        </span>
        <span className="spacer" />
        <Legend />
      </div>

      <h3 style={{ marginBottom: 6 }}>By section</h3>
      <div className="table-scroll" style={{ marginBottom: 20 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Section</th>
              <th className="r">Correct</th>
              <th className="r hide-sm">Incorrect</th>
              <th className="r hide-sm">Omitted</th>
              <th className="r">Accuracy</th>
              <th>Questions</th>
            </tr>
          </thead>
          <tbody>
            {result.sections.map(({ section, tally }) => (
              <tr key={section.id}>
                <td>
                  <span className="hide-sm">{section.name}</span>
                  <span className="show-sm nowrap">{section.shortName}</span>
                </td>
                <td className="r">
                  {tally.correct}/{tally.total}
                </td>
                <td className="r hide-sm">{tally.incorrect}</td>
                <td className="r hide-sm">{tally.omitted}</td>
                <td className="r">{pct(tally.accuracy)}</td>
                <td>
                  <div className="qstrip">
                    {questions
                      .filter((q) => q.sectionId === section.id)
                      .map((q) => (
                        <span
                          key={q.question.id}
                          className={`qcell sw-${q.status} ${q.status}`}
                          data-tip={questionTip(exam, q, showAnswers)}
                          aria-label={`Question ${q.question.number} ${STATUS_LABEL[q.status]}`}
                        >
                          {q.question.number}
                        </span>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {categorized ? (
        <SkillsBreakdown exam={exam} categories={result.categories} summary={result.mastery} showAnswers={showAnswers} />
      ) : (
        <>
          <h3 style={{ marginBottom: 6 }}>By domain</h3>
          <p className="muted small" style={{ margin: 0 }}>
            This answer key has no question categories. Import a key with Domain, Skill and Subskill columns to see this breakdown.
          </p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Question detail
// ---------------------------------------------------------------------------

type Filter = 'all' | 'incorrect' | 'missed' | 'omitted';

function QuestionTable({ report, showAnswers }: { report: GradeReport; showAnswers: boolean }) {
  const [filter, setFilter] = useState<Filter>('missed');
  const [category, setCategory] = useState('');
  const categories = useMemo(() => [...new Set(report.questions.map((q) => q.question.category))], [report]);
  const showSkills = report.questions.some((q) => q.question.topics.length);
  const columns = 4 + (showAnswers ? 2 : 0) + (showSkills ? 1 : 0);

  const rows = report.questions.filter((q) => {
    if (category && q.question.category !== category) return false;
    if (filter === 'incorrect') return q.status === 'incorrect';
    if (filter === 'omitted') return q.status === 'omitted';
    if (filter === 'missed') return q.status !== 'correct';
    return true;
  });

  return (
    <section className="card">
      <div className="card-head">
        <h2>Question detail</h2>
        <span className="muted small num">{rows.length} shown</span>
        <span className="spacer" />
        <div className="row no-print">
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Result filter">
            <option value="missed">Incorrect + omitted</option>
            <option value="incorrect">Incorrect only</option>
            <option value="omitted">Omitted only</option>
            <option value="all">All questions</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Domain filter">
            <option value="">All domains</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Section</th>
              <th className="r">#</th>
              <th>Result</th>
              {showAnswers && <th>Your answer</th>}
              {showAnswers && <th>Correct</th>}
              <th>Domain</th>
              {showSkills && <th className="hide-sm">Skills</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.question.id}>
                <td className="secondary nowrap">{report.exam.sections.find((s) => s.id === q.sectionId)!.shortName}</td>
                <td className="r">{q.question.number}</td>
                <td>
                  <span className={`status ${q.status}`}>
                    <i className={`sw-${q.status}`} />
                    {STATUS_LABEL[q.status]}
                  </span>
                </td>
                {showAnswers && (
                  <td className="num">
                    {q.response ?? <span className="muted">—</span>}
                    {q.invalid && <span className="tag" title="Not a valid answer for this question"> invalid</span>}
                  </td>
                )}
                {showAnswers && <td className="num">{q.question.correct.join(' or ') || <span className="muted">—</span>}</td>}
                <td>{q.question.category}</td>
                {showSkills && (
                  <td className="hide-sm secondary">
                    {q.question.topics.map((t) => (
                      <div key={topicLabel(t)}>{topicLabel(t)}</div>
                    ))}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns} className="muted">
                  Nothing to show for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function exportCsv(report: GradeReport) {
  const rows = [['Section', 'Question', 'Result', 'Your Answer', 'Correct Answer', 'Domain', 'Skills']];
  for (const q of report.questions) {
    rows.push([
      q.sectionName,
      String(q.question.number),
      STATUS_LABEL[q.status],
      q.response ?? '',
      q.question.correct.join(' or '),
      q.question.category,
      q.question.topics.map(topicLabel).join('; '),
    ]);
  }
  downloadText(`${report.exam.name.replace(/[^\w]+/g, '-')}-results.csv`, rowsToCsv(rows));
}

export function ScoreReport({ report, studentName, onBack }: { report: GradeReport; studentName: string; onBack: () => void }) {
  const [primary, ...otherComposites] = report.composites;
  const { key, format } = report.exam;
  const showAnswers = report.questions.some((q) => q.question.correct.length > 0 || q.response);
  const notes = [
    format.scoreNote ?? (report.scales.some((s) => s.scale.estimated) ? 'Scaled scores are estimates; official conversions vary by test form.' : ''),
    key.resultsOnly ? 'Graded from the results pasted from Bluebook, which counts unanswered questions as incorrect.' : '',
    ...report.notes,
    key.isDemo ? 'This report uses a placeholder demo answer key.' : '',
  ].filter(Boolean);

  return (
    <div>
      <div className="row no-print" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={onBack}>
          ← Edit answers
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn" onClick={() => exportCsv(report)}>
          Export CSV
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <section className="card">
        <div className="report-head">
          <div>
            <h1>{studentName ? `${studentName} · ` : ''}Score Report</h1>
            <div className="secondary">{report.exam.name}</div>
          </div>
          <div className="muted small num report-meta">
            {report.gradedAt.toLocaleString()}
            <br />
            {report.overall.correct}/{report.overall.total} correct · {report.overall.incorrect} incorrect · {report.overall.omitted} omitted
          </div>
        </div>

        <div className="tiles">
          {primary && <ScoreTile hero label={primary.composite.name} value={primary.value} range={primary.range} min={primary.composite.min} max={primary.composite.max} />}
          {report.scales.map((s) => (
            <ScoreTile key={s.scale.id} label={s.scale.name} value={s.scaled} range={s.range} min={s.scale.min} max={s.scale.max} sub={`raw ${s.raw}/${s.maxRaw}`} />
          ))}
          {otherComposites.map((c) => (
            <ScoreTile key={c.composite.id} label={c.composite.name} value={c.value} range={c.range} min={c.composite.min} max={c.composite.max} />
          ))}
        </div>

        {report.routing.length > 0 && (
          <ul className="routing small" aria-label="Module 2 versions">
            {report.routing.map((d) => (
              <li key={d.sectionId}>
                <b>{d.sectionName}:</b> {d.versionName} — {ROUTE_METHOD_LABEL[d.method]}. <span className="muted">{d.reason}</span>
              </li>
            ))}
          </ul>
        )}
        {notes.length > 0 && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            {notes.join(' ')}
          </p>
        )}
      </section>

      {report.scales.map((s) => (
        <ScaleSection key={s.scale.id} exam={report.exam} result={s} questions={report.questions} showAnswers={showAnswers} />
      ))}

      <QuestionTable report={report} showAnswers={showAnswers} />
    </div>
  );
}
