import type { CompositeScore, ScaleAnchor, ScaleRange, ScoreScale } from './types';

export interface ScoreRange {
  lower: number;
  upper: number;
}

/** The official (lower, upper) range for a raw score, when the scale has a table. */
export function toScaledRange(scale: ScoreScale, raw: number): ScoreRange | null {
  if (!scale.ranges?.length) return null;
  const rows = [...scale.ranges].sort((a, b) => a.raw - b.raw);
  const row = rows.find((r) => r.raw === raw) ?? (raw < rows[0].raw ? rows[0] : rows[rows.length - 1]);
  return { lower: row.lower, upper: row.upper };
}

/**
 * Convert a raw score to a scaled score. With an official range table this is
 * the range midpoint; otherwise values between anchors are interpolated.
 */
export function toScaled(scale: ScoreScale, raw: number): number {
  const range = toScaledRange(scale, raw);
  const anchors = [...scale.anchors].sort((a, b) => a.raw - b.raw);

  let value: number;
  if (range) {
    value = (range.lower + range.upper) / 2;
  } else if (anchors.length === 0) {
    value = scale.min;
  } else if (raw <= anchors[0].raw) {
    value = anchors[0].scaled;
  } else if (raw >= anchors[anchors.length - 1].raw) {
    value = anchors[anchors.length - 1].scaled;
  } else {
    const hi = anchors.findIndex((a) => a.raw >= raw);
    const lo = anchors[hi - 1];
    const up = anchors[hi];
    value = lo.scaled + ((raw - lo.raw) / (up.raw - lo.raw)) * (up.scaled - lo.scaled);
  }

  const rounded = Math.round(value / scale.step) * scale.step;
  return Math.min(scale.max, Math.max(scale.min, rounded));
}

/**
 * Build anchors from percent-correct breakpoints so one curve shape can be
 * reused for sections of different lengths.
 */
export function anchorsFromPercent(maxRaw: number, points: [number, number][]): ScaleAnchor[] {
  return points.map(([pct, scaled]) => ({ raw: pct * maxRaw, scaled }));
}

/**
 * Re-express an official range table as midpoint anchors on a percent-correct
 * basis, so a test of a different length can borrow its curve.
 */
export function anchorsFromRangeTable(table: ScaleRange[], tableMaxRaw: number, maxRaw: number): ScaleAnchor[] {
  return table.map((r) => ({ raw: (r.raw / tableMaxRaw) * maxRaw, scaled: (r.lower + r.upper) / 2 }));
}

/** Build a range table from rows of [raw, lower, upper]. */
export function rangeTable(rows: [number, number, number][]): ScaleRange[] {
  return rows.map(([raw, lower, upper]) => ({ raw, lower, upper }));
}

export function computeComposite(composite: CompositeScore, scaled: Record<string, number>): number | null {
  const values = composite.scaleIds.map((id) => scaled[id]);
  if (values.some((v) => v === undefined)) return null;
  const total = values.reduce((a, b) => a + b, 0);
  const value = composite.method === 'sum' ? total : Math.round(total / values.length); // ACT rounds .5 up
  return Math.min(composite.max, Math.max(composite.min, value));
}

/** A summed composite of ranged scales is itself a range (lowers + uppers). */
export function computeCompositeRange(composite: CompositeScore, ranges: Record<string, ScoreRange | null>): ScoreRange | null {
  if (composite.method !== 'sum') return null;
  const parts = composite.scaleIds.map((id) => ranges[id]);
  if (parts.some((p) => !p)) return null;
  return {
    lower: parts.reduce((n, p) => n + p!.lower, 0),
    upper: parts.reduce((n, p) => n + p!.upper, 0),
  };
}
