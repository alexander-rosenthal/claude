/**
 * Parser for the question table copied from a Bluebook / My Practice score
 * details page.
 *
 * Bluebook's table has the columns Question | Section | Your Answer | Domain,
 * but the "Your Answer" cell holds the outcome rather than the letter chosen,
 * and copying spreads each row over several lines:
 *
 *   1<TAB>Reading and Writing<TAB><TAB>
 *   Correct
 *
 *   Craft and Structure
 *   2<TAB>Reading and Writing<TAB><TAB>
 *   Incorrect
 *   ...
 *
 * So a record starts at a line beginning with a question number and section,
 * and runs until the next one. Each piece of a record is classified by its
 * content rather than its position: an outcome (Correct / Incorrect /
 * Omitted), a domain or skill name, or an answer ("B", "3/2"). Two answers
 * are read as (correct answer, your answer) unless a header row says
 * otherwise. Sections don't name the module, so a question number restarting
 * at 1 starts Module 2.
 *
 * Pasted outcomes are the official grading of the digital test, so they need
 * no answer key; the result can be graded on its own.
 */
import { isBlank, normalizeChoice, parseRational, sprMatches } from '../core/answers';
import { buildExam } from '../core/exam';
import type { AnswerKey, Exam, Outcomes, QuestionStatus } from '../core/types';
import { SAT_FORMAT } from '../exams/formats';
import { SAT_MATH_TAXONOMY, SAT_RW_TAXONOMY } from '../exams/taxonomy';
import { AnswerCollector, type ParseResult } from './collector';
import { normalizeLabel } from './sections';

const RECORD_START =
  /^\s*(\d{1,2})[\t ]+((?:reading\s*(?:and|&)\s*writing|math)(?:\s*[-:,–—]?\s*module\s*\d)?)(?![a-z])[\t ]*(.*)$/i;

const STATUS_WORDS: Record<string, QuestionStatus> = {
  correct: 'correct',
  right: 'correct',
  incorrect: 'incorrect',
  wrong: 'incorrect',
  omitted: 'omitted',
  skipped: 'omitted',
  blank: 'omitted',
  'not answered': 'omitted',
  unanswered: 'omitted',
  'no answer': 'omitted',
};

const IGNORED = /^(review|view|explanation|details|show|hide|question|section)$/i;

const DOMAINS = new Map(
  [...Object.keys(SAT_RW_TAXONOMY), ...Object.keys(SAT_MATH_TAXONOMY)].map((d) => [normalizeLabel(d), d]),
);
const SKILLS = new Map(
  [...Object.entries(SAT_RW_TAXONOMY), ...Object.entries(SAT_MATH_TAXONOMY)].flatMap(([domain, skills]) =>
    skills.map((skill) => [normalizeLabel(skill), { skill, domain }] as const),
  ),
);

export function looksLikeBluebook(text: string): boolean {
  const starts = text.split(/\r?\n/).filter((l) => RECORD_START.test(l)).length;
  return starts >= 3 || (starts >= 1 && /your answer|correct answer|\bdomain\b/i.test(text));
}

function statusOf(token: string): QuestionStatus | undefined {
  return STATUS_WORDS[token.trim().toLowerCase().replace(/[.!]$/, '')];
}

/** "B; Correct" → "B", "Omitted" → "", "1.5 (Incorrect)" → "1.5" */
export function cleanBluebookAnswer(cell: string): string {
  const s = cell
    .replace(/^(your answer|correct answer|answer)\s*:?\s*/i, '')
    .replace(/[;,(]?\s*\b(in)?correct\b\)?\s*$/i, '')
    .trim();
  if (statusOf(s) === 'omitted' || isBlank(s)) return '';
  return s;
}

function isAnswerLike(token: string): boolean {
  return /^[A-Da-d]$/.test(token) || token.split(/\s*(?:,|;|\bor\b)\s*/i).every((p) => parseRational(p) !== null);
}

interface RecordPieces {
  status?: QuestionStatus;
  answers: string[];
  category?: string;
  subcategory?: string;
}

