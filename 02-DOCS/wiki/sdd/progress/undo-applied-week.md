---
spec: ../specs/undo-applied-week.md
branch: 18-store-created-shift-ids-and-allow-undoing-an-applied-week
status: done
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

## Plan — PR 2: undo a week

- `src/lib/undo.js` (pure, tested): targets (created + safe integer id + not already deleted/not found),
  classification of Factorial's answer, the "all not found" rule, outcome per shift, retry, user confirmation
  ("Mark as removed") for a week already deleted by hand (raised by the user, 2026-11-09).
- Content script `deleteShift`: minimal mutation with `$id: Int!`; returns `fatal` for HTTP errors, non-JSON
  answers (login page) and GraphQL-level errors, which stop the undo and are never read as "not found".
- Service worker `undoWeek` / `markUndoRemoved`: in-memory lock plus an in-progress marker in History (stale
  after 10 min), one deletion at a time, result recorded in History; nothing deleted on a fatal stop → entry
  restored and the user told why.
- History: Undo week / Retry undo / Mark as removed, confirmation listing the shifts with their times and the
  warning about later edits, per-shift undo result; no delete while an undo runs. Version 0.1.12.

## Evidence — PR 2

- `npm test` → 90 passed (undo.test.js: 31); build passes; content script still import-free.
- Reviewer (refuter-correctness): no path deletes a shift the extension did not create. Fixed: ids beyond
  `Number.MAX_SAFE_INTEGER` or non-digit ids could be rounded to another shift → only exact safe integers are
  sent; concurrent undos of one entry → in-memory lock set before any await; logged-out answers without HTTP 401
  (login page, GraphQL error) were not detected → `fatal` stops the undo and restores the entry if nothing was
  deleted; deleting an entry during an undo lost its result → blocked, and the delete re-reads History;
  "Mark as removed" offered during a running undo → hidden. Accepted: History writes from apply and undo can
  race (last writer wins), the same as before.
- Reviewer (refuter-tests, 40 mutants): 9 survived, including the CREATED-status safety rule. Added pinned tests;
  re-run of 8 survivors on a scratch copy → each fails a test. Unreadable undo start times no longer block an
  entry forever. Not automated (covered by the Chrome test): real deletion in Factorial, the manual shift that
  must survive, logged out, cancel, popup closing, UI wording.
- Real extension (2026-11-09, user, unpacked 0.1.12): applied an empty future week, added a shift by hand in the
  same week and deleted one of the extension's shifts by hand. Cancel in the confirmation changed nothing. Undo
  week deleted every remaining extension shift in Factorial (confirms `deleteAttendanceShift` with an `Int!` id
  on existing shifts), the manual shift survived, History showed the hand-deleted shift as "not found", the
  others as "deleted", and the entry as undone. Reported by the user as working perfectly.

## Decision queue

- (resolved) The response bodies of `DeleteAttendanceShift` were captured on 2026-11-09; see the spec.
