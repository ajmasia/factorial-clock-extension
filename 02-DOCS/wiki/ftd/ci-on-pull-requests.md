---
author: Antonio Masiá
branch: 15-run-build-and-tests-on-pull-requests
status: in-progress
---
# CI on pull requests (#15)

## Intent

Tests exist since #14 but only run locally, and the only workflow runs on `v*` tags. Run install, tests and
build on every pull request and push to `main`, run the tests before a release, and protect `main` so a
pull request cannot be merged with a red check.

## Scope

In:
- `.github/workflows/ci.yml`: job `test` (`npm ci`, `npm test`, `npm run build`) on `pull_request` to
  `main` and `push` to `main`, Node 20.
- `release.yml`: `npm test` in the `check` job.
- Branch protection on `main` (a GitHub setting, after the first CI run): required check `test`, branch up
  to date, pull request required with 0 approvals, not enforced for admins. Decided by the user, 2026-11-09.

Out:
- Chrome Web Store upload — #29.
- Lint — no linter configured.

## Checklist

- [ ] Workflows written — proof: YAML parses; `ci.yml` and the `check` job contain the test step.
- [ ] CI runs on the PR — proof: the `test` job of this PR's run is green.
- [ ] CI fails on a red test — proof: a temporary failing commit makes the `test` job fail, then is reverted.
- [ ] `main` protected — proof: `gh api repos/…/branches/main/protection` shows the required `test` check.

## Evidence

## Next

Write `ci.yml` and add the test step to `release.yml`.
