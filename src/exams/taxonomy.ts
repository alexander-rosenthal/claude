/**
 * Question classification vocabulary: domain → skill → subskills.
 *
 * Domains are the College Board / ACT reporting categories (what Bluebook
 * shows as "Domain"). The SAT skills and subskills follow the structure of a
 * tutoring-platform score reports for Bluebook Practice Test 4, so they cover
 * the topics that test exercises; imported keys may add any others.
 */
export type Taxonomy = Record<string, Record<string, string[]>>;

export const SAT_RW_TAXONOMY: Taxonomy = {
  'Craft and Structure': {
    'Purpose/Function of Text': ['Full Text Purpose (Author Intention)', 'Sentence Purpose'],
    'Cross-Text Connections': ['Compare/Contrast'],
    'Vocabulary in Context': ['Sentence Completion', 'Most Nearly Means'],
  },
  'Information and Ideas': {
    Evidence: ['Quantitative Evidence', 'Textual Evidence'],
    Ideas: ['Main Idea', 'Detail'],
    Inferences: ['Inference Question'],
    Reasoning: ['Support/Refute a Claim'],
  },
  'Standard English Conventions': {
    Punctuation: ['Apostrophe Issue', 'Multiple Issues', 'Comma Issue'],
    'Form, Structure, and Sense': ['Run-on Issue', 'Verb Tense Issue', 'Subject-Verb Agreement Issue', 'Pronoun Agreement Issue'],
  },
  'Expression of Ideas': {
    'Logical Transition': ['Logical Transition Issue'],
    'Rhetorical Synthesis': ['Relevance Issue', 'Tone or Emphasis'],
  },
};

export const SAT_MATH_TAXONOMY: Taxonomy = {
  Algebra: {
    'Linear Equations in One Variable': ['Solving for an Expression', 'Manipulating Linear Equations/Expressions'],
    'Linear Equations in Two Variables': ['Solving Linear Equations in Two Variables'],
    'Linear Functions': ['Graphs of Linear Functions', 'Function Notation', 'Evaluating Functions and Function Tables'],
    'Systems of Two Linear Equations': ['Systems of Two Linear Equations in Two Variables'],
    'Linear Inequalities': ['Linear Inequalities in Two Variables'],
    'Translating Math': ['Words to Algebra', 'Algebra to Words'],
  },
  'Advanced Math': {
    'Equivalent Expressions': [],
    'Nonlinear Functions': ['Quadratic Function Graphs'],
    'Nonlinear Equations/Expressions': [
      'Exponents and Roots',
      'Solving Nonlinear Equations',
      'Manipulating Other Nonlinear Equations/Expressions',
      'Interpreting Nonlinear Equations/Expressions',
      'Absolute Value',
      'Systems of Nonlinear Equations in Two Variables',
      'Manipulating Quadratic Equations/Expressions',
    ],
  },
  'Problem-Solving and Data Analysis': {
    'One-Variable Data': ['Distributions: Measures of Center and Spread'],
    Percentages: [],
    Probability: ['Probability and Conditional Probability'],
    'Proportional Relationships': ['Proportions', 'Rates', 'Unit Conversions'],
    'Data Visualization': ['Charts and Graphs'],
    'Two-Variable Data': ['Applying a Model', 'Scatterplots and Line of Best Fit'],
  },
  'Geometry and Trigonometry': {
    Geometry: ['Area, Surface Area, and Volume', 'Perimeter and Area', 'Parallel and Perpendicular Lines', 'Equation of a Circle', 'Angles', 'Similarity', 'Quadrilaterals'],
    Trigonometry: ['Trig Functions', 'Right Triangle Trigonometry'],
  },
};

const skillsOnly = (names: string[]) => Object.fromEntries(names.map((n) => [n, [] as string[]]));

export const ACT_TAXONOMY: Record<string, Taxonomy> = {
  english: {
    'Production of Writing': skillsOnly(['Topic Development', 'Organization, Unity, and Cohesion']),
    'Knowledge of Language': skillsOnly(['Word Choice', 'Style and Tone']),
    'Conventions of Standard English': skillsOnly(['Sentence Structure and Formation', 'Punctuation', 'Usage']),
  },
  math: {
    'Preparing for Higher Math': skillsOnly(['Number and Quantity', 'Algebra', 'Functions', 'Geometry', 'Statistics and Probability']),
    'Integrating Essential Skills': skillsOnly(['Rates and Percentages', 'Proportional Relationships', 'Area and Volume', 'Averages and Medians']),
    Modeling: skillsOnly(['Creating Models', 'Interpreting Models']),
  },
  reading: {
    'Key Ideas and Details': skillsOnly(['Central Ideas and Themes', 'Close Reading', 'Sequential and Cause-Effect Relationships']),
    'Craft and Structure': skillsOnly(['Word and Phrase Meaning', 'Purpose and Point of View', 'Text Structure']),
    'Integration of Knowledge and Ideas': skillsOnly(['Arguments and Claims', 'Multiple Texts']),
  },
  science: {
    'Interpretation of Data': skillsOnly(['Reading Tables and Graphs', 'Trends and Interpolation']),
    'Scientific Investigation': skillsOnly(['Experimental Design', 'Controls and Variables']),
    'Evaluation of Models, Inferences, and Experimental Results': skillsOnly(['Competing Viewpoints', 'Predictions and Conclusions']),
  },
};
