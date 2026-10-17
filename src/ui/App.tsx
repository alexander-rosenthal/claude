import { useMemo, useRef, useState } from 'react';
import { estimateReport, leaveOneOut, mergePoints, pointsFromReport, sameResult, samePoint, type CalibrationPoint } from '../core/calibration';
import { grade, type GradeReport } from '../core/grader';
import { ROUTE_METHOD_LABEL, routeByAnswers, routedSections, type ModuleChoice } from '../core/routing';
import type { AnswerKey, Exam, Responses } from '../core/types';
import { BUILTIN_EXAMS, examFromKey, loadSavedKeys, saveKeys } from '../exams';
import { BUILTIN_CALIBRATION, allPoints, loadSavedPoints, savePoints, scaleForPoint } from '../exams/calibration';
import type { ParseResult } from '../parsers/collector';
import type { BluebookGrading } from '../parsers/bluebook';
import { BubbleSheet } from './BubbleSheet';
import { ACCURACY_CONFIRMATION, ActualScoreInputs, CalibrationSummary, checkOfficialScores } from './Calibration';
import { PastePanel, UploadPanel } from './ImportPanels';
import { KeyImport } from './KeyImport';
import { ScoreReport } from './ScoreReport';

type Tab = 'sheet' | 'paste' | 'upload' | 'key';

function safeExams(keys: AnswerKey[]): Exam[] {
  return keys.flatMap((k) => {
    try {
      return [examFromKey(k)];
    } catch {
      return [];
    }
  });
}

