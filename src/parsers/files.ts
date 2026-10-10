/** Read an uploaded .xlsx / .csv / .tsv / .txt file into rows of strings. */
import readXlsxFile from 'read-excel-file';
import { parseDelimited, type Row } from './table';

export interface FileRows {
  rows: Row[];
  warnings: string[];
}

function cellToString(cell: unknown, warnings: string[], at: string): string {
  if (cell == null) return '';
  if (cell instanceof Date) {
    // Excel turns an answer typed as "3/2" into the date 2 March. Undo that.
    const fraction = `${cell.getUTCMonth() + 1}/${cell.getUTCDate()}`;
    warnings.push(`${at}: a date was converted back to the fraction ${fraction}. Format answer columns as Text to avoid this.`);
    return fraction;
  }
  return String(cell).trim();
}

export async function readRowsFromFile(file: File): Promise<FileRows> {
  const warnings: string[] = [];
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const sheet = await readXlsxFile(file);
    const rows = sheet.map((row, r) => row.map((cell, c) => cellToString(cell, warnings, `Row ${r + 1}, column ${c + 1}`)));
    return { rows, warnings };
  }
  if (name.endsWith('.xls')) {
    throw new Error('Old .xls files aren’t supported. Save the sheet as .xlsx or .csv and upload again.');
  }
  return { rows: parseDelimited(await file.text()), warnings };
}

export function rowsToCsv(rows: Row[]): string {
  return rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
