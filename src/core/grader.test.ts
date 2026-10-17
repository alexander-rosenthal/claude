import { describe, expect, it } from 'vitest';
import { DEMO_EXAMS, OFFICIAL_EXAMS } from '../exams';
import { SAT_FORMAT } from '../exams/formats';
import { AnswerKeyError, buildExam } from './exam';
import { grade } from './grader';
import { toScaled } from './scoring';
import type { Exam, Responses } from './types';
import sampleResponses from '../parsers/fixtures/pt4-bluebook-sample-responses.json';

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
      // Every question of the demo key has exactly one skill tag.
      expect(c.skills.reduce((n, s) => n + s.tally.total, 0)).toBe(c.tally.total);
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

describe('SAT Practice Test 4 (paper, official key)', () => {
  const pt4 = OFFICIAL_EXAMS.find((e) => e.key.id === 'sat-pt4-paper')!;

  it('has the paper layout', () => {
    expect(pt4.sections.map((s) => s.questions.length)).toEqual([33, 33, 27, 27]);
  });

  it('reports official score ranges', () => {
    const top = grade(pt4, perfect(pt4));
    expect(top.scales.map((s) => s.range)).toEqual([
      { lower: 790, upper: 800 },
      { lower: 790, upper: 800 },
    ]);
    expect(top.composites[0].range).toEqual({ lower: 1580, upper: 1600 });

    // 40 RW correct → 530–550; 30 Math correct → 470–500 (conversion table, p. 5).
    const responses: Responses = {};
    const rw = pt4.sections.filter((s) => s.scaleId === 'rw').flatMap((s) => s.questions).slice(0, 40);
    const math = pt4.sections.filter((s) => s.scaleId === 'math').flatMap((s) => s.questions).slice(0, 30);
    for (const q of [...rw, ...math]) responses[q.id] = q.correct[0];
    const report = grade(pt4, responses);
    expect(report.scales.map((s) => [s.raw, s.range])).toEqual([
      [40, { lower: 530, upper: 550 }],
      [30, { lower: 470, upper: 500 }],
    ]);
    expect(report.composites[0].range).toEqual({ lower: 1000, upper: 1050 });
  });

  it('accepts every listed grid-in form', () => {
    const q21 = pt4.sections.find((s) => s.id === 'math1')!.questions[20]; // 361/8; 45.12; 45.13
    for (const answer of ['361/8', '45.12', '45.13', '45.125']) {
      expect(grade(pt4, { [q21.id]: answer }).questions.find((r) => r.question.id === q21.id)!.status).toBe('correct');
    }
    const q6 = pt4.sections.find((s) => s.id === 'math2')!.questions[5]; // 15; -5
    expect(grade(pt4, { [q6.id]: '-5' }).questions.find((r) => r.question.id === q6.id)!.status).toBe('correct');
  });
});

