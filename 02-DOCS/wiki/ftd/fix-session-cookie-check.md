---
author: Antonio Masiá
branch: 2-applying-a-schedule-fails-with-not-authenticated-while-logged-in-to-factorial
status: in-progress
---
# Fix: apply aborts because the session cookie was renamed

## Intent

Applying a week aborts with "Not authenticated" while the user is logged in.
`handleApplySchedule` looks for the cookie `_factorial_session_v2`, which Factorial no
longer sets (it now uses `_factorial_id`, `_factorial_id_refresh`, `session`…). The
cookie value was never used: shifts are created by the content script with
`credentials: 'include'`, and a 401 from the API is already mapped to "Not authenticated".
Remove the check so the API decides whether there is a session.

## Scope

In:
- Remove the cookie lookup and the unused `sessionCookie` parameter in `src/background/service-worker.js`.
- Remove `COOKIES` from `src/lib/constants.js` and the `cookies` permission from `manifest.json`.

Out:
- The history quota bug (`chrome.storage.sync` 8 KB per item) — separate fix.
- The unbounded wait for a new Factorial tab — separate fix.
- Any change to how the GraphQL call authenticates (only if the test shows a 401).

## Checklist

- [x] Cookie check and `sessionCookie` removed — proof: no `cookies`/`sessionCookie`/`COOKIES` left in `src/` and `manifest.json`.
- [x] Build passes — proof: `npm run build` exits 0 and `dist/manifest.json` has no `cookies` permission.
- [x] Shifts created in Factorial — proof: user loads `dist/`, applies an empty week, success alert and shifts visible in Factorial.

## Evidence

- Root cause (2026-11-09): service worker log `Apply failed: Error: Not authenticated…` right after
  `Using Employee ID: 560915`; DevTools → Cookies on app.factorialhr.com shows no `_factorial_session_v2`
  (present: `_factorial_id`, `_factorial_id_refresh`, `_factorial_id_data`, `session`…).
- Removal: `grep -rn 'COOKIES\|sessionCookie\|"cookies"' src manifest.json` → no matches.
- Build: `npm run build` (vite 5.4.21) → `✓ built in 1.13s`; `dist/manifest.json` permissions: `["storage"]`;
  `_factorial_session_v2` occurrences in `dist/background.js`: 0.
- `rsc risk` → tier 1, 1 reviewer, no human approval required.
- Tests: not executed — the project has no test suite.
- Security scan: not executed — the project has none configured.
- Reviewer (fresh context, tier 1): no dangling references; the 3 `createShift` call sites match the
  new signature; nothing else needs the `cookies` permission; a 401 still stops the loop early.
  Two unverified risks, both on the logged-out path:
  1. No active login tab is opened anymore. If the login page leaves `app.factorialhr.com`, the user sees
     "Content script not responding…", which does not mention login.
  2. The early stop relies on HTTP 401 only. A 302 to HTML or a 200 with an auth error would try every
     day and end with "0 shifts created, N failed".
  Not fixed yet: Factorial's real logged-out response is unknown. Decide after the logged-out test.
- Manual test (2026-11-09, user): `dist/` loaded unpacked, Web Store copy disabled, logged in to
  Factorial, applied a week → shifts created in Factorial. Confirmed by the user.

## Next

Commit the fix on the issue #2 branch, bump to 0.1.7, open the PR; tag `v0.1.7` after merge. Follow-ups, each its own feature: logged-out UX (reviewer risks 1-2), history quota
in `chrome.storage.sync`, timeout for the new Factorial tab, version bump and Web Store release.
