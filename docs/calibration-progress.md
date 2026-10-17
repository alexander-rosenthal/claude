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
- [ ] 3. PT4: add every report as a calibration point; check the key and routing
      against all 27.
- [ ] 4. Other tests: build keys (both Module 2 versions where available).
- [ ] 5. Add points for other tests; measure leave-one-out error; report.

## Findings so far

- Module 2 versions per test were told apart by clustering the Module 2
  answer keys. Module 1 misses by route (all tests): harder-route students
  missed up to 10 in RW Module 1 and up to 10 in Math Module 1; easier-route
  students missed at least 10 (RW) and at least 8 (Math). The cutoffs of 7 (RW)
  and 5 (Math) are too low.
- Rerun: `node scripts/extract-nlt-report.mjs data/nlt-reports.json <pdfs...>`
  (needs the original PDFs, which are not in the repo).