function classify(tokens: string[]): RecordPieces {
  const pieces: RecordPieces = { answers: [] };
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token || IGNORED.test(token)) continue;

    const status = statusOf(token);
    if (status) {
      pieces.status = status;
      continue;
    }
    // "B; Correct" / "1.5 (Incorrect)": an answer with its outcome attached.
    const suffixed = /^(\S+?)[;,(]\s*(in)?correct\)?$/i.exec(token);
    if (suffixed) {
      pieces.status = suffixed[2] ? 'incorrect' : 'correct';
      pieces.answers.push(cleanBluebookAnswer(suffixed[1]));
      continue;
    }
    const label = normalizeLabel(token);
    const domain = DOMAINS.get(label);
    if (domain) {
      pieces.category = domain;
      continue;
    }
    const skill = SKILLS.get(label);
    if (skill) {
      pieces.subcategory = skill.skill;
      pieces.category ??= skill.domain;
      continue;
    }
    if (isAnswerLike(token)) {
      pieces.answers.push(cleanBluebookAnswer(token));
      continue;
    }
    if (/\s/.test(token) && splitRun(token, pieces)) continue;
    // An unfamiliar label is most likely a renamed domain.
    if (/[a-z]{3}/i.test(token) && !pieces.category) pieces.category = token;
  }
  return pieces;
}

/**
 * A cell run together with spaces ("B C; Incorrect", "Correct Craft and
 * Structure"): pull out any known domain or skill name, then read the
 * remaining words as answers and outcomes. Returns false if nothing was found.
 */
function splitRun(token: string, pieces: RecordPieces): boolean {
  let rest = ` ${normalizeLabel(token)} `;
  let found = false;
  for (const [label, domain] of DOMAINS) {
    if (rest.includes(` ${label} `)) {
      pieces.category = domain;
      rest = rest.replace(` ${label} `, ' ');
      found = true;
    }
  }
  for (const [label, { skill, domain }] of SKILLS) {
    if (rest.includes(` ${label} `)) {
      pieces.subcategory = skill;
      pieces.category ??= domain;
      rest = rest.replace(` ${label} `, ' ');
      found = true;
    }
  }
  // Re-read the original words (normalizeLabel drops "/" and ".") minus the labels.
  for (const word of token.split(/\s+/)) {
    const clean = word.replace(/^[(]|[;,)]$/g, '');
    const status = statusOf(clean);
    if (status) {
      pieces.status = status;
      found = true;
    } else if (isAnswerLike(clean) && rest.includes(` ${normalizeLabel(clean)} `)) {
      pieces.answers.push(clean);
      found = true;
    }
  }
  return found;
}

