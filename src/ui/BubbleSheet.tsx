import { useState } from 'react';
import { normalizeSpr } from '../core/answers';
import type { Exam, Question, Responses } from '../core/types';

interface Props {
  exam: Exam;
  responses: Responses;
  onChange: (questionId: string, value: string) => void;
}

function answeredIn(questions: Question[], responses: Responses) {
  return questions.filter((q) => responses[q.id]).length;
}

export function BubbleSheet({ exam, responses, onChange }: Props) {
  const [sectionId, setSectionId] = useState(exam.sections[0].id);
  const section = exam.sections.find((s) => s.id === sectionId) ?? exam.sections[0];

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
        </span>
      </div>
      <div className="sheet-grid">
        {section.questions.map((q) =>
          q.type === 'spr' ? (
            <SprRow key={q.id} question={q} value={responses[q.id] ?? ''} onChange={(v) => onChange(q.id, v)} />
          ) : (
            <div className="sheet-row" key={q.id}>
              <span className="qn">{q.number}</span>
              {q.choices.map((choice) => {
                const selected = responses[q.id] === choice;
                return (
                  <button
                    key={choice}
                    className="bubble"
                    aria-pressed={selected}
                    aria-label={`Question ${q.number}, choice ${choice}`}
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

function SprRow({ question, value, onChange }: { question: Question; value: string; onChange: (v: string) => void }) {
  const invalid = value !== '' && !normalizeSpr(value).valid;
  return (
    <div className="sheet-row">
      <span className="qn">{question.number}</span>
      <input
        type="text"
        inputMode="decimal"
        className={`spr-input${invalid ? ' invalid' : ''}`}
        value={value}
        placeholder="e.g. 3/2"
        maxLength={6}
        aria-label={`Question ${question.number}, student-produced response`}
        aria-invalid={invalid}
        title={invalid ? 'Enter a number, decimal or fraction (up to 5 characters, 6 if negative)' : undefined}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9./\-]/g, ''))}
      />
      <span className="tag">grid-in</span>
    </div>
  );
}
