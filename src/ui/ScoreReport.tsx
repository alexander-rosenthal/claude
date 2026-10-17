import { Fragment, useMemo, useState } from 'react';
import type { CategoryResult, GradeReport, QuestionResult, QuestionStatus, ScaleResult, Tally } from '../core/grader';
import type { ScoreRange } from '../core/scoring';
import { downloadText, rowsToCsv } from '../parsers/files';

const pct = (x: number) => `${Math.round(x * 100)}%`;

const STATUS_LABEL: Record<QuestionStatus, string> = { correct: 'Correct', incorrect: 'Incorrect', omitted: 'Omitted' };

function StackBar({ tally, label }: { tally: Tally; label: string }) {
  const parts: [QuestionStatus, number][] = (
    [
      ['correct', tally.correct],
      ['incorrect', tally.incorrect],
      ['omitted', tally.omitted],
    ] as [QuestionStatus, number][]
  ).filter(([, n]) => n > 0);
  const tip = `${label}\nCorrect ${tally.correct} · Incorrect ${tally.incorrect} · Omitted ${tally.omitted}`;
  return (
    <div className="stack" data-tip={tip} role="img" aria-label={tip.replace('\n', ': ')}>
      {parts.map(([status, n]) => (
        <span key={status} className={`sw-${status}`} style={{ flex: n }} />
      ))}
    </div>
  );
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

/** Subcategories worth listing: skip a lone unnamed one. */
function namedSubcategories(c: CategoryResult) {
  return c.subcategories.some((s) => s.name) ? c.subcategories : [];
}

function CategoryTable({ categories }: { categories: CategoryResult[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const sorted = [...categories].sort((a, b) => a.tally.accuracy - b.tally.accuracy);
  return (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            <th>Category</th>
            <th className="r">Correct</th>
            <th className="r">Accuracy</th>
            <th style={{ width: '38%' }}>Breakdown</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <Fragment key={c.name}>
              <tr>
                <td>
                  {namedSubcategories(c).length ? (
                    <button className="btn link" onClick={() => setOpen((o) => ({ ...o, [c.name]: !o[c.name] }))} aria-expanded={!!open[c.name]}>
                      {open[c.name] ? '▾' : '▸'} {c.name}
                    </button>
                  ) : (
                    c.name
                  )}
                </td>
                <td className="r">
                  {c.tally.correct}/{c.tally.total}
                </td>
                <td className="r">{pct(c.tally.accuracy)}</td>
                <td>
                  <StackBar tally={c.tally} label={c.name} />
                </td>
              </tr>
              {open[c.name] &&
                [...namedSubcategories(c)]
                  .sort((a, b) => a.tally.accuracy - b.tally.accuracy)
                  .map((s) => (
                    <tr key={s.name} className="sub">
                      <td>{s.name || <span className="muted">Not specified</span>}</td>
                      <td className="r">
                        {s.tally.correct}/{s.tally.total}
                      </td>
                      <td className="r">{pct(s.tally.accuracy)}</td>
                      <td>
                        <StackBar tally={s.tally} label={s.name} />
                      </td>
                    </tr>
                  ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function questionTip(q: QuestionResult, showAnswers: boolean) {
  const lines = [`#${q.question.number} · ${STATUS_LABEL[q.status]}`];
  if (showAnswers) lines.push(`Your answer: ${q.response ?? '—'}`, `Correct: ${q.question.correct.join(' or ') || '—'}`);
  if (q.question.category !== 'Uncategorized') lines.push(q.question.category);
  if (q.question.subcategory) lines.push(q.question.subcategory);
  return lines.join('\n');
}

function ScaleSection({ result, questions, showAnswers }: { result: ScaleResult; questions: QuestionResult[]; showAnswers: boolean }) {
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
      <div className="table-scroll" style={{ marginBottom: 16 }}>
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
                          data-tip={questionTip(q, showAnswers)}
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

      <h3 style={{ marginBottom: 6 }}>By category (weakest first)</h3>
      {categorized ? (
        <CategoryTable categories={result.categories} />
      ) : (
        <p className="muted small" style={{ margin: 0 }}>
          This answer key has no question categories. Import a key with Category and Subcategory columns to see this breakdown.
        </p>
      )}
    </section>
  );
}

type Filter = 'all' | 'incorrect' | 'missed' | 'omitted';

function QuestionTable({ report, showAnswers }: { report: GradeReport; showAnswers: boolean }) {
  const showSub = report.questions.some((q) => q.question.subcategory);
  const columns = 4 + (showAnswers ? 2 : 0) + (showSub ? 1 : 0);
  const [filter, setFilter] = useState<Filter>('missed');
  const [category, setCategory] = useState('');
  const categories = useMemo(() => [...new Set(report.questions.map((q) => q.question.category))], [report]);

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
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
            <option value="">All categories</option>
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
              <th>Category</th>
              {showSub && <th className="hide-sm">Subcategory</th>}
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
                {showSub && <td className="hide-sm secondary">{q.question.subcategory}</td>}
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
  const rows = [['Section', 'Question', 'Result', 'Your Answer', 'Correct Answer', 'Category', 'Subcategory']];
  for (const q of report.questions) {
    rows.push([q.sectionName, String(q.question.number), STATUS_LABEL[q.status], q.response ?? '', q.question.correct.join(' or '), q.question.category, q.question.subcategory]);
  }
  downloadText(`${report.exam.name.replace(/[^\w]+/g, '-')}-results.csv`, rowsToCsv(rows));
}

export function ScoreReport({ report, studentName, onBack }: { report: GradeReport; studentName: string; onBack: () => void }) {
  const [primary, ...otherComposites] = report.composites;
  const { key, format } = report.exam;
  const showAnswers = report.questions.some((q) => q.question.correct.length > 0 || q.response);
  const notes = [
    format.scoreNote ?? (report.scales.some((s) => s.scale.estimated) ? 'Scaled scores are estimates; official conversions vary by test form.' : ''),
    key.resultsOnly ? 'Graded from the results pasted from Bluebook.' : '',
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
          <div className="muted small num" style={{ textAlign: 'right' }}>
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

        {notes.length > 0 && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            {notes.join(' ')}
          </p>
        )}
      </section>

      {report.scales.map((s) => (
        <ScaleSection key={s.scale.id} result={s} questions={report.questions} showAnswers={showAnswers} />
      ))}

      <QuestionTable report={report} showAnswers={showAnswers} />
    </div>
  );
}
