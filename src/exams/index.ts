import { buildExam } from '../core/exam';
import type { AnswerKey, Exam } from '../core/types';
import { DEMO_KEYS } from './demoKeys';
import { FORMATS, getFormat } from './formats';
import { SAT_PRACTICE_TEST_4_PAPER } from './keys/satPracticeTest4Paper';

export { FORMATS, getFormat };

export function examFromKey(key: AnswerKey): Exam {
  const format = getFormat(key.formatId);
  if (!format) throw new Error(`Unknown exam format "${key.formatId}"`);
  return buildExam(format, key);
}

export const DEMO_EXAMS: Exam[] = DEMO_KEYS.map(examFromKey);

/** Official keys that ship with the app. */
export const OFFICIAL_EXAMS: Exam[] = [SAT_PRACTICE_TEST_4_PAPER].map(examFromKey);

export const BUILTIN_EXAMS: Exam[] = [...OFFICIAL_EXAMS, ...DEMO_EXAMS];

const STORAGE_KEY = 'test-grader:answer-keys';

/** Imported keys persist in this browser only. */
export function loadSavedKeys(): AnswerKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AnswerKey[]) : [];
  } catch {
    return [];
  }
}

export function saveKeys(keys: AnswerKey[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage unavailable (private mode, quota): keys last for this session only.
  }
}
