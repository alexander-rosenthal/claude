import { useEffect, useRef, useState } from 'react';
import type { Exam, Responses } from '../core/types';
import type { ParseResult } from '../parsers/collector';
import { readRowsFromFile } from '../parsers/files';
import {
  bluebookTargetExam,
  examForBluebookResults,
  hasUsableDigitalKey,
  looksLikeBluebook,
  moduleChoicesFor,
  type PasteModuleChoice,
  parseBluebook,
  type BluebookGrading,
} from '../parsers/bluebook';
import { parseForAnyVersion, parsePastedResponses, responsesFromRows } from '../parsers/responses';

interface Props {
  exam: Exam;
  onLoad: (responses: Responses) => void;
}

export function ParseNotice({ result }: { result: ParseResult | null }) {
  if (!result) return null;
  const isResults = Boolean(result.outcomes);
  return (
    <>
      <div className={`notice ${result.answered && !result.errors?.length ? 'ok' : 'error'}`}>
        {isResults ? (
          <>
            Read Bluebook results for {result.answered} question{result.answered === 1 ? '' : 's'}.
            {result.errors?.length ? (
              <ul>
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : (
              ' Enter the official scores if you have them, then grade the test.'
            )}
          </>
        ) : (
          <>
            Read {result.answered} answer{result.answered === 1 ? '' : 's'}.
            {result.answered > 0 && ' They are now on the bubble sheet, where you can review and edit them.'}
          </>
        )}
      </div>
      {result.warnings.length > 0 && (
        <div className="notice">
          {result.warnings.length} note{result.warnings.length === 1 ? '' : 's'}:
          <ul>
            {result.warnings.slice(0, 12).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {result.warnings.length > 12 && <li>…and {result.warnings.length - 12} more</li>}
          </ul>
        </div>
      )}
    </>
  );
}

interface PasteProps extends Props {
  /** The paste box's text, kept by the parent so it survives switching tabs. */
  text: string;
  onTextChange: (text: string) => void;
  /** A pasted Bluebook results table: already graded, graded for the report once official scores are entered. */
  onResults: (grading: BluebookGrading, result: ParseResult) => void;
  /** The paste box was emptied. */
  onClear: () => void;
  /** What was last read (text, Module 2 choices and test), so returning to this tab doesn't re-read it over later edits. */
  lastRead: { current: string };
}

/** How long typing must pause before the paste is read again. */
const READ_DELAY_MS = 250;

export function PastePanel({ exam, onLoad, onResults, onClear, text, onTextChange, lastRead }: PasteProps) {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [moduleChoices, setModuleChoices] = useState<Record<string, PasteModuleChoice>>({});
  const isSat = exam.family === 'SAT';
  const adaptive = hasUsableDigitalKey(exam) ? exam.sections.filter((s) => s.adaptive) : [];

  const load = () => {
    if (!text.trim()) {
      setResult(null);
      onClear();
      return;
    }
    if (isSat && looksLikeBluebook(text)) {
      const target = bluebookTargetExam(exam);
      const parsed = parseBluebook(target, text);
      if (parsed.outcomes) {
        const grading = examForBluebookResults(target, parsed, moduleChoices);
        const r = { ...parsed, warnings: [...parsed.warnings, ...grading.warnings] };
        setResult(r);
        onResults(grading, r);
        return;
      }
      const r = parsed;
      setResult(r);
      if (target === exam && r.answered) onLoad(r.responses);
      return;
    }
    const r = parseForAnyVersion(exam, (e) => parsePastedResponses(e, text));
    setResult(r);
    if (r.answered) onLoad(r.responses);
  };

  // Read the paste as soon as it's pasted or typed: no formatting or extra click needed.
  // Keyed on the test, not the exam object, which changes with every answer loaded.
  useEffect(() => {
    const signature = JSON.stringify([text, moduleChoices, exam.key.id, exam.format.id]);
    if (signature === lastRead.current) return;
    const timer = setTimeout(() => {
      lastRead.current = signature;
      load();
    }, READ_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, moduleChoices, exam.key.id, exam.format.id]);

  return (
    <div>
      <p className="secondary" style={{ marginTop: 0 }}>
        {isSat ? (
          <>
            Paste the question table from a Bluebook practice test’s score details (select the whole table and copy it). It’s
            graded from Bluebook’s own results, so no answer key is needed. Or paste any list of answers.
          </>
        ) : (
          'Paste a list of answers.'
        )}{' '}
        No formatting needed. It recognizes, mixed freely:
      </p>
      <ul className="secondary small" style={{ marginTop: 0 }}>
        <li>
          Section headings such as <code>{exam.sections[0].name}</code> or <code>{exam.sections[1]?.shortName}</code>
        </li>
        <li>
          Numbered answers: <code>1. A</code>, <code>2) B</code>, <code>3 C 4 D</code>
          {exam.sections.some((s) => s.allowsSpr) && (
            <>
              , grid-ins as <code>5 3/2</code>
            </>
          )}
        </li>
        <li>
          Letter runs, one per question: <code>ABDCA-BCD</code> (<code>-</code> = blank)
        </li>
        <li>Rows copied from a spreadsheet (Section, Question, Answer)</li>
      </ul>
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        aria-label="Paste answers or Bluebook results"
        placeholder={`Paste here, as is. It's read automatically.\n\n${exam.sections[0].name}\n1 A\n2 C\n…`}
      />
      {adaptive.length > 0 && (
        <div className="row small secondary" style={{ marginTop: 8 }}>
          <span>For a Bluebook results paste, Module 2:</span>
          {adaptive.map((section) => {
            const options = moduleChoicesFor(exam, section.id);
            return (
              <label key={section.id} className="row" style={{ gap: 4 }}>
                {section.shortName}
                <select
                  value={moduleChoices[section.id] ?? options[0].value}
                  onChange={(e) => setModuleChoices((c) => ({ ...c, [section.id]: e.target.value as PasteModuleChoice }))}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}
      <p className="muted small" style={{ margin: '8px 0 0' }}>
        Read automatically as you paste; answers replace those on the bubble sheet.
      </p>
      <ParseNotice result={result} />
    </div>
  );
}

export function UploadPanel({ exam, onLoad }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const { rows, warnings } = await readRowsFromFile(file);
      const r = parseForAnyVersion(exam, (e) => responsesFromRows(e, rows));
      r.warnings.unshift(...warnings);
      setResult(r);
      if (r.answered) onLoad(r.responses);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <p className="secondary" style={{ marginTop: 0 }}>Upload an Excel (.xlsx) or CSV file. Any of these layouts works:</p>
      <ul className="secondary small" style={{ marginTop: 0 }}>
        <li>
          A header row with <b>Question</b> and <b>Answer</b> columns, plus an optional <b>Section</b> column
        </li>
        <li>No header: columns of Section, Question, Answer, or Question, Answer</li>
        <li>A single column of answers in test order</li>
      </ul>
      <p className="muted small">
        Without a Section column, numbering that restarts at 1 begins the next section. Format grid-in answers as text in Excel so 3/2 isn’t turned into a date.
      </p>
      <input ref={input} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" onChange={(e) => handle(e.target.files?.[0])} />
      {error && <div className="notice error">{error}</div>}
      <ParseNotice result={result} />
    </div>
  );
}
