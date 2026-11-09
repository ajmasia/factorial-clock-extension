---
type: spec
title: Spec — Undo an applied week
description: WHAT and WHY for remembering the shifts each applied week created, showing the per-day result in History, and undoing a week by deleting exactly those shifts.
tags: [sdd, spec, history, factorial]
timestamp: 2026-11-09T11:00:00Z
topic: sdd
slug: undo-applied-week
issue: 18
status: planned
---

# Spec — Undo an applied week

> Slug: `undo-applied-week` · Status: implemented in PRs #37 and #40, released in v0.1.12 · Created: 2026-11-09 · Issue: #18
> Inherits: [constitution](../constitution.md) — still a draft, so no principles are inherited (see Points to clarify).
> Scope decisions 1–4 and 6 were delegated by the user to the agent («Decide tú», 2026-11-09) and are recorded as
> *suposición tomada* below. Approved by the user on 2026-11-09 after reading the revised spec: «si» (to «¿apruebas la
> spec para que empiece el PR 1?»). Delivered in two PRs: PR 1 stores identifiers and per-shift results; PR 2 adds undo.

## Problem & why
When a generated week is applied, Factorial returns the identifier of every shift it creates, and the extension
throws those identifiers away. If a week was applied by mistake — wrong week, wrong configuration, a bug like #11
or #12 — the user has to find and delete each shift by hand in Factorial, up to eight per week. History only says
"applied" and a shift count; it does not say which days succeeded and which failed, so a partial apply is
invisible afterwards.

## Cost of not building it
Every wrong apply costs several minutes of manual deletion in Factorial, with the risk of deleting the wrong
shift or leaving one behind in an official attendance record. Partial failures (overlaps, a lost session) leave
no trace in History, so the user cannot tell later what was actually recorded.

## The cheapest alternative
Keep deleting shifts by hand in Factorial, and use Factorial's own attendance view to see what was recorded. It
works today and needs no change. It is not enough because the extension's own History stays wrong for partial
applies, and manual deletion of up to eight shifts per mistake is exactly the kind of repetitive work the
extension exists to remove.

## Goals
- Every week applied from now on remembers, per shift, which shifts were created and which failed (a split day has two shifts).
- History shows that per-day result for each applied week.
- The user can undo an applied week from History, which deletes in Factorial exactly the shifts that week created
  and nothing else.

