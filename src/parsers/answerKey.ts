/**
 * Import an answer key (answers + categories) from spreadsheet rows.
 *
 * Expected columns (header names are flexible, order doesn't matter):
 *   Section | Question | Answer | Category | Subcategory
 *
 * Section may be omitted if questions are listed in exam order (numbering
 * restarting at 1 starts the next section). Multiple acceptable answers go in
 * one cell separated by commas, semicolons, "|" or "or" (e.g. "3/2, 1.5").
 */
import type { AnswerKey, AnswerKeyEntry, ExamFormat } from '../core/types';
import { resolveSectionLabel } from './sections';
import { findHeader, isEmptyRow, isInteger, type Row } from './table';

const KEY_COLUMNS = {
  subcategory: /sub|secondary|skill|topic/,
  category: /categor|domain|primary|content|reporting/,
  section: /^(section|module|test|subject|part|subtest)/,
  question: /^(q|q#|#|no\.?|num|number|item|question(\s*(#|no\.?|num|number))?)$/,
  answer: /answer|correct|key|solution/,
};

export interface KeyImportResult {
  key: AnswerKey | null;
  errors: string[];
}

export function splitAcceptable(cell: string): string[] {
  return cell
    .split(/\s*(?:,|;|\||\bor\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function answerKeyFromRows(format: ExamFormat, rows: Row[], name: string): KeyImportResult {
  const errors: string[] = [];
  const header = findHeader(rows, KEY_COLUMNS, 'question');
  if (!header || header.columns.answer === undefined) {
    return { key: null, errors: ['Could not find a header row with at least "Question" and "Answer" columns.'] };
  }
  const c = header.columns;
  const entries: AnswerKeyEntry[] = [];
  let sectionIdx = 0;
  let lastNumber = 0;

  rows.slice(header.rowIndex + 1).forEach((row, i) => {
    if (isEmptyRow(row)) return;
    const line = `row ${header.rowIndex + i + 2}`;
    const numCell = row[c.question!] ?? '';
    if (!isInteger(numCell)) {
      errors.push(`${line}: question number "${numCell}" is not a whole number.`);
      return;
    }
    const number = Number(numCell);

    if (c.section !== undefined && row[c.section]) {
      const match = resolveSectionLabel(row[c.section], format.sections, format.scales);
      if (!match) {
        errors.push(`${line}: unknown section "${row[c.section]}". Expected one of: ${format.sections.map((s) => s.name).join(', ')}.`);
        return;
      }
      const target = match.kind === 'section' ? match.section : match.sections[0];
      const targetIdx = format.sections.indexOf(target);
      // A group label ("Math") moves on to the group's next module when numbering restarts.
      if (match.kind === 'group' && number <= lastNumber && format.sections[sectionIdx]?.scaleId === target.scaleId) {
        sectionIdx = Math.min(sectionIdx + 1, format.sections.length - 1);
      } else if (match.kind === 'section' || format.sections[sectionIdx]?.scaleId !== target.scaleId) {
        sectionIdx = targetIdx;
      }
    } else if (number <= lastNumber) {
      sectionIdx++;
    }
    lastNumber = number;

    const section = format.sections[sectionIdx];
    if (!section) {
      errors.push(`${line}: more questions than the ${format.name} has.`);
      return;
    }
    entries.push({
      sectionId: section.id,
      number,
      correct: splitAcceptable(row[c.answer!] ?? ''),
      category: c.category !== undefined ? (row[c.category] ?? '') : '',
      subcategory: c.subcategory !== undefined ? (row[c.subcategory] ?? '') : '',
    });
  });

  if (errors.length) return { key: null, errors };
  const id = `import-${Date.now().toString(36)}`;
  return { key: { id, name, formatId: format.id, isDemo: false, entries }, errors };
}

/** Rows for a blank key template matching a format, ready to save as CSV. */
export function answerKeyTemplate(format: ExamFormat): Row[] {
  const rows: Row[] = [['Section', 'Question', 'Answer', 'Category', 'Subcategory']];
  for (const s of format.sections) {
    for (let n = 1; n <= s.questionCount; n++) rows.push([s.name, String(n), '', '', '']);
  }
  return rows;
}
