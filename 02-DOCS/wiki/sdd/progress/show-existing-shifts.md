---
spec: ../specs/show-existing-shifts.md
branch: 19-show-existing-shifts
status: done
---
# Progress — Show existing Factorial shifts before applying (#19)

## Plan

- `src/lib/existing-shifts.js` (pure, tested): group Factorial's shift nodes by `date` (times from the HH:MM of
  `clockIn`/`clockOut`), default inclusion per day, dates to apply.
- Content script `readShifts`: read-only `attendance.employee(id: Int!).attendanceShiftsConnection(startOn, endOn)`.
- Service worker: on generate, `checkExistingShifts` with a 15 s limit, using only an already open and ready
  Factorial tab; on apply, `includedDates` → excluded days recorded with the new shift status `excluded`.
- Generate: per-day "Already in Factorial" with "Apply this day anyway", notice when not checked, Apply disabled
  when no day is included, confirmation counts skipped days. History: "skipped: already in Factorial".
- Version 0.1.13.

## Evidence

- Read query captured on 2026-11-09 with Claude in Chrome on the user's attendance view (read-only; only the shape
  recorded): two real weeks, 8 and 6 shifts, every `date` in range, `clockIn` date never equal to `date`.
- `npm test` → 102 passed (`existing-shifts.test.js`: 10; `apply-results.test.js`: excluded status). Build passes;
  content script import-free. `rsc risk` → tier 1.
- Reviewer (refuter-correctness): no blockers. Fixed: the check reused the apply tab logic, which could leave a
  background Factorial tab on every Generate and reload the user's tab → it now only uses an already open, ready
  tab and never creates or reloads one; the credentials response (personal data) was logged → removed; the employee
  id is read with `parseInt` as in apply. Accepted: History keeps the full week's `totals` even when days are
  excluded (counts and status are right).
- Real extension (2026-11-09, user, unpacked 0.1.13, Factorial open in a tab): a shift added by hand on the
  Wednesday of an empty future week; generating showed it as "Already in Factorial" with the day unchecked; Apply
  confirmed 1 skipped day; Factorial got the other days and only the manual shift on Wednesday; History showed the
  entry as applied and Wednesday as "skipped: already in Factorial". Reported by the user as all correct.

## Decision queue
