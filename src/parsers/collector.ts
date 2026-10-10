import { normalizeResponse } from '../core/answers';
import type { Exam, Responses, Section } from '../core/types';
import { resolveSectionLabel } from './sections';

export interface ParseResult {
  responses: Responses;
  /** Number of questions that received a non-blank answer. */
  answered: number;
  warnings: string[];
}

/**
 * Places answers onto exam questions as a parser reads them. Every input
 * method funnels through here so they all share the same rules:
 *
 *  - Answers go into the current section. A section label switches it.
 *  - When question numbers restart (… 26, 27, 1, 2 …) the next section in the
 *    current scope begins. The scope is the whole exam, or a group such as
 *    "Reading and Writing" when the label names a group rather than a module.
 *  - A number larger than the current section is read as a running number
 *    across the scope (question 30 of the SAT = RW Module 2, #3).
 *  - Unnumbered answers fill the next question in order.
 */
export class AnswerCollector {
  private responses: Responses = {};
  private warnings: string[] = [];
  private scope: Section[];
  private index = 0;
  private lastNumber = 0;
  private contextKey = '';

  constructor(private exam: Exam) {
    this.scope = exam.sections;
  }

  get current(): Section | undefined {
    return this.scope[this.index];
  }

  warn(message: string) {
    this.warnings.push(message);
  }

  private unknownSections = new Map<string, { first: string; count: number; at: number }>();

  /** Rows under an unknown section are skipped; report each label once. */
  warnUnknownSection(label: string, where: string) {
    const seen = this.unknownSections.get(label);
    if (seen) {
      seen.count++;
      this.warnings[seen.at] = `Skipped ${seen.count} rows with unrecognized section "${label}" (first at ${seen.first}). Sections in this test: ${this.exam.sections.map((s) => s.name).join(', ')}.`;
      return;
    }
    this.unknownSections.set(label, { first: where, count: 1, at: this.warnings.length });
    this.warnings.push(`Skipped a row with unrecognized section "${label}" (${where}). Sections in this test: ${this.exam.sections.map((s) => s.name).join(', ')}.`);
  }

  /** Switch section by label. Returns false when the label is not a section. */
  setContext(label: string): boolean {
    const match = resolveSectionLabel(label, this.exam.sections, this.exam.scales);
    if (!match) return false;
    const key = match.kind === 'section' ? match.section.id : match.sections.map((s) => s.id).join('|');
    if (key === this.contextKey) return true;
    this.contextKey = key;
    if (match.kind === 'section') {
      this.scope = this.exam.sections;
      this.index = this.scope.indexOf(match.section);
    } else {
      this.scope = match.sections;
      this.index = 0;
    }
    this.lastNumber = 0;
    return true;
  }

  /** Record an answer. `number` null means "the next question". */
  add(number: number | null, raw: string, where = '') {
    const at = where ? ` (${where})` : '';
    let section = this.current;
    if (!section) {
      this.warn(`Extra answer "${raw}"${at}: every question already has an answer slot filled.`);
      return;
    }

    let n: number;
    if (number == null) {
      n = this.lastNumber + 1;
      if (n > section.questionCount) {
        this.index++;
        section = this.current;
        n = 1;
        if (!section) {
          this.warn(`Extra answer "${raw}"${at}: more answers than questions.`);
          return;
        }
      }
    } else {
      n = number;
      if (n <= this.lastNumber && this.index + 1 < this.scope.length) {
        // Numbering restarted: next module/section.
        this.index++;
        section = this.current!;
      }
      if (n > section.questionCount) {
        const located = this.locateRunning(n);
        if (!located) {
          this.warn(`Question ${n}${at} is beyond the last question of ${section.name}.`);
          return;
        }
        [section, n] = located;
        this.index = this.scope.indexOf(section);
      }
    }

    this.lastNumber = n;
    const question = section.questions[n - 1];
    if (!question) {
      this.warn(`${section.name} #${n}${at} has no matching question.`);
      return;
    }
    const normalized = normalizeResponse(question, raw);
    if (!normalized.valid) {
      this.warn(`${section.shortName} #${n}: "${raw}" isn't a valid answer${question.type === 'mc' ? ` (choices ${question.choices.join('/')})` : ''}; it will be graded as incorrect.`);
    }
    const previous = this.responses[question.id];
    if (previous && normalized.value && previous !== normalized.value) {
      this.warn(`${section.shortName} #${n} appears more than once ("${previous}" then "${normalized.value}"); kept the last one.`);
    }
    this.responses[question.id] = normalized.value ?? '';
  }

  private locateRunning(n: number): [Section, number] | null {
    let remaining = n;
    for (const s of this.scope) {
      if (remaining <= s.questionCount) return [s, remaining];
      remaining -= s.questionCount;
    }
    return null;
  }

  result(): ParseResult {
    const answered = Object.values(this.responses).filter(Boolean).length;
    return { responses: { ...this.responses }, answered, warnings: [...this.warnings] };
  }
}
