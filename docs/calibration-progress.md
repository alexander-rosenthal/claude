# Calibration data: progress notes

Save state for processing the batch of Next Level Tutors (NLT) Bluebook reports
(84 PDFs, uploaded as SATs.zip). If a session ends mid-way, resume from the
first unchecked step. Student names never go into the repo: reports are
identified by an anonymous id (hash of the report's answers).

Batch contents (by "Test Version" line): Bluebook SAT #4: 27, #5: 13, #6: 17,
#7: 14, #8: 2, #10: 2, "Digital SAT #1": 7, "Digital SAT #2": 2. Some files
are duplicates ("(1)" copies).

## Steps

- [x] 1. Extractor script (`scripts/extract-nlt-report.mjs`): pdftotext -layout
      → anonymized JSON per report (test, section scores, per-module correct
      answers, student answers, domain/skill tags).
- [x] 2. Run it on all reports; dedupe; commit the anonymized data
      (`data/nlt-reports.json`, one report per line: 78 unique of 84 files).
      Every grid's exact-match count equals the report's raw score, except 4
      PT4 easier-route reports where NLT scores Math out of 43 (one question
      dropped); we count all 44.
- [x] 3. Every report is now two calibration points (`scripts/build-calibration.mjs`
      → `src/exams/calibrationData.json`, 156 points). The PT4 key agrees with all
      25 PT4 reports. Leave-one-out error: ±42 uncalibrated → ±13.5 calibrated
      (87% within 20 points).
- [ ] 4. Other tests: build app keys from the grids (answers are in the data;
      skill tags would need the topic pages, not yet extracted). Versions seen:
      PT5 RW harder only; PT8 harder only; PT10 RW harder only.
- [x] 5. Points for other tests are in (they feed the pooled correction even
      without keys in the app).
- [ ] 6. Cutoffs: data favors more than 9 → easier for both sections (RW 2 of 78
      misrouted, Math 4 of 78) over 7/5 (10 and 16 misrouted). Waiting on the user.

## Findings so far

- Module 2 versions per test were told apart by clustering the Module 2
  answer keys. Module 1 misses by route (all tests): harder-route students
  missed up to 10 in RW Module 1 and up to 10 in Math Module 1; easier-route
  students missed at least 10 (RW) and at least 8 (Math). The cutoffs of 7 (RW)
  and 5 (Math) are too low.
- Rerun: `node scripts/extract-nlt-report.mjs data/nlt-reports.json <pdfs...>`
  (needs the original PDFs, which are not in the repo).

## Error floor (target: average error below 8)

- Students with the same test, Module 2 version and raw score get Bluebook
  scores up to 40 points apart (23 such groups). This holds even with the same
  Module 1 / Module 2 split, so Bluebook's score depends on which questions
  were answered (item response theory), not only how many.
- Pooled within-group SD is 14.1, so any raw-score model has an expected
  average error of about ±11, however much data it gets. Current: ±13.5.
- Weighting questions by observed difficulty made it worse (±14.6 → ±16.6 or
  higher in a leave-one-out test). That fits IRT: what makes a question count
  more is its discrimination, not its difficulty.
- Below ±8 needs an item-level (2PL/3PL) model per test, which conventionally
  needs several hundred to 1000+ students per question (per Module 2 version
  for Module 2 questions).

## Official score entry

- Official scores are optional for now. They become required automatically,
  along with a ±20 check against the estimate, once no more than 3% of
  leave-one-out estimates miss by more than 20 (`SCORE_CHECK`). Today: 13%.
- Every graded official score is saved in the browser and used for the next
  estimate. Sharing across users needs Export/Import, or a server later.
