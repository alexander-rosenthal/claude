import { describe, expect, it } from 'vitest';
import { OFFICIAL_EXAMS, examFromKey } from '../exams';
import { SAT_PRACTICE_TEST_4_BLUEBOOK } from '../exams/keys/satPracticeTest4Bluebook';
import { checkOfficialScores } from './Calibration';

const pt4 = examFromKey(SAT_PRACTICE_TEST_4_BLUEBOOK);

describe('official score check', () => {
  it('leaves official scores optional', () => {
    expect(checkOfficialScores(pt4, {})).toMatchObject({ ok: true, needsConfirmation: false, errors: [] });
  });

  it('accepts scores ending in 0 within the section range', () => {
    expect(checkOfficialScores(pt4, { rw: '610', math: '600' }, { confirmed: true })).toMatchObject({ ok: true, scores: { rw: 610, math: 600 } });
    expect(checkOfficialScores(pt4, { rw: '615' }).errors).toEqual(['Reading and Writing: scores end in 0.']);
    expect(checkOfficialScores(pt4, { rw: '850', math: '190' }).errors).toEqual([
      'Reading and Writing: enter a score from 200 to 800.',
      'Math: enter a score from 200 to 800.',
    ]);
  });

  it('accepts any valid score, however far from the estimate', () => {
    expect(checkOfficialScores(pt4, { rw: '800', math: '200' }, { confirmed: true }).ok).toBe(true);
  });

  it('needs the accuracy confirmation for official scores or pasted Bluebook results', () => {
    expect(checkOfficialScores(pt4, { rw: '610' })).toMatchObject({ ok: false, needsConfirmation: true });
    expect(checkOfficialScores(pt4, {}, { bluebookResults: true })).toMatchObject({ ok: false, needsConfirmation: true });
    expect(checkOfficialScores(pt4, {}, { bluebookResults: true, confirmed: true }).ok).toBe(true);
  });

  it('has nothing to enter for tests with official tables', () => {
    const paper = OFFICIAL_EXAMS.find((e) => e.format.id === 'sat-paper')!;
    expect(checkOfficialScores(paper, { rw: '500' })).toMatchObject({ ok: true, needsConfirmation: false });
  });
});
