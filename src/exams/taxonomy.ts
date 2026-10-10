/**
 * Official reporting categories (main → subcategories) for each test, used to
 * build demo keys and as the suggested vocabulary for imported keys. Imported
 * keys may use any category names; these are not enforced.
 */
export type Taxonomy = Record<string, string[]>;

export const SAT_RW_TAXONOMY: Taxonomy = {
  'Craft and Structure': ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
  'Information and Ideas': ['Central Ideas and Details', 'Command of Evidence: Textual', 'Command of Evidence: Quantitative', 'Inferences'],
  'Standard English Conventions': ['Boundaries', 'Form, Structure, and Sense'],
  'Expression of Ideas': ['Transitions', 'Rhetorical Synthesis'],
};

export const SAT_MATH_TAXONOMY: Taxonomy = {
  Algebra: [
    'Linear equations in one variable',
    'Linear functions',
    'Linear equations in two variables',
    'Systems of two linear equations in two variables',
    'Linear inequalities in one or two variables',
  ],
  'Advanced Math': [
    'Nonlinear functions',
    'Nonlinear equations in one variable and systems of equations in two variables',
    'Equivalent expressions',
  ],
  'Problem-Solving and Data Analysis': [
    'Ratios, rates, proportional relationships, and units',
    'Percentages',
    'One-variable data: distributions and measures of center and spread',
    'Two-variable data: models and scatterplots',
    'Probability and conditional probability',
    'Inference from sample statistics and margin of error',
    'Evaluating statistical claims: observational studies and experiments',
  ],
  'Geometry and Trigonometry': ['Area and volume', 'Lines, angles, and triangles', 'Right triangles and trigonometry', 'Circles'],
};

export const ACT_TAXONOMY: Record<string, Taxonomy> = {
  english: {
    'Production of Writing': ['Topic Development', 'Organization, Unity, and Cohesion'],
    'Knowledge of Language': ['Word Choice', 'Style and Tone'],
    'Conventions of Standard English': ['Sentence Structure and Formation', 'Punctuation', 'Usage'],
  },
  math: {
    'Preparing for Higher Math': ['Number and Quantity', 'Algebra', 'Functions', 'Geometry', 'Statistics and Probability'],
    'Integrating Essential Skills': ['Rates and Percentages', 'Proportional Relationships', 'Area and Volume', 'Averages and Medians'],
    Modeling: ['Creating Models', 'Interpreting Models'],
  },
  reading: {
    'Key Ideas and Details': ['Central Ideas and Themes', 'Close Reading', 'Sequential and Cause-Effect Relationships'],
    'Craft and Structure': ['Word and Phrase Meaning', 'Purpose and Point of View', 'Text Structure'],
    'Integration of Knowledge and Ideas': ['Arguments and Claims', 'Multiple Texts'],
  },
  science: {
    'Interpretation of Data': ['Reading Tables and Graphs', 'Trends and Interpolation'],
    'Scientific Investigation': ['Experimental Design', 'Controls and Variables'],
    'Evaluation of Models, Inferences, and Experimental Results': ['Competing Viewpoints', 'Predictions and Conclusions'],
  },
};
