---
author: Antonio Masiá
branch: 38-overlap-errors-are-not-recognised-when-factorial-answers-in-spanish
status: done
---
# Fix: overlap errors not recognised in Spanish (#38)

## Intent

Factorial returns its error messages in the account's language. Overlaps were detected by the English text
`overlaps with shift`, so with a Spanish account (`se solapa con el turno de …`) they were treated as unknown
errors: generic alert, and every overlap logged as an error. Found while testing #18 (chrome://extensions →
Errors). Detect overlaps independently of the language, and keep Factorial's `type`/`code` with each error so a
language-independent signal can replace text matching once its value is known. Done before #18 PR 2, which needs
the same handling for "shift not found".

## Scope

In:
- `src/lib/factorial-errors.js` (tested): `isOverlapError({ message, code, type })` — English and Spanish texts
  today; `code`/`type` passed through for later.
- Content script: request `code` in GraphQL errors, return `message`, `code`, `type`; stop classifying errors
  itself (content scripts cannot import shared modules) and stop logging Factorial's rejections as errors.
- Service worker: use `isOverlapError`; keep `errorCode` with failed shifts in History.
- Remove `ERROR_STRINGS.SHIFT_OVERLAP`.

Out:
- Other languages (Catalan, French, …): their wording is unknown; the `code` path covers them once confirmed.
- Translating the extension's own messages (#24).

## Checklist

- [x] `isOverlapError` tested for English, Spanish, other errors and the code path — proof: `npm test`.
- [x] No English-only overlap check left — proof: grep.
- [x] Content script still has no imports — proof: `dist/factorial-api.js` contains no `import`.
- [x] Real extension — proof: user re-applies an applied week with a Spanish account: overlap alert shown, no
      overlap entries in chrome://extensions → Errors.
- [x] Build and CI.

## Evidence

- Found on 2026-11-09 in chrome://extensions → Errors while testing #18: `[Factorial API] Error creating shift:
  Error: se solapa con el turno de 07:13 a 14:44 del 2026-11-03` and `✗ Failed to create shift for 2026-11-03: …`.
- `npm test` → 59 passed (5 new in `factorial-errors.test.js`); build passes; `dist/factorial-api.js` has no
  `import`; grep finds no English-only overlap check outside `factorial-errors.js`. `rsc risk` → tier 1.
- Reviewer (refuter-correctness): no findings. Unverifiable offline: whether `SimpleError.code` exists in the
  create mutation's schema (seen in `DeleteAttendanceShift`); if not, every create would fail visibly → covered
  by the Chrome test. Accepted: until a code is known, languages other than English and Spanish fall back to
  the generic message.
- Chrome test 1 (user): re-applying an applied week showed the overlap-specific alert, but the service worker
  still logged `Apply failed: …` as an error (and `Some shifts failed` as a warning) → overlap-only outcomes are
  now logged as info; other failures still as errors.
- Chrome test 2 (user, 2026-11-09): re-applying the week → alert "Cannot create shifts: All dates already have
  existing shifts in Factorial…", and no new entry in chrome://extensions → Errors. Factorial answered the create
  query (which now selects `SimpleError.code`) with the overlap error, not a schema validation error, so the
  create mutation accepts `code`.
- Pending: the value of `code` for an overlap (to make detection language-independent).
## Next

Merged in PR #39, released in v0.1.12 (2026-11-09). Add the overlap `code` to `OVERLAP_CODES` once a
create response with an overlap is captured.