export function App() {
  const [savedKeys, setSavedKeys] = useState<AnswerKey[]>(loadSavedKeys);
  const exams = useMemo(() => [...safeExams(savedKeys), ...BUILTIN_EXAMS], [savedKeys]);
  const [examId, setExamId] = useState(exams[0].id);
  const baseExam = exams.find((e) => e.id === examId) ?? exams[0];

  const [responses, setResponses] = useState<Responses>({});
  // Adaptive Module 2: routed from Module 1 and checked against the answers, unless overridden.
  const [moduleChoices, setModuleChoices] = useState<Record<string, ModuleChoice>>({});
  const routed = useMemo(() => routeByAnswers(baseExam, responses, moduleChoices), [baseExam, responses, moduleChoices]);
  const exam = routed.exam;
  const [tab, setTab] = useState<Tab>('sheet');
  const [studentName, setStudentName] = useState('');
  const [report, setReport] = useState<GradeReport | null>(null);
  const [actualInput, setActualInput] = useState<Record<string, string>>({});
  const [savedPoints, setSavedPoints] = useState<CalibrationPoint[]>(loadSavedPoints);
  const [confirmed, setConfirmed] = useState(false);
  // Bubble sheet marking: off while answers go in, on once the test is graded.
  const [marked, setMarked] = useState(false);
  // Bluebook results pasted under "Paste": already graded, waiting for official scores.
  const [pasted, setPasted] = useState<{ grading: BluebookGrading; result: ParseResult } | null>(null);
  const [pasteText, setPasteText] = useState('');
  const lastRead = useRef('');

  const updatePoints = (points: CalibrationPoint[]) => {
    setSavedPoints(points);
    savePoints(points);
  };

  // What would be graded now: pasted Bluebook results, or the answers on the sheet.
  const graded = useMemo<GradeReport>(
    () =>
      pasted
        ? { ...grade(pasted.grading.exam, pasted.result.responses, pasted.result.outcomes), notes: pasted.grading.notes, routing: pasted.grading.routing }
        : { ...grade(exam, responses), routing: routed.decisions },
    [pasted, exam, responses, routed],
  );
  const pool = useMemo(() => allPoints(savedPoints), [savedPoints]);
  const accuracy = useMemo(() => leaveOneOut(pool, scaleForPoint), [pool]);
  const pasteErrors = pasted?.result.errors ?? [];
  const check = checkOfficialScores(graded.exam, actualInput, { confirmed, bluebookResults: Boolean(pasted) });
  const canGrade = check.ok && pasteErrors.length === 0;

  /**
   * Grade with the official scores, and save them to train the model. A
   * re-grade of the same result replaces its earlier point (e.g. a corrected
   * typo), and the report's estimate never uses its own score.
   */
  const gradeTest = () => {
    if (!canGrade) return;
    const scored = estimateReport(graded, pool, check.scores);
    setReport(scored);
    setMarked(true);
    const added = pointsFromReport(scored).filter((p) => !BUILTIN_CALIBRATION.some((b) => samePoint(b, p)));
    if (added.length) updatePoints(mergePoints(savedPoints.filter((p) => !added.some((a) => sameResult(a, p))), added));
  };

  const loadResponses = (next: Responses) => {
    setPasted(null);
    setConfirmed(false);
    setMarked(false);
    setResponses(next);
  };

  const answered = exam.sections.reduce((n, s) => n + s.questions.filter((q) => responses[q.id]).length, 0);
  const total = exam.sections.reduce((n, s) => n + s.questions.length, 0);

  const selectExam = (id: string) => {
    if (id === examId) return;
    if (answered && !confirm('Switching tests clears the answers entered so far. Continue?')) return;
    setExamId(id);
    setResponses({});
    setPasted(null);
    setPasteText('');
    lastRead.current = '';
    setModuleChoices({});
    setActualInput({});
    setConfirmed(false);
    setMarked(false);
  };

  const importKey = (key: AnswerKey) => {
    const next = [key, ...savedKeys];
    setSavedKeys(next);
    saveKeys(next);
    setExamId(examFromKey(key).id);
    setResponses({});
    setPasted(null);
    setModuleChoices({});
    setTab('sheet');
  };

  const removeKey = () => {
    if (!confirm(`Remove the answer key "${exam.name}" from this browser?`)) return;
    const next = savedKeys.filter((k) => k.id !== exam.key.id);
    setSavedKeys(next);
    saveKeys(next);
    setExamId(BUILTIN_EXAMS[0].id);
    setResponses({});
    setPasted(null);
    setModuleChoices({});
  };

  if (report) {
    return (
      <div className="app">
        <ScoreReport report={report} studentName={studentName} onBack={() => setReport(null)} />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>Test Grader</h1>
        <span className="spacer" />
        <input type="text" placeholder="Student name (optional)" value={studentName} onChange={(e) => setStudentName(e.target.value)} aria-label="Student name" />
      </div>

      <section className="card">
        <div className="row">
          <label htmlFor="exam" className="secondary">
            Test
          </label>
          <select id="exam" value={baseExam.id} onChange={(e) => selectExam(e.target.value)} style={{ maxWidth: '100%' }}>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <span className="muted small">
            {exam.format.name} · {total} questions
          </span>
          {savedKeys.some((k) => k.id === exam.key.id) && (
            <button className="btn link small" onClick={removeKey}>
              Remove key
            </button>
          )}
        </div>
        {routedSections(baseExam).length > 0 && (
          <div className="row small secondary" style={{ marginTop: 8 }}>
            <span>Module 2 for entered answers:</span>
            {routedSections(baseExam).map((section) => {
              const decision = routed.decisions.find((d) => d.sectionId === section.id);
              return (
                <label key={section.id} className="row" style={{ gap: 4 }}>
                  {section.shortName}
                  <select
                    value={moduleChoices[section.id] ?? 'auto'}
                    onChange={(e) => setModuleChoices((c) => ({ ...c, [section.id]: e.target.value as ModuleChoice }))}
                  >
                    <option value="auto">Auto (cutoff, checked by answers)</option>
                    {baseExam.key.versions![section.id].map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  {decision && (
                    <span className="muted" title={decision.reason}>
                      {decision.versionName} · {ROUTE_METHOD_LABEL[decision.method]}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        <ActualScoreInputs exam={graded.exam} values={actualInput} onChange={setActualInput} check={check} onConfirm={setConfirmed} />
        <CalibrationSummary saved={savedPoints} accuracy={accuracy} onChange={updatePoints} />
        {exam.key.isDemo && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            This test uses a placeholder answer key for trying out the grader. Import a real key under “Answer key”.
          </p>
        )}
        {exam.format.id === 'sat-paper' && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            For answer sheets from the paper version (33 Reading and Writing and 27 Math questions per module). For a test taken in
            Bluebook, paste its score details under “Paste” instead.
          </p>
        )}
      </section>

      <section className="card">
        <div className="tabs" role="tablist">
          {(
            [
              ['sheet', 'Bubble sheet'],
              ['paste', 'Paste'],
              ['upload', 'Upload file'],
              ['key', 'Answer key'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'sheet' && (
          <BubbleSheet
            key={exam.id}
            exam={exam}
            responses={responses}
            marked={marked}
            onMarkedChange={setMarked}
            onChange={(id, v) => {
              setPasted(null);
              setResponses((r) => ({ ...r, [id]: v }));
            }}
          />
        )}
        {tab === 'paste' && (
          <PastePanel
            exam={exam}
            onLoad={loadResponses}
            text={pasteText}
            onTextChange={setPasteText}
            lastRead={lastRead}
            onResults={(g, r) => {
              setPasted({ grading: g, result: r });
              setConfirmed(false);
            }}
            onClear={() => setPasted(null)}
          />
        )}
        {tab === 'upload' && <UploadPanel exam={exam} onLoad={loadResponses} />}
        {tab === 'key' && <KeyImport onImported={importKey} />}
      </section>

      <div className="row card" style={{ position: 'sticky', bottom: 8 }}>
        {pasted ? (
          <span className="small">
            <b>Bluebook results</b> <span className="muted">· {Object.keys(pasted.result.outcomes ?? {}).length} questions</span>{' '}
            <button className="btn link small" onClick={() => setPasted(null)}>
              Discard
            </button>
          </span>
        ) : (
          <span className="num">
            <b>{answered}</b>
            <span className="muted">/{total} answered</span>
          </span>
        )}
        <span style={{ flex: 1 }} />
        {(pasteErrors.length > 0 || check.missing || check.errors.length > 0) && (
          <span className="muted small">
            {pasteErrors.length
              ? 'The pasted results are incomplete; see Paste.'
              : check.missing
                ? 'Enter the official scores to grade.'
                : 'Fix the official scores to grade.'}
          </span>
        )}
        <button
          className="btn"
          disabled={!answered && !pasted}
          onClick={() => {
            if (!confirm('Clear all answers and official scores?')) return;
            setResponses({});
            setPasted(null);
            setPasteText('');
            lastRead.current = '';
            setActualInput({});
            setConfirmed(false);
            setMarked(false);
          }}
        >
          Clear
        </button>
        {check.needsConfirmation && (
          <label className="row small confirm" style={{ gap: 6 }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>{ACCURACY_CONFIRMATION}</span>
          </label>
        )}
        <button className="btn primary" disabled={!canGrade} onClick={gradeTest}>
          Grade test
        </button>
      </div>
    </div>
  );
}
