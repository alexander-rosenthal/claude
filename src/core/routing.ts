/**
 * Module 2 routing for adaptive tests (the digital SAT).
 *
 * Bluebook gives each section a harder or easier Module 2 depending on how
 * the student did on Module 1, and each section routes on its own. A key that
 * holds both versions (version ids 'harder' and 'easier') is routed in two
 * steps:
 *
 *  1. Cutoff: count Module 1 questions missed (wrong or blank; Bluebook scores
 *     blanks as wrong). More than the section's cutoff → easier Module 2.
 *  2. Check: where the data allows, test that guess.
 *     - With answer letters: grade Module 2 against both versions. Answers
 *       checked against the wrong version score near chance, so a clear gap
 *       decides.
 *     - With a Bluebook results paste: compare the pasted Module 2 domains to
 *       each version's. (Reading and Writing versions share a domain layout,
 *       so this can't separate them; the cutoff's guess stands, as inferred.)
 *
 * When the check contradicts the cutoff, the other version is used. Every
 * section gets a RouteDecision saying which version was used and why.
 */
import { isCorrect, isBlank } from './answers';
import { buildExam } from './exam';
import type { AnswerKey, Exam, Outcomes, Responses, Section, VersionChoice } from './types';

/**
 * Most Module 1 questions a student can miss (wrong or blank) and still get
 * the harder Module 2, by score scale. Bluebook's real routing weighs
 * question difficulty, so these are approximations.
 */
export const MODULE_2_CUTOFFS: Record<string, number> = { rw: 7, math: 5 };

/** The answer check decides only with enough Module 2 answers and a clear accuracy gap. */
export const ANSWER_CHECK = { minAnswered: 8, minMargin: 0.2 };

/** The domain check decides only when one version fits well and clearly better. */
export const DOMAIN_CHECK = { minAgreement: 0.85, minLead: 0.15 };

/** A manually chosen version fitting the pasted domains worse than this gets a warning. */
export const MANUAL_MIN_AGREEMENT = 0.75;

export const HARDER = 'harder';
export const EASIER = 'easier';

/** What the user asked for: route automatically, a specific version, or (pastes only) no version. */
export type ModuleChoice = 'auto' | 'harder' | 'easier' | 'none';

export type RouteMethod =
  | 'cutoff'
  | 'confirmed-by-answers'
  | 'confirmed-by-domains'
  | 'overridden-by-answers'
  | 'overridden-by-domains'
  | 'inferred'
  | 'manual'
  | 'domains-only';

export const ROUTE_METHOD_LABEL: Record<RouteMethod, string> = {
  cutoff: 'cutoff',
  'confirmed-by-answers': 'confirmed by answers',
  'confirmed-by-domains': 'confirmed by domains',
  'overridden-by-answers': 'cutoff overridden by answers',
  'overridden-by-domains': 'cutoff overridden by domains',
  inferred: 'inferred from cutoff',
  manual: 'chosen manually',
  'domains-only': 'domains only',
};

export interface RouteDecision {
  sectionId: string;
  sectionName: string;
  /** Version used, or null when Module 2 is graded from Bluebook's domains only. */
  version: string | null;
  versionName: string;
  method: RouteMethod;
  /** Module 1 questions missed (wrong or blank). */
  module1Missed: number;
  /** What the cutoff alone would have picked. */
  cutoffGuess: string;
  /** One sentence of evidence, for the report. */
  reason: string;
}

export interface Routed {
  exam: Exam;
  decisions: RouteDecision[];
}

/** Adaptive sections of this exam whose key holds both a harder and an easier version. */
export function routedSections(exam: Exam): Section[] {
  return exam.sections.filter((s) => {
    const ids = exam.key.versions?.[s.id]?.map((v) => v.id) ?? [];
    return s.adaptive && ids.includes(HARDER) && ids.includes(EASIER);
  });
}

function versionName(key: AnswerKey, sectionId: string, version: string): string {
  return key.versions?.[sectionId]?.find((v) => v.id === version)?.name ?? version;
}

