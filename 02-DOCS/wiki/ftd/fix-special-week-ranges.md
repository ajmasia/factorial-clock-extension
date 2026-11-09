---
author: Antonio Masiá
branch: 13-special-week-ranges-only-apply-to-the-week-of-their-start-date
status: in-progress
---
# Fix: special week ranges only apply to the week of their start date (#13)

## Intent

A `special_week` exception with `date … endDate` spanning several weeks only applied to the week containing
`date`: the lookup ignored `endDate`. Apply a special week to every week its range overlaps.

Decisions (taken by the agent, following existing behaviour; open to the user's veto before merge):
- Any overlap with the week applies the special week to the whole week, as a single-date special week
  already does.
- When several special weeks overlap the same week, the one covering the most days of that week wins; on a
  tie, the one starting later (the more specific one). Before, the first one in storage order won.

## Scope

In:
- `src/lib/scheduler.js`: the special week lookup in `generateWeeklySchedule`.
- Tests: remove `.fails` from the #13 test; cover the first, middle and last week of a range, a range ending
  on the week's Monday, no overlap, and the overlap tie-break.

- `ExceptionsPage.jsx`: show the end date for special weeks too (add and edit forms). Before, the picker
  was hidden, so ranged special weeks could only appear by switching the type of a ranged exception, and
  that endDate stayed invisible. Decision (user, 2026-11-09, option A).

Out:
- Partial-week hours (prorating a special week that covers only some days).

## Checklist

- [x] #13 test passes without `.fails` — proof: `npm test`.
- [x] Every overlapped week uses the special week; others do not — proof: range tests.
- [x] Tie-break between overlapping special weeks — proof: test.
- [ ] Full suite, build, CI — proof: `npm test`, `npm run build`, PR check.

## Evidence

- `npm test` → 44 passed (5 consecutive runs green). #13 test passes without `.fails`.
- Mutants on a scratch copy (ignore endDate, inverted tie-break, no tie rule, first match wins, exclusive end)
  → each fails 1–5 tests.
- Reviewer (refuter-correctness): no blockers. Fixed: an inverted range (endDate < date, only from
  hand-edited storage) falls back to its single date, as before. Added tests: a range across the turn of the
  year, a holiday inside a special week range (30 h → 24 h), the inverted range. Found that the form hid
  the end date for special weeks → option A above.
- Real extension (2026-11-09, user, unpacked build): special week 2026-11-02 … 2026-11-22 at 30 h created
  from the form; week of 2026-11-09 generated 30h 0m, week of 2026-11-23 back to the normal hours.
- Build passes; `rsc risk` → tier 1. The reviewer covered the scheduler change; the form change (two pickers
  made visible) was verified by the user's Chrome test.

## Next

Commit with `Fixes #13`, bump to 0.1.11, PR and CI.
