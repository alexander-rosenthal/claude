import { describe, expect, it } from 'vitest';
import { OFFICIAL_EXAMS, examFromKey } from '../exams';
import { SAT_PRACTICE_TEST_4_BLUEBOOK } from '../exams/keys/satPracticeTest4Bluebook';
import { checkOfficialScores } from './Calibration';

const pt4 = examFromKey(SAT_PRACTICE_TEST_4_BLUEBOOK);

describe('official score check', () => {
  it('requires both section scores for a real digital SAT key', () => {
    expect(checkOfficialScores(pt4, {}, { confirmed: true })).toMatchObject({ ok: false, missing: true, errors: [] });
    expect(checkOfficialScores(pt4, { rw: '610' }, { confirmed: true })).toMatchObject({ ok: false, missing: true });
  });

  it('does not require scores for demo keys', () => {
    const demo = examFromKey({ ...SAT_PRACTICE_TEST_4_BLUEBOOK, isDemo: true });
    expect(checkOfficialScores(demo, {})).toMatchObject({ ok: true, missing: false, needsConfirmation: false });
  });

  it('accepts scores ending in 0 within the section range', () => {
    expect(checkOfficialScores(pt4, { rw: '610', math: '600' }, { confirmed: true })).toMatchObject({ ok: true, scores: { rw: 610, math: 600 } });
    expect(checkOfficialScores(pt4, { rw: '615', math: '600' }).errors).toEqual(['Reading and Writing: scores end in 0.']);
    expect(checkOfficialScores(pt4, { rw: '850', math: '190' }).errors).toEqual([
      'Reading and Writing: enter a score from 200 to 800.',
      'Math: enter a score from 200 to 800.',
    ]);
  });

  it('accepts any valid score, however far from the estimate', () => {
    expect(checkOfficialScores(pt4, { rw: '800', math: '200' }, { confirmed: true }).ok).toBe(true);
  });

  it('needs the accuracy confirmation', () => {
    expect(checkOfficialScores(pt4, { rw: '610', math: '600' })).toMatchObject({ ok: false, needsConfirmation: true, missing: false });
    expect(checkOfficialScores(pt4, { rw: '610', math: '600' }, { confirmed: true }).ok).toBe(true);
    const demo = examFromKey({ ...SAT_PRACTICE_TEST_4_BLUEBOOK, isDemo: true });
    expect(checkOfficialScores(demo, {}, { bluebookResults: true })).toMatchObject({ ok: false, needsConfirmation: true });
  });

  it('has nothing to enter for tests with official tables', () => {
    const paper = OFFICIAL_EXAMS.find((e) => e.format.id === 'sat-paper')!;
    expect(checkOfficialScores(paper, { rw: '500' })).toMatchObject({ ok: true, needsConfirmation: false });
  });
});
