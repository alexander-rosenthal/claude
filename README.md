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
  - Questions are classified as **domain → skill → subskill**. Each question has one domain and any number of (skill, subskill) tags, because one question can test several skills. Classification lives only on the answer key and is used only by the report.
  - The report rates every domain, skill and subskill by accuracy: **mastered** at 80% or more, **for review** at 50–79%, **for instruction** below 50%. Thresholds are in `MASTERY_THRESHOLDS`.
- **`src/exams`** holds:
  - the formats: digital SAT (Bluebook, 27/22-question modules), the digital SAT's paper version (33/27-question modules), enhanced ACT for 2025 onward, and legacy ACT;
  - the official reporting-category vocabulary;
  - built-in keys (`src/exams/keys`):
    - **SAT Practice Test 4 — Bluebook**: answers plus skill tags, from a tutoring-platform report. Module 2 is the version reached after a strong Module 1. Its figures are reproduced exactly in `grader.test.ts`.
    - **SAT Practice Test 4 — paper version**: the College Board's official key and conversion table, with score ranges;
  - seeded **placeholder demo keys** for trying out the tool.
- **`src/parsers`**: every input method goes through `AnswerCollector`, so they all follow the same rules for sections, restarting question numbers, running numbers and blanks.
  - Paste accepts section headings, numbered answers (`1. A`, `2) B`, `3 C 4 D`), letter runs (`ABCD-AB`), and tab-separated rows.
  - **Bluebook score details** (Question / Section / Your Answer / Domain) are pasted as already-graded results. Bluebook lists Correct/Incorrect rather than the letter chosen, and counts blanks as incorrect. The domain becomes each question's category, and no answer key is needed. A restart in question numbering marks Module 2. A sample paste is in `src/parsers/fixtures`.
  - If a real digital key for the same test is selected, the paste picks up its Module 1 correct answers and skill tags. Module 2 is adaptive, so the key's Module 2 is used only when the user confirms the student saw that version. The app warns if the pasted domains contradict that choice.
  - Upload reads `.xlsx`, `.csv` and `.tsv`. It accepts header-based columns (Section / Question / Answer), headerless columns, or a single column of answers.
  - Answer keys are imported from a spreadsheet with the columns `Section, Question, Answer, Domain, Skill, Subskill`. "Category" and "Subcategory" are accepted for Domain and Skill. To give a question several tags, repeat its row, or list `;`-separated skills paired with `;`-separated subskills. A template can be downloaded from the app. Imported keys are saved in the browser's localStorage.

## Known gaps

- **Digital SAT scores are estimates.** Bluebook scores the adaptive test with item response theory, which isn't published. The estimate applies the official paper Practice Test 4 table, matched on percent correct. Paper tests with an official table (`ScoreScale.ranges`) report the official range. ACT conversions are still a generic estimate.
- The paper Practice Test 4 key has no question categories, because the scoring guide doesn't list them.
- Bluebook pastes give domains only. Skills come from a tagged key, and only for the modules the key covers.
- The skill vocabulary in `src/exams/taxonomy.ts` covers only the topics Practice Test 4 tests. Other tests' keys can add more.
