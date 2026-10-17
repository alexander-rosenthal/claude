#!/usr/bin/env node
/**
 * Extract anonymized results from Next Level Tutors (NLT) digital SAT report
 * PDFs: the Bluebook test number, section scores, and the answer grid (the
 * student's answer and the accepted answers for every question).
 *
 *   node scripts/extract-nlt-report.mjs out.json report1.pdf report2.pdf ...
 *
 * Needs poppler's pdftotext. Student names are not extracted; each report is
 * identified by a hash of its answers and scores, so duplicates collapse.
 * Reports that can't be read cleanly are listed on stderr and skipped.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const MODULES = ['rw1', 'rw2', 'math1', 'math2'];
const COUNTS = { rw1: 27, rw2: 27, math1: 22, math2: 22 };

const text = (pdf, page) => execFileSync('pdftotext', ['-layout', ...(page ? ['-f', `${page}`, '-l', `${page}`] : []), pdf, '-'], { encoding: 'utf8' });

function words(pdf, page) {
  const tsv = execFileSync('pdftotext', ['-tsv', '-f', `${page}`, '-l', `${page}`, pdf, '-'], { encoding: 'utf8' });
  return tsv
    .split('\n')
    .slice(1)
    .map((line) => line.split('\t'))
    .filter((c) => c[0] === '5' && c[11] !== undefined)
    .map((c) => ({ x: +c[6], y: +c[7], w: +c[8], text: c[11] }));
}

/** "Test Version: Bluebook SAT #4" → 4; "Digital SAT #1" is kept apart as "digital-1". */
function testOf(all) {
  const m = all.match(/Test Version:\s*(Bluebook SAT|Digital SAT)\s*#\s*(\d+)/i);
  if (!m) return null;
  return /bluebook/i.test(m[1]) ? `bluebook-${m[2]}` : `digital-${m[2]}`;
}

/** Section score and "N out of M" from the section's topics page. */
function sectionScore(all, heading) {
  const start = all.search(new RegExp(`^\\s*${heading}\\s+Section \\d/2`, 'm'));
  if (start < 0) return null;
  const chunk = all.slice(start, start + 1500);
  const score = chunk.match(/^\s*(\d{3})\b/m);
  const raw = chunk.match(/(\d+)\s+out of\s+(\d+)/);
  return score && raw ? { scaled: +score[1], raw: +raw[1], of: +raw[2] } : null;
}

function totalScore(all) {
  const m = all.match(/Total Score\s+(\d{3,4})/);
  return m ? +m[1] : null;
}

/** The answer grid page: the one with the vertical column headers. */
function gridPage(pdf, pages) {
  for (let p = 1; p <= pages; p++) {
    const t = text(pdf, p);
    if (/Correct answer/.test(t) && /Incorrect answer/.test(t) && /noitseuQ/.test(t)) return p;
  }
  return null;
}

function parseGrid(pdf, page, problems) {
  const ws = words(pdf, page);
  // Vertical headers ("# noitseuQ", "rewsnA ruoY", "tcerroC") are single letters above the rows.
  const header = (letter) => ws.filter((w) => w.text === letter && w.y > 100 && w.y < 195).map((w) => w.x).sort((a, b) => a - b);
  const qX = header('Q');
  const yourX = header('Y');
  const correctX = header('C');
  if (qX.length !== 4 || yourX.length !== 4 || correctX.length !== 4) {
    problems.push(`grid headers not found (Q ${qX.length}, Y ${yourX.length}, C ${correctX.length})`);
    return null;
  }
  const body = ws.filter((w) => w.y >= 195 && w.y < 780 && !/nleveltutors|^\(424\)$|^208-4570$/.test(w.text));
  const columns = [
    ...yourX.map((x, g) => ({ g, kind: 'your', x: x + 3 })),
    ...correctX.map((x, g) => ({ g, kind: 'correct', x: x + 3 })),
  ];
  const isNumberCell = (w) => /^\d+$/.test(w.text) && qX.some((x) => Math.abs(w.x - x) <= 6);

  const grid = {};
  MODULES.forEach((m, g) => {
    const numbers = body.filter((w) => isNumberCell(w) && Math.abs(w.x - qX[g]) <= 6).sort((a, b) => a.y - b.y);
    const rows = numbers.map((n, i) => ({ number: +n.text, top: n.y - 4, bottom: i + 1 < numbers.length ? numbers[i + 1].y - 4 : n.y + 70 }));
    grid[m] = rows.map((row) => {
      const cell = (kind) =>
        body
          .filter((w) => !isNumberCell(w) && w.y >= row.top && w.y < row.bottom)
          .filter((w) => {
            const centre = w.x + w.w / 2;
            const nearest = columns.reduce((a, b) => (Math.abs(centre - a.x) <= Math.abs(centre - b.x) ? a : b));
            return nearest.g === g && nearest.kind === kind;
          })
          .sort((a, b) => a.y - b.y)
          .map((w) => w.text);
      const your = cell('your');
      const correct = cell('correct');
      if (your.length > 1) problems.push(`${m} #${row.number}: several answers (${your.join(' ')})`);
      // A long answer can run into the correct answer and print as one word
      // ("41760" + "4176" → "417604176"); resolved later from other reports.
      if (!correct.length) {
        const merged = body.filter((w) => !isNumberCell(w) && w.y >= row.top && w.y < row.bottom && w.x < correctX[g] && w.x + w.w > correctX[g]);
        if (merged.length === 1 && your.length <= 1 && (your[0] ?? merged[0].text) === merged[0].text) {
          return { number: row.number, your: '', correct: [], merged: merged[0].text };
        }
      }
      return { number: row.number, your: your.join(' '), correct };
    });
    const numbersSeen = grid[m].map((r) => r.number).join(',');
    const expected = Array.from({ length: COUNTS[m] }, (_, i) => i + 1).join(',');
    if (numbersSeen !== expected) problems.push(`${m}: question numbers ${numbersSeen}`);
    for (const r of grid[m]) if (!r.correct.length && !r.merged) problems.push(`${m} #${r.number}: no correct answer`);
  });
  return grid;
}

function extract(pdf) {
  const problems = [];
  const pages = +execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)[1];
  const all = text(pdf);
  const test = testOf(all);
  if (!test) problems.push('no "Test Version" line');
  const rw = sectionScore(all, 'Reading & Writing');
  const math = sectionScore(all, 'Math');
  const total = totalScore(all);
  if (!rw || !math) problems.push('section scores not found');
  if (rw && math && total !== rw.scaled + math.scaled) problems.push(`total ${total} ≠ ${rw.scaled} + ${math.scaled}`);
  const page = gridPage(pdf, pages);
  if (!page) problems.push('answer grid not found');
  const grid = page ? parseGrid(pdf, page, problems) : null;
  if (problems.length) return { problems };
  const report = { test, scores: { rw: rw.scaled, math: math.scaled, total }, raw: { rw: rw.raw, math: math.raw }, rawOf: { rw: rw.of, math: math.of }, modules: grid };
  const id = createHash('sha256').update(JSON.stringify(report)).digest('hex').slice(0, 12);
  return { report: { id, ...report } };
}

