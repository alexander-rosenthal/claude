import { describe, expect, it } from 'vitest';
import { OFFICIAL_EXAMS, examFromKey } from '../exams';
import { SAT_PRACTICE_TEST_4_BLUEBOOK } from '../exams/keys/satPracticeTest4Bluebook';
import { leaveOneOut, scoreCheckReady } from '../core/calibration';
import { BUILTIN_CALIBRATION, scaleForPoint } from '../exams/calibration';
import { checkOfficialScores, requiredScales } from './Calibration';

const pt4 = examFromKey(SAT_PRACTICE_TEST_4_BLUEBOOK);
const estimates = { rw: 610, math: 600 };

describe('official score check, once the model is ready', () => {
  it('requires both section scores for a real digital SAT key', () => {
    expect(requiredScales(pt4, true).map((s) => s.id)).toEqual(['rw', 'math']);
    const check = checkOfficialScores(pt4, { rw: '610' }, estimates, false, true);
    expect(check.ok).toBe(false);
    expect(check.errors).toEqual(['Enter the official Math score.']);
  });

  it('accepts scores ending in 0 within the section range', () => {
    expect(checkOfficialScores(pt4, { rw: '610', math: '600' }, estimates, false, true)).toMatchObject({ ok: true, scores: { rw: 610, math: 600 }, outliers: [] });
    expect(checkOfficialScores(pt4, { rw: '615', math: '600' }, estimates, false, true).errors).toEqual(['Reading and Writing: scores end in 0.']);
    expect(checkOfficialScores(pt4, { rw: '850', math: '190' }, estimates, false, true).errors).toEqual([
      'Reading and Writing: enter a score from 200 to 800.',
      'Math: enter a score from 200 to 800.',
    ]);
  });

  it('asks for confirmation more than 20 points from the estimate', () => {
    expect(checkOfficialScores(pt4, { rw: '630', math: '580' }, estimates, false, true).ok).toBe(true);
    const far = checkOfficialScores(pt4, { rw: '640', math: '600' }, estimates, false, true);
    expect(far).toMatchObject({ ok: false, errors: [], outliers: ['Reading and Writing'] });
    expect(checkOfficialScores(pt4, { rw: '640', math: '600' }, estimates, true, true).ok).toBe(true);
  });

  it('does not require scores for demo keys or tests with official tables', () => {
    const demo = examFromKey({ ...SAT_PRACTICE_TEST_4_BLUEBOOK, isDemo: true });
    expect(checkOfficialScores(demo, {}, estimates, false, true).ok).toBe(true);
    const paper = OFFICIAL_EXAMS.find((e) => e.format.id === 'sat-paper')!;
    expect(requiredScales(paper, true)).toEqual([]);
    expect(checkOfficialScores(paper, {}).ok).toBe(true);
  });
});

describe('official score check, before the model is ready', () => {
  it('leaves scores optional but still checks what is typed', () => {
    expect(requiredScales(pt4, false)).toEqual([]);
    expect(checkOfficialScores(pt4, {}, estimates).ok).toBe(true);
    expect(checkOfficialScores(pt4, { rw: '700', math: '400' }, estimates)).toMatchObject({ ok: true, outliers: [] });
    expect(checkOfficialScores(pt4, { rw: '705' }, estimates)).toMatchObject({ ok: false, errors: ['Reading and Writing: scores end in 0.'] });
  });

  it('turns on when no more than 3% of estimates miss by over 20', () => {
    const accuracy = leaveOneOut(BUILTIN_CALIBRATION, scaleForPoint);
    expect(accuracy.beyondTolerance).toBeGreaterThan(0.03); // about 13% today
    expect(scoreCheckReady(accuracy)).toBe(false);
    expect(scoreCheckReady({ ...accuracy, beyondTolerance: 0.03 })).toBe(true);
  });
});
