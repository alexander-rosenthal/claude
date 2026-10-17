/**
 * SAT Practice Test 4 as given in Bluebook (digital, 27/22-question modules).
 *
 * Answers and skill tags come from a tutoring-platform score report for this
 * test. Module 1 of each section is the same for every student. Module 2 is
 * adaptive, and this key covers the version that report shows (reached after
 * a strong Module 1); a student routed to the other Module 2 saw different
 * questions.
 *
 * Tags are listed the way that report groups them: each row is
 * [domain, skill, subskill, questions], with questions written as
 * "module.question" ("2.14" = Module 2, question 14). A question may appear
 * under several skills or subskills; '' as a subskill tags the skill alone.
 */
import type { AnswerKey, AnswerKeyEntry, Topic } from '../../core/types';
import { SAT_FORMAT } from '../formats';

const ANSWERS: Record<string, string[]> = {
  rw1: 'B B A B A D A A D B C B B D D B C A D D D C D A C D C'.split(' '),
  rw2: 'B B C C D A A C B C C D C B D A D D B A A C B C D A D'.split(' '),
  math1: ['C', 'B', 'B', 'A', 'C', '5', 'D', 'A', '28', 'C', '11', '9', 'A', 'D', 'D', 'B', 'C', 'C', 'D', 'B', 'B', '6.556; 6.555; 59/9'],
  math2: ['A', 'B', 'B', 'C', 'D', 'C', 'C', 'C', 'A', 'C', '-0.9333; -0.933; -14/15; -.9333; -.933', '4.06', '289', '44', 'D', '14.5', 'C', 'C', 'A', '10', 'B', 'D'],
};

type TagRow = [domain: string, skill: string, subskill: string, questions: string];

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

function buildEntries(): AnswerKeyEntry[] {
  const tags = new Map<string, { category: string; topics: Topic[] }>();
  const add = (prefix: 'rw' | 'math', rows: TagRow[]) => {
    for (const [domain, skill, subskill, questions] of rows) {
      for (const ref of questions.split(' ')) {
        const [module, number] = ref.split('.');
        const id = `${prefix}${module}-${number}`;
        const entry = tags.get(id) ?? { category: domain, topics: [] };
        if (entry.category !== domain) throw new Error(`${id} is tagged in two domains`);
        entry.topics.push({ skill, subskill });
        tags.set(id, entry);
      }
    }
  };
  add('rw', RW_TAGS);
  add('math', MATH_TAGS);

  return Object.entries(ANSWERS).flatMap(([sectionId, answers]) =>
    answers.map((answer, i) => {
      const tag = tags.get(`${sectionId}-${i + 1}`);
      return {
        sectionId,
        number: i + 1,
        correct: answer.split(';').map((a) => a.trim()),
        category: tag?.category ?? '',
        topics: tag?.topics ?? [],
      };
    }),
  );
}

export const SAT_PRACTICE_TEST_4_BLUEBOOK: AnswerKey = {
  id: 'sat-pt4-bluebook',
  name: 'SAT Practice Test 4 — Bluebook',
  formatId: SAT_FORMAT.id,
  isDemo: false,
  entries: buildEntries(),
};
