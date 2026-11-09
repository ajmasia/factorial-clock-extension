/**
 * Classification of errors returned by Factorial (#38)
 *
 * Factorial writes its error messages in the account's language, so text matching must cover every
 * language seen so far. Its GraphQL errors also carry a `type` and a `code`; once the value used for
 * overlaps is confirmed, it should be added to OVERLAP_CODES so detection no longer depends on the text.
 */

// Lower-case fragments of Factorial's overlap message, per language seen
export const OVERLAP_MESSAGE_FRAGMENTS = [
  'overlaps with shift', // English
  'se solapa con', // Spanish: "se solapa con el turno de 07:13 a 14:44 del 2026-11-03"
]

// Language-independent codes for an overlap (not confirmed yet)
export const OVERLAP_CODES = []

/**
 * Whether a Factorial error means the shift overlaps an existing one.
 * @param {{message?: string, code?: string|null, type?: string|null}} error
 * @returns {boolean}
 */
export function isOverlapError({ message, code } = {}) {
  if (code && OVERLAP_CODES.includes(code)) return true
  const text = (message || '').toLowerCase()
  return OVERLAP_MESSAGE_FRAGMENTS.some((fragment) => text.includes(fragment))
}
