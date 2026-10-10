/**
 * Core data model.
 *
 * An exam is built from two independent pieces:
 *  - an ExamFormat: the shape of the test (sections, question counts, answer
 *    choices, score scales). One format is shared by every test form of that
 *    type (e.g. all digital SAT practice tests).
 *  - an AnswerKey: the correct answers and the category/subcategory of each
 *    question for one specific test form.
 *
 * Categories are carried on the key so the grader never needs them; they only
 * feed the score report.
 */

export type QuestionType = 'mc' | 'spr'; // multiple choice | student-produced response (grid-in)

export interface SectionFormat {
  id: string;
  name: string;
  /** Short label for compact UI, e.g. "RW 1". */
  shortName: string;
  /** Extra labels accepted when parsing pasted/uploaded answers. */
  aliases: string[];
  questionCount: number;
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
}

export interface AnswerKeyEntry {
  sectionId: string;
  number: number;
  /** One or more acceptable answers. */
  correct: string[];
  category: string;
  subcategory: string;
}

export interface AnswerKey {
  id: string;
  name: string;
  formatId: string;
  /** Placeholder keys ship for demoing the tool; real keys are imported. */
  isDemo: boolean;
  entries: AnswerKeyEntry[];
}

export interface Question {
  /** Stable id: `${sectionId}-${number}`. */
  id: string;
  sectionId: string;
  number: number;
  type: QuestionType;
  choices: string[];
  correct: string[];
  category: string;
  subcategory: string;
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
}

/** Student responses keyed by Question.id. Missing or '' means omitted. */
export type Responses = Record<string, string>;

export function questionId(sectionId: string, number: number): string {
  return `${sectionId}-${number}`;
}
