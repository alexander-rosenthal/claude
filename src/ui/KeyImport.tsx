import { useRef, useState } from 'react';
import { AnswerKeyError, buildExam } from '../core/exam';
import type { AnswerKey } from '../core/types';
import { FORMATS, getFormat } from '../exams';
import { answerKeyFromRows, answerKeyTemplate } from '../parsers/answerKey';
import { downloadText, readRowsFromFile, rowsToCsv } from '../parsers/files';

/** Import a real answer key (answers + categories) from a spreadsheet. */
export function KeyImport({ onImported }: { onImported: (key: AnswerKey) => void }) {
  const [formatId, setFormatId] = useState(FORMATS[0].id);
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const format = getFormat(formatId)!;

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setErrors([]);
    try {
      const { rows } = await readRowsFromFile(file);
      const { key, errors } = answerKeyFromRows(format, rows, name.trim() || file.name.replace(/\.[^.]+$/, ''));
      if (!key) return setErrors(errors);
      buildExam(format, key); // validates completeness
      onImported(key);
      setName('');
    } catch (e) {
      setErrors(e instanceof AnswerKeyError ? e.problems : [e instanceof Error ? e.message : String(e)]);
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <p className="secondary" style={{ marginTop: 0 }}>
        Columns: <b>Section</b>, <b>Question</b>, <b>Answer</b>, <b>Category</b>, <b>Subcategory</b>. Separate multiple acceptable grid-in answers with commas (e.g. <code>3/2, 1.5</code>).
      </p>
      <div className="row">
        <select value={formatId} onChange={(e) => setFormatId(e.target.value)} aria-label="Test format">
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input type="text" placeholder="Test name, e.g. Practice Test 4" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" onClick={() => downloadText(`${format.id}-key-template.csv`, rowsToCsv(answerKeyTemplate(format)))}>
          Download template
        </button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input ref={input} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" onChange={(e) => handle(e.target.files?.[0])} />
      </div>
      {errors.length > 0 && (
        <div className="notice error">
          The key couldn’t be imported:
          <ul>
            {errors.slice(0, 12).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 12 && <li>…and {errors.length - 12} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
