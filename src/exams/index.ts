import { buildExam } from '../core/exam';
import type { AnswerKey, Exam } from '../core/types';
import { DEMO_KEYS } from './demoKeys';
import { FORMATS, getFormat } from './formats';
import { SAT_PRACTICE_TEST_4_BLUEBOOK } from './keys/satPracticeTest4Bluebook';
import { SAT_PRACTICE_TEST_4_PAPER } from './keys/satPracticeTest4Paper';

export { FORMATS, getFormat };

export function examFromKey(key: AnswerKey): Exam {
  const format = getFormat(key.formatId);
  if (!format) throw new Error(`Unknown exam format "${key.formatId}"`);
  return buildExam(format, key);
}

export const DEMO_EXAMS: Exam[] = DEMO_KEYS.map(examFromKey);

/** Real (non-placeholder) keys that ship with the app. */
export const OFFICIAL_EXAMS: Exam[] = [SAT_PRACTICE_TEST_4_BLUEBOOK, SAT_PRACTICE_TEST_4_PAPER].map(examFromKey);

export const BUILTIN_EXAMS: Exam[] = [...OFFICIAL_EXAMS, ...DEMO_EXAMS];

const STORAGE_KEY = 'test-grader:answer-keys';

/** Imported keys persist in this browser only. */
export function loadSavedKeys(): AnswerKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    // Keys saved before skill tags existed carry a single `subcategory`.
    return (JSON.parse(raw) as AnswerKey[]).map((key) => ({
      ...key,
      entries: key.entries.map((e) => {
        const legacy = (e as { subcategory?: string }).subcategory;
        return { ...e, topics: e.topics ?? (legacy ? [{ skill: legacy, subskill: '' }] : []) };
      }),
    }));
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
