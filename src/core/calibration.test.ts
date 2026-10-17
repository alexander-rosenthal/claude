import { describe, expect, it } from 'vitest';
import { OFFICIAL_EXAMS, examFromKey } from '../exams';
import { BUILTIN_CALIBRATION, parsePoints, scaleForPoint } from '../exams/calibration';
import { SAT_FORMAT } from '../exams/formats';
import { SAT_PRACTICE_TEST_4_BLUEBOOK } from '../exams/keys/satPracticeTest4Bluebook';
import harderSample from '../parsers/fixtures/pt4-bluebook-sample-harder.json';
import easierSample from '../parsers/fixtures/pt4-bluebook-sample-easier.json';
import pt4Results from '../parsers/fixtures/bluebook-pt4-results.txt?raw';
import { examForBluebookResults, parseBluebook } from '../parsers/bluebook';
import { applyScores, calibratedCurve, estimateReport, leaveOneOut, mergePoints, pointsFromReport, samePoint, type CalibrationPoint } from './calibration';
import { grade, type GradeReport } from './grader';
import { routeByAnswers } from './routing';
import { toScaled } from './scoring';
import type { Responses } from './types';

const rwScale = SAT_FORMAT.scales.find((s) => s.id === 'rw')!;
const base = examFromKey(SAT_PRACTICE_TEST_4_BLUEBOOK);

function sampleReport(sample: Record<string, string>): GradeReport {
  const responses: Responses = {};
  for (const [sectionId, answers] of Object.entries(sample)) answers.split(' ').forEach((a, i) => (responses[`${sectionId}-${i + 1}`] = a));
  const { exam, decisions } = routeByAnswers(base, responses);
  return { ...grade(exam, responses), routing: decisions };
}

const point = (over: Partial<CalibrationPoint>): CalibrationPoint => ({
  formatId: 'sat-digital',
  keyId: 'sat-pt4-bluebook',
  scaleId: 'rw',
  version: 'harder',
  raw: 36,
  maxRaw: 54,
  actual: 610,
  ...over,
});
const ctx = { formatId: 'sat-digital', keyId: 'sat-pt4-bluebook', scaleId: 'rw', version: 'harder', maxRaw: 54 };

describe('calibratedCurve', () => {
  it('is the plain conversion without points', () => {
    const { values, pooled } = calibratedCurve(rwScale, ctx, []);
    expect(pooled).toBe(0);
    expect(values[36]).toBe(toScaled(rwScale, 36));
  });

  it('moves toward a point near its raw score and barely at all far away', () => {
    const { values } = calibratedCurve(rwScale, ctx, [point({})]);
    expect(values[36]).toBe(610); // 570 → 610, from one point at raw 36
    expect(Math.abs(values[10] - toScaled(rwScale, 10))).toBeLessThanOrEqual(10);
  });

  it('stays monotonic in the raw score', () => {
    const points = [point({ raw: 30, actual: 640 }), point({ raw: 34, actual: 520 })];
    const { values } = calibratedCurve(rwScale, ctx, points);
    values.forEach((v, i) => i && expect(v).toBeGreaterThanOrEqual(values[i - 1]));
  });

  it('pools across tests of the same Module 2 version, and weighs this test on top', () => {
    const other = [point({ keyId: 'sat-pt5-bluebook', actual: 650 }), point({ keyId: 'sat-pt5-bluebook', actual: 650, raw: 37 })];
    const pooledOnly = calibratedCurve(rwScale, ctx, other);
    expect(pooledOnly).toMatchObject({ pooled: 2, test: 0 });
    expect(pooledOnly.values[36]).toBeGreaterThan(toScaled(rwScale, 36));
    const withTest = calibratedCurve(rwScale, ctx, [...other, point({ actual: 580 })]);
    expect(withTest).toMatchObject({ pooled: 3, test: 1 });
    expect(withTest.values[36]).toBeLessThan(pooledOnly.values[36]);
  });

  it('keeps Module 2 versions apart', () => {
    const { values, pooled } = calibratedCurve(rwScale, ctx, [point({ version: 'easier', actual: 430 })]);
    expect(pooled).toBe(0);
    expect(values[36]).toBe(toScaled(rwScale, 36));
  });
});

