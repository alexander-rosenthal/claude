/**
 * Turn pasted text or spreadsheet rows into student responses.
 */
import { buildAllVersions } from '../core/exam';
import type { Exam } from '../core/types';
import { bluebookTargetExam, looksLikeBluebook, parseBluebook } from './bluebook';
import { AnswerCollector, type ParseResult } from './collector';
import { findHeader, isEmptyRow, isInteger, parseDelimited, type Row } from './table';

const RESPONSE_COLUMNS = {
  // "Your Answer" must be claimed before a generic "answer" pattern could grab "Correct Answer".
  answer: /^(your|student|student's|my)\s*(answer|response|choice)|^(answer|response|choice|resp|ans)\b(?!.*key)/,
  correct: /correct|key/,
  question: /^(q|q#|#|no\.?|num|number|item|question(\s*(#|no\.?|num|number))?)$/,
  section: /^(section|module|test|subject|part|subtest)/,
};

/**
 * Responses from table rows (spreadsheet or tab/comma-separated paste).
 * Accepted layouts:
 *  - a header row naming Question and Answer columns (Section optional)
 *  - no header: [section, question, answer], [question, answer] or [answer]
 */
export function responsesFromRows(exam: Exam, rows: Row[]): ParseResult {
  const collector = new AnswerCollector(exam);
  const header = findHeader(rows, RESPONSE_COLUMNS, 'question');
  const body = rows.slice(header ? header.rowIndex + 1 : 0).filter((r) => !isEmptyRow(r));

  if (header && header.columns.answer !== undefined) {
    const { section, question, answer } = header.columns;
    body.forEach((row, i) => {
      const line = `row ${i + (header.rowIndex + 2)}`;
      if (section !== undefined && row[section] && !collector.setContext(row[section])) {
        collector.warnUnknownSection(row[section], line);
        return;
      }
      const num = row[question!];
      collector.add(isInteger(num) ? Number(num) : null, row[answer] ?? '', line);
    });
    return collector.result();
  }

  body.forEach((row, i) => {
    const cells = row.map((c) => c.trim());
    const line = `row ${i + 1}`;
    if (cells.length >= 3 && !isInteger(cells[0]) && isInteger(cells[1])) {
      if (!collector.setContext(cells[0])) return collector.warnUnknownSection(cells[0], line);
      collector.add(Number(cells[1]), cells[2], line);
    } else if (cells.length >= 2 && isInteger(cells[0])) {
      collector.add(Number(cells[0]), cells[1], line);
    } else if (cells.filter(Boolean).length === 1 && !isInteger(cells[0]) && collector.setContext(cells[0])) {
      // A lone section label row.
    } else {
      collector.add(null, cells[0] ?? '', line);
    }
  });
  return collector.result();
}

// A number, a separator (or a letter directly after it, as in "1A"), then the answer.
// A dash only separates when it isn't the sign of a numeric answer ("3 -4").
const PAIR = /(\d+)(?:\s*[.):=](?!\d)\s*|\s*-(?=\s|[A-Ka-k(])\s*|\s+|(?=\(?[A-Ka-k](?![A-Za-z])))(\(?[A-Ka-k]\)?(?![A-Za-z])|[-−]?\d*\.?\d+(?:\/\d+)?|[-–—](?=\s|$|,))/g;
const LETTER_RUN = /^[A-Ka-k\-–—_\s,]+$/;
// One bare answer: a letter, a grid-in number ("2.9", "-23", "3/2"), or a blank marker.
const ANSWER_TOKEN = /^(?:\(?[A-Ka-k]\)?|[-−]?\d*\.?\d+(?:\/\d*\.?\d+)?|[-–—_])$/;

/**
 * A line of bare answers in order ("C A B 2.9 D 27 -23"), as students type
 * them without numbering, or one per line. Not "1 A 2 B", where every other token counts up
 * by one: that's numbered.
 */
function plainAnswers(line: string, listMode: boolean): string[] | null {
  const tokens = line.split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length || !tokens.every((t) => ANSWER_TOKEN.test(t))) return null;
  // A lone number could be a stray question number; it's an answer only within a list of answers.
  if (tokens.length === 1 && !listMode && /\d/.test(tokens[0])) return null;
  const numbers = tokens.filter((_, i) => i % 2 === 0);
  const numbered =
    tokens.length % 2 === 0 && numbers.every((t) => /^\d+$/.test(t)) && numbers.every((t, i) => i === 0 || Number(t) === Number(numbers[i - 1]) + 1);
  return numbered ? null : tokens;
}

/**
 * Responses from free-form pasted text. Understands, in any mix:
 *   section headings ("Math Module 1", "English")
 *   numbered answers ("1. A", "2) B", "3: 3/2", several per line)
 *   letter runs ("ABDCA BCD…", one answer per letter, "-" for blank)
 *   plain answer lists ("C A B 2.9 D 27", in order, no numbering)
 * Tab-separated tables and Bluebook score-detail pastes are detected and
 * handed to their own parsers.
 */
export function parsePastedResponses(exam: Exam, text: string): ParseResult {
  if (exam.family === 'SAT' && looksLikeBluebook(text)) return parseBluebook(bluebookTargetExam(exam), text);

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length && lines.filter((l) => l.includes('\t')).length >= lines.length / 2) {
    return responsesFromRows(exam, parseDelimited(text, '\t'));
  }

  const collector = new AnswerCollector(exam);
  // Plain answers elsewhere (a letter, or several answers on a line) mean a lone number is an answer too.
  const listMode = lines.some((l) => {
    const tokens = plainAnswers(l.trim(), false);
    return tokens !== null && (tokens.length > 1 || /[A-Ka-k]/.test(tokens[0]));
  });
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    const where = `line ${i + 1}`;
    const pairs = [...line.matchAll(PAIR)];
    const startsWithWord = /^[A-Za-z]{2,}/.test(line);

    if (startsWithWord && !LETTER_RUN.test(line)) {
      // Heading, possibly followed by answers on the same line ("Module 1: 1 A 2 B").
      const headingEnd = pairs.length ? pairs[0].index : line.length;
      const heading = line.slice(0, headingEnd);
      if (collector.setContext(heading) || collector.setContext(line)) {
        for (const m of pairs) collector.add(Number(m[1]), m[2].replace(/[()]/g, ''), where);
        return;
      }
      if (!pairs.length) {
        collector.warn(`Skipped ${where}: "${line.slice(0, 40)}" isn't a recognized section.`);
        return;
      }
    }

    const plain = plainAnswers(line, listMode);
    if (plain) {
      for (const t of plain) collector.add(null, t.replace(/[()]/g, ''), where);
      return;
    }

    if (pairs.length) {
      for (const m of pairs) collector.add(Number(m[1]), m[2].replace(/[()]/g, ''), where);
      return;
    }

    if (LETTER_RUN.test(line)) {
      const tokens = line.includes(',') || /\s/.test(line) ? line.split(/[\s,]+/).filter(Boolean) : [...line];
      for (const t of tokens) collector.add(null, t, where);
      return;
    }

    collector.warn(`Skipped ${where}: couldn't read "${line.slice(0, 40)}".`);
  });
  return collector.result();
}

/**
 * Parse against every Module 2 version the key holds and keep the reading
 * with the fewest problems (the current version on a tie). Which version a
 * student saw isn't known until their answers are in, and the versions put
 * grid-ins in different places.
 */
export function parseForAnyVersion(exam: Exam, parse: (exam: Exam) => ParseResult): ParseResult {
  if (!exam.key.versions) return parse(exam);
  return [exam, ...buildAllVersions(exam.format, exam.key)].map(parse).reduce((best, r) => (r.warnings.length < best.warnings.length ? r : best));
}
