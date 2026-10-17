/**
 * Calibrating estimated scores against real ones.
 *
 * The digital SAT is scored with item response theory, whose parameters
 * aren't published, so its scaled scores are estimated from a conversion
 * curve. Each official score a user enters (e.g. from Bluebook) becomes a
 * calibration point, and estimates are corrected toward those points:
 *
 *   estimate = curve(raw) + pooled correction + test correction
 *
 * - The pooled correction learns from every test of the same format, scale
 *   and Module 2 version (e.g. "a harder Module 2 is worth more than the
 *   curve says").
 * - The test correction learns from points on the same test, on top of that.
 *
 * Each correction is a kernel-weighted average of the residuals (actual minus
 * curve) near the raw score, shrunk toward zero when there are few points
 * nearby. The result is kept monotonic in the raw score.
 */
import { type CompositeResult, type GradeReport, type ScaleResult, compositesOf } from './grader';
import { roundScaled, scaledCurve } from './scoring';
import type { Exam, ScoreScale } from './types';

export interface CalibrationPoint {
  formatId: string;
  /** The answer key (test form) the score came from. */
  keyId: string;
  scaleId: string;
  /** Module 2 version(s) behind this scale ('' for a non-adaptive scale). */
  version: string;
  raw: number;
  maxRaw: number;
  /** The official scaled score. */
  actual: number;
  /** Question ids not answered correctly, kept for item-level modeling later. */
  missed?: string[];
  /** Where the point came from (an anonymized report id), for built-in points. */
  source?: string;
}

export const CALIBRATION = {
  /** Kernel width, as a share of the scale's raw points. */
  bandwidth: 0.12,
  /** How many points' worth of weight pulls a correction toward zero. */
  priorWeight: 0.5,
};

interface Context {
  formatId: string;
  keyId: string;
  scaleId: string;
  version: string;
  maxRaw: number;
}

/** The answer key a report's scores belong to, or null when it isn't a real test form. */
export function testKeyId(exam: Exam): string | null {
  if (exam.key.isDemo) return null;
  if (exam.key.resultsOnly) return exam.key.sourceKeyId ?? null;
  return exam.key.id;
}

/** Module 2 version(s) behind a scale, or null when one is unknown (domains only). */
export function scaleVersion(report: GradeReport, scaleId: string): string | null {
  const adaptive = report.exam.sections.filter((s) => s.scaleId === scaleId && s.adaptive);
  const parts: string[] = [];
  for (const section of adaptive) {
    const decision = report.routing.find((d) => d.sectionId === section.id);
    if (decision && decision.version === null) return null;
    const version = decision?.version ?? report.exam.versions[section.id];
    if (version) parts.push(version);
  }
  return parts.join('+');
}

function correction(residuals: { raw: number; residual: number }[], raw: number, maxRaw: number): number {
  const width = CALIBRATION.bandwidth * maxRaw;
  let weight = 0;
  let sum = 0;
  for (const p of residuals) {
    const w = Math.exp(-0.5 * ((p.raw - raw) / width) ** 2);
    weight += w;
    sum += w * p.residual;
  }
  return sum / (weight + CALIBRATION.priorWeight);
}

/** Calibrated scaled scores for every raw score 0..maxRaw. */
export function calibratedCurve(scale: ScoreScale, ctx: Context, points: CalibrationPoint[]): { values: number[]; pooled: number; test: number } {
  const pooled = points.filter((p) => p.formatId === ctx.formatId && p.scaleId === ctx.scaleId && p.version === ctx.version && p.maxRaw === ctx.maxRaw);
  const test = pooled.filter((p) => p.keyId === ctx.keyId);
  const pooledResiduals = pooled.map((p) => ({ raw: p.raw, residual: p.actual - scaledCurve(scale, p.raw) }));
  const pooledAt = (raw: number) => correction(pooledResiduals, raw, ctx.maxRaw);
  const testResiduals = test.map((p) => ({ raw: p.raw, residual: p.actual - scaledCurve(scale, p.raw) - pooledAt(p.raw) }));

  const values: number[] = [];
  let floor = -Infinity;
  for (let raw = 0; raw <= ctx.maxRaw; raw++) {
    const value = scaledCurve(scale, raw) + pooledAt(raw) + correction(testResiduals, raw, ctx.maxRaw);
    floor = Math.max(floor, value);
    values.push(roundScaled(scale, floor));
  }
  return { values, pooled: pooled.length, test: test.length };
}

/** Scales whose conversion is an estimate (no official range table). */
const calibratable = (scale: ScoreScale) => !scale.ranges?.length;

/**
 * Apply calibration points and any actual scores the user entered (by scale
 * id) to a report. Reported scores become the actual ones where given.
 */
