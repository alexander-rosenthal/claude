/**
 * Core data model.
 *
 * An exam is built from two independent pieces:
 *  - an ExamFormat: the shape of the test (sections, question counts, answer
 *    choices, score scales). One format is shared by every test form of that
 *    type (e.g. all digital SAT practice tests).
 *  - an AnswerKey: the correct answers and the classification of each
 *    question for one specific test form.
 *
 * Classification has three levels: a domain (the main category, one per
 * question), then skills, each optionally narrowed to a subskill. A question
 * can carry several (skill, subskill) tags, e.g. a sentence with both a
 * punctuation and a run-on issue. Classification only feeds the score report;
 * the grader never needs it.
 */

export type QuestionType = 'mc' | 'spr'; // multiple choice | student-produced response (grid-in)

export type QuestionStatus = 'correct' | 'incorrect' | 'omitted';

export interface SectionFormat {
  id: string;
  name: string;
  /** Short label for compact UI, e.g. "RW 1". */
  shortName: string;
  /** Extra labels accepted when parsing pasted/uploaded answers. */
  aliases: string[];
  questionCount: number;
  /** Content depends on earlier performance (the digital SAT's second modules). */
  adaptive?: boolean;
  /** Which score scale this section's raw points count toward. */
  scaleId: string;
  /** Answer choices for a given 1-based question number. */
  choicesFor: (questionNumber: number) => string[];
  /** Whether student-produced (free-entry numeric) answers can appear. */
  allowsSpr: boolean;
  timeLimitMinutes?: number;
}

export interface ScaleAnchor {
  raw: number;
  scaled: number;
}

/** One row of an official conversion table that reports a score range. */
export interface ScaleRange {
  raw: number;
  lower: number;
  upper: number;
}

export interface ScoreScale {
  id: string;
  name: string;
  min: number;
  max: number;
  /** Scaled scores are rounded to a multiple of this (10 for SAT, 1 for ACT). */
  step: number;
  /**
   * Raw → scaled conversion points. Values between anchors are linearly
   * interpolated, so an exact conversion table is just an anchor for every raw
   * score.
   */
  anchors: ScaleAnchor[];
  /**
   * Official raw → (lower, upper) table, one row per raw score. When present
   * it takes precedence over `anchors` and the report shows ranges.
   */
  ranges?: ScaleRange[];
  /** True when the conversion is an estimate rather than an official table. */
  estimated: boolean;
}

export interface CompositeScore {
  id: string;
  name: string;
  method: 'sum' | 'average';
  scaleIds: string[];
  min: number;
  max: number;
}

export interface ExamFormat {
  id: string;
  family: string;
  name: string;
  sections: SectionFormat[];
  scales: ScoreScale[];
  composites: CompositeScore[];
  /** Where the score conversion comes from, shown under the scores. */
  scoreNote?: string;
}

/** One skill tag; `subskill` is '' when the tag stops at the skill level. */
export interface Topic {
  skill: string;
  subskill: string;
}

export interface AnswerKeyEntry {
  sectionId: string;
  number: number;
  /** One or more acceptable answers; empty only in a results-only key. */
  correct: string[];
  /** Domain: the main category. */
  category: string;
  topics: Topic[];
  /** For an adaptive section with several versions: which one this entry belongs to. */
  version?: string;
}

/** One version of an adaptive section (e.g. the easier Module 2). */
export interface SectionVersion {
  id: string;
  name: string;
}

export interface AnswerKey {
  id: string;
  name: string;
  formatId: string;
  /** Placeholder keys ship for demoing the tool; real keys are imported. */
  isDemo: boolean;
  /**
   * The correct answers aren't known; outcomes arrive already graded (e.g. a
   * Bluebook results paste) and the key only supplies categories.
   */
  resultsOnly?: boolean;
  /** For a results-only key built on a real key: that key's id. */
  sourceKeyId?: string;
  /**
   * Adaptive sections with more than one version, by section id. Entries for
   * those sections carry a `version`; the first listed is the default.
   */
  versions?: Record<string, SectionVersion[]>;
  entries: AnswerKeyEntry[];
}

/** Which version of each multi-version section to use, by section id. */
export type VersionChoice = Record<string, string>;

export interface Question {
  /** Stable id: `${sectionId}-${number}`. */
  id: string;
  sectionId: string;
  number: number;
  type: QuestionType;
  choices: string[];
  correct: string[];
  category: string;
  topics: Topic[];
}

export interface Section extends Omit<SectionFormat, 'choicesFor'> {
  questions: Question[];
}

export interface Exam {
  id: string;
  name: string;
  family: string;
  format: ExamFormat;
  key: AnswerKey;
  sections: Section[];
  scales: ScoreScale[];
  composites: CompositeScore[];
  /** The version used for each multi-version section. */
  versions: VersionChoice;
  /** e.g. "RW 2: Easier, Math 2: Harder"; only for keys with versions. */
  versionLabel?: string;
}

/** Student responses keyed by Question.id. Missing or '' means omitted. */
export type Responses = Record<string, string>;

/** Already-graded outcomes keyed by Question.id; these override responses. */
export type Outcomes = Record<string, QuestionStatus>;

export function questionId(sectionId: string, number: number): string {
  return `${sectionId}-${number}`;
}
