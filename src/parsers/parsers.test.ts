import { describe, expect, it } from 'vitest';
import { DEMO_EXAMS } from '../exams';
import { SAT_FORMAT } from '../exams/formats';
import { answerKeyFromRows, answerKeyTemplate } from './answerKey';
import { cleanBluebookAnswer, parseBluebook } from './bluebook';
import { parsePastedResponses, responsesFromRows } from './responses';
import { parseDelimited } from './table';
import { buildExam } from '../core/exam';

const sat = DEMO_EXAMS.find((e) => e.family === 'SAT')!;
const act = DEMO_EXAMS.find((e) => e.format.id === 'act-enhanced')!;

describe('parseDelimited', () => {
  it('handles quotes, CRLF and tabs', () => {
    expect(parseDelimited('a,"b, c",d\r\n1,"say ""hi""",3\n')).toEqual([
      ['a', 'b, c', 'd'],
      ['1', 'say "hi"', '3'],
    ]);
    expect(parseDelimited('x\ty\n1\t2')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('parsePastedResponses', () => {
  it('reads section headings and numbered answers', () => {
    const text = `Reading and Writing Module 1
1. A
2) b
3: C
Math Module 1
1 D  2 3/2  3 -4`;
    const { responses, warnings } = parsePastedResponses(sat, text);
    expect(responses).toMatchObject({ 'rw1-1': 'A', 'rw1-2': 'B', 'rw1-3': 'C', 'math1-1': 'D', 'math1-2': '3/2', 'math1-3': '-4' });
    // math1-2/3 are MC in the demo key, so numeric answers are flagged.
    expect(warnings.some((w) => w.includes('Math 1 #2'))).toBe(true);
  });

  it('reads letter runs and rolls over into the next section', () => {
    const run = 'A'.repeat(27) + 'B';
    const { responses } = parsePastedResponses(sat, run);
    expect(responses['rw1-27']).toBe('A');
    expect(responses['rw2-1']).toBe('B');
  });

  it('starts the next section when numbering restarts', () => {
    const lines = ['English', ...Array.from({ length: 50 }, (_, i) => `${i + 1} ${i % 2 ? 'G' : 'B'}`), '1 C'];
    const { responses } = parsePastedResponses(act, lines.join('\n'));
    expect(responses['english-50']).toBe('G');
    expect(responses['math-1']).toBe('C');
  });

  it('maps running numbers across sections', () => {
    const { responses } = parsePastedResponses(sat, '28 D');
    expect(responses['rw2-1']).toBe('D');
  });

  it('reads leading-dot decimals as grid-in answers', () => {
    const { responses } = parsePastedResponses(sat, 'Math Module 1\n7 .6667\n8. -.5');
    expect(responses['math1-7']).toBe('.6667');
    expect(responses['math1-8']).toBe('-.5');
  });

  it('does not read a bare number as an answer', () => {
    const { responses, warnings } = parsePastedResponses(sat, '12');
    expect(responses).toEqual({});
    expect(warnings).toHaveLength(1);
  });

  it('routes tab-separated pastes through the table reader', () => {
    const { responses } = parsePastedResponses(act, 'Section\tQuestion\tAnswer\nMath\t4\tH\nReading\t1\tA');
    expect(responses).toEqual({ 'math-4': 'H', 'reading-1': 'A' });
  });
});

describe('Bluebook paste', () => {
  const q = (s: string, n: number) => sat.sections.find((x) => x.id === s)!.questions[n - 1];

  it('cleans answer cells', () => {
    expect(cleanBluebookAnswer('B; Correct')).toBe('B');
    expect(cleanBluebookAnswer('1.5; Incorrect')).toBe('1.5');
    expect(cleanBluebookAnswer('Omitted')).toBe('');
    expect(cleanBluebookAnswer('Your answer: C')).toBe('C');
  });

  it('reads a tabbed table and infers modules from numbering', () => {
    const rows = ['Question\tSection\tCorrect Answer\tYour Answer'];
    for (let n = 1; n <= 27; n++) rows.push(`${n}\tReading and Writing\t${q('rw1', n).correct[0]}\t${q('rw1', n).correct[0]}; Correct`);
    rows.push(`1\tReading and Writing\t${q('rw2', 1).correct[0]}\tOmitted`);
    const spr = sat.sections[2].questions.find((x) => x.type === 'spr')!;
    rows.push(`${spr.number}\tMath\t${spr.correct[0]}\t${spr.correct[0]}; Correct`);

    const text = rows.join('\n');
    const { responses, warnings } = parsePastedResponses(sat, text);
    expect(responses['rw1-27']).toBe(q('rw1', 27).correct[0]);
    expect(responses['rw2-1']).toBe('');
    expect(responses[spr.id]).toBe(spr.correct[0]);
    expect(warnings).toEqual([]);
  });

  it('warns when the pasted key disagrees with the loaded key', () => {
    const right = q('rw1', 1).correct[0];
    const wrong = ['A', 'B', 'C', 'D'].find((c) => c !== right)!;
    const { warnings } = parseBluebook(sat, `1\tReading and Writing\t${wrong}\t${right}; Incorrect`);
    expect(warnings.join(' ')).toMatch(/disagree/);
  });

  it('reads rows flattened to single spaces', () => {
    const { responses } = parseBluebook(sat, '1 Reading and Writing Module 2 B C; Incorrect');
    expect(responses['rw2-1']).toBe('C');
  });
});

describe('responsesFromRows', () => {
  it('reads a header layout', () => {
    const rows = parseDelimited('Module,Q #,Your Answer\nMath 2,5,C\nRW1,1,a');
    expect(responsesFromRows(sat, rows).responses).toEqual({ 'math2-5': 'C', 'rw1-1': 'A' });
  });

  it('skips rows from unknown sections and warns once per label', () => {
    const rows = parseDelimited('Section,Question,Answer\nPhysics,1,A\nPhysics,2,B\nEnglish,1,C');
    const { responses, warnings } = responsesFromRows(act, rows);
    expect(responses).toEqual({ 'english-1': 'C' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Skipped 2 rows .*"Physics"/);
  });

  it('reads a single column of answers in order', () => {
    const rows = parseDelimited('B\nC\n\nD');
    expect(responsesFromRows(act, rows).responses).toEqual({ 'english-1': 'B', 'english-2': 'H', 'english-3': 'D' });
  });
});

describe('answer key import', () => {
  it('round-trips the template', () => {
    const template = answerKeyTemplate(SAT_FORMAT);
    for (const row of template.slice(1)) {
      row[2] = row[0].startsWith('Math') && row[1] === '5' ? '3/2, 1.5' : 'C';
      row[3] = 'Algebra';
      row[4] = 'Linear functions';
    }
    const { key, errors } = answerKeyFromRows(SAT_FORMAT, template, 'Practice Test 1');
    expect(errors).toEqual([]);
    const exam = buildExam(SAT_FORMAT, key!);
    const q5 = exam.sections[2].questions[4];
    expect(q5.type).toBe('spr');
    expect(q5.correct).toEqual(['3/2', '1.5']);
  });

  it('infers modules from group labels and restarts', () => {
    const rows = parseDelimited(
      'Section,Question,Answer,Domain,Skill\nMath,1,A,Algebra,Linear functions\nMath,2,B,Algebra,Linear functions\nMath,1,C,Algebra,Linear functions',
    );
    const { key } = answerKeyFromRows(SAT_FORMAT, rows, 'x');
    expect(key!.entries.map((e) => `${e.sectionId}-${e.number}`)).toEqual(['math1-1', 'math1-2', 'math2-1']);
    expect(key!.entries[0].subcategory).toBe('Linear functions');
  });

  it('rejects unknown sections', () => {
    const rows = parseDelimited('Section,Question,Answer\nPhysics,1,A');
    expect(answerKeyFromRows(SAT_FORMAT, rows, 'x').errors[0]).toMatch(/unknown section/);
  });
});