/** The non-adaptive section feeding an adaptive one (same score scale). */
function module1For(exam: Exam, section: Section): Section | undefined {
  return exam.sections.find((s) => s.scaleId === section.scaleId && !s.adaptive);
}

/** Module 1 questions missed: an outcome other than correct, or a wrong or blank answer. */
export function module1Missed(exam: Exam, section: Section, responses: Responses, outcomes: Outcomes = {}): number {
  const m1 = module1For(exam, section);
  if (!m1) return 0;
  return m1.questions.filter((q) => (outcomes[q.id] ? outcomes[q.id] !== 'correct' : !isCorrect(q, responses[q.id]))).length;
}

export function cutoffGuess(section: Section, missed: number, cutoffs: Record<string, number> = MODULE_2_CUTOFFS): string {
  const cutoff = cutoffs[section.scaleId];
  return cutoff !== undefined && missed > cutoff ? EASIER : HARDER;
}

const other = (version: string) => (version === HARDER ? EASIER : HARDER);
const pct = (x: number) => `${Math.round(x * 100)}%`;

function sectionOf(base: Exam, sectionId: string, version: string): Section {
  return buildExam(base.format, base.key, { ...base.versions, [sectionId]: version }).sections.find((s) => s.id === sectionId)!;
}

function cutoffReason(section: Section, missed: number, guess: string, cutoffs: Record<string, number>): string {
  const cutoff = cutoffs[section.scaleId];
  return `Module 1: ${missed} missed (cutoff: more than ${cutoff} → easier) → ${guess}`;
}

/** Accuracy of entered answers on a section, over the questions answered. */
function answerAccuracy(section: Section, responses: Responses): { correct: number; answered: number } {
  const answered = section.questions.filter((q) => !isBlank(responses[q.id]));
  return { correct: answered.filter((q) => isCorrect(q, responses[q.id])).length, answered: answered.length };
}

/**
 * Route each two-version adaptive section using the Module 1 cutoff, checked
 * against the entered Module 2 answers. `choices` can force a version.
 */
export function routeByAnswers(
  base: Exam,
  responses: Responses,
  choices: Record<string, ModuleChoice> = {},
  cutoffs: Record<string, number> = MODULE_2_CUTOFFS,
): Routed {
  const decisions: RouteDecision[] = [];
  const chosen: VersionChoice = {};

  for (const section of routedSections(base)) {
    const missed = module1Missed(base, section, responses);
    const guess = cutoffGuess(section, missed, cutoffs);
    const choice = choices[section.id] ?? 'auto';
    const why = cutoffReason(section, missed, guess, cutoffs);
    let version = guess;
    let method: RouteMethod = 'cutoff';
    let reason: string;

    if (choice === HARDER || choice === EASIER) {
      version = choice;
      method = 'manual';
      reason = `${why}; set by hand to ${choice}.`;
    } else {
      const acc = Object.fromEntries(
        [HARDER, EASIER].map((v) => {
          const a = answerAccuracy(sectionOf(base, section.id, v), responses);
          return [v, { ...a, ratio: a.answered ? a.correct / a.answered : 0 }];
        }),
      );
      const g = acc[guess];
      const o = acc[other(guess)];
      const scores = `${g.correct}/${g.answered} (${pct(g.ratio)}) on ${guess} vs ${o.correct}/${o.answered} (${pct(o.ratio)}) on ${other(guess)}`;
      if (g.answered < ANSWER_CHECK.minAnswered) {
        reason = `${why}; too few Module 2 answers (${g.answered}) to check.`;
      } else if (o.ratio - g.ratio >= ANSWER_CHECK.minMargin) {
        version = other(guess);
        method = 'overridden-by-answers';
        reason = `${why}, but Module 2 answers scored ${scores}.`;
      } else if (g.ratio - o.ratio >= ANSWER_CHECK.minMargin) {
        method = 'confirmed-by-answers';
        reason = `${why}; Module 2 answers scored ${scores}.`;
      } else {
        reason = `${why}; Module 2 answers don't clearly favor either version (${scores}).`;
      }
    }

    chosen[section.id] = version;
    decisions.push({
      sectionId: section.id,
      sectionName: section.name,
      version,
      versionName: versionName(base.key, section.id, version),
      method,
      module1Missed: missed,
      cutoffGuess: guess,
      reason,
    });
  }

  if (decisions.length === 0) return { exam: base, decisions };
  return { exam: buildExam(base.format, base.key, { ...base.versions, ...chosen }), decisions };
}

