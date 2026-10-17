import { useState } from 'react';
import { isCorrect, normalizeSpr } from '../core/answers';
import type { Exam, Question, Responses } from '../core/types';

interface Props {
  exam: Exam;
  responses: Responses;
  onChange: (questionId: string, value: string) => void;
  /** Outline the key's answers in green and wrong selections in red. */
  marked: boolean;
  onMarkedChange: (marked: boolean) => void;
}

function answeredIn(questions: Question[], responses: Responses) {
  return questions.filter((q) => responses[q.id]).length;
}

export function BubbleSheet({ exam, responses, onChange, marked, onMarkedChange }: Props) {
  const [sectionId, setSectionId] = useState(exam.sections[0].id);
  const section = exam.sections.find((s) => s.id === sectionId) ?? exam.sections[0];
  const hasKey = exam.sections.some((s) => s.questions.some((q) => q.correct.length > 0));
  const mark = marked && hasKey;

  return (
    <div>
      <div className="sheet-sections" role="group" aria-label="Section">
        {exam.sections.map((s) => (
          <button key={s.id} className="btn" aria-pressed={s.id === section.id} onClick={() => setSectionId(s.id)}>
            {s.shortName}{' '}
            <span className="muted small num">
              {answeredIn(s.questions, responses)}/{s.questions.length}
            </span>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 8 }}>
        <h2>{section.name}</h2>
        <span className="muted small">
          {section.questions.length} questions{section.timeLimitMinutes ? ` · ${section.timeLimitMinutes} min` : ''}
          {mark && ` · ${section.questions.filter((q) => isCorrect(q, responses[q.id])).length} correct`}
        </span>
        {hasKey && (
          <label className="row small secondary mark-toggle" style={{ gap: 6 }}>
            <input type="checkbox" checked={marked} onChange={(e) => onMarkedChange(e.target.checked)} />
            Mark answers
          </label>
        )}
      </div>
      <div className="sheet-grid">
        {section.questions.map((q) =>
          q.type === 'spr' ? (
            <SprRow key={q.id} question={q} value={responses[q.id] ?? ''} marked={mark && q.correct.length > 0} onChange={(v) => onChange(q.id, v)} />
          ) : (
            <div className="sheet-row" key={q.id}>
              <span className="qn">{q.number}</span>
              {q.choices.map((choice) => {
                const selected = responses[q.id] === choice;
                const isKey = mark && q.correct.includes(choice);
                const wrong = mark && selected && q.correct.length > 0 && !isKey;
                return (
                  <button
                    key={choice}
                    className={`bubble${isKey ? ' key' : ''}${wrong ? ' wrong' : ''}`}
                    aria-pressed={selected}
                    aria-label={`Question ${q.number}, choice ${choice}${isKey ? ' (correct answer)' : ''}${wrong ? ' (incorrect)' : ''}`}
                    onClick={() => onChange(q.id, selected ? '' : choice)}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function SprRow({ question, value, marked, onChange }: { question: Question; value: string; marked: boolean; onChange: (v: string) => void }) {
  const invalid = value !== '' && !normalizeSpr(value).valid;
  const right = marked && isCorrect(question, value);
  return (
    <div className="sheet-row">
      <span className="qn">{question.number}</span>
      <input
        type="text"
        inputMode="decimal"
        className={`spr-input${invalid ? ' invalid' : ''}${marked ? (right ? ' key' : ' wrong') : ''}`}
        value={value}
        placeholder="e.g. 3/2"
        maxLength={6}
        aria-label={`Question ${question.number}, student-produced response`}
        aria-invalid={invalid}
        title={invalid ? 'Enter a number, decimal or fraction (up to 5 characters, 6 if negative)' : undefined}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9./\-]/g, ''))}
      />
      {marked && !right ? (
        <span className="small key-answer" title={`Accepted: ${question.correct.join(', ')}`}>
          {question.correct[0]}
        </span>
      ) : (
        <span className="tag">grid-in</span>
      )}
    </div>
  );
}
