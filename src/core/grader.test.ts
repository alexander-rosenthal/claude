import { describe, expect, it } from 'vitest';
import { DEMO_EXAMS } from '../exams';
import { SAT_FORMAT } from '../exams/formats';
import { AnswerKeyError, buildExam } from './exam';
import { grade } from './grader';
import { toScaled } from './scoring';
import type { Exam, Responses } from './types';

const sat = DEMO_EXAMS.find((e) => e.family === 'SAT')!;
const act = DEMO_EXAMS.find((e) => e.format.id === 'act-enhanced')!;

function perfect(exam: Exam): Responses {
  return Object.fromEntries(exam.sections.flatMap((s) => s.questions.map((q) => [q.id, q.correct[0]])));
}

describe('grade', () => {
  it('gives a perfect score for a perfect sheet', () => {
    const report = grade(sat, perfect(sat));
    expect(report.overall.correct).toBe(98);
    expect(report.scales.map((s) => s.scaled)).toEqual([800, 800]);
    expect(report.composites[0].value).toBe(1600);
  });

  it('gives the floor for a blank sheet', () => {
    const report = grade(sat, {});
    expect(report.overall).toMatchObject({ correct: 0, omitted: 98, incorrect: 0 });
    expect(report.composites[0].value).toBe(400);
  });

  it('separates incorrect from omitted and tallies categories', () => {
    const responses = perfect(sat);
    const [q1, q2] = sat.sections[0].questions;
    responses[q1.id] = q1.choices.find((c) => c !== q1.correct[0])!;
    delete responses[q2.id];
    const report = grade(sat, responses);
    const rw = report.scales.find((s) => s.scale.id === 'rw')!;
    expect(rw.tally).toMatchObject({ correct: 52, incorrect: 1, omitted: 1, total: 54 });
    expect(rw.sections[0].tally.correct).toBe(25);

    const catTotal = rw.categories.reduce((n, c) => n + c.tally.total, 0);
    expect(catTotal).toBe(54);
    for (const c of rw.categories) {
      expect(c.subcategories.reduce((n, s) => n + s.tally.total, 0)).toBe(c.tally.total);
    }
    const missed = report.questions.find((r) => r.question.id === q1.id)!;
    expect(missed.status).toBe('incorrect');
  });

  it('grades SPR answers by value', () => {
    const spr = sat.sections[2].questions.find((q) => q.type === 'spr')!;
    expect(grade(sat, { [spr.id]: spr.correct[0] }).questions.find((r) => r.question.id === spr.id)!.status).toBe('correct');
  });

  it('computes ACT composite as the rounded average', () => {
    const report = grade(act, perfect(act));
    expect(report.composites.find((c) => c.composite.id === 'composite')!.value).toBe(36);
    expect(report.composites.find((c) => c.composite.id === 'stem')!.value).toBe(36);
  });

  it('accepts ACT answers typed with the wrong letter set', () => {
    const q2 = act.sections[0].questions[1]; // even → F-J
    const idx = q2.choices.indexOf(q2.correct[0]);
    const typed = ['A', 'B', 'C', 'D'][idx];
    expect(grade(act, { [q2.id]: typed }).questions[1].status).toBe('correct');
  });
});

describe('scaled scores', () => {
  it('is monotonic and within range', () => {
    for (const scale of sat.scales) {
      let prev = -Infinity;
      for (let raw = 0; raw <= 54; raw++) {
        const s = toScaled(scale, raw);
        expect(s).toBeGreaterThanOrEqual(prev);
        expect(s % 10).toBe(0);
        prev = s;
      }
    }
  });
});

describe('buildExam', () => {
  it('reports every problem with an incomplete key', () => {
    const key = { id: 'k', name: 'k', formatId: SAT_FORMAT.id, isDemo: false, entries: [{ sectionId: 'rw1', number: 1, correct: ['Z'], category: '', subcategory: '' }] };
    try {
      buildExam(SAT_FORMAT, key);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AnswerKeyError);
      const problems = (e as AnswerKeyError).problems;
      expect(problems[0]).toMatch(/not a valid answer/);
      expect(problems).toHaveLength(98);
    }
  });
});
