import harderSample from './fixtures/pt4-bluebook-sample-harder.json';
import { describe, expect, it } from 'vitest';
import { grade } from '../core/grader';
import { DEMO_EXAMS, OFFICIAL_EXAMS } from '../exams';
import { SAT_FORMAT } from '../exams/formats';
import { answerKeyFromRows, answerKeyTemplate } from './answerKey';
import { bluebookTargetExam, cleanBluebookAnswer, examForBluebookResults, parseBluebook } from './bluebook';
import { parseForAnyVersion, parsePastedResponses, responsesFromRows } from './responses';
import pt4Results from './fixtures/bluebook-pt4-results.txt?raw';
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

  it('reads unformatted answers in order: a line per module, or one per line', () => {
    const pt4 = OFFICIAL_EXAMS.find((e) => e.key.id === 'sat-pt4-bluebook')!;
    const lines = Object.values(harderSample);
    const expected = Object.fromEntries(Object.entries(harderSample).flatMap(([id, a]) => a.split(' ').map((x, i) => [`${id}-${i + 1}`, x])));
    for (const text of [lines.join('\n'), lines.join(' ').replace(/ /g, '\n'), lines.join(', ')]) {
      const { responses, warnings } = parsePastedResponses(pt4, text);
      expect(warnings).toEqual([]);
      expect(responses).toEqual(expected);
    }
  });

  it('checks pasted answers against the Module 2 version they fit', () => {
    const pt4 = OFFICIAL_EXAMS.find((e) => e.key.id === 'sat-pt4-bluebook')!;
    // The app guesses the easier Module 2 before any answers are in.
    const easierFirst = buildExam(SAT_FORMAT, pt4.key, { rw2: 'easier', math2: 'easier' });
    const text = Object.values(harderSample).join('\n');
    expect(parsePastedResponses(easierFirst, text).warnings.length).toBeGreaterThan(0);
    expect(parseForAnyVersion(easierFirst, (e) => parsePastedResponses(e, text)).warnings).toEqual([]);
  });

  it('still reads numbered answers as numbered', () => {
    expect(parsePastedResponses(sat, '1 A 2 B 3 C').responses).toEqual({ 'rw1-1': 'A', 'rw1-2': 'B', 'rw1-3': 'C' });
  });

  it('routes tab-separated pastes through the table reader', () => {
    const { responses } = parsePastedResponses(act, 'Section\tQuestion\tAnswer\nMath\t4\tH\nReading\t1\tA');
    expect(responses).toEqual({ 'math-4': 'H', 'reading-1': 'A' });
  });
});

