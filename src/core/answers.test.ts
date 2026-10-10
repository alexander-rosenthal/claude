import { describe, expect, it } from 'vitest';
import { normalizeChoice, normalizeSpr, parseRational, sprMatches } from './answers';

describe('normalizeChoice', () => {
  const abcd = ['A', 'B', 'C', 'D'];
  const fghj = ['F', 'G', 'H', 'J'];

  it('accepts letters regardless of case and punctuation', () => {
    expect(normalizeChoice('b', abcd)).toEqual({ value: 'B', valid: true });
    expect(normalizeChoice('(C)', abcd)).toEqual({ value: 'C', valid: true });
    expect(normalizeChoice(' d. ', abcd)).toEqual({ value: 'D', valid: true });
  });

  it('treats blanks as omitted', () => {
    for (const blank of ['', ' ', '-', '—', 'omit', 'N/A']) {
      expect(normalizeChoice(blank, abcd)).toEqual({ value: null, valid: true });
    }
  });

  it('maps numeric positions', () => {
    expect(normalizeChoice('3', abcd).value).toBe('C');
    expect(normalizeChoice('2', fghj).value).toBe('G');
  });

  it('maps ACT alternate lettering by position', () => {
    expect(normalizeChoice('A', fghj).value).toBe('F');
    expect(normalizeChoice('D', fghj).value).toBe('J');
    expect(normalizeChoice('H', abcd).value).toBe('C');
  });

  it('flags impossible answers', () => {
    expect(normalizeChoice('E', abcd)).toEqual({ value: 'E', valid: false });
    expect(normalizeChoice('Q', abcd).valid).toBe(false);
  });
});

describe('student-produced responses', () => {
  it('parses integers, decimals and fractions exactly', () => {
    expect(parseRational('3/2')).toEqual({ num: 3n, den: 2n });
    expect(parseRational('1.50')).toEqual({ num: 3n, den: 2n });
    expect(parseRational('-.25')).toEqual({ num: -1n, den: 4n });
    expect(parseRational('6/-4')).toEqual({ num: -3n, den: 2n });
    expect(parseRational('abc')).toBeNull();
    expect(parseRational('1/0')).toBeNull();
  });

  it('accepts every equivalent form', () => {
    expect(sprMatches('1.5', ['3/2'])).toBe(true);
    expect(sprMatches('6/4', ['3/2'])).toBe(true);
    expect(sprMatches('1.50', ['1.5'])).toBe(true);
    expect(sprMatches('-0.5', ['-1/2'])).toBe(true);
    expect(sprMatches('1.4', ['3/2'])).toBe(false);
  });

  it('accepts rounded or truncated decimals that fill the answer field', () => {
    // 2/3: College Board lists .6666, .6667, 0.666, 0.667 as acceptable.
    for (const ok of ['.6666', '.6667', '0.666', '0.667']) expect(sprMatches(ok, ['2/3'])).toBe(true);
    // Too short to be a full-width approximation.
    for (const bad of ['.66', '.67', '0.67', '.666']) expect(sprMatches(bad, ['2/3'])).toBe(false);
    // Negative answers have one more character available.
    expect(sprMatches('-.6666', ['-2/3'])).toBe(true);
    expect(sprMatches('-.6667', ['-2/3'])).toBe(true);
    expect(sprMatches('-0.66', ['-2/3'])).toBe(false);
    expect(sprMatches('.6667', ['-2/3'])).toBe(false);
  });

  it('accepts any of several listed answers', () => {
    expect(sprMatches('4', ['-4', '4'])).toBe(true);
  });

  it('validates field length', () => {
    expect(normalizeSpr('12345').valid).toBe(true);
    expect(normalizeSpr('123456').valid).toBe(false);
    expect(normalizeSpr('-12345').valid).toBe(true);
    expect(normalizeSpr('1/2/3').valid).toBe(false);
  });
});
