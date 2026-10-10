import { anchorsFromPercent } from '../core/scoring';
import type { ExamFormat, ScoreScale, SectionFormat } from '../core/types';

const ABCD = ['A', 'B', 'C', 'D'];
const FGHJ = ['F', 'G', 'H', 'J'];
const ABCDE = ['A', 'B', 'C', 'D', 'E'];
const FGHJK = ['F', 'G', 'H', 'J', 'K'];

const always = (choices: string[]) => () => choices;
/** ACT answer sheets alternate letters: odd questions A–D, even F–J. */
const alternating = (odd: string[], even: string[]) => (n: number) => (n % 2 === 1 ? odd : even);

// ---------------------------------------------------------------------------
// Digital SAT (Bluebook)
// ---------------------------------------------------------------------------

/**
 * The digital SAT is adaptive and the College Board does not publish its
 * conversion, so this curve is an estimate in line with Bluebook practice
 * test results. Swap in an official table when one is available.
 */
function satScale(id: string, name: string, maxRaw: number, curve: [number, number][]): ScoreScale {
  return { id, name, min: 200, max: 800, step: 10, estimated: true, anchors: anchorsFromPercent(maxRaw, curve) };
}

const SAT_RW_SECTIONS: SectionFormat[] = [1, 2].map((m) => ({
  id: `rw${m}`,
  name: `Reading and Writing — Module ${m}`,
  shortName: `RW ${m}`,
  aliases: [`rw${m}`, `rw m${m}`, `reading and writing module ${m}`, `reading writing module ${m}`, `rw module ${m}`, `english module ${m}`],
  questionCount: 27,
  scaleId: 'rw',
  choicesFor: always(ABCD),
  allowsSpr: false,
  timeLimitMinutes: 32,
}));

const SAT_MATH_SECTIONS: SectionFormat[] = [1, 2].map((m) => ({
  id: `math${m}`,
  name: `Math — Module ${m}`,
  shortName: `Math ${m}`,
  aliases: [`math${m}`, `m${m}`, `math m${m}`, `math module ${m}`],
  questionCount: 22,
  scaleId: 'math',
  choicesFor: always(ABCD),
  allowsSpr: true,
  timeLimitMinutes: 35,
}));

export const SAT_FORMAT: ExamFormat = {
  id: 'sat-digital',
  family: 'SAT',
  name: 'Digital SAT',
  sections: [...SAT_RW_SECTIONS, ...SAT_MATH_SECTIONS],
  scales: [
    satScale('rw', 'Reading and Writing', 54, [
      [0, 200], [0.1, 260], [0.2, 330], [0.3, 390], [0.4, 440], [0.5, 490],
      [0.6, 540], [0.7, 590], [0.8, 640], [0.9, 710], [0.96, 760], [1, 800],
    ]),
    satScale('math', 'Math', 44, [
      [0, 200], [0.1, 280], [0.2, 350], [0.3, 410], [0.4, 460], [0.5, 510],
      [0.6, 560], [0.7, 610], [0.8, 670], [0.9, 730], [0.96, 770], [1, 800],
    ]),
  ],
  composites: [{ id: 'total', name: 'Total Score', method: 'sum', scaleIds: ['rw', 'math'], min: 400, max: 1600 }],
};

// ---------------------------------------------------------------------------
// ACT
// ---------------------------------------------------------------------------

/** Estimated ACT curve; individual forms vary by a point or two. */
const ACT_CURVE: [number, number][] = [
  [0, 1], [0.1, 6], [0.2, 10], [0.3, 13], [0.4, 15], [0.5, 18],
  [0.6, 20], [0.7, 23], [0.8, 26], [0.9, 30], [0.95, 33], [1, 36],
];

function actScale(id: string, name: string, maxRaw: number): ScoreScale {
  return { id, name, min: 1, max: 36, step: 1, estimated: true, anchors: anchorsFromPercent(maxRaw, ACT_CURVE) };
}

function actSection(
  id: string,
  name: string,
  questionCount: number,
  choicesFor: (n: number) => string[],
  timeLimitMinutes: number,
  aliases: string[],
): SectionFormat {
  return { id, name, shortName: name, aliases: [id, ...aliases], questionCount, scaleId: id, choicesFor, allowsSpr: false, timeLimitMinutes };
}

/** Enhanced ACT (2025+): shorter sections, four choices everywhere, Science optional. */
export const ACT_ENHANCED_FORMAT: ExamFormat = {
  id: 'act-enhanced',
  family: 'ACT',
  name: 'ACT (Enhanced, 2025+)',
  sections: [
    actSection('english', 'English', 50, alternating(ABCD, FGHJ), 35, ['e', 'eng']),
    actSection('math', 'Math', 45, alternating(ABCD, FGHJ), 50, ['m', 'mathematics']),
    actSection('reading', 'Reading', 36, alternating(ABCD, FGHJ), 40, ['r', 'read']),
    actSection('science', 'Science', 40, alternating(ABCD, FGHJ), 40, ['s', 'sci']),
  ],
  scales: [
    actScale('english', 'English', 50),
    actScale('math', 'Math', 45),
    actScale('reading', 'Reading', 36),
    actScale('science', 'Science', 40),
  ],
  composites: [
    { id: 'composite', name: 'Composite', method: 'average', scaleIds: ['english', 'math', 'reading'], min: 1, max: 36 },
    { id: 'stem', name: 'STEM', method: 'average', scaleIds: ['math', 'science'], min: 1, max: 36 },
  ],
};

/** Pre-2025 ACT: 215 questions, five-choice math, Science in the composite. */
export const ACT_LEGACY_FORMAT: ExamFormat = {
  id: 'act-legacy',
  family: 'ACT',
  name: 'ACT (Legacy, pre-2025)',
  sections: [
    actSection('english', 'English', 75, alternating(ABCD, FGHJ), 45, ['e', 'eng']),
    actSection('math', 'Math', 60, alternating(ABCDE, FGHJK), 60, ['m', 'mathematics']),
    actSection('reading', 'Reading', 40, alternating(ABCD, FGHJ), 35, ['r', 'read']),
    actSection('science', 'Science', 40, alternating(ABCD, FGHJ), 35, ['s', 'sci']),
  ],
  scales: [
    actScale('english', 'English', 75),
    actScale('math', 'Math', 60),
    actScale('reading', 'Reading', 40),
    actScale('science', 'Science', 40),
  ],
  composites: [
    { id: 'composite', name: 'Composite', method: 'average', scaleIds: ['english', 'math', 'reading', 'science'], min: 1, max: 36 },
    { id: 'stem', name: 'STEM', method: 'average', scaleIds: ['math', 'science'], min: 1, max: 36 },
  ],
};

export const FORMATS: ExamFormat[] = [SAT_FORMAT, ACT_ENHANCED_FORMAT, ACT_LEGACY_FORMAT];

export function getFormat(id: string): ExamFormat | undefined {
  return FORMATS.find((f) => f.id === id);
}
