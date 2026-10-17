/**
 * Official scores that calibrate the estimated ones (see core/calibration.ts).
 *
 * Built-in points come from real Bluebook score reports, anonymized: just the
 * test, Module 2 version, raw score, the Bluebook section score and which
 * questions were missed. Points entered in the app are saved in this browser
 * and can be exported to add here.
 */
import { mergePoints, type CalibrationPoint } from '../core/calibration';
import type { ScoreScale } from '../core/types';
import { getFormat } from './formats';

export const BUILTIN_CALIBRATION: CalibrationPoint[] = [
  // Harder-route sample student (Reading and Writing, Math)
  {
    formatId: 'sat-digital',
    keyId: 'sat-pt4-bluebook',
    scaleId: 'rw',
    version: 'harder',
    raw: 36,
    maxRaw: 54,
    actual: 610,
    missed: ['rw1-2', 'rw1-3', 'rw1-5', 'rw1-10', 'rw1-14', 'rw1-18', 'rw1-20', 'rw1-27', 'rw2-3', 'rw2-6', 'rw2-14', 'rw2-19', 'rw2-20', 'rw2-22', 'rw2-23', 'rw2-25', 'rw2-26', 'rw2-27'],
  },
  {
    formatId: 'sat-digital',
    keyId: 'sat-pt4-bluebook',
    scaleId: 'math',
    version: 'harder',
    raw: 29,
    maxRaw: 44,
    actual: 600,
    missed: ['math1-9', 'math1-19', 'math1-20', 'math1-22', 'math2-8', 'math2-10', 'math2-11', 'math2-12', 'math2-13', 'math2-14', 'math2-15', 'math2-17', 'math2-18', 'math2-20', 'math2-21'],
  },
  // Easier-route sample student (Reading and Writing, Math)
  {
    formatId: 'sat-digital',
    keyId: 'sat-pt4-bluebook',
    scaleId: 'rw',
    version: 'easier',
    raw: 31,
    maxRaw: 54,
    actual: 430,
    missed: ['rw1-3', 'rw1-7', 'rw1-10', 'rw1-12', 'rw1-13', 'rw1-16', 'rw1-18', 'rw1-19', 'rw1-20', 'rw1-21', 'rw1-22', 'rw1-24', 'rw2-2', 'rw2-4', 'rw2-8', 'rw2-9', 'rw2-14', 'rw2-17', 'rw2-18', 'rw2-20', 'rw2-21', 'rw2-22', 'rw2-26'],
  },
  {
    formatId: 'sat-digital',
    keyId: 'sat-pt4-bluebook',
    scaleId: 'math',
    version: 'easier',
    raw: 27,
    maxRaw: 44,
    actual: 490,
    missed: ['math1-2', 'math1-6', 'math1-9', 'math1-11', 'math1-15', 'math1-16', 'math1-18', 'math1-19', 'math1-20', 'math1-22', 'math2-14', 'math2-15', 'math2-17', 'math2-19', 'math2-20', 'math2-21', 'math2-22'],
  },
];

const STORAGE_KEY = 'test-grader:calibration';

/** The scale a point was scored on. */
export function scaleForPoint(p: CalibrationPoint): ScoreScale | undefined {
  return getFormat(p.formatId)?.scales.find((s) => s.id === p.scaleId);
}

function isPoint(x: unknown): x is CalibrationPoint {
  const p = x as CalibrationPoint;
  return (
    typeof p === 'object' &&
    p !== null &&
    ['formatId', 'keyId', 'scaleId', 'version'].every((k) => typeof p[k as keyof CalibrationPoint] === 'string') &&
    ['raw', 'maxRaw', 'actual'].every((k) => Number.isFinite(p[k as keyof CalibrationPoint])) &&
    (p.missed === undefined || (Array.isArray(p.missed) && p.missed.every((m) => typeof m === 'string')))
  );
}

/** Points from an exported calibration file; throws on anything else. */
export function parsePoints(text: string): CalibrationPoint[] {
  const data: unknown = JSON.parse(text);
  const list = Array.isArray(data) ? data : (data as { points?: unknown })?.points;
  if (!Array.isArray(list) || !list.every(isPoint)) throw new Error('This file is not a calibration export.');
  return list;
}

/** Points entered in this browser (built-in points excluded). */
export function loadSavedPoints(): CalibrationPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parsePoints(raw) : [];
  } catch {
    return [];
  }
}

export function savePoints(points: CalibrationPoint[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
  } catch {
    // Storage unavailable (private mode, quota): points last for this session only.
  }
}

/** Built-in and saved points together, without duplicates. */
export function allPoints(saved: CalibrationPoint[]): CalibrationPoint[] {
  return mergePoints(BUILTIN_CALIBRATION, saved);
}