## Non-goals / out of scope
- Undoing single days — deferred (decision 2).
- Undoing weeks applied before this version: they have no stored shift identifiers (decision 3).
- Showing shifts that already exist in Factorial before applying — #19 (decision 1).
- Deleting any shift the extension did not create, or "all shifts of a week".
- Editing shifts in Factorial.
- Syncing history across devices (history is local since #4).

## Users & context
The extension user (an employee who records attendance in Factorial), working from the popup's History tab after
applying a week from the Generate tab, logged in to Factorial in the same browser.

## What the user can do
- After applying a week, see in History, per day, whether its shifts were created.
- Undo an applied week from its History entry, after confirming, when the entry has stored shift identifiers and
  is not already fully undone.
- Retry an undo that only partly succeeded.
- Not allowed: undo an entry with no stored shift identifiers (older versions); undo while logged out of
  Factorial succeeds for no shift and says so.

## What result they get
- A History entry lists each day of the week with its shifts and their result: for example "2/2 created", or
  "1/2 created" with the reason Factorial gave for the failed one (for example an overlap).
- After a successful undo, the entry shows as undone, and those shifts no longer appear in Factorial's attendance
  view for that week.
- After a partial undo, the entry shows which shifts could not be deleted and offers to retry.
- Reference for approval: this textual description; the History layout follows the existing card style. A screen
  sketch is not required for this change (recorded as *suposición tomada*).

## What it must respect
- Only shifts whose identifiers the extension stored when it created them can be deleted (safety rule).
- Applying a week keeps working exactly as today, including the overlap and authentication messages (#2, #9).
- History stays in `chrome.storage.local` with the 50-entry limit and the migration from #4; older entries keep
  showing as today.
- The user confirms before any deletion; nothing is deleted automatically. The confirmation lists the shifts to
  delete with the times they were created with, and warns that they are deleted even if edited in Factorial since.
- An undo continues and records its result even if the popup closes; the same entry cannot be undone twice at the
  same time, and History shows an undo in progress as such.
- When an entry drops off the 50-entry History limit, its stored identifiers go with it and that week can no
  longer be undone from the extension (accepted).
- The total weekly hours and the generator are unchanged (#12, #13).
- Personal data (employee ID, credentials) is not logged or published.

## How it proves it
- Automated tests of the history entry with per-day results and stored identifiers, of the undo selection (only
  stored identifiers, retry of what is left), and of older entries without identifiers.
- Manual test in Chrome on a throwaway week: apply, check History per-day results, undo, and check in Factorial's
  attendance view that exactly those shifts are gone and any manual shift in the same week is untouched.
  Evidence: the steps and outcomes recorded in the feature document.

## Behaviour
- Main path: apply a week → each created shift's identifier is stored with its day → History shows the per-day
  result → the user undoes the week → after confirming, each stored shift is deleted in Factorial → the entry
  shows as undone.
- Edge cases: a week where some days failed to apply (only the created shifts can be undone); an entry already
  undone (no undo action); an older entry without identifiers (no undo action, as today); a shift already deleted
  by hand in Factorial (counts as removed, not as an error).
- Error paths: logged out of Factorial → nothing is deleted and the user is told to log in; some deletions fail →
  the entry shows them and offers retry; Factorial rejects the deletion for a reason → the reason is shown.

## Acceptance criteria
- Given a week applied with this version, When the user opens History, Then each day of that entry shows created
  or failed, with the number of shifts or the failure reason.
- Given an applied entry with stored identifiers, When the user confirms "Undo week", Then exactly the stored
  shifts are deleted in Factorial and the entry shows as undone.
- Given the same week also contains a shift the user added manually in Factorial, When the week is undone, Then
  that manual shift still exists.
- Given an undo where some deletions fail, When it finishes, Then the entry lists the shifts not deleted and
  offers to retry only those.
- Given a History entry created before this version, When the user opens History, Then it shows as today and has
  no undo action.
- Given the user is logged out of Factorial, When they undo a week, Then no shift is deleted, the entry is
  unchanged, and they are told to log in.
- Given the user opens "Undo week" and cancels the confirmation, When the dialog closes, Then no shift is deleted
  and the entry is unchanged.
- Given an undo is in progress for an entry, When the user tries to undo the same entry again, Then no second undo
  starts.
- Given the popup is closed during an undo, When it is reopened, Then History shows the undo's final result.
- Given a stored shift was already deleted by hand in Factorial and other shifts of the week still exist, When the
  week is undone, Then that shift is shown as not found (probably deleted already), not as a failure.
- Given Factorial answers every deletion of an undo as not found, When the undo finishes, Then it is reported as
  "Factorial did not find these shifts" and the user can confirm "Mark as removed" after checking Factorial; only
  then is the entry marked undone.
- Given Factorial rejects a deletion with a reason, When the undo finishes, Then that shift is listed as not
  deleted with the reason.

## Points to clarify
- **suposición tomada** — answered on 2026-11-09 (captured by the user from the Factorial console and web app): how Factorial answers a
  deletion. Operation `attendanceMutations.deleteAttendanceShift(id)`; for this API the `id` argument is an integer
  (`Int!`; `ID!` is rejected with `variableMismatch`). Success: `errors: []` and `shift` is the deleted shift with
  the same `id`. A shift that no longer exists: `errors: [{ type: "malformed_request", code: null, message:
  <localised> }]` and `shift: null` — the same answer as a malformed request.
- **suposición tomada** — a deletion counts as done only with no errors and `shift.id` equal to the requested
  identifier. `malformed_request` with `shift: null` is shown as "not found in Factorial (probably deleted already)"
  and not as a failure, **unless every shift of the undo answers that way**: then it is reported as "Factorial did
  not find these shifts", nothing is marked undone, and the user can confirm "Mark as removed" after checking
  Factorial (the user pointed out that a week may already be deleted by hand, 2026-11-09). *Base:* Factorial does not distinguish "not
  found" from a malformed request; a broken request is far likelier than a whole week deleted by hand (decided by
  the agent under the user's delegation). *Riesgo:* a week whose shifts were all deleted by hand needs one extra
  confirmation from the user.
- **suposición tomada** — Factorial returns `clockIn`/`clockOut` with the current date and `+00:00` but the right
  wall-clock time (for example a shift dated 2026-11-06 comes back as `2026-11-09T07:31:00+00:00`), while the
  extension sends `2026-11-06T07:31:00+01:00`. *Base:* observed on 2026-11-09; shifts appear on their day in
  Factorial. *Riesgo:* none for undo, which deletes by identifier and shows the times the extension stored.
- **suposición tomada** — scope is #18 alone, without #19. *Base:* delegated decision 1; #19 needs reading shifts
  from Factorial, a separate capability. *Riesgo:* low; #19 can reuse the stored identifiers later.
- **suposición tomada** — undo works per week, not per day. *Base:* delegated decision 2. *Riesgo:* a user who
  wants to undo one day must use Factorial for now.
- **suposición tomada** — entries from older versions get no undo. *Base:* delegated decision 3; without stored
  identifiers there is no safe way to know which shifts the extension created. *Riesgo:* none for data; older
  mistakes still need manual deletion.
- **suposición tomada** — a partial undo is shown and can be retried. *Base:* delegated decision 4. *Riesgo:* low.
- **suposición tomada** — no screen sketch is required as the approved reference; the textual result above is the
  reference. *Base:* small UI change inside an existing card. *Riesgo:* layout feedback arrives at the Chrome test.
- **suposición tomada** — a shift edited in Factorial after it was applied is still deleted by undo; the
  confirmation warns about it and lists the shifts with their original times. *Base:* checking for edits needs
  reading shifts from Factorial, which is #19 (decided by the agent after the fresh-eyes review, under the user's
  delegation). *Riesgo:* a user who edited a shift and ignores the warning loses that edit.
- **suposición tomada** — a week where no shift was created (for example, every day overlaps) is not recorded in
  History; the apply error already tells the user. A shift not attempted because an earlier shift of the same day
  failed is shown as *skipped*, not *failed*, so the apply messages keep their counts. *Base:* decided by the agent
  after the PR 1 review, under the user's delegation; retries of a failed week would otherwise push real entries
  out of the 50-entry limit. *Riesgo:* a fully failed apply leaves no trace in History.
- **suposición tomada** — an undone entry stays in History, marked "undone", until the user deletes it. *Base:*
  user decision on 2026-11-09, following the agent's recommendation: it records what was deleted from an
  official attendance record, partial undos need the entry for "Retry undo", and History is capped at 50 entries.
  *Riesgo:* none.
- **decisión diferida** — verifying before deletion that a stored shift was not edited in Factorial; revisit with #19.
- **decisión diferida** — ratifying the project constitution (still a draft); this spec inherits no principles
  until then (delegated decision 6).

## Revisions
- 2026-11-09 — after a fresh-eyes review: results per shift instead of per day; confirmation lists the shifts and
  warns about later edits; undo survives the popup closing and cannot run twice; 50-entry limit accepted; added
  acceptance criteria for cancel, concurrent undo, popup closing, already-deleted shifts and rejected deletions.
