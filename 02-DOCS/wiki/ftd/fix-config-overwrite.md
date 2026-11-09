---
author: Antonio Masiá
branch: 11-opening-the-config-tab-can-overwrite-the-saved-configuration-with-defaults
status: done
---
# Fix: opening Config overwrites the saved configuration (#11)

## Intent

Opening the Config tab runs Employee ID auto-detection with the default `config` captured on the first
render. When detection succeeds it saves `{ ...defaults, employeeId }` over the stored configuration, while
the UI keeps showing the real values. Reproduced in Chrome on 2026-11-09 (stored 35 h → 40 h on opening
Config). Fix it so auto-detection only changes `employeeId` in the stored configuration, and only runs once
the stored configuration has been loaded. Release as 0.1.9.

## Scope

In:
- New `src/lib/config-storage.js`: `DEFAULT_CONFIG` and `saveEmployeeId(id)`, which reads the stored config
  and writes it back with only `employeeId` changed (defaults fill a missing config).
- `ConfigPage.jsx`: auto-detection waits for the stored config and saves through `saveEmployeeId`.
- `service-worker.js`: uses the shared `DEFAULT_CONFIG` instead of its own copy.
- Version 0.1.9.

Out:
- The manual "Auto-detect" button already updates only the UI state and is saved with Save — unchanged.
- A storage layer for config, exceptions and history — #25.
- React component tests (no DOM test setup in the project).

## Checklist

- [x] Storage helper tested — proof: Vitest with a mocked `chrome.storage`: a stored 35 h config keeps 35 h after `saveEmployeeId`; a missing config gets the defaults plus the ID.
- [x] Old behaviour shown wrong — proof: the same test applied to the old write (`{ ...defaults, employeeId }`) fails.
- [x] Full suite and build — proof: `npm test` and `npm run build` pass.
- [x] Real extension — proof: user retest with the `chrome.storage.onChanged` listener: opening Config writes only `employeeId` (or nothing), weekly hours unchanged.
- [x] CI green on the PR.

## Evidence

- Reproduction (2026-11-09, user, 0.1.8): `chrome.storage.onChanged` listener; opening Config without saving
  logged `Employee ID found` then `CONFIG WRITTEN sync 35 → 40`. Recorded on #11 (an earlier, wrong
  reproduction comment was retracted there).
- `config-storage.test.js`: 3 tests (only `employeeId` changes; values saved after the page opened are kept;
  missing config gets defaults + ID). `npm test` → 21 passed.
- Old write as a mutant (`saveEmployeeId` without the stored config, on a scratch copy) → 2 of 3 tests fail;
  the missing-config case passes, correctly, since old and new behave the same there.
- Build: `npm run build` passes; `dist/manifest.json` version `0.1.9`.
- `rsc risk` → tier 1, 1 reviewer.
- Reviewer (refuter-correctness): no blockers; core bug fixed. Fixed: `loadConfig` had no `catch` → now logs.
  Accepted, not fixed:
  1. Race between `saveEmployeeId` (read then write) and a manual Save landing in the same few ms can
     drop the Save. Detection now only runs when no Employee ID is stored, so this is a first-use, ms-wide window.
  2. `saveEmployeeId` backfills missing keys from the defaults on write; harmless.
  3. The `loaded` gating in `ConfigPage` has no automated test (no DOM test setup); the Chrome retest covers it.
- Real extension (2026-11-09, user, 0.1.9 unpacked): with 35 h stored, opening Config without saving
  logged no `CONFIG WRITTEN`, and `chrome.storage.sync.get('config')` still returned 35 (0.1.8 returned 40).

## Next

Merged in PR #33, released in v0.1.9 (2026-11-09).
