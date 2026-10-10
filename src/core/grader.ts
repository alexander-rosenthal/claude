import { isCorrect, normalizeResponse } from './answers';
import { computeComposite, toScaled } from './scoring';
import type { CompositeScore, Exam, Question, Responses, ScoreScale, Section } from './types';

export type QuestionStatus = 'correct' | 'incorrect' | 'omitted';

export interface QuestionResult {
  question: Question;
  sectionId: string;
  sectionName: string;
  /** Normalized response, or null when omitted. */
  response: string | null;
  /** The response could not be interpreted (e.g. "Q" on an A–D question). */
  invalid: boolean;
  status: QuestionStatus;
}

export interface Tally {
  correct: number;
  incorrect: number;
  omitted: number;
  total: number;
  /** correct / total, 0–1. */
  accuracy: number;
}

export interface SubcategoryResult {
  name: string;
  tally: Tally;
}

export interface CategoryResult {
  name: string;
  tally: Tally;
  subcategories: SubcategoryResult[];
}

export interface SectionResult {
  section: Section;
  tally: Tally;
}

export interface ScaleResult {
  scale: ScoreScale;
  raw: number;
  maxRaw: number;
  scaled: number;
  tally: Tally;
  sections: SectionResult[];
  categories: CategoryResult[];
}

export interface CompositeResult {
  composite: CompositeScore;
  value: number;
}

export interface GradeReport {
  exam: Exam;
  gradedAt: Date;
  questions: QuestionResult[];
  scales: ScaleResult[];
  composites: CompositeResult[];
  overall: Tally;
}

function tally(results: QuestionResult[]): Tally {
  const t = { correct: 0, incorrect: 0, omitted: 0, total: results.length, accuracy: 0 };
  for (const r of results) t[r.status]++;
  t.accuracy = t.total ? t.correct / t.total : 0;
  return t;
}

/** Group by key, preserving first-seen order. */
function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

function categoryBreakdown(results: QuestionResult[]): CategoryResult[] {
  return [...groupBy(results, (r) => r.question.category)].map(([name, items]) => ({
    name,
    tally: tally(items),
    subcategories: [...groupBy(items, (r) => r.question.subcategory)].map(([sub, subItems]) => ({
      name: sub,
      tally: tally(subItems),
    })),
  }));
}

export function grade(exam: Exam, responses: Responses): GradeReport {
  const questions: QuestionResult[] = exam.sections.flatMap((section) =>
    section.questions.map((question) => {
      const raw = responses[question.id];
      const { value, valid } = normalizeResponse(question, raw);
      const status: QuestionStatus = value == null ? 'omitted' : isCorrect(question, raw) ? 'correct' : 'incorrect';
      return {
        question,
        sectionId: section.id,
        sectionName: section.name,
        response: value,
        invalid: !valid,
        status,
      };
    }),
  );

  const scales: ScaleResult[] = exam.scales.map((scale) => {
    const sections = exam.sections.filter((s) => s.scaleId === scale.id);
    const inScale = questions.filter((q) => sections.some((s) => s.id === q.sectionId));
    const t = tally(inScale);
    return {
      scale,
      raw: t.correct,
      maxRaw: t.total,
      scaled: toScaled(scale, t.correct),
      tally: t,
      sections: sections.map((section) => ({
        section,
        tally: tally(inScale.filter((q) => q.sectionId === section.id)),
      })),
      categories: categoryBreakdown(inScale),
    };
  });

  const scaledById = Object.fromEntries(scales.map((s) => [s.scale.id, s.scaled]));
  const composites: CompositeResult[] = exam.composites.flatMap((composite) => {
    const value = computeComposite(composite, scaledById);
    return value == null ? [] : [{ composite, value }];
  });

  return { exam, gradedAt: new Date(), questions, scales, composites, overall: tally(questions) };
}
