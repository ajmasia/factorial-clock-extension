---
type: spec
title: Spec — Show existing Factorial shifts before applying
description: WHAT and WHY for showing, on the generated week, the days that already have shifts in Factorial, and skipping them when applying.
tags: [sdd, spec, generate, factorial]
timestamp: 2026-11-09T14:00:00Z
topic: sdd
slug: show-existing-shifts
issue: 19
status: planned
---

# Spec — Show existing Factorial shifts before applying

> Slug: `show-existing-shifts` · Status: draft · Created: 2026-11-09 · Issue: #19
> Inherits: [constitution](../constitution.md) — still a draft, so no principles are inherited (see Points to clarify).
> Decisions 1–4 delegated by the user to the agent («decide tú con las preguntas», 2026-11-09), recorded as
> *suposición tomada*. Approved by the user on 2026-11-09 after reading the spec: «Adelante» (to «¿apruebas la
> spec?»).

## Problem & why
When some days of a week already have shifts in Factorial — recorded by hand, by an earlier partial apply, or
by remote-work tooling — the user only finds out when applying: Factorial rejects those days with an overlap
error, the alert says that some shifts failed, and the user has to work out which days were affected. Nothing is
duplicated, but the user cannot see the situation before deciding, nor apply only the free days cleanly.

## Cost of not building it
Every week with already-recorded days ends in an error alert and a partial History entry, and the user has to
check Factorial to understand what happened. The cost is confusion and a few minutes per affected week; no data
is lost or duplicated, because Factorial rejects overlaps.

## The cheapest alternative
Check Factorial's attendance view before applying and add those days as exceptions in the extension, or simply
apply and read the overlap errors. It works today. It is not enough because it moves the check to a different
tool and to after the fact, and exceptions meant for holidays get misused for "already recorded" days.

## Goals
- When a week is generated, the user sees which of its days already have shifts in Factorial, with their times.
- When the week is applied, days that already have shifts are skipped by default, so only free days are created.
- The user can still choose to include a day that already has shifts.

## Non-goals / out of scope
- Verifying before an undo that stored shifts were not edited in Factorial — deferred (decision 4).
- Editing or deleting existing Factorial shifts from the extension.
- Merging generated times around existing shifts (for example filling the gap after a morning shift).
- Showing existing shifts anywhere other than the generated week.

## Users & context
The extension user, on the Generate tab, after generating a week and before applying it, logged in to Factorial
in the same browser.

## What the user can do
- Generate a week and see, per day, whether Factorial already has shifts that day and at what times.
- Leave days with existing shifts excluded (default) or include any of them before applying.
- Apply the week: only the included days are sent to Factorial.
- If the check cannot run (no Factorial session or tab), still generate and apply as today, with a notice that
  existing shifts could not be checked.

## What result they get
- Each generated day shows "already in Factorial: 07:30–15:00" (one line per existing shift) and an include
  checkbox, unchecked by default for those days.
- The apply confirmation and the result count only the included days; skipped days are listed as skipped.
- History records skipped days as skipped (not as failed), so the entry is "applied" when every included day
  was created.
- Reference for approval: this textual description; the layout follows the existing day rows of Generate.

## What it must respect
- Applying, History per shift and undo (#18) keep working as today; skipped days have no shifts to undo.
- The overlap handling of #38 stays: an included day that overlaps is rejected by Factorial and reported as
  today.
- Reading shifts never changes anything in Factorial.
- Generation does not wait indefinitely for Factorial: if the check fails or is slow, the week is still shown.
- Personal data is not logged or published.

## How it proves it
- Automated tests of the per-day decision (existing shifts → excluded by default; include toggles; skipped days
  in History and counts) and of reading Factorial's answer into per-day shifts.
- Manual test in Chrome: a week with a shift added by hand on one day; generate → that day shows the existing
  shift and is unchecked; apply → only the other days are created, History shows that day as skipped; include it
  and apply again in a fresh week → Factorial rejects the overlap as today. Evidence recorded in the progress log.

## Behaviour
- Main path: generate → the extension asks Factorial for the week's shifts → days with shifts show them and are
  unchecked → apply → only checked days are created → History shows skipped days.
- Edge cases: a day with several existing shifts; existing shifts outside the generated work days (shown only
  for generated days); a week with every day already recorded (nothing to apply; Apply disabled with a message).
- Error paths: no Factorial session or tab, or Factorial's answer cannot be read → the week is shown without the
  check and with a notice; applying then behaves as today.

## Acceptance criteria
- Given a generated week where one day already has a shift in Factorial, When the week is shown, Then that day
  lists the existing shift's times and its include checkbox is unchecked.
- Given that week, When the user applies it without changing anything, Then no shift is sent for that day and
  History shows it as skipped while the other days are created.
- Given the user checks a day that already has shifts, When the week is applied, Then that day is sent and, if it
  overlaps, Factorial's rejection is shown as today.
- Given every generated day already has shifts, When the week is shown, Then Apply is disabled with a message.
- Given the extension cannot read Factorial's shifts, When a week is generated, Then it is shown with a notice and
  every day checked, and applying behaves as today.
- Given a day with no existing shifts, When the week is shown, Then nothing changes for that day.

## Points to clarify
- **suposición tomada** — answered on 2026-11-09 (captured by the agent with Claude in Chrome on the user's
  Factorial attendance view, read-only, no values recorded): Factorial's page reads shifts with
  `attendance.employee(id).attendanceShiftsConnection(startOn, endOn).nodes`. For this API `employee(id)` takes an
  integer (`Int!`; an `ID!` variable is rejected with a type mismatch). Each node has `id` (number), `date` and
  `referenceDate` (`YYYY-MM-DD`), `clockIn`/`clockOut` (ISO datetime with offset), `minutes` and `workable`. In
  two real weeks every node's `date` was inside the requested range, and the date part of `clockIn` never matched
  `date` (Factorial returns the current date with the shift's wall-clock time, as seen in #18). *Base:* the day of a
  shift is its `date`; its displayed times are the `HH:MM` of `clockIn`/`clockOut`. *Riesgo:* if Factorial changes
  this representation the displayed times would be wrong; the include/skip decision only uses `date`.
- **suposición tomada** — a day that already has shifts is excluded by default, with a per-day checkbox to include
  it. *Base:* delegated decision 1. *Riesgo:* a user who wants to add an extra shift on such a day must tick it.
- **suposición tomada** — any existing shift makes a day "already recorded", whether or not it overlaps the
  generated times. *Base:* delegated decision 2; simpler and predictable. *Riesgo:* a day with only a short manual
  shift is skipped by default.
- **suposición tomada** — the check runs when the week is generated, not when applying. *Base:* delegated
  decision 3; the user sees it before deciding. *Riesgo:* a shift added in Factorial between generating and
  applying is caught only by Factorial's overlap rejection, as today.
- **suposición tomada** — the check only uses a Factorial tab that is already open and ready; it never opens or
  reloads a tab. Without one, the week is shown with "open Factorial in a tab to check existing shifts". *Base:*
  the review found that reusing the apply path could leave background tabs open on every Generate and reload the
  user's Factorial tab, which a read-only check must not do. *Riesgo:* users without Factorial open see the notice
  instead of the check.
- **decisión diferida** — checking for edits before an undo (#18's deferred decision); not in this issue
  (delegated decision 4).
- **decisión diferida** — ratifying the project constitution (still a draft).
