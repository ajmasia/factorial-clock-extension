# SDD decisions log

Append-only. One entry per scoping decision of the SDD chain.

## 2026-11-09 — CI on pull requests (#15) promoted to a spec

- `rsc risk` rated the CI change tier 2, so the ship guard required an approved spec. The user chose to
  write the spec rather than disable the gate (`.rsc/.no-asdd-gate`).
- The spec was written after the change was drafted and records the contract the drafted change must meet.
- Scope decisions by the user: protection of `main` with a required `test` check, branch up to date, pull
  request required with 0 approvals, not enforced for administrators.
- Out of scope: Chrome Web Store upload (#29), linting, coverage, Node/OS matrix.
