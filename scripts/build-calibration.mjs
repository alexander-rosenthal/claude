#!/usr/bin/env node
/**
 * Build calibration points (src/exams/calibrationData.json) from the
 * anonymized reports in data/nlt-reports.json, and print how well Module 1
 * cutoffs predict the Module 2 route.
 *
 *   node scripts/build-calibration.mjs
 *
 * Module 2 versions are told apart by their answer keys. Where a test shows
 * two versions, the one whose students missed fewer Module 1 questions is the
 * harder one. Where it shows one, it is the harder one if a student who
 * missed 3 or fewer saw it (no such student is routed to the easier one);
 * otherwise its reports are left out.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const reports = JSON.parse(readFileSync(new URL('../data/nlt-reports.json', import.meta.url), 'utf8'));
const SECTIONS = [
  { scaleId: 'rw', m1: 'rw1', m2: 'rw2' },
  { scaleId: 'math', m1: 'math1', m2: 'math2' },
];

const keyIdOf = (test) => {
  const [kind, n] = test.split('-');
  return kind === 'bluebook' ? `sat-pt${n}-bluebook` : `sat-digital-${n}`;
};
/** Exact value of a grid-in ("1/2", ".5", "-3"), or null. */
const value = (s) => {
  const m = /^(-?\d*\.?\d+)(?:\/(\d*\.?\d+))?$/.exec(s.trim());
  return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : null;
};
/** Right if the answer is a listed form or has exactly the value of one (1/2 for 0.5). */
const isRight = (c) => c.correct.includes(c.your) || (value(c.your) !== null && c.correct.some((f) => value(f) !== null && Math.abs(value(f) - value(c.your)) < 1e-9));
const missedIn = (r, m) => r.modules[m].filter((c) => !isRight(c)).map((c) => `${m}-${c.number}`);
const signature = (r, m) => r.modules[m].map((c) => c.correct.join('|')).join(',');
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const routes = []; // { test, scaleId, version, m1Missed }
const points = [];
const skipped = [];

for (const test of [...new Set(reports.map((r) => r.test))]) {
  const ofTest = reports.filter((r) => r.test === test);
  for (const { scaleId, m1, m2 } of SECTIONS) {
    const groups = new Map();
    for (const r of ofTest) {
      const sig = signature(r, m2);
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(r);
    }
    const ranked = [...groups.values()].sort((a, b) => mean(a.map((r) => missedIn(r, m1).length)) - mean(b.map((r) => missedIn(r, m1).length)));
    const labels = new Map();
    if (ranked.length === 2) {
      labels.set(ranked[0], 'harder');
      labels.set(ranked[1], 'easier');
    } else if (ranked.length === 1 && ranked[0].some((r) => missedIn(r, m1).length <= 3)) {
      labels.set(ranked[0], 'harder');
    } else {
      skipped.push(`${test} ${scaleId}: ${ranked.length} Module 2 versions`);
      continue;
    }
    for (const [group, version] of labels) {
      for (const r of group) {
        const missed = [...missedIn(r, m1), ...missedIn(r, m2)];
        const maxRaw = r.modules[m1].length + r.modules[m2].length;
        routes.push({ test, scaleId, version, m1Missed: missedIn(r, m1).length });
        points.push({ formatId: 'sat-digital', keyId: keyIdOf(test), scaleId, version, raw: maxRaw - missed.length, maxRaw, actual: r.scores[scaleId], missed, source: r.id });
      }
    }
  }
}

writeFileSync(new URL('../src/exams/calibrationData.json', import.meta.url), `[\n${points.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`);
console.log(`${points.length} points from ${reports.length} reports.`);
for (const s of skipped) console.log(`skipped ${s}`);

// How often "more than N missed in Module 1 → easier" picks the right route.
for (const scaleId of ['rw', 'math']) {
  const rows = routes.filter((r) => r.scaleId === scaleId);
  console.log(`\n${scaleId}: ${rows.length} routes (${rows.filter((r) => r.version === 'easier').length} easier)`);
  for (let cutoff = 4; cutoff <= 12; cutoff++) {
    const wrong = rows.filter((r) => (r.m1Missed > cutoff ? 'easier' : 'harder') !== r.version);
    console.log(`  more than ${String(cutoff).padStart(2)} → easier: ${wrong.length} misrouted (${wrong.map((r) => `${r.test}:${r.version}:${r.m1Missed}`).join(' ')})`);
  }
}
