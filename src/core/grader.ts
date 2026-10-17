import { isCorrect, normalizeResponse } from './answers';
import { computeComposite, computeCompositeRange, toScaled, toScaledRange, type ScoreRange } from './scoring';
import type { RouteDecision } from './routing';
import type { CompositeScore, Exam, Outcomes, Question, QuestionStatus, Responses, ScoreScale, Section } from './types';

export type { QuestionStatus };

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

/**
 * Mastery tiers for a topic's accuracy: ≥80% mastered, 50–79% for review,
 * under 50% for instruction.
 */
export type Mastery = 'mastered' | 'review' | 'instruction';
export const MASTERY_THRESHOLDS = { mastered: 0.8, review: 0.5 } as const;

export function masteryOf(accuracy: number): Mastery {
  if (accuracy >= MASTERY_THRESHOLDS.mastered) return 'mastered';
  if (accuracy >= MASTERY_THRESHOLDS.review) return 'review';
  return 'instruction';
}

export interface TopicResult {
  name: string;
  tally: Tally;
  mastery: Mastery;
  questions: QuestionResult[];
}

export interface SkillResult extends TopicResult {
  /** Narrower subskills; questions tagged only at the skill level appear in none. */
  subskills: TopicResult[];
}

/** A domain. Its questions are counted once; skills may overlap. */
export interface CategoryResult extends TopicResult {
  skills: SkillResult[];
}

/** How many topics (domains, skills and subskills) fall in each mastery tier. */
export interface MasterySummary {
  mastered: number;
  review: number;
  instruction: number;
  total: number;
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
  /** Official score range, when the scale's conversion table gives one. */
  range: ScoreRange | null;
  tally: Tally;
  sections: SectionResult[];
  categories: CategoryResult[];
  mastery: MasterySummary;
}

export interface CompositeResult {
  composite: CompositeScore;
  value: number;
  range: ScoreRange | null;
}

export interface GradeReport {
  exam: Exam;
  gradedAt: Date;
  questions: QuestionResult[];
  scales: ScaleResult[];
  composites: CompositeResult[];
  overall: Tally;
  /** Context to show with the scores (e.g. how a pasted result was matched). */
  notes: string[];
  /** Which adaptive Module 2 version was used for each section, and why. */
  routing: RouteDecision[];
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

function topicResult(name: string, questions: QuestionResult[]): TopicResult {
  const t = tally(questions);
  return { name, tally: t, mastery: masteryOf(t.accuracy), questions };
}

function categoryBreakdown(results: QuestionResult[]): CategoryResult[] {
  return [...groupBy(results, (r) => r.question.category)].map(([name, items]) => {
    const skillNames = [...new Set(items.flatMap((r) => r.question.topics.map((t) => t.skill)))];
    const skills = skillNames.map((skill): SkillResult => {
      const inSkill = items.filter((r) => r.question.topics.some((t) => t.skill === skill));
      const subskillNames = [...new Set(inSkill.flatMap((r) => r.question.topics.filter((t) => t.skill === skill && t.subskill).map((t) => t.subskill)))];
      return {
        ...topicResult(skill, inSkill),
        subskills: subskillNames.map((sub) =>
          topicResult(sub, inSkill.filter((r) => r.question.topics.some((t) => t.skill === skill && t.subskill === sub))),
        ),
      };
    });
    return { ...topicResult(name, items), skills };
  });
}

function masterySummary(categories: CategoryResult[]): MasterySummary {
  const summary = { mastered: 0, review: 0, instruction: 0, total: 0 };
  const topics = categories.filter((c) => c.name !== 'Uncategorized').flatMap((c) => [c, ...c.skills, ...c.skills.flatMap((s) => s.subskills)]);
  for (const t of topics) {
    summary[t.mastery]++;
    summary.total++;
  }
  return summary;
}

/**
 * Grade responses against the exam's key. `outcomes` holds questions that were
 * already graded elsewhere (e.g. pasted from Bluebook); they take precedence.
 */
export function grade(exam: Exam, responses: Responses, outcomes: Outcomes = {}): GradeReport {
  const questions: QuestionResult[] = exam.sections.flatMap((section) =>
    section.questions.map((question) => {
      const raw = responses[question.id];
      const { value, valid } = normalizeResponse(question, raw);
      const status: QuestionStatus =
        outcomes[question.id] ?? (value == null ? 'omitted' : isCorrect(question, raw) ? 'correct' : 'incorrect');
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
    const categories = categoryBreakdown(inScale);
    return {
      scale,
      raw: t.correct,
      maxRaw: t.total,
      scaled: toScaled(scale, t.correct),
      range: toScaledRange(scale, t.correct),
      tally: t,
      sections: sections.map((section) => ({
        section,
        tally: tally(inScale.filter((q) => q.sectionId === section.id)),
      })),
      categories,
      mastery: masterySummary(categories),
    };
  });

  const scaledById = Object.fromEntries(scales.map((s) => [s.scale.id, s.scaled]));
  const rangesById = Object.fromEntries(scales.map((s) => [s.scale.id, s.range]));
  const composites: CompositeResult[] = exam.composites.flatMap((composite) => {
    const value = computeComposite(composite, scaledById);
    return value == null ? [] : [{ composite, value, range: computeCompositeRange(composite, rangesById) }];
  });

  return { exam, gradedAt: new Date(), questions, scales, composites, overall: tally(questions), notes: [], routing: [] };
}
