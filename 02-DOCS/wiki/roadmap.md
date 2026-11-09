# Roadmap — project audit (2026-11-09)

Audit of v0.1.8 after fixing #2 (session cookie) and #4 (history quota). Every item has a GitHub issue:
bugs are labelled `bug`, improvements `enhancement`.

## Open bugs

| Issue | Bug | How it was found |
| --- | --- | --- |
| #11 | Opening Config can overwrite the saved config with defaults (`ConfigPage.jsx:30-48`) | Traced in code, not reproduced |
| #12 | Short days with split shifts generate invalid shifts (`scheduler.js:108-125`) | Real generator, 2,000 runs: about 4 invalid days per week at 20–25 h |
| #13 | Special week ranges only apply to the week of their start date (`scheduler.js:241`) | Real generator: 30 h range gives 40 h in its second week |
| #7 | Exceptions exceed the `chrome.storage.sync` item quota (60–100 entries) | Same root cause as #4 |
| #8 | "Failed to apply" shown when only the history save rejects | Review of #4 |
| #9 | Unclear behaviour when applying while logged out | Review of #2 |
| #10 | Applying hangs if the new Factorial tab never finishes loading | Code reading |
| #27 | Week navigation shifts by a day in negative UTC offsets (`GeneratePage.jsx`) | Code reading, not reproduced |

## Improvements

### Quality and process
| Issue | Improvement |
| --- | --- |
| #14 | Unit tests with Vitest for `scheduler.js`, with invariants (`checkout > checkin`, total = target) |
| #15 | CI on pull requests: build and tests (the release workflow only runs on tags) |
| #16 | One source for the version (now in 5 files) |
| #17 | Repo cleanup: committed `factorial-clock-v0.1.3.zip`, links to missing `CHANGELOG.md` and `CHROME_WEB_STORE_DESCRIPTION.md`, reference to the gitignored `CLAUDE.md` |
| #29 | Upload releases to the Chrome Web Store from the release workflow (Chrome Web Store API; secrets set by the owner) |

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
| #25 | One storage layer with schema versions and migrations, JSON backup, no duplicated `raw` in history (covers #7, prevents another #11) |

### Factorial integration
| Issue | Improvement |
| --- | --- |
| #26 | One adapter for the Factorial API: clear errors, remove the unused `getEmployeeId`, less logging, note the pinned credentials API version `2025-10-01` |

### Not tracked as an issue
- Complete the rsc draft `02-DOCS/wiki/sdd/constitution.md` before the first ASDD feature.

## Recommended order

1. #14 scheduler tests, then #11, #12 and #13.
2. #15 CI on pull requests, and #29 automatic upload to the Chrome Web Store.
3. #18 and #19: shift IDs, undo week, skip days already in Factorial.
4. #22 inline messages and #24 i18n.
5. #25 storage layer and JSON backup (includes #7).