export function parseBluebook(exam: Exam, text: string): ParseResult {
  const collector = new AnswerCollector(exam);
  const lines = text.split(/\r?\n/);

  // A header row only matters for telling "your" and "correct" answers apart.
  const header = lines.find((l) => /your answer/i.test(l) && /correct answer/i.test(l));
  const yoursFirst = header ? header.search(/your answer/i) < header.search(/correct answer/i) : false;

  const records: { line: number; number: number; section: string; tokens: string[] }[] = [];
  lines.forEach((line, i) => {
    const m = RECORD_START.exec(line);
    if (m) records.push({ line: i + 1, number: Number(m[1]), section: m[2], tokens: m[3].split('\t') });
    else if (records.length) records[records.length - 1].tokens.push(...line.split('\t'));
  });

  const outcomes: Outcomes = {};
  const categories: Record<string, string> = {};
  const subcategories: Record<string, string> = {};
  const keyMismatches: string[] = [];
  const domainMismatches: string[] = [];
  const realKey = !exam.key.isDemo && !exam.key.resultsOnly;
  let placed = 0;

  for (const record of records) {
    const where = `line ${record.line}`;
    if (!collector.setContext(record.section)) {
      collector.warnUnknownSection(record.section, where);
      continue;
    }
    const question = collector.locate(record.number, where, 'result');
    if (!question) continue;
    placed++;

    const pieces = classify(record.tokens);
    let yours: string | undefined;
    let pastedKey: string | undefined;
    if (pieces.answers.length >= 2) [pastedKey, yours] = yoursFirst ? [pieces.answers[1], pieces.answers[0]] : pieces.answers;
    else yours = pieces.answers[0];

    if (yours) collector.record(question, yours);
    if (pieces.category) categories[question.id] = pieces.category;
    if (pieces.subcategory) subcategories[question.id] = pieces.subcategory;

    let status = pieces.status;
    if (!status && pastedKey !== undefined) {
      // No outcome given, but the pasted key lets us grade it the way Bluebook did.
      const acceptable = pastedKey.split(/\s*(?:,|;|\bor\b)\s*/i);
      status = !yours ? 'omitted' : /^[A-D]$/i.test(yours) ? (acceptable.includes(yours.toUpperCase()) ? 'correct' : 'incorrect') : sprMatches(yours, acceptable) ? 'correct' : 'incorrect';
    }
    if (status) outcomes[question.id] = status;
    if (!status && !yours) collector.warn(`${where}: no answer or result found for ${question.sectionId} #${question.number}.`);

    const label = exam.sections.find((s) => s.id === question.sectionId)!.shortName;
    if (realKey && pastedKey && question.correct.length) {
      const agrees =
        question.type === 'spr'
          ? pastedKey.split(/\s*(?:,|;|\bor\b)\s*/i).some((p) => sprMatches(p, question.correct))
          : question.correct.includes(normalizeChoice(pastedKey, question.choices).value ?? '');
      if (!agrees) keyMismatches.push(`${label} #${question.number}: pasted ${pastedKey}, key ${question.correct.join(' / ')}`);
    }
    if (realKey && pieces.category && question.category !== 'Uncategorized' && normalizeLabel(question.category) !== normalizeLabel(pieces.category)) {
      domainMismatches.push(`${label} #${question.number}`);
    }
  }

  if (records.length === 0) collector.warn('No Bluebook question rows were found. Copy the whole question table from the score details page.');
  const total = exam.sections.reduce((n, s) => n + s.questions.length, 0);
  if (placed > 0 && placed < total) collector.warn(`The paste covers ${placed} of ${total} questions; the rest count as omitted.`);
  if (keyMismatches.length) {
    collector.warn(
      `The pasted correct answers disagree with the selected answer key on ${keyMismatches.length} question(s), so the selected test may not be the one taken. ` +
        `${keyMismatches.slice(0, 5).join('; ')}${keyMismatches.length > 5 ? '; …' : ''}`,
    );
  }
  if (domainMismatches.length) {
    collector.warn(`The pasted domains differ from the selected key's categories on ${domainMismatches.length} question(s) (${domainMismatches.slice(0, 5).join(', ')}${domainMismatches.length > 5 ? ', …' : ''}).`);
  }

  const result = collector.result();
  const hasOutcomes = Object.keys(outcomes).length > 0;
  return {
    ...result,
    answered: hasOutcomes ? placed : result.answered,
    ...(hasOutcomes ? { outcomes } : {}),
    ...(Object.keys(categories).length ? { categories } : {}),
    ...(Object.keys(subcategories).length ? { subcategories } : {}),
  };
}

// ---------------------------------------------------------------------------
// Choosing the exam a Bluebook paste is read against and graded with
// ---------------------------------------------------------------------------

function resultsOnlyExam(result?: ParseResult): Exam {
  const key: AnswerKey = {
    id: 'bluebook-results',
    name: 'Bluebook practice test results',
    formatId: SAT_FORMAT.id,
    isDemo: false,
    resultsOnly: true,
    entries: SAT_FORMAT.sections.flatMap((s) =>
      Array.from({ length: s.questionCount }, (_, i) => {
        const id = `${s.id}-${i + 1}`;
        return {
          sectionId: s.id,
          number: i + 1,
          correct: [],
          category: result?.categories?.[id] ?? '',
          subcategory: result?.subcategories?.[id] ?? '',
        };
      }),
    ),
  };
  return buildExam(SAT_FORMAT, key);
}

/** Bluebook results are always the digital layout, whatever test is selected. */
export function bluebookTargetExam(selected: Exam): Exam {
  return selected.format.id === SAT_FORMAT.id ? selected : resultsOnlyExam();
}

/**
 * The exam to grade a Bluebook results paste with: the selected test when it
 * has a real digital answer key, otherwise one built from the paste itself.
 */
export function examForBluebookResults(target: Exam, result: ParseResult): Exam {
  if (target.format.id === SAT_FORMAT.id && !target.key.isDemo && !target.key.resultsOnly) return target;
  return resultsOnlyExam(result);
}