const [out, ...pdfs] = process.argv.slice(2);
const reports = new Map();
let failed = 0;
for (const pdf of pdfs) {
  const { report, problems } = extract(pdf);
  if (problems) {
    failed++;
    console.error(`SKIP ${pdf}:\n  ${problems.join('\n  ')}`);
    continue;
  }
  if (reports.has(report.id)) console.error(`duplicate of ${report.id}: ${pdf}`);
  reports.set(report.id, report);
  console.error(`${report.id}\t${pdf}`);
}
/**
 * A long grid-in answer can print into the next column and fuse with it:
 * "11/28.3928" is the answer 11/28 next to the accepted form .3928, and
 * "2755627556" is 27556 entered and accepted. Split such words against the
 * accepted forms of the same question, taken by majority over the reports for
 * the same test and module version (versions told apart by their
 * multiple-choice answers, which never fuse).
 */
function resolveFused(all) {
  const letter = (c) => c.correct.length === 1 && /^[A-D]$/.test(c.correct[0]);
  const groups = new Map();
  for (const r of all) {
    for (const m of MODULES) {
      const sig = `${r.test}|${m}|${r.modules[m].map((c) => (letter(c) ? c.correct[0] : '*')).join('')}`;
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(r.modules[m]);
    }
  }
  for (const [sig, modules] of groups) {
    modules[0].forEach((_, i) => {
      const cells = modules.map((cells) => cells[i]);
      if (cells.every(letter)) return;
      const counts = new Map();
      for (const c of cells) for (const f of new Set(c.correct)) counts.set(f, (counts.get(f) ?? 0) + 1);
      // Only long answers overflow their column, so a fused word has a prefix of 3+ characters.
      const fusedWith = (t, f) => t.endsWith(f) && t.length - f.length >= 3;
      const doubled = (t) => t.length >= 6 && t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2);
      // Forms seen intact in at least two reports (or half, for small groups),
      // most common first, minus fused words made of an accepted form.
      const accepted = [];
      for (const [f, n] of [...counts].sort((a, b) => b[1] - a[1])) {
        if (n < Math.min(2, cells.length / 2) || (n === 1 && doubled(f))) continue;
        if (accepted.some((g) => fusedWith(f, g))) continue;
        accepted.push(f);
      }
      const split = (t) => {
        const f = accepted.filter((f) => fusedWith(t, f)).sort((a, b) => b.length - a.length)[0];
        if (f) return [t.slice(0, -f.length), f];
        if (doubled(t)) return [t.slice(0, t.length / 2), t.slice(t.length / 2)];
        return null;
      };
      for (const cell of cells) {
        const tokens = cell.merged ? [cell.merged, ...cell.correct] : cell.correct;
        delete cell.merged;
        const kept = [];
        for (const t of tokens) {
          if (accepted.includes(t)) kept.push(t);
          else if (split(t)) {
            const [your, form] = split(t);
            if (!cell.your) cell.your = your;
            else console.error(`CHECK ${sig} #${i + 1}: "${t}" next to answer "${cell.your}"`);
            kept.push(form);
          } else {
            kept.push(t);
            console.error(`UNKNOWN FORM ${sig} #${i + 1}: "${t}"`);
          }
        }
        // The answer column can swallow an accepted form instead.
        const missing = accepted.filter((f) => !kept.includes(f) && fusedWith(cell.your, f));
        if (missing.length && !accepted.includes(cell.your)) {
          const f = missing.sort((a, b) => b.length - a.length)[0];
          cell.your = cell.your.slice(0, -f.length);
          kept.push(f);
        }
        cell.correct = cells.length > 1 ? accepted : kept;
      }
    });
  }
}
resolveFused([...reports.values()]);
const sorted = [...reports.values()].sort((a, b) => a.test.localeCompare(b.test, 'en', { numeric: true }) || a.id.localeCompare(b.id));
writeFileSync(out, `[\n${sorted.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);
console.error(`${sorted.length} reports written (${failed} skipped).`);