describe('Bluebook paste', () => {
  // A digital key treated as real (not demo), so key cross-checks apply.
  const realSat = buildExam(SAT_FORMAT, { ...sat.key, id: 'real', isDemo: false });
  const q = (s: string, n: number) => realSat.sections.find((x) => x.id === s)!.questions[n - 1];

  it('cleans answer cells', () => {
    expect(cleanBluebookAnswer('B; Correct')).toBe('B');
    expect(cleanBluebookAnswer('1.5; Incorrect')).toBe('1.5');
    expect(cleanBluebookAnswer('Omitted')).toBe('');
    expect(cleanBluebookAnswer('Your answer: C')).toBe('C');
  });

  describe('score details results (Practice Test 4)', () => {
    it('reads every question, outcome and domain without an answer key', () => {
      const result = parsePastedResponses(sat, pt4Results);
      expect(result.warnings).toEqual([]);
      expect(result.answered).toBe(98);
      expect(Object.keys(result.outcomes!)).toHaveLength(98);
      expect(Object.keys(result.categories!)).toHaveLength(98);
      expect(result.responses).toEqual({});
      expect(result.outcomes).toMatchObject({ 'rw1-1': 'correct', 'rw1-2': 'incorrect', 'rw2-1': 'correct', 'math2-22': 'incorrect' });
      expect(result.categories).toMatchObject({ 'rw1-6': 'Craft and Structure', 'rw2-9': 'Craft and Structure', 'math1-2': 'Problem-Solving and Data Analysis' });
    });

    it('grades from the pasted outcomes', () => {
      const target = bluebookTargetExam(sat);
      const result = parseBluebook(target, pt4Results);
      const { exam } = examForBluebookResults(target, result);
      expect(exam.key.resultsOnly).toBe(true);
      const report = grade(exam, result.responses, result.outcomes);
      const [rw, math] = report.scales;
      expect(rw.sections.map((s) => s.tally.correct)).toEqual([4, 14]);
      expect(math.sections.map((s) => s.tally.correct)).toEqual([9, 6]);
      expect(rw.raw).toBe(18);
      expect(math.raw).toBe(15);
      const craft = rw.categories.find((c) => c.name === 'Craft and Structure')!;
      expect(craft.tally).toMatchObject({ correct: 5, total: 15 });
      expect(math.categories.map((c) => c.name).sort()).toEqual(['Advanced Math', 'Algebra', 'Geometry and Trigonometry', 'Problem-Solving and Data Analysis']);
    });

    it('reads against the digital layout even when the paper key is selected', () => {
      const paper = OFFICIAL_EXAMS.find((e) => e.format.id === 'sat-paper')!;
      expect(paper.format.id).toBe('sat-paper');
      const result = parsePastedResponses(paper, pt4Results);
      expect(result.outcomes!['math2-22']).toBe('incorrect');
      expect(result.warnings).toEqual([]);
    });

    it('survives tabs turned into spaces', () => {
      const result = parsePastedResponses(sat, pt4Results.replace(/\t+/g, ' '));
      expect(Object.keys(result.outcomes!)).toHaveLength(98);
      expect(result.warnings).toEqual([]);
    });

    describe('with the tagged Practice Test 4 key selected', () => {
      const pt4 = OFFICIAL_EXAMS.find((e) => e.key.id === 'sat-pt4-bluebook')!;
      const result = parseBluebook(pt4, pt4Results);
      const q = (exam: typeof pt4, id: string) => exam.sections.flatMap((s) => s.questions).find((x) => x.id === id)!;

      it('confirms the easier Math Module 2 by domains and infers the RW Module 2 from the cutoff', () => {
        const { exam, warnings, routing } = examForBluebookResults(pt4, result);
        expect(warnings).toEqual([]);
        const [rw, math] = routing;
        expect(rw).toMatchObject({ sectionId: 'rw2', version: 'easier', method: 'inferred', module1Missed: 23, cutoffGuess: 'easier' });
        expect(rw.reason).toMatch(/fit both versions \(27 and 27 of 27\)/);
        expect(math).toMatchObject({ sectionId: 'math2', version: 'easier', method: 'confirmed-by-domains', module1Missed: 13, cutoffGuess: 'easier' });
        expect(math.reason).toMatch(/21 of 22 Bluebook domains match the easier version \(vs 8 for harder\)/);
        // Module 1 always comes from the key.
        expect(q(exam, 'rw1-1').topics).toEqual([{ skill: 'Vocabulary in Context', subskill: 'Sentence Completion' }]);
        expect(q(exam, 'rw1-1').correct).toEqual(['B']);
        // Easier Math Module 2 #3 is a grid-in with answer 2520.
        expect(q(exam, 'math2-3').correct).toEqual(['2520']);
        expect(q(exam, 'math2-12').topics).toEqual([{ skill: 'Probability', subskill: 'Probability and Conditional Probability' }]);
        // RW Module 2 takes the easier version's tags.
        expect(q(exam, 'rw2-1').correct).toEqual(['D']);
        expect(q(exam, 'rw2-1').topics.length).toBeGreaterThan(0);
        const report = grade(exam, result.responses, result.outcomes);
        expect(report.scales.map((s) => s.raw)).toEqual([18, 15]);
      });

      it('overrides the cutoff when the domains clearly fit the other version', () => {
        // With a looser Math cutoff the guess is harder, but the domains say easier.
        const { routing } = examForBluebookResults(pt4, result, {}, { rw: 7, math: 15 });
        expect(routing[1]).toMatchObject({ version: 'easier', method: 'overridden-by-domains', cutoffGuess: 'harder' });
      });

      it('uses a chosen version, and warns when the paste contradicts it', () => {
        const { exam, warnings, routing } = examForBluebookResults(pt4, result, { rw2: 'harder', math2: 'harder' });
        expect(routing.map((d) => d.method)).toEqual(['manual', 'manual']);
        expect(q(exam, 'math2-3').correct).not.toEqual(['2520']);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatch(/Math — Module 2: .* 14 of 22/);
      });

      it('can use Bluebook’s domains only for Module 2', () => {
        const { exam, routing } = examForBluebookResults(pt4, result, { rw2: 'none', math2: 'none' });
        expect(routing.map((d) => [d.version, d.method])).toEqual([[null, 'domains-only'], [null, 'domains-only']]);
        expect(q(exam, 'math2-3').correct).toEqual([]);
        expect(q(exam, 'rw2-1').topics).toEqual([]);
        expect(q(exam, 'rw2-1').category).toBe('Craft and Structure');
      });
    });
  });

  it('grades a table with correct and chosen answers', () => {
    const rows = ['Question\tSection\tCorrect Answer\tYour Answer'];
    for (let n = 1; n <= 27; n++) rows.push(`${n}\tReading and Writing\t${q('rw1', n).correct[0]}\t${q('rw1', n).correct[0]}; Correct`);
    rows.push(`1\tReading and Writing\t${q('rw2', 1).correct[0]}\tOmitted`);
    const spr = realSat.sections[2].questions.find((x) => x.type === 'spr')!;
    rows.push(`${spr.number}\tMath\t${spr.correct[0]}\t${spr.correct[0]}`);

    const { responses, outcomes, warnings, errors } = parseBluebook(realSat, rows.join('\n'));
    expect(responses['rw1-27']).toBe(q('rw1', 27).correct[0]);
    expect(outcomes!['rw2-1']).toBe('omitted');
    expect(responses[spr.id]).toBe(spr.correct[0]);
    expect(outcomes![spr.id]).toBe('correct'); // derived from the pasted key
    expect(warnings).toEqual([]);
    // Only part of the table was pasted, so it can't be graded as is.
    expect(errors).toContain('Reading and Writing — Module 2: no result for questions 2–27.');
    expect(errors).toContain('Math — Module 2 is missing from the paste.');
  });

  it('lists the questions missing from a cut-off Bluebook paste', () => {
    expect(parseBluebook(sat, pt4Results).errors).toBeUndefined();
    const cut = pt4Results.slice(0, pt4Results.lastIndexOf('21\tMath'));
    const { errors } = parseBluebook(sat, cut);
    expect(errors).toEqual([
      'Math — Module 2: no result for questions 21–22.',
      'Copy the whole question table from the Bluebook score details page, including every module, and paste it again.',
    ]);
  });

  it('honors a header that puts your answer first', () => {
    const { responses } = parseBluebook(realSat, 'Question\tSection\tYour Answer\tCorrect Answer\n1\tReading and Writing\tC\tB');
    expect(responses['rw1-1']).toBe('C');
  });

  it('warns when the pasted key disagrees with the selected key', () => {
    const right = q('rw1', 1).correct[0];
    const wrong = ['A', 'B', 'C', 'D'].find((c) => c !== right)!;
    const { warnings } = parseBluebook(realSat, `1\tReading and Writing\t${wrong}\t${right}; Incorrect`);
    expect(warnings.join(' ')).toMatch(/disagree/);
  });

  it('reads rows flattened to single spaces', () => {
    const { responses, outcomes } = parseBluebook(realSat, '1 Reading and Writing Module 2 B C; Incorrect');
    expect(responses['rw2-1']).toBe('C');
    expect(outcomes!['rw2-1']).toBe('incorrect');
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
    expect(key!.entries[0].topics).toEqual([{ skill: 'Linear functions', subskill: '' }]);
  });

  it('collects several skill tags per question', () => {
    const rows = parseDelimited(
      [
        'Section,Question,Answer,Domain,Skill,Subskill',
        'RW1,15,D,Standard English Conventions,Punctuation,Multiple Issues',
        'RW1,15,,,Form Structure and Sense,Run-on Issue',
        'RW1,16,A,Standard English Conventions,Punctuation; Form Structure and Sense,Apostrophe Issue; Verb Tense Issue',
        'RW1,17,B,Standard English Conventions,Punctuation,',
      ].join('\n'),
    );
    const { key, errors } = answerKeyFromRows(SAT_FORMAT, rows, 'x');
    expect(errors).toEqual([]);
    expect(key!.entries).toHaveLength(3);
    expect(key!.entries[0]).toMatchObject({
      number: 15,
      correct: ['D'],
      category: 'Standard English Conventions',
      topics: [
        { skill: 'Punctuation', subskill: 'Multiple Issues' },
        { skill: 'Form Structure and Sense', subskill: 'Run-on Issue' },
      ],
    });
    expect(key!.entries[1].topics).toEqual([
      { skill: 'Punctuation', subskill: 'Apostrophe Issue' },
      { skill: 'Form Structure and Sense', subskill: 'Verb Tense Issue' },
    ]);
    expect(key!.entries[2].topics).toEqual([{ skill: 'Punctuation', subskill: '' }]);
  });

  it('rejects a repeated question with a conflicting answer', () => {
    const rows = parseDelimited('Section,Question,Answer\nRW1,1,A\nRW1,1,B');
    expect(answerKeyFromRows(SAT_FORMAT, rows, 'x').errors[0]).toMatch(/different answer/);
  });

  it('rejects unknown sections', () => {
    const rows = parseDelimited('Section,Question,Answer\nPhysics,1,A');
    expect(answerKeyFromRows(SAT_FORMAT, rows, 'x').errors[0]).toMatch(/unknown section/);
  });
});
