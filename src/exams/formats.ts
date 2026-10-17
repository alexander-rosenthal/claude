import { anchorsFromPercent, anchorsFromRangeTable, rangeTable } from '../core/scoring';
import type { ExamFormat, ScoreScale, SectionFormat } from '../core/types';

const ABCD = ['A', 'B', 'C', 'D'];
const FGHJ = ['F', 'G', 'H', 'J'];
const ABCDE = ['A', 'B', 'C', 'D', 'E'];
const FGHJK = ['F', 'G', 'H', 'J', 'K'];

const always = (choices: string[]) => () => choices;
/** ACT answer sheets alternate letters: odd questions A–D, even F–J. */
const alternating = (odd: string[], even: string[]) => (n: number) => (n % 2 === 1 ? odd : even);

// ---------------------------------------------------------------------------
// Digital SAT (Bluebook) and its paper version
// ---------------------------------------------------------------------------

/**
 * Official raw → score-range conversion for the paper version of SAT Practice
 * Test 4 ("Scoring Your Paper SAT Practice Test #4", College Board 2023).
 * Rows are [raw, lower, upper].
 */
export const SAT_PT4_PAPER_RW_TABLE = rangeTable([
  [0, 200, 200], [1, 200, 200], [2, 200, 200], [3, 200, 200], [4, 200, 200], [5, 200, 200],
  [6, 200, 200], [7, 200, 210], [8, 200, 220], [9, 210, 230], [10, 230, 250], [11, 240, 260],
  [12, 250, 270], [13, 260, 280], [14, 280, 300], [15, 290, 310], [16, 320, 340], [17, 340, 360],
  [18, 350, 370], [19, 360, 380], [20, 370, 390], [21, 370, 390], [22, 380, 400], [23, 390, 410],
  [24, 400, 420], [25, 410, 430], [26, 420, 440], [27, 420, 440], [28, 430, 450], [29, 440, 460],
  [30, 450, 470], [31, 460, 480], [32, 460, 480], [33, 470, 490], [34, 480, 500], [35, 490, 510],
  [36, 490, 510], [37, 500, 520], [38, 510, 530], [39, 520, 540], [40, 530, 550], [41, 540, 560],
  [42, 540, 560], [43, 550, 570], [44, 560, 580], [45, 570, 590], [46, 580, 600], [47, 590, 610],
  [48, 590, 610], [49, 600, 620], [50, 610, 630], [51, 620, 640], [52, 630, 650], [53, 630, 650],
  [54, 640, 660], [55, 650, 670], [56, 660, 680], [57, 670, 690], [58, 680, 700], [59, 690, 710],
  [60, 700, 720], [61, 710, 730], [62, 720, 740], [63, 730, 750], [64, 750, 770], [65, 770, 790],
  [66, 790, 800],
]);

export const SAT_PT4_PAPER_MATH_TABLE = rangeTable([
  [0, 200, 200], [1, 200, 200], [2, 200, 200], [3, 200, 200], [4, 200, 200], [5, 200, 200],
  [6, 200, 200], [7, 200, 220], [8, 200, 230], [9, 220, 250], [10, 250, 280], [11, 280, 310],
  [12, 290, 320], [13, 300, 330], [14, 310, 340], [15, 320, 350], [16, 330, 360], [17, 330, 360],
  [18, 340, 370], [19, 350, 380], [20, 360, 390], [21, 370, 400], [22, 370, 400], [23, 380, 410],
  [24, 390, 420], [25, 400, 430], [26, 420, 450], [27, 430, 460], [28, 440, 470], [29, 460, 490],
  [30, 470, 500], [31, 480, 510], [32, 500, 530], [33, 510, 540], [34, 520, 550], [35, 530, 560],
  [36, 550, 580], [37, 560, 590], [38, 570, 600], [39, 580, 610], [40, 590, 620], [41, 600, 630],
  [42, 620, 650], [43, 630, 660], [44, 650, 680], [45, 670, 700], [46, 690, 720], [47, 710, 740],
  [48, 730, 760], [49, 740, 770], [50, 750, 780], [51, 760, 790], [52, 770, 800], [53, 780, 800],
  [54, 790, 800],
]);

function satSections(rwCount: number, mathCount: number): SectionFormat[] {
  const rw = [1, 2].map((m) => ({
    id: `rw${m}`,
    name: `Reading and Writing — Module ${m}`,
    shortName: `RW ${m}`,
    aliases: [`rw${m}`, `rw m${m}`, `reading and writing module ${m}`, `reading writing module ${m}`, `rw module ${m}`, `english module ${m}`],
    questionCount: rwCount,
    scaleId: 'rw',
    choicesFor: always(ABCD),
    allowsSpr: false,
    timeLimitMinutes: 32,
  }));
  const math = [1, 2].map((m) => ({
    id: `math${m}`,
    name: `Math — Module ${m}`,
    shortName: `Math ${m}`,
    aliases: [`math${m}`, `m${m}`, `math m${m}`, `math module ${m}`],
    questionCount: mathCount,
    scaleId: 'math',
    choicesFor: always(ABCD),
    allowsSpr: true,
    timeLimitMinutes: 35,
  }));
  return [...rw, ...math];
}

const SAT_COMPOSITES: ExamFormat['composites'] = [
  { id: 'total', name: 'Total Score', method: 'sum', scaleIds: ['rw', 'math'], min: 400, max: 1600 },
];

/**
 * The digital SAT is adaptive and scored with item response theory, so raw
 * counts don't map exactly to scores. This estimate borrows the official
 * paper Practice Test 4 table, matched on percent correct.
 */
export const SAT_FORMAT: ExamFormat = {
  id: 'sat-digital',
  family: 'SAT',
  name: 'Digital SAT (Bluebook)',
  sections: satSections(27, 22),
  scales: [
    { id: 'rw', name: 'Reading and Writing', min: 200, max: 800, step: 10, estimated: true, anchors: anchorsFromRangeTable(SAT_PT4_PAPER_RW_TABLE, 66, 54) },
    { id: 'math', name: 'Math', min: 200, max: 800, step: 10, estimated: true, anchors: anchorsFromRangeTable(SAT_PT4_PAPER_MATH_TABLE, 54, 44) },
  ],
  composites: SAT_COMPOSITES,
  scoreNote:
    'Estimated: the digital SAT is adaptive, so these scores apply the official paper Practice Test 4 conversion by percent correct. Bluebook’s own score is the official one.',
};

/**
 * Paper versions of the digital SAT practice tests: fixed (non-adaptive)
 * modules of 33 Reading and Writing and 27 Math questions, scored with an
 * official range table per test form.
 */
export const SAT_PAPER_FORMAT: ExamFormat = {
  id: 'sat-paper',
  family: 'SAT',
  name: 'Digital SAT — paper version',
  sections: satSections(33, 27),
  scales: [
    { id: 'rw', name: 'Reading and Writing', min: 200, max: 800, step: 10, estimated: false, anchors: [], ranges: SAT_PT4_PAPER_RW_TABLE },
    { id: 'math', name: 'Math', min: 200, max: 800, step: 10, estimated: false, anchors: [], ranges: SAT_PT4_PAPER_MATH_TABLE },
  ],
  composites: SAT_COMPOSITES,
  scoreNote: 'Score ranges from the College Board’s official conversion table for paper SAT Practice Test 4.',
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

export const FORMATS: ExamFormat[] = [SAT_FORMAT, SAT_PAPER_FORMAT, ACT_ENHANCED_FORMAT, ACT_LEGACY_FORMAT];

export function getFormat(id: string): ExamFormat | undefined {
  return FORMATS.find((f) => f.id === id);
}
