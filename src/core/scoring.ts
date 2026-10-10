import type { CompositeScore, ScaleAnchor, ScoreScale } from './types';

/** Convert a raw score to a scaled score by interpolating between anchors. */
export function toScaled(scale: ScoreScale, raw: number): number {
  const anchors = [...scale.anchors].sort((a, b) => a.raw - b.raw);
  if (anchors.length === 0) return scale.min;

  let value: number;
  if (raw <= anchors[0].raw) {
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

export function computeComposite(composite: CompositeScore, scaled: Record<string, number>): number | null {
  const values = composite.scaleIds.map((id) => scaled[id]);
  if (values.some((v) => v === undefined)) return null;
  const total = values.reduce((a, b) => a + b, 0);
  const value = composite.method === 'sum' ? total : Math.round(total / values.length); // ACT rounds .5 up
  return Math.min(composite.max, Math.max(composite.min, value));
}