describe('applyScores', () => {
  it('reports entered official scores alongside the estimate', () => {
    const report = applyScores(sampleReport(harderSample), [], { rw: 610, math: 600 });
    const [rw, math] = report.scales;
    expect([rw.scaled, rw.estimate, rw.actual]).toEqual([610, 570, 610]);
    expect([math.scaled, math.estimate, math.actual]).toEqual([600, 560, 600]);
    expect(report.composites[0]).toMatchObject({ value: 1210, estimate: 1130 });
  });

  it('calibrates the estimate from points for the same test and version', () => {
    const others = [point({ raw: 35, actual: 600 }), point({ raw: 37, actual: 620 })];
    const report = applyScores(sampleReport(harderSample), others);
    expect(report.scales[0].estimate).toBeGreaterThan(570);
    expect(report.scales[0].calibration).toEqual({ pooled: 2, test: 2 });
    expect(report.scales[1].calibration).toBeNull(); // no Math points
    expect(report.composites[0].value).toBe(report.scales[0].estimate + report.scales[1].estimate);
  });

  it('never estimates a result from its own saved score, whatever score was saved', () => {
    const report = sampleReport(harderSample);
    const own = pointsFromReport(applyScores(report, [], { rw: 800, math: 200 }));
    const withOwn = estimateReport(report, own);
    expect(withOwn.scales.map((s) => s.estimate)).toEqual(applyScores(report, []).scales.map((s) => s.estimate));
  });

  it('leaves official conversion tables alone', () => {
    const paper = OFFICIAL_EXAMS.find((e) => e.format.id === 'sat-paper')!;
    const report = applyScores(grade(paper, {}), [point({ formatId: 'sat-paper', keyId: paper.key.id, version: '' })], { rw: 500 });
    expect(report.scales[0].calibration).toBeNull();
    expect(pointsFromReport(report)).toEqual([]);
  });
});

describe('calibration points', () => {
  it('are taken from a report with official scores, matching the built-in points for the sample students', () => {
    const harder = pointsFromReport(applyScores(sampleReport(harderSample), [], { rw: 610, math: 600 }));
    const easier = pointsFromReport(applyScores(sampleReport(easierSample), [], { rw: 430, math: 490 }));
    expect([...harder, ...easier].map((p) => [p.scaleId, p.version, p.raw, p.actual])).toEqual([
      ['rw', 'harder', 36, 610],
      ['math', 'harder', 29, 600],
      ['rw', 'easier', 31, 430],
      ['math', 'easier', 27, 490],
    ]);
    for (const p of [...harder, ...easier]) expect(BUILTIN_CALIBRATION.some((b) => samePoint(b, p))).toBe(true);
  });

  it('bring the sample students’ estimates close to their Bluebook scores', () => {
    for (const [sample, actual] of [
      [harderSample, { rw: 610, math: 600 }],
      [easierSample, { rw: 430, math: 490 }],
    ] as const) {
      const report = sampleReport(sample);
      const own = pointsFromReport(applyScores(report, [], actual));
      const others = BUILTIN_CALIBRATION.filter((b) => !own.some((p) => samePoint(b, p)));
      const [rw, math] = applyScores(report, others).scales;
      expect(Math.abs(rw.estimate - actual.rw)).toBeLessThanOrEqual(30);
      expect(Math.abs(math.estimate - actual.math)).toBeLessThanOrEqual(30);
    }
  });

  it('come from a Bluebook paste only for sections with a known Module 2 version', () => {
    const pt4 = OFFICIAL_EXAMS.find((e) => e.key.id === 'sat-pt4-bluebook')!;
    const result = parseBluebook(pt4, pt4Results);
    const auto = examForBluebookResults(pt4, result);
    const report = applyScores({ ...grade(auto.exam, result.responses, result.outcomes), routing: auto.routing }, [], { rw: 400, math: 420 });
    expect(pointsFromReport(report).map((p) => [p.keyId, p.scaleId, p.version, p.raw])).toEqual([
      ['sat-pt4-bluebook', 'rw', 'easier', 18],
      ['sat-pt4-bluebook', 'math', 'easier', 15],
    ]);
    const domainsOnly = examForBluebookResults(pt4, result, { rw2: 'none' });
    const report2 = applyScores({ ...grade(domainsOnly.exam, result.responses, result.outcomes), routing: domainsOnly.routing }, [], { rw: 400, math: 420 });
    expect(pointsFromReport(report2).map((p) => p.scaleId)).toEqual(['math']);
  });

  it('are not taken from demo keys', () => {
    const demo = examFromKey({ ...SAT_PRACTICE_TEST_4_BLUEBOOK, isDemo: true });
    expect(pointsFromReport(applyScores(grade(demo, {}), [], { rw: 400 }))).toEqual([]);
  });

  it('merge without duplicates', () => {
    expect(mergePoints(BUILTIN_CALIBRATION, [...BUILTIN_CALIBRATION, point({ actual: 700 })])).toHaveLength(BUILTIN_CALIBRATION.length + 1);
  });

  it('round-trip through an export file, and reject other files', () => {
    expect(parsePoints(JSON.stringify(BUILTIN_CALIBRATION))).toEqual(BUILTIN_CALIBRATION);
    expect(() => parsePoints('[{"raw": 3}]')).toThrow(/not a calibration export/);
  });

  it('measure accuracy by leaving one out', () => {
    // Each built-in point predicted from all the others.
    const accuracy = leaveOneOut(BUILTIN_CALIBRATION, scaleForPoint);
    expect(accuracy.n).toBe(156);
    expect(accuracy.uncalibrated).toBeGreaterThan(40);
    expect(accuracy.calibrated).toBeLessThan(15);
  });
});
