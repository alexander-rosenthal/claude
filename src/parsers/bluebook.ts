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
import { MODULE_2_CUTOFFS, routeByDomains, routedSections, type ModuleChoice, type RouteDecision } from '../core/routing';
import type { AnswerKey, Exam, Outcomes, QuestionStatus, Section, Topic } from '../core/types';
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
/** Skill and subskill names → their tag and domain. */
const SKILLS = new Map(
  [...Object.entries(SAT_RW_TAXONOMY), ...Object.entries(SAT_MATH_TAXONOMY)].flatMap(([domain, skills]) =>
    Object.entries(skills).flatMap(([skill, subskills]) => [
      [normalizeLabel(skill), { topic: { skill, subskill: '' }, domain }] as const,
      ...subskills.map((subskill) => [normalizeLabel(subskill), { topic: { skill, subskill }, domain }] as const),
    ]),
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
  topics: Topic[];
}

function classify(tokens: string[]): RecordPieces {
  const pieces: RecordPieces = { answers: [], topics: [] };
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
      pieces.topics.push(skill.topic);
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
  for (const [label, { topic, domain }] of SKILLS) {
    if (rest.includes(` ${label} `)) {
      pieces.topics.push(topic);
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
  const topics: Record<string, Topic[]> = {};
  const keyMismatches: string[] = [];
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
    if (pieces.topics.length) topics[question.id] = pieces.topics;

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

  const result = collector.result();
  const hasOutcomes = Object.keys(outcomes).length > 0;
  return {
    ...result,
    answered: hasOutcomes ? placed : result.answered,
    ...(hasOutcomes ? { outcomes } : {}),
    ...(Object.keys(categories).length ? { categories } : {}),
    ...(Object.keys(topics).length ? { topics } : {}),
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
          topics: result?.topics?.[id] ?? [],
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

/** A digital key with real answers, whose answers and tags can enrich a paste. */
export function hasUsableDigitalKey(exam: Exam): boolean {
  return exam.format.id === SAT_FORMAT.id && !exam.key.isDemo && !exam.key.resultsOnly;
}

export interface BluebookGrading {
  exam: Exam;
  /** Shown before the report (possible mismatch). */
  warnings: string[];
  /** Shown on the report. */
  notes: string[];
  /** How each adaptive Module 2 was handled. */
  routing: RouteDecision[];
}

/**
 * For an adaptive module: route automatically, force a version, use the
 * pasted domains only, or ('key') use the single version a key without
 * routing data holds.
 */
export type PasteModuleChoice = ModuleChoice | 'key';

/** Choices offered for an adaptive section of the selected exam. */
export function moduleChoicesFor(exam: Exam, sectionId: string): { value: PasteModuleChoice; label: string }[] {
  if (routedSections(exam).some((s) => s.id === sectionId)) {
    return [
      { value: 'auto', label: 'Auto (cutoff, checked by domains)' },
      ...exam.key.versions![sectionId].map((v) => ({ value: v.id as PasteModuleChoice, label: v.name })),
      { value: 'none', label: 'Domains only' },
    ];
  }
  return [
    { value: 'none', label: 'Domains only' },
    { value: 'key', label: 'This key’s Module 2' },
  ];
}

/**
 * The exam to grade a Bluebook results paste with.
 *
 * With a real digital key selected, the paste is graded with Bluebook's
 * outcomes while the key adds correct answers and skill tags. Module 1 is the
 * same for every student, so it always uses the key. Module 2 is adaptive: a
 * key holding both versions is routed (Module 1 cutoff, checked against the
 * pasted domains; see core/routing); a key with one version is used only when
 * chosen. Without such a key, the exam is built from the paste alone.
 */
export function examForBluebookResults(
  target: Exam,
  result: ParseResult,
  choices: Record<string, PasteModuleChoice> = {},
  cutoffs: Record<string, number> = MODULE_2_CUTOFFS,
): BluebookGrading {
  if (!hasUsableDigitalKey(target)) return { exam: resultsOnlyExam(result), warnings: [], notes: [], routing: [] };

  const warnings: string[] = [];
  const notes: string[] = [];
  const routing: RouteDecision[] = [];
  const routed = new Set(routedSections(target).map((s) => s.id));

  const sections = target.sections.map((section): Section | null => {
    if (!section.adaptive) return section;
    const choice = choices[section.id];
    if (routed.has(section.id)) {
      const route = routeByDomains(target, section, result.outcomes ?? {}, result.categories, (choice ?? 'auto') as ModuleChoice, cutoffs);
      routing.push(route.decision);
      if (route.warning) warnings.push(route.warning);
      return route.section;
    }
    if (choice === 'key') {
      notes.push(`${section.name}: using the selected key’s Module 2 as chosen.`);
      return section;
    }
    notes.push(`${section.name} is adaptive; its skills come from Bluebook’s domains only.`);
    return null;
  });

  const entries = target.sections.flatMap((base, i) => {
    const section = sections[i];
    return base.questions.map((q) => {
      const keyQ = section?.questions[q.number - 1];
      const pastedCategory = result.categories?.[q.id];
      const keyHasTags = Boolean(keyQ && keyQ.topics.length);
      return {
        sectionId: base.id,
        number: q.number,
        correct: keyQ ? keyQ.correct : [],
        // A tagged key keeps its own domain so its skill tree stays consistent.
        category: keyHasTags ? keyQ!.category : (pastedCategory ?? (keyQ && keyQ.category !== 'Uncategorized' ? keyQ.category : '')),
        topics: keyHasTags ? keyQ!.topics : (result.topics?.[q.id] ?? []),
      };
    });
  });

  const key: AnswerKey = {
    id: `${target.key.id}+bluebook`,
    name: `${target.name} (Bluebook results)`,
    formatId: target.format.id,
    isDemo: false,
    resultsOnly: true,
    entries,
  };
  return { exam: buildExam(target.format, key), warnings, notes, routing };
}
