import { describe, expect, it } from 'vitest';
import reports from '../../data/nlt-reports.json';
import { BUILTIN_CALIBRATION } from './calibration';

type Cell = { number: number; your: string; correct: string[] };

/** Exact value of a grid-in ("1/2", ".5"), or null. */
const value = (s: string) => {
  const m = /^(-?\d*\.?\d+)(?:\/(\d*\.?\d+))?$/.exec(s.trim());
  return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : null;
};
const isRight = (c: Cell) =>
  c.correct.includes(c.your) || (value(c.your) !== null && c.correct.some((f) => value(f) !== null && Math.abs(value(f)! - value(c.your)!) < 1e-9));
type Report = { id: string; test: string; scores: Record<string, number>; raw: Record<string, number>; rawOf: Record<string, number>; modules: Record<string, Cell[]> };

describe('extracted NLT reports', () => {
  const all = reports as Report[];

  it('have complete grids and consistent scores', () => {
    expect(all).toHaveLength(78);
    for (const r of all) {
      expect(Object.values(r.modules).map((m) => m.length), r.id).toEqual([27, 27, 22, 22]);
      expect(r.scores.rw + r.scores.math, r.id).toBe(r.scores.total);
    }
  });

  it('reproduce each report’s raw scores from its answer grid', () => {
    for (const r of all) {
      for (const [scale, modules] of [['rw', ['rw1', 'rw2']], ['math', ['math1', 'math2']]] as const) {
        const correct = modules.reduce((n, m) => n + r.modules[m].filter(isRight).length, 0);
        // A few reports score Math out of 43, leaving one question out.
        const dropped = 54 - (scale === 'rw' ? 0 : 10) - r.rawOf[scale];
        expect(correct - dropped, `${r.id} ${scale}`).toBeLessThanOrEqual(r.raw[scale]);
        expect(correct, `${r.id} ${scale}`).toBeGreaterThanOrEqual(r.raw[scale]);
      }
    }
  });

  it('give two calibration points each', () => {
    expect(BUILTIN_CALIBRATION).toHaveLength(all.length * 2);
  });
});

describe('the built-in Practice Test 4 key', () => {
  it('agrees with every Practice Test 4 report', async () => {
    const { buildExam } = await import('../core/exam');
    const { isCorrect } = await import('../core/answers');
    const { SAT_FORMAT } = await import('./formats');
    const { SAT_PRACTICE_TEST_4_BLUEBOOK: key } = await import('./keys/satPracticeTest4Bluebook');
    const builds = ['harder', 'easier'].map((v) => buildExam(SAT_FORMAT, key, { rw2: v, math2: v }));
    const pt4 = (reports as Report[]).filter((r) => r.test === 'bluebook-4');
    expect(pt4.length).toBe(25);
    for (const r of pt4) {
      for (const section of builds[0].sections) {
        // The version whose key matches this report's listed answers.
        const fits = builds.map((exam) => {
          const s = exam.sections.find((x) => x.id === section.id)!;
          return r.modules[s.id].every((c, i) => c.correct.every((f) => isCorrect(s.questions[i], f)));
        });
        expect(fits.some(Boolean), `${r.id} ${section.id}`).toBe(true);
      }
    }
  });
});
