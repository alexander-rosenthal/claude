/**
 * Answer normalization and comparison.
 *
 * Multiple choice: tolerant of case, punctuation, numeric positions (1 = first
 * choice) and the ACT's alternating A-D / F-J lettering (typing "A" on an
 * F-J question means "F").
 *
 * Student-produced responses follow the digital SAT rules: any numerically
 * equal form is correct (3/2 = 1.5 = 1.50), and a non-terminating value may be
 * entered as a decimal that is rounded or truncated, provided it fills the
 * whole answer field (5 characters, or 6 when negative).
 */

import type { Question } from './types';

const BLANK_TOKENS = new Set(['', '-', '–', '—', '_', '.', 'OMIT', 'OMITTED', 'BLANK', 'NONE', 'N/A', 'NA', 'NOANSWER']);

const LETTER_SETS = [
  ['A', 'B', 'C', 'D', 'E'],
  ['F', 'G', 'H', 'J', 'K'],
];

export const SPR_MAX_LENGTH = 5;
export const SPR_MAX_LENGTH_NEGATIVE = 6;

export function isBlank(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  return BLANK_TOKENS.has(raw.trim().toUpperCase().replace(/\s+/g, ''));
}

export interface NormalizedResponse {
  /** Canonical value, or null when the response is blank. */
  value: string | null;
  /** False when something was entered but it can't be a valid answer. */
  valid: boolean;
}

/** Map a raw multiple-choice entry onto one of `choices`. */
export function normalizeChoice(raw: string, choices: string[]): NormalizedResponse {
  if (isBlank(raw)) return { value: null, valid: true };
  const cleaned = raw.trim().toUpperCase().replace(/^\(|[).:]$/g, '').trim();

  if (choices.includes(cleaned)) return { value: cleaned, valid: true };

  if (/^\d$/.test(cleaned)) {
    const idx = Number(cleaned) - 1;
    if (idx >= 0 && idx < choices.length) return { value: choices[idx], valid: true };
  }

  // ACT alternates A-D(E) and F-J(K); accept the letter in the same position.
  for (const set of LETTER_SETS) {
    const idx = set.indexOf(cleaned);
    if (idx >= 0 && idx < choices.length && !choices.includes(cleaned)) {
      const other = LETTER_SETS.find((s) => s !== set)!;
      if (choices[idx] === other[idx]) return { value: choices[idx], valid: true };
    }
  }

  return { value: cleaned, valid: false };
}

// ---------------------------------------------------------------------------
// Exact rational arithmetic for student-produced responses
// ---------------------------------------------------------------------------

export interface Rational {
  num: bigint; // carries the sign
  den: bigint; // always > 0
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function reduce(num: bigint, den: bigint): Rational {
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den) || 1n;
  return { num: num / g, den: den / g };
}

function parseDecimal(s: string): Rational | null {
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const [, sign, int = '', frac = ''] = m;
  if (!int && !frac) return null;
  const digits = BigInt((int || '0') + frac);
  const den = 10n ** BigInt(frac.length);
  return reduce(sign ? -digits : digits, den);
}

/** Parse "12", "-0.5", ".75", "3/2", "-7/4". Returns null when not numeric. */
export function parseRational(raw: string): Rational | null {
  const s = raw.trim().replace(/\s+/g, '').replace(/^\+/, '').replace(/[−–]/g, '-');
  if (!s) return null;
  const slash = s.indexOf('/');
  if (slash === -1) return parseDecimal(s);
  const top = parseDecimal(s.slice(0, slash));
  const bottom = parseDecimal(s.slice(slash + 1));
  if (!top || !bottom || bottom.num === 0n) return null;
  return reduce(top.num * bottom.den, top.den * bottom.num);
}

function equalRationals(a: Rational, b: Rational): boolean {
  return a.num * b.den === b.num * a.den;
}

/** Normalize a student-produced response for storage/display. */
export function normalizeSpr(raw: string): NormalizedResponse {
  if (isBlank(raw)) return { value: null, valid: true };
  const value = raw.trim().replace(/\s+/g, '').replace(/[−–]/g, '-');
  const parsed = parseRational(value);
  const limit = value.startsWith('-') ? SPR_MAX_LENGTH_NEGATIVE : SPR_MAX_LENGTH;
  return { value, valid: parsed !== null && value.length <= limit };
}

/**
 * Does a decimal `response` count as a rounded or truncated form of `target`?
 * Only applies when the response fills the entire answer field.
 */
function isAcceptedApproximation(response: string, target: Rational): boolean {
  const m = /^(-)?(\d*)\.(\d+)$/.exec(response);
  if (!m) return false;
  const negative = Boolean(m[1]);
  const limit = negative ? SPR_MAX_LENGTH_NEGATIVE : SPR_MAX_LENGTH;
  if (response.length !== limit) return false;
  if (negative !== target.num < 0n) return false;

  const places = m[3].length;
  const scale = 10n ** BigInt(places);
  const entered = BigInt((m[2] || '0') + m[3]);
  const absNum = target.num < 0n ? -target.num : target.num;
  const truncated = (absNum * scale) / target.den;
  const rounded = (absNum * scale * 2n + target.den) / (2n * target.den);
  return entered === truncated || entered === rounded;
}

export function sprMatches(response: string, acceptable: string[]): boolean {
  const resp = normalizeSpr(response);
  if (!resp.value) return false;
  const value = parseRational(resp.value);
  if (!value) return false;
  for (const answer of acceptable) {
    const target = parseRational(answer);
    if (!target) continue;
    if (equalRationals(value, target)) return true;
    if (isAcceptedApproximation(resp.value, target)) return true;
  }
  return false;
}

/** Normalize a raw response for a specific question. */
export function normalizeResponse(question: Question, raw: string | undefined): NormalizedResponse {
  if (raw == null || isBlank(raw)) return { value: null, valid: true };
  if (question.type === 'spr') return normalizeSpr(raw);
  return normalizeChoice(raw, question.choices);
}

export function isCorrect(question: Question, raw: string | undefined): boolean {
  const { value } = normalizeResponse(question, raw);
  if (value == null) return false;
  if (question.type === 'spr') return sprMatches(value, question.correct);
  return question.correct.includes(value);
}
