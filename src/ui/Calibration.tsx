import { useRef, useState } from 'react';
import { leaveOneOut, mergePoints, samePoint, type CalibrationPoint } from '../core/calibration';
import type { Exam, ScoreScale } from '../core/types';
import { BUILTIN_CALIBRATION, allPoints, parsePoints, scaleForPoint } from '../exams/calibration';
import { downloadText } from '../parsers/files';

/** Scales whose scores are estimated, so an official score is worth entering. */
export function estimatedScales(exam: Exam): ScoreScale[] {
  return exam.scales.filter((s) => !s.ranges?.length);
}

/** Valid entered scores by scale id, plus a message for each invalid one. */
export function parseActualScores(exam: Exam, values: Record<string, string>): { scores: Record<string, number>; errors: string[] } {
  const scores: Record<string, number> = {};
  const errors: string[] = [];
  for (const scale of estimatedScales(exam)) {
    const text = values[scale.id]?.trim();
    if (!text) continue;
    const n = Number(text);
    if (Number.isInteger(n) && n >= scale.min && n <= scale.max && n % scale.step === 0) scores[scale.id] = n;
    else errors.push(`${scale.name}: enter a score from ${scale.min} to ${scale.max}${scale.step > 1 ? ` in steps of ${scale.step}` : ''}.`);
  }
  return { scores, errors };
}

export function ActualScoreInputs({ exam, values, onChange }: { exam: Exam; values: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const scales = estimatedScales(exam);
  if (!scales.length) return null;
  const { errors } = parseActualScores(exam, values);
  return (
    <div className="row small secondary" style={{ marginTop: 8 }}>
      <span title="Shown on the report next to our estimate, and saved (without names) to calibrate future estimates.">Official scores (optional):</span>
      {scales.map((scale) => (
        <label key={scale.id} className="row" style={{ gap: 4 }}>
          {scale.name}
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Official ${scale.name} score`}
            className="num"
            style={{ width: 64 }}
            placeholder={`${scale.min}–${scale.max}`}
            value={values[scale.id] ?? ''}
            onChange={(e) => onChange({ ...values, [scale.id]: e.target.value })}
          />
        </label>
      ))}
      {errors.length > 0 && <span className="field-error">{errors.join(' ')}</span>}
    </div>
  );
}

export function CalibrationSummary({ saved, onChange }: { saved: CalibrationPoint[]; onChange: (points: CalibrationPoint[]) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const points = allPoints(saved);
  const accuracy = leaveOneOut(points, scaleForPoint);
  const own = points.length - BUILTIN_CALIBRATION.length;

  const importFile = async (f: File) => {
    try {
      const added = parsePoints(await f.text()).filter((p) => !BUILTIN_CALIBRATION.some((b) => samePoint(b, p)));
      const next = mergePoints(saved, added);
      onChange(next);
      setMessage(`Added ${next.length - saved.length} new score${next.length - saved.length === 1 ? '' : 's'}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <details className="small secondary" style={{ marginTop: 8 }}>
      <summary>
        Score calibration: {points.length} official section score{points.length === 1 ? '' : 's'}
        {accuracy.n > 1 && (
          <>
            {' '}
            · typical error ±{Math.round(accuracy.calibrated)} (uncalibrated ±{Math.round(accuracy.uncalibrated)})
          </>
        )}
      </summary>
      <p className="muted">
        Each official score entered with a graded test is saved in this browser, without the student’s name, and used to correct
        estimates for that test and Module 2 version. The typical error predicts each saved score from all the others. {BUILTIN_CALIBRATION.length}{' '}
        scores are built in; {own} {own === 1 ? 'was' : 'were'} added here.
      </p>
      <div className="row">
        <button className="btn" onClick={() => downloadText('score-calibration.json', JSON.stringify(points, null, 2), 'application/json')}>
          Export
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          Import
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
        <button className="btn" disabled={!saved.length} onClick={() => confirm('Delete the scores saved in this browser?') && onChange([])}>
          Clear saved
        </button>
        {message && <span className="muted">{message}</span>}
      </div>
    </details>
  );
}
