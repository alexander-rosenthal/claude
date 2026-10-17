import { parseRational } from './answers';
import type { AnswerKey, Exam, ExamFormat, Question, QuestionType, Section, Topic } from './types';
import { questionId } from './types';

/** Trim, drop empty and duplicate tags. */
export function normalizeTopics(topics: Topic[] | undefined): Topic[] {
  const seen = new Set<string>();
  const out: Topic[] = [];
  for (const t of topics ?? []) {
    const topic = { skill: t.skill.trim(), subskill: (t.subskill ?? '').trim() };
    const id = `${topic.skill}|${topic.subskill}`;
    if (!topic.skill || seen.has(id)) continue;
    seen.add(id);
    out.push(topic);
  }
  return out;
}

export class AnswerKeyError extends Error {
  constructor(public problems: string[]) {
    super(`Answer key has ${problems.length} problem(s):\n${problems.join('\n')}`);
  }
}

/**
 * Merge a format with an answer key into a gradable exam. Every question in
 * the format must have exactly one key entry. Question type is inferred: an
 * answer that is one of the question's choices is multiple choice, a numeric
 * answer in a section that allows it is a student-produced response.
 */
export function buildExam(format: ExamFormat, key: AnswerKey): Exam {
  const problems: string[] = [];
  const entries = new Map(key.entries.map((e) => [questionId(e.sectionId, e.number), e]));

  const knownIds = new Set<string>();
  const sections: Section[] = format.sections.map((sf) => {
    const { choicesFor, ...rest } = sf;
    const questions: Question[] = [];
    for (let n = 1; n <= sf.questionCount; n++) {
      const id = questionId(sf.id, n);
      knownIds.add(id);
      const entry = entries.get(id);
      if (!entry) {
        problems.push(`${sf.name} #${n}: missing from key`);
        continue;
      }
      const choices = choicesFor(n);
      const correct = entry.correct.map((c) => c.trim()).filter(Boolean);
      const upper = correct.map((c) => c.toUpperCase());
      let type: QuestionType;
      if (correct.length === 0 && key.resultsOnly) {
        type = 'mc'; // answer unknown; outcome comes pre-graded
      } else if (correct.length > 0 && upper.every((c) => choices.includes(c))) {
        type = 'mc';
      } else if (sf.allowsSpr && correct.length > 0 && correct.every((c) => parseRational(c))) {
        type = 'spr';
      } else {
        problems.push(`${sf.name} #${n}: "${entry.correct.join(', ')}" is not a valid answer (choices ${choices.join('/')})`);
        continue;
      }
      questions.push({
        id,
        sectionId: sf.id,
        number: n,
        type,
        choices: type === 'mc' ? choices : [],
        correct: type === 'mc' ? upper : correct,
        category: entry.category.trim() || 'Uncategorized',
        topics: normalizeTopics(entry.topics),
      });
    }
    return { ...rest, questions };
  });

  for (const e of key.entries) {
    if (!knownIds.has(questionId(e.sectionId, e.number))) {
      problems.push(`Key entry for section "${e.sectionId}" #${e.number} doesn't match any question in ${format.name}`);
    }
  }

  if (problems.length) throw new AnswerKeyError(problems);

  return {
    id: `${format.id}:${key.id}`,
    name: key.name,
    family: format.family,
    format,
    key,
    sections,
    scales: format.scales,
    composites: format.composites,
  };
}
