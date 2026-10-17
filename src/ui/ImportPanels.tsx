import { useRef, useState } from 'react';
import type { Exam, Responses } from '../core/types';
import type { ParseResult } from '../parsers/collector';
import { readRowsFromFile } from '../parsers/files';
import { bluebookTargetExam, examForBluebookResults, looksLikeBluebook, parseBluebook } from '../parsers/bluebook';
import { parsePastedResponses, responsesFromRows } from '../parsers/responses';

interface Props {
  exam: Exam;
  onLoad: (responses: Responses) => void;
}

export function ParseNotice({ result }: { result: ParseResult | null }) {
  if (!result) return null;
  const isResults = Boolean(result.outcomes);
  return (
    <>
      <div className={`notice ${result.answered ? 'ok' : 'error'}`}>
        {isResults ? (
          <>Read Bluebook results for {result.answered} question{result.answered === 1 ? '' : 's'}.</>
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
  /** A pasted Bluebook results table: already graded, ready for a report. */
  onResults: (exam: Exam, result: ParseResult) => void;
}

export function PastePanel({ exam, onLoad, onResults }: PasteProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [pending, setPending] = useState<{ exam: Exam; result: ParseResult } | null>(null);
  const isSat = exam.family === 'SAT';

  const load = () => {
    setPending(null);
    if (isSat && looksLikeBluebook(text)) {
      const target = bluebookTargetExam(exam);
      const r = parseBluebook(target, text);
      setResult(r);
      if (r.outcomes) {
        const gradeWith = examForBluebookResults(target, r);
        // Go straight to the report unless there's something to read first.
        if (r.warnings.length) setPending({ exam: gradeWith, result: r });
        else onResults(gradeWith, r);
        return;
      }
      if (target === exam && r.answered) onLoad(r.responses);
      return;
    }
    const r = parsePastedResponses(exam, text);
    setResult(r);
    if (r.answered) onLoad(r.responses);
  };

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
        Accepted formats, mixed freely:
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
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={`${exam.sections[0].name}\n1 A\n2 C\n…`} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" disabled={!text.trim()} onClick={load}>
          Load answers
        </button>
        <span className="muted small">Replaces the answers currently on the sheet.</span>
      </div>
      <ParseNotice result={result} />
      {pending && (
        <button className="btn primary" onClick={() => onResults(pending.exam, pending.result)}>
          View score report →
        </button>
      )}
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
      const r = responsesFromRows(exam, rows);
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
