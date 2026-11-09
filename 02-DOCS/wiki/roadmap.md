# Roadmap — project audit (2026-11-09)

Audit of v0.1.8 after fixing #2 (session cookie) and #4 (history quota). Every item has a GitHub issue:
bugs are labelled `bug`, improvements `enhancement`. Updated 2026-11-09 after v0.1.11.

## Done

| Issue | What | PR | Release |
| --- | --- | --- | --- |
| #2 | Apply failed with "Not authenticated": renamed session cookie | #3 | v0.1.7 |
| #4 | History stopped saving after the 4th week (`chrome.storage.sync` quota) | #6 | v0.1.8 |
| #14 | Unit tests for the schedule generator (Vitest) | #30 | — |
| #15 | CI on pull requests; `main` protected (required `test`, admins included) | #31 | — |
| #11 | Opening Config overwrote the saved config with defaults | #33 | v0.1.9 |
| #12 | Short split days generated invalid shifts; weekly total off when the last day is split | #34 | v0.1.10 |
| #13 | Special week ranges only applied to their first week; the form hid the end date | #35 | v0.1.11 |

Chrome Web Store: v0.1.9 submitted for review on 2026-11-09 (published: v0.1.6). Upload v0.1.11 once it
is approved.

## Open bugs

| Issue | Bug | How it was found |
| --- | --- | --- |
| #7 | Exceptions exceed the `chrome.storage.sync` item quota (60–100 entries) | Same root cause as #4 |
| #8 | "Failed to apply" shown when only the history save rejects | Review of #4 |
| #9 | Unclear behaviour when applying while logged out | Review of #2 |
| #10 | Applying hangs if the new Factorial tab never finishes loading | Code reading |
| #27 | Week navigation shifts by a day in negative UTC offsets (`GeneratePage.jsx`) | Code reading, not reproduced |

## Improvements

### Quality and process
| Issue | Improvement |
| --- | --- |
| #16 | One source for the version (now in 5 files) |
| #17 | Repo cleanup: committed `factorial-clock-v0.1.3.zip`, links to missing `CHANGELOG.md` and `CHROME_WEB_STORE_DESCRIPTION.md`, reference to the gitignored `CLAUDE.md` |
| #29 | Upload releases to the Chrome Web Store from the release workflow (Chrome Web Store API; secrets set by the owner) |

Not tracked yet (from the #15 review panel): narrow the release jobs `check` and `build` to read-only
permissions; avoid duplicating the install/test/build steps between `ci.yml` and `release.yml`.

### Functionality
| Issue | Improvement |
| --- | --- |
| #18 | Store the shift IDs returned by the API; "undo week" and per-day results in History |
| #19 | Show the shifts already in Factorial before applying, and skip those days |
| #20 | Edit a time by hand, or regenerate one day, before applying |
| #21 | Import time off and holidays from Factorial as exceptions |

### UI
| Issue | Improvement |
| --- | --- |
| #22 | Inline messages instead of the 20 `alert()`/`confirm()` calls, and per-day progress while applying |
| #23 | Keep the apply result when the popup closes |
| #24 | One UI language (`chrome.i18n`), config validation, unsaved-changes warning, bundled Inter font |

### Data persistence
| Issue | Improvement |
| --- | --- |
| #25 | One storage layer with schema versions and migrations, JSON backup, no duplicated `raw` in history (covers #7) |

### Factorial integration
| Issue | Improvement |
| --- | --- |
| #26 | One adapter for the Factorial API: clear errors, remove the unused `getEmployeeId`, less logging, note the pinned credentials API version `2025-10-01` |

### Not tracked as an issue
- Complete the rsc draft `02-DOCS/wiki/sdd/constitution.md` before the next ASDD feature.

## Recommended order

1. #18 and #19: shift IDs, undo week, skip days already in Factorial.
2. #29 automatic upload to the Chrome Web Store, and #16 single version source.
3. #8, #9 and #10: apply-flow robustness.
4. #22 inline messages and #24 i18n.
5. #25 storage layer and JSON backup (includes #7).
