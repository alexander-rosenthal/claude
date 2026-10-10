/** Delimited-text parsing and header detection shared by paste and upload. */

export type Row = string[];

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n');
  if (sample.includes('\t')) return '\t';
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

/** Parse CSV/TSV with RFC 4180 quoting. Trailing empty rows are dropped. */
export function parseDelimited(text: string, delimiter = detectDelimiter(text)): Row[] {
  const rows: Row[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);

  const trimmed = rows.map((r) => r.map((c) => c.trim()));
  while (trimmed.length && trimmed[trimmed.length - 1].every((c) => c === '')) trimmed.pop();
  return trimmed;
}

export function isEmptyRow(row: Row): boolean {
  return row.every((c) => !c || !c.trim());
}

export interface HeaderMatch<K extends string> {
  rowIndex: number;
  columns: Partial<Record<K, number>>;
}

/**
 * Find a header row (within the first few rows) where the `required` column
 * is present. Each column takes the first header cell matching its pattern,
 * checked in the order the spec lists them so more specific patterns win.
 */
export function findHeader<K extends string>(rows: Row[], spec: Record<K, RegExp>, required: NoInfer<K>): HeaderMatch<K> | null {
  for (let r = 0; r < Math.min(rows.length, 8); r++) {
    const cells = rows[r].map((c) => c.trim().toLowerCase());
    const columns: Partial<Record<K, number>> = {};
    const used = new Set<number>();
    for (const key of Object.keys(spec) as K[]) {
      const idx = cells.findIndex((c, i) => !used.has(i) && c !== '' && spec[key].test(c));
      if (idx >= 0) {
        columns[key] = idx;
        used.add(idx);
      }
    }
    if (columns[required] !== undefined && Object.keys(columns).length >= 2) return { rowIndex: r, columns };
  }
  return null;
}

export function isInteger(s: string | undefined): boolean {
  return s != null && /^\d+$/.test(s.trim());
}
