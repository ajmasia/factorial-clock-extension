---
spec: ../specs/undo-applied-week.md
branch: 18-store-created-shift-ids-and-allow-undoing-an-applied-week
status: in-progress
---
# Progress — Undo an applied week (#18)

## Plan — PR 1: store identifiers and per-shift results

Findings in the current apply loop (`service-worker.js`, `handleApplySchedule`):
- Errors are caught per day, so in a split day where shift 1 is created and shift 2 fails, shift 1's identifier is lost.
- An authentication error mid-week stops the loop and nothing that was created is recorded.
- History is saved by the popup after the apply; if the popup closes first, the identifiers are lost.

Design:
- `src/lib/apply-results.js` (pure, tested): `planShifts(day)` → the shifts of a generated day with their
  clock-in/clock-out; `buildHistoryEntry(scheduleData, days, now)` → the History entry with `days` (per shift:
  times, `id` or `null`, `status` created/failed, `error`) and `status` applied/partial/failed; `summarizeDays`.
- Service worker: create shifts one by one, record each result, and save the History entry itself (in `local`,
  through `history-storage.js`) whenever at least one shift was attempted, including when an authentication
  error stops the loop. A failed history save is logged and reported in the response; it never turns a
  successful apply into "Failed to apply" (related to #8). The user-facing messages of the apply stay as today.
- Popup: `GeneratePage` no longer saves History (the service worker does); it shows the history warning from the
  response. The `saveToHistory` message and its handler are removed.
- `HistoryPage`: for entries with `days`, show "created/total shifts" and, expanded, each shift with its times and
  result or failure reason; status badge applied/partial/failed. Older entries render as today.

## Tasks

| # | Task | Criterion | Done-check |
| --- | --- | --- | --- |
| 1 | `apply-results.js` + tests | AC1 (data) | `npm test` covers split/continuous plans, statuses, summary |
| 2 | Service worker records per-shift results and saves History | AC1 | code review + Chrome test |
| 3 | Popup stops saving History, shows warning | AC1 | Chrome test |
| 4 | History shows per-shift results; old entries unchanged | AC1, AC5 | Chrome test |

## Evidence

- PR 1: `apply-results.test.js` (10 tests); `npm test` → 54 passed; build passes; `rsc risk` → tier 1.
- Reviewer (refuter-correctness): no blockers. Fixed: skipped shifts counted as failed (messages changed vs
  main) → new `skipped` status; weeks with nothing created were recorded → only weeks with ≥ 1 created shift
  are recorded; spurious history warning when nothing had to be recorded → `historySaved: null`; a created
  shift without an identifier became `"undefined"` → stored as `null` (cannot be undone).
  Accepted: identifiers live in memory until the loop ends; if Chrome stopped the service worker mid-apply they
  would be lost (it does not while a message is pending).
- Real extension (2026-11-09, user, unpacked build): applied an empty future week → History entry green with
  `8/8 shifts` and the 8 shifts listed as created; applying the same week again → overlap alert and no new
  History entry. The test shifts were deleted by hand in Factorial.

## Decision queue

- PR 2 (undo) waits for the response bodies of `DeleteAttendanceShift` (success and not found).
