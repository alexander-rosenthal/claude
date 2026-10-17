# Test Grader

Grades SAT and ACT practice tests and produces a score report built around the data.

```
npm install
npm run dev      # local app
npm test         # unit tests (grading engine + parsers)
npm run build    # typecheck + production build
```

## How it works

```
ExamFormat (sections, choices, scales)  ─┐
                                         ├─ buildExam ─► Exam ─┐
AnswerKey (answers + categories)        ─┘                     ├─ grade ─► GradeReport ─► ScoreReport UI
                                                               │
Bubble sheet / Paste / Upload ─► AnswerCollector ─► Responses ─┘
```

- **`src/core`** has no UI dependencies. It covers the data model, answer matching, raw-to-scaled conversion, and the grader.
  - Multiple-choice answers are compared after normalizing case and punctuation. A number like `3` means the third choice. ACT answers typed with the wrong letter set (`A` on an F–J question) map to the same position.
  - SAT grid-in answers are matched by exact rational value, so `3/2`, `1.5` and `1.50` are all equal. Rounded or truncated decimals are accepted when they fill the answer field, per College Board rules (`.6666`, `.6667`, `0.666` and `0.667` for 2/3).
  - Categories and subcategories live only on the answer key and are used only by the report.
- **`src/exams`** holds:
  - the formats: digital SAT (Bluebook, 27/22-question modules), the digital SAT's paper version (33/27-question modules), enhanced ACT for 2025 onward, and legacy ACT;
  - the official reporting-category vocabulary;
  - the official key and conversion table for **paper SAT Practice Test 4** (`src/exams/keys`), with score ranges;
  - seeded **placeholder demo keys** for trying out the tool.
- **`src/parsers`**: every input method goes through `AnswerCollector`, so they all follow the same rules for sections, restarting question numbers, running numbers and blanks.
  - Paste accepts section headings, numbered answers (`1. A`, `2) B`, `3 C 4 D`), letter runs (`ABCD-AB`), and tab-separated rows.
  - **Bluebook score details** (Question / Section / Your Answer / Domain) are pasted as already-graded results: Bluebook lists Correct/Incorrect rather than the letter chosen. The domain becomes each question's category, and no answer key is needed. A restart in question numbering marks Module 2. A sample paste is in `src/parsers/fixtures`.
  - Upload reads `.xlsx`, `.csv` and `.tsv`. It accepts header-based columns (Section / Question / Answer), headerless columns, or a single column of answers.
  - Answer keys are imported from a spreadsheet with the columns `Section, Question, Answer, Category, Subcategory`. A template can be downloaded from the app. Imported keys are saved in the browser's localStorage.

## Known gaps

- **Digital SAT scores are estimates.** Bluebook scores the adaptive test with item response theory, which isn't published. The estimate applies the official paper Practice Test 4 table, matched on percent correct. Paper tests with an official table (`ScoreScale.ranges`) report the official range. ACT conversions are still a generic estimate.
- The paper Practice Test 4 key has no question categories, because the scoring guide doesn't list them.
- Bluebook pastes give main domains only, not skills (subcategories).