/** Share of a section's questions whose pasted domain matches the key's. */
export function domainFit(section: Section, categories: Record<string, string> = {}): { agree: number; compared: number; ratio: number } {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const compared = section.questions.filter((q) => categories[q.id] && q.category !== 'Uncategorized');
  const agree = compared.filter((q) => norm(q.category) === norm(categories[q.id])).length;
  return { agree, compared: compared.length, ratio: compared.length ? agree / compared.length : 0 };
}

export interface DomainRoute {
  /** Section of the chosen version, or null for domains only. */
  section: Section | null;
  decision: RouteDecision;
  warning?: string;
}

/**
 * Route one two-version adaptive section for a Bluebook results paste, using
 * the Module 1 cutoff checked against the pasted Module 2 domains.
 */
export function routeByDomains(
  base: Exam,
  section: Section,
  outcomes: Outcomes,
  categories: Record<string, string> = {},
  choice: ModuleChoice = 'auto',
  cutoffs: Record<string, number> = MODULE_2_CUTOFFS,
): DomainRoute {
  const missed = module1Missed(base, section, {}, outcomes);
  const guess = cutoffGuess(section, missed, cutoffs);
  const why = cutoffReason(section, missed, guess, cutoffs);
  const fits = Object.fromEntries([HARDER, EASIER].map((v) => [v, domainFit(sectionOf(base, section.id, v), categories)]));
  const fitText = (v: string) => `${fits[v].agree} of ${fits[v].compared} Bluebook domains match the ${v} version`;
  const decision = (version: string | null, method: RouteMethod, reason: string): RouteDecision => ({
    sectionId: section.id,
    sectionName: section.name,
    version,
    versionName: version ? versionName(base.key, section.id, version) : 'Domains only',
    method,
    module1Missed: missed,
    cutoffGuess: guess,
    reason,
  });

  if (choice === 'none') {
    return { section: null, decision: decision(null, 'domains-only', `${why}; set by hand to use Bluebook's domains only.`) };
  }
  if (choice === HARDER || choice === EASIER) {
    const fit = fits[choice];
    const warning =
      fit.compared && fit.ratio < MANUAL_MIN_AGREEMENT
        ? `${section.name}: the pasted domains differ from the ${choice} version on ${fit.compared - fit.agree} of ${fit.compared} questions, so the student probably saw the other version.`
        : undefined;
    return { section: sectionOf(base, section.id, choice), decision: decision(choice, 'manual', `${why}; set by hand to ${choice} (${fitText(choice)}).`), warning };
  }

  const [best, runnerUp] = [HARDER, EASIER].sort((a, b) => fits[b].ratio - fits[a].ratio);
  const clear = fits[best].ratio >= DOMAIN_CHECK.minAgreement && fits[best].ratio - fits[runnerUp].ratio >= DOMAIN_CHECK.minLead;
  if (clear && best === guess) {
    return { section: sectionOf(base, section.id, best), decision: decision(best, 'confirmed-by-domains', `${why}; ${fitText(best)} (vs ${fits[runnerUp].agree} for ${runnerUp}).`) };
  }
  if (clear) {
    return {
      section: sectionOf(base, section.id, best),
      decision: decision(best, 'overridden-by-domains', `${why}, but ${fitText(best)} (vs ${fits[runnerUp].agree} for ${runnerUp}).`),
    };
  }
  return {
    section: sectionOf(base, section.id, guess),
    decision: decision(guess, 'inferred', `${why}; Bluebook's domains fit both versions (${fits[HARDER].agree} and ${fits[EASIER].agree} of ${fits[HARDER].compared}), so this can't be checked.`),
  };
}
