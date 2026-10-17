import { useRef, useState } from 'react';
import { mergePoints, samePoint, type CalibrationAccuracy, type CalibrationPoint } from '../core/calibration';
import type { Exam, ScoreScale } from '../core/types';
import { BUILTIN_CALIBRATION, allPoints, parsePoints } from '../exams/calibration';
import { downloadText } from '../parsers/files';

/** Scales whose scores are estimated, so an official score is worth entering. */
export function estimatedScales(exam: Exam): ScoreScale[] {
  return exam.scales.filter((s) => !s.ranges?.length);
}

export const ACCURACY_CONFIRMATION = 'I have verified my results from Bluebook and confirm this data is accurate.';

export interface OfficialScoreCheck {
  /** Valid scores by scale id. */
  scores: Record<string, number>;
  /** Problems that block grading. */
  errors: string[];
  /** Official scores or Bluebook results are being used, so grading needs the accuracy confirmation. */
  needsConfirmation: boolean;
  /** A required score is still empty. */
  missing: boolean;
  /** Ready to grade. */
  ok: boolean;
}

/**
 * Scales that need an official score before grading: every estimated scale
 * of a real key. Placeholder demo keys have no official score.
 */
export function requiredScales(exam: Exam): ScoreScale[] {
  return exam.key.isDemo ? [] : estimatedScales(exam);
}

/**
 * Check entered official scores: required ones must be filled, each must be
 * on the scale (200–800 in steps of 10 on the SAT) and a composite in range
 * (400–1600). Grading with official scores or pasted Bluebook results needs
 * the user's confirmation that the data matches Bluebook, since it trains
 * the score model.
 */
export function checkOfficialScores(exam: Exam, values: Record<string, string>, { confirmed = false, bluebookResults = false } = {}): OfficialScoreCheck {
  const scores: Record<string, number> = {};
  const errors: string[] = [];
  let typed = false;
  let missing = false;
  const required = requiredScales(exam);
  for (const scale of estimatedScales(exam)) {
    const text = values[scale.id]?.trim();
    if (!text) {
      if (required.includes(scale)) missing = true;
      continue;
    }
    typed = true;
    const n = Number(text);
    if (!Number.isInteger(n) || n < scale.min || n > scale.max) errors.push(`${scale.name}: enter a score from ${scale.min} to ${scale.max}.`);
    else if (n % scale.step !== 0) errors.push(`${scale.name}: scores end in ${scale.step === 10 ? '0' : `a multiple of ${scale.step}`}.`);
    else scores[scale.id] = n;
  }
  for (const composite of exam.composites) {
    const parts = composite.scaleIds.map((id) => scores[id]);
    if (composite.method !== 'sum' || parts.some((v) => v === undefined)) continue;
    const total = parts.reduce((a, b) => a + b, 0);
    if (total < composite.min || total > composite.max) errors.push(`${composite.name} must be from ${composite.min} to ${composite.max}.`);
  }
  const needsConfirmation = typed || bluebookResults || required.length > 0;
  return { scores, errors, needsConfirmation, missing, ok: errors.length === 0 && !missing && (!needsConfirmation || confirmed) };
}

export function ActualScoreInputs({
  exam,
  values,
  onChange,
  check,
  onConfirm,
}: {
  exam: Exam;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  check: OfficialScoreCheck;
  /** Called with false when a score changes, so the accuracy confirmation must be given again. */
  onConfirm: (v: boolean) => void;
}) {
  const scales = estimatedScales(exam);
  const required = requiredScales(exam).length > 0;
  return (
    <div className="small secondary" style={{ marginTop: 8 }}>
      {scales.length > 0 && (
        <div className="row">
          <span title="Saved (without names) to train the score model.">Official scores{required ? '' : ' (optional)'}:</span>
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
                onChange={(e) => {
                  onChange({ ...values, [scale.id]: e.target.value });
                  onConfirm(false);
                }}
              />
            </label>
          ))}
          {check.errors.length > 0 && <span className="field-error">{check.errors.join(' ')}</span>}
        </div>
      )}
    </div>
  );
}

export function CalibrationSummary({
  saved,
  accuracy,
  onChange,
}: {
  saved: CalibrationPoint[];
  accuracy: CalibrationAccuracy;
  onChange: (points: CalibrationPoint[]) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const points = allPoints(saved);
  const pctBeyond = Math.round(accuracy.beyondTolerance * 100);
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
            · typical error ±{Math.round(accuracy.calibrated)} (uncalibrated ±{Math.round(accuracy.uncalibrated)}) · {pctBeyond}% off by more
            than 20
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
