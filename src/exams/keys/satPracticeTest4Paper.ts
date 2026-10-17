/**
 * Official answer key for the paper version of SAT Practice Test 4
 * ("Scoring Your Paper SAT Practice Test #4", College Board 2023, p. 4).
 *
 * This is NOT the Bluebook (digital) form: the paper version has fixed
 * 33-question Reading and Writing and 27-question Math modules, while
 * Bluebook gives 27/22-question modules with an adaptive second module.
 *
 * The scoring guide doesn't list question categories, so none are set here.
 * Grid-in answers separated by ";" are each accepted.
 */
import type { AnswerKey, AnswerKeyEntry } from '../../core/types';
import { SAT_PAPER_FORMAT } from '../formats';

const ANSWERS: Record<string, string[]> = {
  rw1: 'B A A C A B D B B D C D A B C A A A A D D D B C B A C D A A D D C'.split(' '),
  rw2: 'D D B B B B A C C A A B D C C A B D C A B D D A B B A A C C A A B'.split(' '),
  math1: ['B', 'A', 'B', 'D', 'A', '9', '10', 'A', 'B', 'D', 'A', 'C', '1/5; .2', '80', 'D', 'B', 'B', 'A', 'C', '100', '361/8; 45.12; 45.13', 'B', 'D', 'C', 'C', 'D', '5'],
  math2: ['B', 'B', 'C', 'A', 'A', '15; -5', '50', 'B', 'D', 'A', 'A', 'B', '.3; 3/10', '2', 'A', 'C', 'B', 'D', 'A', '15/17; .8824; .8823', '51', 'A', 'C', 'C', 'D', 'B', '600'],
};

const entries: AnswerKeyEntry[] = Object.entries(ANSWERS).flatMap(([sectionId, answers]) =>
  answers.map((answer, i) => ({
    sectionId,
    number: i + 1,
    correct: answer.split(';').map((a) => a.trim()),
    category: '',
    subcategory: '',
  })),
);

export const SAT_PRACTICE_TEST_4_PAPER: AnswerKey = {
  id: 'sat-pt4-paper',
  name: 'SAT Practice Test 4 — paper version',
  formatId: SAT_PAPER_FORMAT.id,
  isDemo: false,
  entries,
};
