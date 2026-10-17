/**
 * SAT Practice Test 4 as given in Bluebook (digital, 27/22-question modules).
 *
 * Answers and skill tags come from two tutoring-platform score reports for
 * this test, one per adaptive route. Module 1 of each section is the same
 * for every student (both reports agree on it). Module 2 is adaptive: a strong
 * Module 1 leads to the harder version, otherwise the easier one, and each
 * section routes on its own.
 *
 * Tags are listed the way those reports group them: each row is
 * [domain, skill, subskill, questions], with questions written as
 * "module.question" ("2.14" = Module 2, question 14). A question may appear
 * under several skills or subskills; '' as a subskill tags the skill alone.
 */
import type { AnswerKey, AnswerKeyEntry, SectionVersion, Topic } from '../../core/types';
import { SAT_FORMAT } from '../formats';

const MODULE_2_VERSIONS: SectionVersion[] = [
  { id: 'harder', name: 'Harder Module 2' },
  { id: 'easier', name: 'Easier Module 2' },
];

const MODULE_1_ANSWERS: Record<string, string[]> = {
  rw1: 'B B A B A D A A D B C B B D D B C A D D D C D A C D C'.split(' '),
  math1: ['C', 'B', 'B', 'A', 'C', '5', 'D', 'A', '28', 'C', '11', '9', 'A', 'D', 'D', 'B', 'C', 'C', 'D', 'B', 'B', '6.556; 6.555; 59/9'],
};

const MODULE_2_ANSWERS: Record<string, Record<string, string[]>> = {
  harder: {
    rw2: 'B B C C D A A C B C C D C B D A D D B A A C B C D A D'.split(' '),
    math2: ['A', 'B', 'B', 'C', 'D', 'C', 'C', 'C', 'A', 'C', '-0.9333; -0.933; -14/15; -.9333; -.933', '4.06', '289', '44', 'D', '14.5', 'C', 'C', 'A', '10', 'B', 'D'],
  },
  easier: {
    rw2: 'D D A A B C C A C A C A D A D C B A A D C D B D D A B'.split(' '),
    math2: ['B', 'B', '2520', '40', '7', '30', '180', 'C', 'A', 'D', 'D', 'A', 'A', 'C', 'A', 'D', 'D', 'C', 'D', 'C', 'D', 'A'],
  },
};

type TagRow = [domain: string, skill: string, subskill: string, questions: string];

// Module 1 and the harder Module 2.
const RW_TAGS: TagRow[] = [
  ['Craft and Structure', 'Purpose/Function of Text', 'Full Text Purpose (Author Intention)', '2.6 2.7'],
  ['Craft and Structure', 'Purpose/Function of Text', 'Sentence Purpose', '2.5 2.8'],
  ['Craft and Structure', 'Cross-Text Connections', 'Compare/Contrast', '2.9'],
  ['Craft and Structure', 'Vocabulary in Context', 'Sentence Completion', '1.1 1.2 1.3 1.4 1.5 2.1 2.2 2.3 2.4'],
  ['Craft and Structure', 'Vocabulary in Context', 'Most Nearly Means', '1.6'],
  ['Information and Ideas', 'Evidence', 'Quantitative Evidence', '1.11 2.10 2.12'],
  ['Information and Ideas', 'Evidence', 'Textual Evidence', '1.10 2.11'],
  ['Information and Ideas', 'Ideas', 'Main Idea', '1.8 1.9'],
  ['Information and Ideas', 'Ideas', 'Detail', '1.7'],
  ['Information and Ideas', 'Inferences', 'Inference Question', '1.12 1.13 2.15 2.16'],
  ['Information and Ideas', 'Reasoning', 'Support/Refute a Claim', '1.10 2.11 2.13 2.14'],
  ['Standard English Conventions', 'Punctuation', 'Apostrophe Issue', '1.16'],
  ['Standard English Conventions', 'Punctuation', 'Multiple Issues', '1.14 1.15 1.17 1.19 2.17 2.23'],
  ['Standard English Conventions', 'Punctuation', 'Comma Issue', '2.22'],
  ['Standard English Conventions', 'Form, Structure, and Sense', 'Run-on Issue', '1.15 1.17 2.19 2.21'],
  ['Standard English Conventions', 'Form, Structure, and Sense', 'Verb Tense Issue', '1.18 1.20 2.18 2.20'],
  ['Standard English Conventions', 'Form, Structure, and Sense', 'Subject-Verb Agreement Issue', '1.18 2.20'],
  ['Expression of Ideas', 'Logical Transition', 'Logical Transition Issue', '1.21 2.24 2.25 2.26'],
  ['Expression of Ideas', 'Rhetorical Synthesis', 'Relevance Issue', '1.22 1.23 1.24 1.26 1.27 2.27'],
  ['Expression of Ideas', 'Rhetorical Synthesis', 'Tone or Emphasis', '1.25'],
];