export function applyScores(report: GradeReport, points: CalibrationPoint[], actual: Record<string, number | undefined> = {}): GradeReport {
  const keyId = testKeyId(report.exam);
  const scales: ScaleResult[] = report.scales.map((s) => {
    let estimate = s.estimate;
    let calibration = s.calibration;
    const version = scaleVersion(report, s.scale.id);
    if (calibratable(s.scale) && keyId && version !== null) {
      const ctx = { formatId: report.exam.format.id, keyId, scaleId: s.scale.id, version, maxRaw: s.maxRaw };
      const curve = calibratedCurve(s.scale, ctx, points);
      if (curve.pooled > 0) {
        estimate = curve.values[s.raw];
        calibration = { pooled: curve.pooled, test: curve.test };
      }
    }
    const given = actual[s.scale.id];
    return { ...s, estimate, calibration, actual: given ?? null, scaled: given ?? estimate };
  });
  const composites: CompositeResult[] = compositesOf(report.exam, scales);
  return { ...report, scales, composites };
}

/** Calibration points from a report's entered actual scores. */
export function pointsFromReport(report: GradeReport): CalibrationPoint[] {
  const keyId = testKeyId(report.exam);
  if (!keyId) return [];
  return report.scales.flatMap((s) => {
    const version = scaleVersion(report, s.scale.id);
    if (s.actual == null || version === null || !calibratable(s.scale)) return [];
    const missed = report.questions
      .filter((q) => q.status !== 'correct' && report.exam.sections.some((sec) => sec.id === q.sectionId && sec.scaleId === s.scale.id))
      .map((q) => q.question.id);
    return [{ formatId: report.exam.format.id, keyId, scaleId: s.scale.id, version, raw: s.raw, maxRaw: s.maxRaw, actual: s.actual, missed }];
  });
}

/** Two points come from the same graded result, whatever official score was entered. */
export function sameResult(a: CalibrationPoint, b: CalibrationPoint): boolean {
  return samePoint({ ...a, actual: 0 }, { ...b, actual: 0 });
}

/**
 * The report's estimates, calibrated from every point except those from this
 * same result, so a re-graded test is never predicted from its own score.
 */
export function estimateReport(report: GradeReport, points: CalibrationPoint[], actual: Record<string, number | undefined> = {}): GradeReport {
  const own = pointsFromReport(applyScores(report, [], Object.fromEntries(report.scales.map((s) => [s.scale.id, 0]))));
  return applyScores(report, points.filter((p) => !own.some((o) => sameResult(o, p))), actual);
}

/** Two points describe the same result (a re-grade), so only one is kept. */
export function samePoint(a: CalibrationPoint, b: CalibrationPoint): boolean {
  return (
    a.formatId === b.formatId &&
    a.keyId === b.keyId &&
    a.scaleId === b.scaleId &&
    a.version === b.version &&
    a.raw === b.raw &&
    a.actual === b.actual &&
    (a.missed ?? []).join() === (b.missed ?? []).join()
  );
}

export function mergePoints(existing: CalibrationPoint[], added: CalibrationPoint[]): CalibrationPoint[] {
  return [...existing, ...added.filter((p) => !existing.some((e) => samePoint(e, p)))];
}

export interface CalibrationAccuracy {
  /** Points that could be checked (their scale was found). */
  n: number;
  /** Mean absolute error of the uncalibrated curve. */
  uncalibrated: number;
  /** Mean absolute error when each point is predicted from all the others. */
  calibrated: number;
  /** Share of points predicted more than two score steps away (±20 on the SAT). */
  beyondTolerance: number;
}

/** Leave-one-out check: predict each point from the rest and compare with its actual score. */
export function leaveOneOut(points: CalibrationPoint[], scaleFor: (p: CalibrationPoint) => ScoreScale | undefined): CalibrationAccuracy {
  let n = 0;
  let uncalibrated = 0;
  let calibrated = 0;
  let beyond = 0;
  points.forEach((p, i) => {
    const scale = scaleFor(p);
    if (!scale) return;
    const rest = points.filter((_, j) => j !== i);
    const predicted = calibratedCurve(scale, p, rest).values[p.raw];
    n++;
    uncalibrated += Math.abs(roundScaled(scale, scaledCurve(scale, p.raw)) - p.actual);
    calibrated += Math.abs(predicted - p.actual);
    if (Math.abs(predicted - p.actual) > 2 * scale.step) beyond++;
  });
  return { n, uncalibrated: n ? uncalibrated / n : 0, calibrated: n ? calibrated / n : 0, beyondTolerance: n ? beyond / n : 0 };
}
