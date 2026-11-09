---
author: Antonio Masiá
branch: 14-add-unit-tests-for-the-schedule-generator
status: in-progress
---
# Unit tests for the schedule generator (#14)

## Intent

The project has no tests. `src/lib/scheduler.js` is pure functions, and #12 and #13 were only found by
running it by hand. Add Vitest and tests that pin today's behaviour, check the generator's invariants over
many random runs, and record #12 and #13 as known failures so their fixes flip them.

## Scope

In:
- `vitest@2.1.9` as a dev dependency (works with Vite 5) and an `npm test` script.
- `src/lib/scheduler.test.js`: helpers, `isWorkDay` (including #1), weekly invariants, totals, and
  `it.fails` cases for #12 and #13.

Out:
- Fixing #12 and #13 — their own PRs.
- React tests for #11 — needs a DOM setup; its own PR.
- CI on pull requests — #15.

## Checklist

- [x] Vitest installed — proof: `npm ls vitest` shows 2.1.9 and `npm test` runs.
- [x] Tests pass — proof: `npm test` output, with #12 and #13 reported as expected failures.
- [x] Known-bug tests catch the bugs — proof: the #12 and #13 assertions fail when run as normal tests.
- [x] Build still passes — proof: `npm run build` exits 0 and the test file is not in `dist/`.

## Evidence

- `npm ls vitest` → `vitest@2.1.9` (devDependency, exact); it uses the project's `vite@5.4.21`.
- `npm test` → `Test Files 1 passed (1)`, `Tests 18 passed (18)`. #12 and #13 are `it.fails`.
- Known-bug check: same file with `.fails` removed, run with `-t "#1[23]"` →
  #12 `expected [ …(1166) ] to deeply equal []` (1,166 invalid days in 300 weeks);
  #13 `expected 2400 to be 1800`. Both fail for their own bug.
- Stability: 20 consecutive `vitest run` → 20 × `Tests 18 passed (18)`.
- Build: `npm run build` → `✓ built in 1.23s`; no test code in `dist/`.
- `rsc risk` → tier 1, 1 reviewer, no human approval required.
- Reviewer (refuter-tests, fresh context): 17 mutants of `scheduler.js`, 4 survived, no blockers.
  Added 5 tests: a 4-day week (daily base from `workDays.length`), split days only on configured days,
  variance on a non-last day, split days never end on their start minute, special week without `splitDays`
  falls back to the global ones; #12 now also asserts the 25 h total.
  Re-run of the surviving mutants on a scratch copy: `configuredWorkDays = 5`, `varianceMinutes = 0` and
  `if (false)` on the minute adjustment → 1 test fails each; inverted split detection → 7 fail.
  Not added (noted for later): direct tests of `generateDailySchedule` ranges, `formatScheduleForDisplay`,
  `getDayName`, checkout past 24:00.

## Next

Open the PR; after merge, #15 runs these tests on every pull request.