// Module 1 and the harder Module 2.
const MATH_TAGS: TagRow[] = [
  ['Algebra', 'Linear Equations in One Variable', 'Solving for an Expression', '2.13'],
  ['Algebra', 'Linear Equations in One Variable', 'Manipulating Linear Equations/Expressions', '1.1 2.11 2.13'],
  ['Algebra', 'Linear Equations in Two Variables', '', '2.4'],
  ['Algebra', 'Linear Equations in Two Variables', 'Solving Linear Equations in Two Variables', '2.8'],
  ['Algebra', 'Linear Functions', 'Graphs of Linear Functions', '1.22 2.4 2.8'],
  ['Algebra', 'Linear Functions', 'Evaluating Functions and Function Tables', '1.11'],
  ['Algebra', 'Systems of Two Linear Equations', 'Systems of Two Linear Equations in Two Variables', '1.5 1.13 1.18'],
  ['Algebra', 'Linear Inequalities', 'Linear Inequalities in Two Variables', '1.13 1.20'],
  ['Algebra', 'Translating Math', 'Words to Algebra', '1.6 1.8 1.20 2.2'],
  ['Algebra', 'Translating Math', 'Algebra to Words', '1.6'],
  ['Advanced Math', 'Nonlinear Functions', '', '2.5 2.6 2.18'],
  ['Advanced Math', 'Nonlinear Functions', 'Quadratic Function Graphs', '2.22'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Exponents and Roots', '1.16'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Solving Nonlinear Equations', '1.9 2.19'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Manipulating Other Nonlinear Equations/Expressions', '1.10 1.12 2.6 2.18'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Interpreting Nonlinear Equations/Expressions', '2.5'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Absolute Value', '1.9'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Systems of Nonlinear Equations in Two Variables', '2.16'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Manipulating Quadratic Equations/Expressions', '2.15 2.22'],
  ['Problem-Solving and Data Analysis', 'One-Variable Data', 'Distributions: Measures of Center and Spread', '1.2 2.14 2.17'],
  ['Problem-Solving and Data Analysis', 'Percentages', '', '1.17 2.1 2.12'],
  ['Problem-Solving and Data Analysis', 'Proportional Relationships', 'Proportions', '1.19'],
  ['Problem-Solving and Data Analysis', 'Proportional Relationships', 'Rates', '1.4 1.14'],
  ['Problem-Solving and Data Analysis', 'Proportional Relationships', 'Unit Conversions', '2.9'],
  ['Problem-Solving and Data Analysis', 'Data Visualization', 'Charts and Graphs', '1.15 2.17'],
  ['Problem-Solving and Data Analysis', 'Two-Variable Data', 'Applying a Model', '2.10'],
  ['Problem-Solving and Data Analysis', 'Two-Variable Data', 'Scatterplots and Line of Best Fit', '2.3'],
  ['Geometry and Trigonometry', 'Geometry', 'Area, Surface Area, and Volume', '2.21'],
  ['Geometry and Trigonometry', 'Geometry', 'Perimeter and Area', '1.7'],
  ['Geometry and Trigonometry', 'Geometry', 'Equation of a Circle', '2.20'],
  ['Geometry and Trigonometry', 'Geometry', 'Angles', '2.7'],
  ['Geometry and Trigonometry', 'Geometry', 'Similarity', '1.3 1.7 1.21'],
  ['Geometry and Trigonometry', 'Geometry', 'Quadrilaterals', '1.7'],
  ['Geometry and Trigonometry', 'Trigonometry', 'Trig Functions', '1.21'],
  ['Geometry and Trigonometry', 'Trigonometry', 'Right Triangle Trigonometry', '1.3 1.21'],
];

// The easier Module 2 (Module 2 questions only).
const EASIER_RW_TAGS: TagRow[] = [
  ['Craft and Structure', 'Purpose/Function of Text', 'Full Text Purpose (Author Intention)', '2.8'],
  ['Craft and Structure', 'Purpose/Function of Text', 'Sentence Purpose', '2.7'],
  ['Craft and Structure', 'Cross-Text Connections', 'Compare/Contrast', '2.9'],
  ['Craft and Structure', 'Vocabulary in Context', 'Sentence Completion', '2.1 2.2 2.3 2.4 2.5 2.6'],
  ['Information and Ideas', 'Evidence', 'Quantitative Evidence', '2.10 2.13'],
  ['Information and Ideas', 'Evidence', 'Textual Evidence', '2.11 2.12 2.14'],
  ['Information and Ideas', 'Inferences', 'Inference Question', '2.15 2.16'],
  ['Standard English Conventions', 'Punctuation', 'Apostrophe Issue', '2.21'],
  ['Standard English Conventions', 'Punctuation', 'Multiple Issues', '2.18 2.22'],
  ['Standard English Conventions', 'Form, Structure, and Sense', 'Verb Tense Issue', '2.17 2.19 2.20'],
  ['Standard English Conventions', 'Form, Structure, and Sense', 'Pronoun Agreement Issue', '2.23'],
  ['Expression of Ideas', 'Logical Transition', 'Logical Transition Issue', '2.24 2.25 2.26'],
  ['Expression of Ideas', 'Rhetorical Synthesis', 'Relevance Issue', '2.27'],
];

const EASIER_MATH_TAGS: TagRow[] = [
  ['Algebra', 'Linear Equations in One Variable', 'Solving for an Expression', '2.1'],
  ['Algebra', 'Linear Equations in Two Variables', '', '2.8 2.19'],
  ['Algebra', 'Linear Functions', 'Graphs of Linear Functions', '2.8 2.19'],
  ['Algebra', 'Linear Functions', 'Function Notation', '2.6'],
  ['Algebra', 'Linear Functions', 'Evaluating Functions and Function Tables', '2.6'],
  ['Algebra', 'Translating Math', 'Words to Algebra', '2.19'],
  ['Algebra', 'Translating Math', 'Algebra to Words', '2.15'],
  ['Advanced Math', 'Equivalent Expressions', '', '2.9'],
  ['Advanced Math', 'Nonlinear Functions', '', '2.10 2.17 2.18'],
  ['Advanced Math', 'Nonlinear Functions', 'Quadratic Function Graphs', '2.5'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Exponents and Roots', '2.18'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Solving Nonlinear Equations', '2.21'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Manipulating Other Nonlinear Equations/Expressions', '2.9'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Interpreting Nonlinear Equations/Expressions', '2.17'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Systems of Nonlinear Equations in Two Variables', '2.16'],
  ['Advanced Math', 'Nonlinear Equations/Expressions', 'Manipulating Quadratic Equations/Expressions', '2.21'],
  ['Problem-Solving and Data Analysis', 'One-Variable Data', 'Distributions: Measures of Center and Spread', '2.14'],
  ['Problem-Solving and Data Analysis', 'Percentages', '', '2.2'],
  ['Problem-Solving and Data Analysis', 'Probability', 'Probability and Conditional Probability', '2.12'],
  ['Problem-Solving and Data Analysis', 'Proportional Relationships', 'Rates', '2.3 2.20'],
  ['Problem-Solving and Data Analysis', 'Proportional Relationships', 'Unit Conversions', '2.3'],
  ['Problem-Solving and Data Analysis', 'Data Visualization', 'Charts and Graphs', '2.4 2.14'],
  ['Problem-Solving and Data Analysis', 'Two-Variable Data', 'Scatterplots and Line of Best Fit', '2.13'],
  ['Geometry and Trigonometry', 'Geometry', 'Perimeter and Area', '2.7'],
  ['Geometry and Trigonometry', 'Geometry', 'Parallel and Perpendicular Lines', '2.11'],
  ['Geometry and Trigonometry', 'Geometry', 'Equation of a Circle', '2.22'],
  ['Geometry and Trigonometry', 'Geometry', 'Angles', '2.11'],
  ['Geometry and Trigonometry', 'Geometry', 'Quadrilaterals', '2.7'],
];

type Tags = Map<string, { category: string; topics: Topic[] }>;

/** Index tag rows by question id ("rw2-14"), optionally keeping one module only. */
function indexTags(prefix: 'rw' | 'math', rows: TagRow[], module?: string, into: Tags = new Map()): Tags {
  for (const [domain, skill, subskill, questions] of rows) {
    for (const ref of questions.split(' ')) {
      const [mod, number] = ref.split('.');
      if (module && mod !== module) continue;
      const id = `${prefix}${mod}-${number}`;
      const entry = into.get(id) ?? { category: domain, topics: [] };
      if (entry.category !== domain) throw new Error(`${id} is tagged in two domains`);
      entry.topics.push({ skill, subskill });
      into.set(id, entry);
    }
  }
  return into;
}

function entriesFor(answers: Record<string, string[]>, tags: Tags, version?: string): AnswerKeyEntry[] {
  return Object.entries(answers).flatMap(([sectionId, list]) =>
    list.map((answer, i) => {
      const tag = tags.get(`${sectionId}-${i + 1}`);
      return {
        sectionId,
        number: i + 1,
        correct: answer.split(';').map((a) => a.trim()),
        category: tag?.category ?? '',
        topics: tag?.topics ?? [],
        ...(version ? { version } : {}),
      };
    }),
  );
}

function buildEntries(): AnswerKeyEntry[] {
  const module1 = indexTags('math', MATH_TAGS, '1', indexTags('rw', RW_TAGS, '1'));
  const harder = indexTags('math', MATH_TAGS, '2', indexTags('rw', RW_TAGS, '2'));
  const easier = indexTags('math', EASIER_MATH_TAGS, '2', indexTags('rw', EASIER_RW_TAGS, '2'));
  return [
    ...entriesFor(MODULE_1_ANSWERS, module1),
    ...entriesFor(MODULE_2_ANSWERS.harder, harder, 'harder'),
    ...entriesFor(MODULE_2_ANSWERS.easier, easier, 'easier'),
  ];
}

export const SAT_PRACTICE_TEST_4_BLUEBOOK: AnswerKey = {
  id: 'sat-pt4-bluebook',
  name: 'SAT Practice Test 4 — Bluebook',
  formatId: SAT_FORMAT.id,
  isDemo: false,
  versions: { rw2: MODULE_2_VERSIONS, math2: MODULE_2_VERSIONS },
  entries: buildEntries(),
};
