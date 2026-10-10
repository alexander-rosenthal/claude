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
- **`src/exams`** holds the formats (digital SAT, enhanced ACT for 2025 onward, legacy ACT), the official reporting-category vocabulary, and seeded **placeholder demo keys** for trying out the tool.
- **`src/parsers`**: every input method goes through `AnswerCollector`, so they all follow the same rules for sections, restarting question numbers, running numbers and blanks.
  - Paste accepts section headings, numbered answers (`1. A`, `2) B`, `3 C 4 D`), letter runs (`ABCD-AB`), tab-separated rows, and Bluebook score-detail tables.
  - Upload reads `.xlsx`, `.csv` and `.tsv`. It accepts header-based columns (Section / Question / Answer), headerless columns, or a single column of answers.
  - Answer keys are imported from a spreadsheet with the columns `Section, Question, Answer, Category, Subcategory`. A template can be downloaded from the app. Imported keys are saved in the browser's localStorage.

## Known gaps

- **Scaled scores are estimates.** The digital SAT's adaptive scoring isn't published, and ACT conversion tables vary by form. Each `ScoreScale` takes a list of anchors, so an official table can be added as one anchor per raw score.
- **The Bluebook paste parser is written defensively** against the score-details table layout (Question / Section / Correct Answer / Your Answer). It needs to be checked against a real paste. When the pasted correct answers disagree with the loaded key, it warns that the wrong test may be selected.
- Only demo keys ship with the app. Real practice-test keys need to be imported.
