---
author: Antonio Masiá
branch: 4-history-stops-saving-after-the-fourth-applied-week-chromestoragesync-quota
status: in-progress
---
# Fix: history stops saving after the fourth applied week (#4)

## Intent

The whole history array lives under one `chrome.storage.sync` key, which allows 8,192 bytes per item.
One applied week takes about 2,250 bytes, so the fourth save is rejected. The popup only logs the
failure and still shows "applied successfully", so History freezes without notice.
Move history to `chrome.storage.local` (about 10 MB, no per-item limit), migrate what is already in
`sync`, and tell the user when a save fails.

## Scope

In:
- New `src/lib/history-storage.js` with `loadHistory()` (reads `local`; on first use migrates `sync.history`
  to `local` and removes it from `sync`) and `saveHistory()`.
- `src/background/service-worker.js`: `handleSaveToHistory` and the install defaults use it.
- `src/popup/pages/HistoryPage.jsx`: load and delete use it.
- `src/popup/pages/GeneratePage.jsx`: the success alert says when the history save failed.

Out:
- Exceptions in a single `sync` key (fail at about 80 exceptions) — separate issue.
- Compacting the history entry format (`raw` stored twice) — not needed with `local`.
- Cross-device sync of history — given up on purpose (decision accepted by the user, 2026-11-09).

## Checklist

- [x] Storage module and call sites changed — proof: no `storage.sync` access to `history` left in `src/`.
- [x] Migration and quota behaviour — proof: node script with a mocked `chrome.storage` (sync enforces 8,192 bytes per item) saves 50 entries and migrates 3 existing ones.
- [x] Build passes — proof: `npm run build` exits 0.
- [x] Real extension — proof: user reloads `dist/`, History still shows the old entries, applying a week adds a new one.

## Evidence

- Call sites: `grep -rn "storage\.sync" src | grep -i history` → only `src/lib/history-storage.js` (the migration read and remove).
- Mocked `chrome.storage` (sync enforces 8,192 bytes per item; script in the session scratchpad):
  the old path rejects 4 entries with `QUOTA_BYTES_PER_ITEM`; 3 sync entries migrate to local in order and the
  sync key is removed; a second load is idempotent; 52 more saves keep 50 entries (112,047 bytes, newest first);
  a fresh install loads `[]`.
- Build: `npm run build` → `✓ built in 1.26s`.
- Tests: no project test suite; the mocked script above is the only automated check.
- `rsc risk` → tier 1, 1 reviewer, no human approval required.
- Reviewer (refuter-correctness, fresh context): no blockers. Fixed after review:
  1. `onInstalled` wrote `local.history = []`, which skipped the migration of synced history → removed.
  2. A failing `sync.remove` made `loadHistory` reject after a completed migration → now only warns.
  3. The history warning could read `(undefined)` → falls back to `unknown error`.
  Accepted, not fixed: a migration racing a save from the other context (popup vs service worker) on an
  unmigrated profile can drop the new entry; tiny window, once per profile. Multi-device: only the first
  device to update keeps the synced entries (cross-device history was given up on purpose).
  Pre-existing, out of scope: if `saveToHistory` itself rejects, the popup says "Failed to apply" although
  shifts were created.
- Re-run after fixes: mocked script adds a case where `sync.remove` throws → load succeeds with 2 entries;
  all previous cases pass; build `✓ built in 1.33s`.
- Real extension (2026-11-09, user): `dist/` reloaded, History kept the existing weeks and a newly applied
  week was saved. Confirmed by the user.

## Next

Commit with `Fixes #4` and open the PR. Follow-ups: exceptions in a single sync key; "Failed to apply"
shown when only the history save rejects.
