import { useRef, useState } from 'react';
import { SCORE_CHECK, mergePoints, samePoint, type CalibrationAccuracy, type CalibrationPoint } from '../core/calibration';
import type { Exam, ScoreScale } from '../core/types';
import { BUILTIN_CALIBRATION, allPoints, parsePoints } from '../exams/calibration';
import { downloadText } from '../parsers/files';

/** Scales whose scores are estimated, so an official score is worth entering. */
export function estimatedScales(exam: Exam): ScoreScale[] {
  return exam.scales.filter((s) => !s.ranges?.length);
}

/**
 * Scales that need an official score before grading, once the model is ready
 * to check them (see SCORE_CHECK): every estimated scale of a real key.
 * Placeholder demo keys have no official score.
 */
export function requiredScales(exam: Exam, enforced: boolean): ScoreScale[] {
  return enforced && !exam.key.isDemo ? estimatedScales(exam) : [];
}

export interface OfficialScoreCheck {
  /** Valid scores by scale id. */
  scores: Record<string, number>;
  /** Problems that block grading. */
  errors: string[];
  /** Scales whose score is far from our estimate (when enforced): grading needs a confirmation. */
  outliers: string[];
  /** Ready to grade (given the confirmation, when there are outliers). */
  ok: boolean;
}

/**
 * Check entered official scores. Each must be on the scale (200–800 in steps
 * of 10 on the SAT) and a composite must be in range (400–1600). When
 * `enforced` (the model is ready, see SCORE_CHECK), scores are also required
 * and one far from our estimate is flagged.
 */
export function checkOfficialScores(
  exam: Exam,
  values: Record<string, string>,
  estimates: Record<string, number> = {},
  confirmed = false,
  enforced = false,
): OfficialScoreCheck {
  const scores: Record<string, number> = {};
  const errors: string[] = [];
  const outliers: string[] = [];
  const required = requiredScales(exam, enforced);
  for (const scale of estimatedScales(exam)) {
    const text = values[scale.id]?.trim();
    if (!text) {
      if (required.includes(scale)) errors.push(`Enter the official ${scale.name} score.`);
      continue;
    }
    const n = Number(text);
    if (!Number.isInteger(n) || n < scale.min || n > scale.max) {
      errors.push(`${scale.name}: enter a score from ${scale.min} to ${scale.max}.`);
    } else if (n % scale.step !== 0) {
      errors.push(`${scale.name}: scores end in ${scale.step === 10 ? '0' : `a multiple of ${scale.step}`}.`);
    } else {
      scores[scale.id] = n;
      const estimate = estimates[scale.id];
      if (enforced && estimate !== undefined && Math.abs(n - estimate) > SCORE_CHECK.toleranceSteps * scale.step) outliers.push(scale.name);
    }
  }
  for (const composite of exam.composites) {
    const parts = composite.scaleIds.map((id) => scores[id]);
    if (composite.method !== 'sum' || parts.some((v) => v === undefined)) continue;
    const total = parts.reduce((a, b) => a + b, 0);
    if (total < composite.min || total > composite.max) errors.push(`${composite.name} must be from ${composite.min} to ${composite.max}.`);
  }
  return { scores, errors, outliers, ok: errors.length === 0 && (outliers.length === 0 || confirmed) };
}

export function ActualScoreInputs({
  exam,
  values,
  onChange,
  check,
  confirmed,
  onConfirm,
  enforced,
}: {
  enforced: boolean;
  exam: Exam;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  check: OfficialScoreCheck;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
}) {
  const scales = estimatedScales(exam);
  if (!scales.length) return null;
  const required = requiredScales(exam, enforced).length > 0;
  // Only typed-in problems show here; a missing score is noted by the Grade button.
  const shown = check.errors.filter((e) => !e.startsWith('Enter the official'));
  return (
    <div className="small secondary" style={{ marginTop: 8 }}>
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
        {shown.length > 0 && <span className="field-error">{shown.join(' ')}</span>}
      </div>
      {check.outliers.length > 0 && (
        <label className="row" style={{ gap: 6, marginTop: 4 }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} />
          <span>
            <span className="field-error">
              {check.outliers.join(' and ')} {check.outliers.length === 1 ? 'is' : 'are'} unusually far from what these answers predict.
            </span>{' '}
            I’ve checked {check.outliers.length === 1 ? 'it' : 'them'} against Bluebook.
          </span>
        </label>
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
  const gate = Math.round(SCORE_CHECK.maxShareBeyond * 100);
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
        scores are built in; {own} {own === 1 ? 'was' : 'were'} added here. Once no more than {gate}% of estimates are off by more than 20
        points (now {pctBeyond}%), official scores become required and are checked against the estimate.
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
