import { useMemo, useState } from 'react';
import { grade, type GradeReport } from '../core/grader';
import { ROUTE_METHOD_LABEL, routeByAnswers, routedSections, type ModuleChoice } from '../core/routing';
import type { AnswerKey, Exam, Responses } from '../core/types';
import { BUILTIN_EXAMS, examFromKey, loadSavedKeys, saveKeys } from '../exams';
import { BubbleSheet } from './BubbleSheet';
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

  const answered = exam.sections.reduce((n, s) => n + s.questions.filter((q) => responses[q.id]).length, 0);
  const total = exam.sections.reduce((n, s) => n + s.questions.length, 0);

  const selectExam = (id: string) => {
    if (id === examId) return;
    if (answered && !confirm('Switching tests clears the answers entered so far. Continue?')) return;
    setExamId(id);
    setResponses({});
    setModuleChoices({});
  };

  const importKey = (key: AnswerKey) => {
    const next = [key, ...savedKeys];
    setSavedKeys(next);
    saveKeys(next);
    setExamId(examFromKey(key).id);
    setResponses({});
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
          <BubbleSheet key={exam.id} exam={exam} responses={responses} onChange={(id, v) => setResponses((r) => ({ ...r, [id]: v }))} />
        )}
        {tab === 'paste' && (
          <PastePanel
            exam={exam}
            onLoad={setResponses}
            onResults={(g, r) => setReport({ ...grade(g.exam, r.responses, r.outcomes), notes: g.notes, routing: g.routing })}
          />
        )}
        {tab === 'upload' && <UploadPanel exam={exam} onLoad={setResponses} />}
        {tab === 'key' && <KeyImport onImported={importKey} />}
      </section>

      <div className="row card" style={{ position: 'sticky', bottom: 8 }}>
        <span className="num">
          <b>{answered}</b>
          <span className="muted">/{total} answered</span>
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn" disabled={!answered} onClick={() => confirm('Clear all answers?') && setResponses({})}>
          Clear
        </button>
        <button className="btn primary" onClick={() => setReport({ ...grade(exam, responses), routing: routed.decisions })}>
          Grade test
        </button>
      </div>
    </div>
  );
}
