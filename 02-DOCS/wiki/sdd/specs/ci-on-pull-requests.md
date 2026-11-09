---
type: spec
title: Spec — CI on pull requests
description: WHAT and WHY for running the test suite and build automatically on every change proposed to main, and before every release.
tags: [sdd, spec, ci]
timestamp: 2026-11-09T10:00:00Z
topic: sdd
slug: ci-on-pull-requests
branch: 15-run-build-and-tests-on-pull-requests
issue: 15
status: draft
---

# Spec — CI on pull requests

> Slug: `ci-on-pull-requests` · Status: draft · Created: 2026-11-09 · Issue: #15
> Inherits: [constitution](../constitution.md) — still a draft, so no principles are inherited (see Points to clarify).
> Promoted from the FTD document `02-DOCS/wiki/ftd/ci-on-pull-requests.md` because `rsc risk` rates CI changes tier 2.
> Written after the change was drafted: it records the contract the drafted change must meet.
> Approved by the user on 2026-11-09, item by item after reading the spec and the implementation summary: «apruebo, adelante».

## Problem & why
Since #14 the project has a test suite, but it only runs when someone remembers to run it locally. Nothing
stops a pull request with failing tests or a broken build from reaching `main`, and the release process only
builds, it does not test. The maintainer finds a broken build at release time, after the tag is pushed.

## Cost of not building it
A regression in the schedule generator — the kind #12 and #13 are — can be merged and released to the
Chrome Web Store unnoticed, and users create wrong shifts in their real time-tracking records until a fix is
reviewed and published again (days, given store review). For a single-maintainer project the day-to-day cost
is small; the cost is in the rare release that ships a regression.

## The cheapest alternative
Run `npm test` and `npm run build` by hand before every merge and release, as a checklist item in
`CONTRIBUTING.md` and `RELEASING.md`. It costs nothing to set up and is not enough: it depends on memory, it
leaves no record on the pull request, and today it already does not happen (the release guide never ran tests).

## Goals
- Every change proposed to `main` shows, on the pull request, whether the tests and the build pass.
- A change whose tests or build fail cannot be merged into `main` through a pull request.
- A release cannot be published when the tests fail.

## Non-goals / out of scope
- Uploading releases to the Chrome Web Store — #29.
- Linting or formatting checks — no linter is configured.
- Coverage thresholds, test reports or badges.
- Running against several Node versions or operating systems.
- Requiring reviews or approvals: the project has a single maintainer.
- Blocking the maintainer from acting as administrator in an emergency.

## Users & context
The maintainer (single owner of the repository) and any contributor following `CONTRIBUTING.md`, who propose
changes through pull requests to `main` and publish releases by pushing a `v*` tag (`RELEASING.md`).

## What the user can do
- Anyone who opens or updates a pull request to `main` gets the checks run automatically, with no action.
- The maintainer can merge a pull request only when its checks pass and it is up to date with `main`.
- The maintainer, as repository administrator, can still bypass the rule in an emergency.
- Pushing a `v*` tag still publishes a release, only when the tests pass.

## What result they get
On each pull request to `main`, a check named `test` appears and ends green or red. The approved reference is
the pull-request check list as GitHub shows it: one `test` entry, green when `npm test` and `npm run build`
succeed, red when either fails, with the failing step's log one click away. The merge button is disabled while
`test` is red or pending. A release whose tests fail shows a red `check` job and no GitHub Release is created.

## What it must respect
- The release flow in `RELEASING.md` keeps working: a `v*` tag builds, zips and creates the GitHub Release.
- The project decision "branches and pull requests" (`02-DOCS/wiki/harness/decisions.md`, PR #5).
- Tags are not affected by the protection of `main`.
- No secrets are needed, and the checks get only read access to the repository.
- The shipped extension is unchanged.

## How it proves it
- The pull request of #15 itself shows a green `test` check (evidence: the run URL in the feature document).
- A throwaway pull request with a deliberately failing test shows a red `test` check and a blocked merge
  button; it is then closed and its branch deleted (evidence: run URL and the protection API response).
- The protection rule is read back from GitHub's API and recorded in the feature document.

## Behaviour
- Main path: a pull request to `main` is opened or updated → tests and build run → the `test` check turns green → merge is allowed.
- Edge cases: a newer push to the same pull request supersedes the running check; a push to `main` (merge) runs the same check; a pull request behind `main` must be updated before merging.
- Error paths: a failing test or build turns `test` red and blocks the merge; a release tag with failing tests stops before any release is created.

## Acceptance criteria
- Given a pull request to `main` whose tests and build pass, When it is opened or updated, Then a `test` check ends green and the pull request can be merged.
- Given a pull request to `main` with a failing test, When it is opened or updated, Then the `test` check ends red and the merge is blocked.
- Given a `v*` tag pushed on a commit whose tests fail, When the release workflow runs, Then the `check` job fails and no GitHub Release is created.
- Given the protection rule is active, When it is read from GitHub's API, Then `test` is a required status check, branches must be up to date, a pull request is required with 0 approvals, and it is not enforced for administrators.

## Points to clarify
- **suposición tomada** — no reviews or approvals are required. *Base:* single maintainer who merges their own pull requests (user decision, 2026-11-09). *Riesgo:* with a second contributor, unreviewed code could be merged; revisit then.
- **suposición tomada** — the rule is not enforced for administrators. *Base:* user decision, 2026-11-09, to keep an emergency path. *Riesgo:* the maintainer can merge a red pull request by mistake.
- **suposición tomada** — the release criterion is checked by reading the workflow (tests run before the build in the `check` job, which the other jobs depend on), not by publishing a failing tag. *Base:* a real failing tag would create a public tag to clean up. *Riesgo:* low; the dependency between jobs is explicit in the workflow.
- **decisión diferida** — ratifying the project constitution (`02-DOCS/wiki/sdd/constitution.md` is a draft); this spec inherits no principles until then.
