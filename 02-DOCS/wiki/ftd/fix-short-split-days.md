---
author: Antonio Masiá
branch: 12-short-days-with-split-shifts-generate-invalid-shifts
status: done
---
# Fix: short days with split shifts generate invalid shifts (#12)

## Intent

When a split day's target is shorter than the time from clock-in to lunch, the afternoon block became
0 minutes and the last day got a negative duration. Decision (user, 2026-11-09, option A): a day stays
split only if at least 60 minutes of work remain after lunch; otherwise it becomes a continuous day.
Refinement agreed in the same exchange: the lunch start is first chosen within the configured lunch range so
that 60 minutes remain; the day becomes continuous only when even the earliest lunch in the range leaves less
than 60 minutes. Normal 40 h weeks keep their split days; short weeks become continuous.

## Scope

In:
- `generateDailySchedule` in `src/lib/scheduler.js`: cap the lunch start so the afternoon is ≥ 60 min, within
  the configured range; fall back to continuous when impossible.
- Weekly total exact on split last days: the 1-3 min anti-match adjustment now changes the lunch length
  (within the configured duration range) instead of adding work. Pre-existing; found by the new tests.
- Tests: remove `.fails` from the #12 test; add invariants (split afternoon ≥ 60 min, lunch inside the
  configured range) and the default-week split pattern over many runs.

Out:
- Moving lunch outside the configured range (option B, rejected).
- Configurable minimum afternoon (fixed at 60 min).
- #13 (special week ranges).

## Checklist

- [x] #12 test passes without `.fails` — proof: `npm test`.
- [x] Split days keep ≥ 60 min after lunch and lunch inside the configured range — proof: invariant tests over many runs and configs.
- [x] Default 40 h week still splits Mon–Wed — proof: test over many runs.
- [x] Full suite, build, CI — proof: `npm test`, `npm run build`, PR check.

## Evidence

- `npm test` → 35 passed; 10 consecutive runs, all green. The #12 test passes without `.fails`.
- New tests found a pre-existing total error: with every day split, main gives weekly totals up to
  +34 min at 40 h (2,000 runs); the branch now gives exactly 2400 / 2700 at 40 / 45 h.
- Reviewer (refuter-tests, mutants on a scratch copy): no code defect; 7 surviving mutants
  (MIN 59/61, `<=` fallback, `< max`, `> min`, no min check, no +1 clamp). Added deterministic tests of
  `generateDailySchedule` (single-value ranges, `Math.random` stubbed only for lunch length and adjustment).
  Re-run of the 7 mutants → each fails 1–4 tests.
- Accepted trade-off (pinned by a test): with a fixed lunch length (min = max), the checkout may keep the
  check-in minute; worked minutes stay exact.
- Build passes; `rsc risk` → tier 1.

## Next

Merged in PR #34, released in v0.1.10 (2026-11-09).
