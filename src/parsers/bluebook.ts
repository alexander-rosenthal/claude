/**
 * Parser for answers copied from a Bluebook / My Practice score details page.
 *
 * Copying that table yields one row per question, roughly:
 *
 *   Question  Section                       Correct Answer  Your Answer
 *   1         Reading and Writing           B               B; Correct
 *   2         Reading and Writing           C               A; Incorrect
 *   ...
 *   1         Math                          3/2, 1.5        1.5; Correct
 *
 * Cells are usually tab-separated. The section may or may not name the
 * module; when it doesn't, the restart of question numbers marks Module 2.
 * When a header row is present its column names are used; otherwise the
 * first two answer-like cells after the section are read as
 * (correct answer, your answer).
 *
 * The exact page layout is subject to change, so the parser is deliberately
 * forgiving, and the "correct answer" column is used only to cross-check
 * that the loaded answer key matches the test that was taken.
 */
import { isBlank, normalizeChoice, sprMatches } from '../core/answers';
import type { Exam } from '../core/types';
import { questionId } from '../core/types';
import { AnswerCollector, type ParseResult } from './collector';
import { findHeader, type Row } from './table';

const SECTION_CELL = /reading|writing|math/i;

const COLUMNS = {
  your: /your|student|response/,
  correct: /correct/,
  question: /^(question|q|#|no\.?|number)(\s*(#|no\.?|number))?$/,
  section: /section|module|domain|test/,
};

export function looksLikeBluebook(text: string): boolean {
  if (!/reading\s*(and|&)\s*writing|math/i.test(text)) return false;
  return /\t/.test(text) || /your answer|correct answer/i.test(text) || /;\s*(in)?correct/i.test(text);
}

/** "B; Correct" → "B", "Omitted" → "", "1.5 (Incorrect)" → "1.5" */
export function cleanBluebookAnswer(cell: string): string {
  const s = cell
    .replace(/^(your answer|correct answer|answer)\s*:?\s*/i, '')
    .replace(/[;,(]?\s*\b(in)?correct\b\)?\s*$/i, '')
    .trim();
  if (/^(omitted|not answered|no answer|unanswered|skipped)$/i.test(s) || isBlank(s)) return '';
  return s;
}

function splitRow(line: string): Row {
  const cells = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/);
  return cells.map((c) => c.trim());
}

/** Fallback for rows flattened to single spaces: "12 Math 3/2 1.5; Correct" */
const LOOSE_ROW = /^(\d+)\s+(reading\s*(?:and|&)\s*writing|math)(?:\s*[:,-]?\s*module\s*(\d))?\s+(.+)$/i;

function splitLooseRow(line: string): Row | null {
  const m = LOOSE_ROW.exec(line.trim());
  if (!m) return null;
  const section = m[3] ? `${m[2]} module ${m[3]}` : m[2];
  const rest = m[4].replace(/\s*\b(review|view)\b\s*$/i, '').trim();
  // "B B; Correct" → ["B", "B; Correct"]; a single token is the student's answer.
  const parts = rest.match(/^(\S+(?:,\s*\S+)*)\s+(.+)$/);
  return parts ? [m[1], section, parts[1], parts[2]] : [m[1], section, '', rest];
}

export function parseBluebook(exam: Exam, text: string): ParseResult {
  const collector = new AnswerCollector(exam);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.map((l) => {
    const cells = splitRow(l);
    return cells.length >= 3 ? cells : (splitLooseRow(l) ?? cells);
  });
  const header = findHeader(rows, COLUMNS, 'question');
  const mismatches: string[] = [];
  let read = 0;

  rows.forEach((row, i) => {
    if (header && i <= header.rowIndex) return;
    const where = `line ${i + 1}`;

    let number: number;
    let sectionLabel: string | undefined;
    let correct: string | undefined;
    let yours: string | undefined;

    if (header) {
      const c = header.columns;
      if (c.question === undefined || !/^\d+$/.test(row[c.question] ?? '')) return;
      number = Number(row[c.question]);
      sectionLabel = c.section !== undefined ? row[c.section] : undefined;
      correct = c.correct !== undefined ? row[c.correct] : undefined;
      yours = c.your !== undefined ? row[c.your] : undefined;
    } else {
      const numIdx = row.findIndex((c) => /^\d+$/.test(c));
      const secIdx = row.findIndex((c) => SECTION_CELL.test(c));
      if (numIdx < 0 || secIdx < 0) {
        // Section heading rows ("Math Module 2") still set context.
        if (row.length === 1) collector.setContext(row[0]);
        return;
      }
      number = Number(row[numIdx]);
      sectionLabel = row[secIdx];
      const answerCells = row.slice(Math.max(numIdx, secIdx) + 1).filter((c) => c && !/^(review|view|explanation)$/i.test(c));
      if (answerCells.length >= 2) [correct, yours] = answerCells;
      else yours = answerCells[0];
    }

    if (sectionLabel && !collector.setContext(sectionLabel)) {
      collector.warnUnknownSection(sectionLabel, where);
      return;
    }
    const before = collector.current;
    collector.add(number, cleanBluebookAnswer(yours ?? ''), where);
    read++;

    const section = collector.current ?? before;
    const question = section?.questions.find((q) => q.id === questionId(section.id, number));
    const pastedKey = correct ? cleanBluebookAnswer(correct) : '';
    if (question && pastedKey) {
      const agrees =
        question.type === 'spr'
          ? pastedKey.split(/\s*(?:,|\bor\b)\s*/i).some((p) => sprMatches(p, question.correct))
          : question.correct.includes(normalizeChoice(pastedKey, question.choices).value ?? '');
      if (!agrees) mismatches.push(`${section!.shortName} #${number}: pasted key says ${pastedKey}, loaded key says ${question.correct.join(' / ')}`);
    }
  });

  if (read === 0) collector.warn('No Bluebook answer rows were found. Check that the copied text includes the question table.');
  if (mismatches.length) {
    collector.warn(
      `The pasted correct answers disagree with the loaded answer key on ${mismatches.length} question(s). ` +
        `Make sure the right practice test is selected. ${mismatches.slice(0, 5).join('; ')}${mismatches.length > 5 ? '; …' : ''}`,
    );
  }
  return collector.result();
}
