---
author: Antonio Masiá
branch: 15-run-build-and-tests-on-pull-requests
status: done
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

- [x] Workflows written — proof: YAML parses; `ci.yml` and the `check` job contain the test step.
- [x] CI runs on the PR — proof: the `test` job of this PR's run is green.
- [x] CI fails on a red test — proof: a throwaway PR with a failing test shows a red `test` check and a blocked merge.
- [x] `main` protected — proof: `gh api repos/…/branches/main/protection` shows the required `test` check.

## Evidence

- Promoted to ASDD: `rsc risk` rated CI changes tier 2. Spec `02-DOCS/wiki/sdd/specs/ci-on-pull-requests.md`,
  approved by the user; review panel of 3 (correctness, security, tests) recorded on `1d19322`, no blockers.
- Criterion 1: PR #31 `test` check green in 22 s, merge state `CLEAN`
  (https://github.com/ajmasia/factorial-clock-extension/actions/runs/42588390809).
- Criterion 2: throwaway PR #32 with a failing test → `test` `FAILURE`, merge state `BLOCKED`
  (https://github.com/ajmasia/factorial-clock-extension/actions/runs/42588613758); closed, branch deleted.
- Criterion 3: `release.yml` read: `check` runs `npm test`, `build` needs `check`, `create-release` needs
  `build`. Every later release (v0.1.9–v0.1.11) ran the tests in `check`.
- Criterion 4: protection read back from the API: required `test`, strict, PR required with 0 approvals,
  no force pushes or deletions. Later the user asked to include admins: `enforce_admins: true`.
## Next

Merged in PR #31 (2026-11-09); `main` protected, admins included since 2026-11-09.
