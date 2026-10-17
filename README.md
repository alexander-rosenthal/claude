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
    - **SAT Practice Test 4 — Bluebook**: answers plus skill tags for Module 1 and both Module 2 versions (harder and easier), from two tutoring-platform reports. Both reports' figures are reproduced exactly in `grader.test.ts`.
    - **SAT Practice Test 4 — paper version**: the College Board's official key and conversion table, with score ranges;
  - seeded **placeholder demo keys** for trying out the tool.
- **`src/parsers`**: every input method goes through `AnswerCollector`, so they all follow the same rules for sections, restarting question numbers, running numbers and blanks.
  - Paste accepts section headings, numbered answers (`1. A`, `2) B`, `3 C 4 D`), letter runs (`ABCD-AB`), and tab-separated rows.
  - **Bluebook score details** (Question / Section / Your Answer / Domain) are pasted as already-graded results. Bluebook lists Correct/Incorrect rather than the letter chosen, and counts blanks as incorrect. The domain becomes each question's category, and no answer key is needed. A restart in question numbering marks Module 2. A sample paste is in `src/parsers/fixtures`.
  - If a real digital key for the same test is selected, the paste picks up the key's correct answers and skill tags for Module 1 and for the routed Module 2 version (see below).
  - Upload reads `.xlsx`, `.csv` and `.tsv`. It accepts header-based columns (Section / Question / Answer), headerless columns, or a single column of answers.
  - Answer keys are imported from a spreadsheet with the columns `Section, Question, Answer, Domain, Skill, Subskill`. "Category" and "Subcategory" are accepted for Domain and Skill. To give a question several tags, repeat its row, or list `;`-separated skills paired with `;`-separated subskills. A template can be downloaded from the app. Imported keys are saved in the browser's localStorage.
- **`src/core/routing.ts`**: Module 2 routing for keys that hold both a harder and an easier version. Each section is routed on its own.
  1. **Cutoff.** Count Module 1 questions missed, with blanks counted as wrong. More than `MODULE_2_CUTOFFS` (RW 7, Math 5) means the easier Module 2.
  2. **Check.**
     - With answer letters (bubble sheet, letter paste, upload), Module 2 is graded against both versions. The other version wins if it scores at least 20 points higher, on 8 or more answers.
     - With a Bluebook results paste, the pasted Module 2 domains are compared with each version. The other version wins at 85% agreement or more with a 15-point lead. The two RW versions share a domain layout, so for RW the cutoff's guess stands and is labeled *inferred*.
  3. The report lists each section's version and how it was chosen: cutoff, confirmed by answers or domains, overridden by answers or domains, inferred, or chosen manually.
  
  The bubble sheet and Paste tabs offer a manual override: auto, harder, easier, and (on Paste only) domains only.
- **`src/core/calibration.ts`**: calibrating estimated scores against official ones.
  - Enter a student's official section scores (e.g. from Bluebook) before grading. The report then shows the official score with our estimate beside it.
  - Each such score is saved in the browser as a calibration point. A point records the test, scale, Module 2 version, raw score, official score and the questions missed, with no names.
  - Estimates are the conversion curve plus two corrections:
    - one pooled across all tests with the same Module 2 version;
    - one for the test itself.

    Each correction is a kernel-weighted average of nearby residuals, shrunk toward zero when there are few points, and the curve stays monotonic.
  - The panel under the test picker reports the typical error, measured by leaving one point out at a time. It can export, import or clear points.
  - Built-in points (`src/exams/calibrationData.json`) come from 78 anonymized tutoring-platform reports across 8 Bluebook practice tests: 156 section scores. They're extracted by `scripts/extract-nlt-report.mjs` into `data/nlt-reports.json`, then turned into points by `scripts/build-calibration.mjs`. That script also tells the Module 2 versions apart and reports how well each cutoff predicts the route.
  - Leave-one-out on those points:

    | | Average error | Within 20 points |
    |---|---|---|
    | Uncalibrated | ±42 | 39% |
    | Calibrated | ±13.5 | 87% |

## Known gaps

- **Digital SAT scores are estimates.** Bluebook scores the adaptive test with item response theory, whose parameters aren't published. The estimate applies the official paper Practice Test 4 table, matched on percent correct, then corrects it with whatever official scores have been collected for that Module 2 version and test. With the built-in points, the average error is about ±13.5 per section. It's larger for easier-route students, who are fewer in the data. Paper tests with an official table (`ScoreScale.ranges`) report the official range. ACT conversions are still a generic estimate.
- The paper Practice Test 4 key has no question categories, because the scoring guide doesn't list them.
- The Module 2 cutoffs are approximations. Bluebook's routing weighs question difficulty, and the harder-route sample student missed 8 in RW Module 1 yet got the harder module. The answer check catches such cases, but a Bluebook paste for RW can't be checked.
- Bluebook pastes give domains only. Skills come from a tagged key, and only for the modules the key covers.
- The skill vocabulary in `src/exams/taxonomy.ts` covers only the topics Practice Test 4 tests. Other tests' keys can add more.
