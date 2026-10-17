/**
 * Placeholder answer keys so the grader can be exercised end to end before
 * real keys are imported. Answers and categories are generated from a fixed
 * seed, so the same demo key is produced on every load.
 */
import type { AnswerKey, AnswerKeyEntry, ExamFormat, Topic } from '../core/types';
import { ACT_ENHANCED_FORMAT, ACT_LEGACY_FORMAT, SAT_FORMAT } from './formats';
import { ACT_TAXONOMY, SAT_MATH_TAXONOMY, SAT_RW_TAXONOMY, type Taxonomy } from './taxonomy';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

/** One random (skill, subskill) tag from a domain. */
function pickTopic(rand: () => number, skills: Record<string, string[]>): Topic[] {
  const skill = pick(rand, Object.keys(skills));
  const subskills = skills[skill];
  return [{ skill, subskill: subskills.length ? pick(rand, subskills) : '' }];
}

/** SAT RW modules run in a fixed domain order; split 27 questions across it. */
const RW_DOMAIN_COUNTS: [string, number][] = [
  ['Craft and Structure', 7],
  ['Information and Ideas', 7],
  ['Standard English Conventions', 7],
  ['Expression of Ideas', 6],
];

const SPR_SAMPLES = ['12', '3/2', '-4', '0.25', '2/3', '45', '7/8', '1.6', '-1/3', '100'];
/** Grid-in positions in each 22-question demo math module. */
const SPR_POSITIONS = new Set([6, 7, 8, 18, 19, 20]);

function demoSat(): AnswerKey {
  const rand = rng(2024);
  const entries: AnswerKeyEntry[] = [];
  for (const section of SAT_FORMAT.sections) {
    if (section.scaleId === 'rw') {
      let n = 1;
      for (const [category, count] of RW_DOMAIN_COUNTS) {
        for (let i = 0; i < count; i++, n++) {
          entries.push({
            sectionId: section.id,
            number: n,
            correct: [pick(rand, section.choicesFor(n))],
            category,
            topics: pickTopic(rand, SAT_RW_TAXONOMY[category]),
          });
        }
      }
    } else {
      const categories = Object.keys(SAT_MATH_TAXONOMY);
      const weights = [0.35, 0.35, 0.15, 0.15];
      for (let n = 1; n <= section.questionCount; n++) {
        let r = rand();
        const category = categories.find((_, i) => (r -= weights[i]) < 0) ?? categories[0];
        entries.push({
          sectionId: section.id,
          number: n,
          correct: SPR_POSITIONS.has(n) ? [pick(rand, SPR_SAMPLES)] : [pick(rand, section.choicesFor(n))],
          category,
          topics: pickTopic(rand, SAT_MATH_TAXONOMY[category]),
        });
      }
    }
  }
  return { id: 'demo', name: 'SAT Demo Test (placeholder key)', formatId: SAT_FORMAT.id, isDemo: true, entries };
}

function demoAct(format: ExamFormat, seed: number): AnswerKey {
  const rand = rng(seed);
  const entries: AnswerKeyEntry[] = [];
  for (const section of format.sections) {
    const taxonomy: Taxonomy = ACT_TAXONOMY[section.id];
    const categories = Object.keys(taxonomy);
    for (let n = 1; n <= section.questionCount; n++) {
      const category = pick(rand, categories);
      entries.push({
        sectionId: section.id,
        number: n,
        correct: [pick(rand, section.choicesFor(n))],
        category,
        topics: pickTopic(rand, taxonomy[category]),
      });
    }
  }
  return { id: 'demo', name: `${format.name} Demo Test (placeholder key)`, formatId: format.id, isDemo: true, entries };
}

export const DEMO_KEYS: AnswerKey[] = [demoSat(), demoAct(ACT_ENHANCED_FORMAT, 2025), demoAct(ACT_LEGACY_FORMAT, 2016)];