describe('SAT Practice Test 4 (Bluebook) skills', () => {
  // A sample student's answers (from a third-party report for this test) and
  // every "correct of total" figure that report gives for them.
  const pt4 = OFFICIAL_EXAMS.find((e) => e.key.id === 'sat-pt4-bluebook')!;
  const responses: Responses = {};
  for (const [sectionId, answers] of Object.entries(sampleResponses)) {
    answers.split(' ').forEach((a, i) => (responses[`${sectionId}-${i + 1}`] = a));
  }
  const report = grade(pt4, responses);
  const [rw, math] = report.scales;

  const rows = (scale: typeof rw) =>
    Object.fromEntries(
      scale.categories.flatMap((c) => [c, ...c.skills, ...c.skills.flatMap((s) => s.subskills)]).map((t) => [t.name, `${t.tally.correct}/${t.tally.total}`]),
    );

  it('matches the reference section scores', () => {
    expect(rw.sections.map((s) => s.tally.correct)).toEqual([19, 17]);
    expect(math.sections.map((s) => s.tally.correct)).toEqual([18, 11]);
    expect([rw.raw, math.raw]).toEqual([36, 29]);
  });

  it('matches every Reading and Writing topic figure', () => {
    expect(rows(rw)).toEqual({
      'Craft and Structure': '10/15',
      'Purpose/Function of Text': '3/4',
      'Full Text Purpose (Author Intention)': '1/2',
      'Sentence Purpose': '2/2',
      'Cross-Text Connections': '1/1',
      'Compare/Contrast': '1/1',
      'Vocabulary in Context': '6/10',
      'Sentence Completion': '5/9',
      'Most Nearly Means': '1/1',
      'Standard English Conventions': '7/14',
      Punctuation: '5/8',
      'Apostrophe Issue': '1/1',
      'Multiple Issues': '4/6',
      'Comma Issue': '0/1',
      'Form, Structure, and Sense': '4/8',
      'Run-on Issue': '3/4',
      'Verb Tense Issue': '1/4',
      'Subject-Verb Agreement Issue': '0/2',
      'Expression of Ideas': '7/11',
      'Logical Transition': '2/4',
      'Logical Transition Issue': '2/4',
      'Rhetorical Synthesis': '5/7',
      'Relevance Issue': '4/6',
      'Tone or Emphasis': '1/1',
      'Information and Ideas': '12/14',
      Evidence: '4/5',
      'Quantitative Evidence': '3/3',
      'Textual Evidence': '1/2',
      Ideas: '3/3',
      'Main Idea': '2/2',
      Detail: '1/1',
      Inferences: '4/4',
      'Inference Question': '4/4',
      Reasoning: '2/4',
      'Support/Refute a Claim': '2/4',
    });
  });

  it('matches every Math topic figure', () => {
    expect(rows(math)).toEqual({
      'Problem-Solving and Data Analysis': '8/13',
      'One-Variable Data': '1/3',
      'Distributions: Measures of Center and Spread': '1/3',
      Percentages: '2/3',
      'Proportional Relationships': '3/4',
      Proportions: '0/1',
      Rates: '2/2',
      'Unit Conversions': '1/1',
      'Data Visualization': '1/2',
      'Charts and Graphs': '1/2',
      'Two-Variable Data': '1/2',
      'Applying a Model': '0/1',
      'Scatterplots and Line of Best Fit': '1/1',
      'Advanced Math': '8/11',
      'Nonlinear Functions': '3/4',
      'Quadratic Function Graphs': '1/1',
      'Nonlinear Equations/Expressions': '8/11',
      'Exponents and Roots': '1/1',
      'Solving Nonlinear Equations': '1/2',
      'Manipulating Other Nonlinear Equations/Expressions': '3/4',
      'Interpreting Nonlinear Equations/Expressions': '1/1',
      'Absolute Value': '0/1',
      'Systems of Nonlinear Equations in Two Variables': '1/1',
      'Manipulating Quadratic Equations/Expressions': '1/2',
      'Geometry and Trigonometry': '4/6',
      Geometry: '4/6',
      'Area, Surface Area, and Volume': '0/1',
      'Perimeter and Area': '1/1',
      'Equation of a Circle': '0/1',
      Angles: '1/1',
      Similarity: '3/3',
      Quadrilaterals: '1/1',
      Trigonometry: '2/2',
      'Trig Functions': '1/1',
      'Right Triangle Trigonometry': '2/2',
      Algebra: '9/14',
      'Linear Equations in One Variable': '1/3',
      'Solving for an Expression': '0/1',
      'Manipulating Linear Equations/Expressions': '1/3',
      'Linear Equations in Two Variables': '1/2',
      'Solving Linear Equations in Two Variables': '0/1',
      'Linear Functions': '2/4',
      'Graphs of Linear Functions': '1/3',
      'Evaluating Functions and Function Tables': '1/1',
      'Systems of Two Linear Equations': '3/3',
      'Systems of Two Linear Equations in Two Variables': '3/3',
      'Linear Inequalities': '1/2',
      'Linear Inequalities in Two Variables': '1/2',
      'Translating Math': '3/4',
      'Words to Algebra': '3/4',
      'Algebra to Words': '1/1',
    });
  });

  it('matches the reference mastery tiers', () => {
    expect(rw.mastery).toEqual({ mastered: 14, review: 18, instruction: 3, total: 35 });
    expect(math.mastery).toEqual({ mastered: 18, review: 21, instruction: 12, total: 51 });
  });

  it('accepts every listed form of the -14/15 grid-in', () => {
    const q = pt4.sections.find((s) => s.id === 'math2')!.questions[10];
    const status = (a: string) => grade(pt4, { [q.id]: a }).questions.find((r) => r.question.id === q.id)!.status;
    for (const a of ['-14/15', '-.9333', '-0.933', '-0.9333', '-28/30']) expect(status(a)).toBe('correct');
    // -0.93333… rounds to -.9333, so -.9334 is neither rounded nor truncated.
    expect(status('-.9334')).toBe('incorrect');
  });
});

describe('graded outcomes', () => {
  it('override responses', () => {
    const q = sat.sections[0].questions[0];
    const report = grade(sat, { [q.id]: q.correct[0] }, { [q.id]: 'incorrect' });
    expect(report.questions[0].status).toBe('incorrect');
  });
});

describe('scaled scores', () => {
  it('estimates the digital SAT from the official paper table by percent correct', () => {
    // 27/54 RW ≈ 33/66 on paper → 470–490; 22/44 Math ≈ 27/54 → 430–460.
    expect(toScaled(sat.scales[0], 27)).toBe(480);
    expect(toScaled(sat.scales[1], 22)).toBe(450);
    expect(toScaled(sat.scales[0], 54)).toBe(800);
    expect(toScaled(sat.scales[1], 0)).toBe(200);
  });

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
    const key = { id: 'k', name: 'k', formatId: SAT_FORMAT.id, isDemo: false, entries: [{ sectionId: 'rw1', number: 1, correct: ['Z'], category: '', topics: [] }] };
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
