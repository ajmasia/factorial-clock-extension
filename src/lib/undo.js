/**
 * Undo of an applied week (#18): which shifts to delete and how to read Factorial's answers.
 *
 * Safety rule: only shifts that the extension created and whose Factorial identifier it stored are
 * ever deleted.
 */

import { SHIFT_STATUS } from './apply-results.js'

export const UNDO_SHIFT_STATUS = {
  DELETED: 'deleted', // Factorial confirmed the deletion
  NOT_FOUND: 'not_found', // Factorial did not find it: probably deleted by hand already
  FAILED: 'failed', // not deleted; can be retried
}

export const UNDO_STATUS = {
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  PARTIAL: 'partial',
  FAILED: 'failed',
}

// An undo still marked in progress after this long was interrupted (for example the browser closed)
export const STALE_UNDO_MS = 10 * 60 * 1000

// Factorial answers "malformed_request" both for a shift that no longer exists and for a malformed request
export const NOT_FOUND_ERROR_TYPE = 'malformed_request'

/**
 * Whether a stored identifier can be sent to Factorial unchanged as an integer.
 * Rejects ids that would be rounded (beyond Number.MAX_SAFE_INTEGER) or are not plain digits.
 */
export function isValidShiftId(id) {
  if (id === null || id === undefined) return false
  const text = String(id)
  if (!/^\d+$/.test(text)) return false
  const n = Number(text)
  return Number.isSafeInteger(n) && String(n) === text
}

/**
 * The shifts an undo has to delete: created by the extension, with a stored identifier, and not
 * already deleted or found missing by an earlier undo.
 * @param {object} entry - History entry
 * @returns {{date: string, index: number, id: string, clockIn: string, clockOut: string}[]}
 */
export function undoTargets(entry) {
  if (!entry || !Array.isArray(entry.days)) return []
  const targets = []
  for (const day of entry.days) {
    day.shifts.forEach((shift, index) => {
      if (shift.status !== SHIFT_STATUS.CREATED || !isValidShiftId(shift.id)) return
      const done = shift.undo && [UNDO_SHIFT_STATUS.DELETED, UNDO_SHIFT_STATUS.NOT_FOUND].includes(shift.undo.status)
      if (done) return
      targets.push({ date: day.date, index, id: shift.id, clockIn: shift.clockIn, clockOut: shift.clockOut })
    })
  }
  return targets
}

/**
 * Whether an undo can start now for this entry.
 * @returns {boolean}
 */
export function canUndo(entry, now = Date.now()) {
  if (undoTargets(entry).length === 0) return false
  return !isUndoRunning(entry, now)
}

/**
 * Whether an undo is in progress and not stale. An unreadable start time counts as stale, so an
 * entry can never stay blocked.
 */
export function isUndoRunning(entry, now = Date.now()) {
  const undo = entry && entry.undo
  if (!undo || undo.status !== UNDO_STATUS.IN_PROGRESS) return false
  const started = Date.parse(undo.startedAt)
  if (!Number.isFinite(started)) return false
  return now - started <= STALE_UNDO_MS
}

/**
 * Read the content script's answer to one deletion.
 * @param {{success: boolean, data?: {id: string}, error?: string, errorType?: string, shiftReturned?: boolean}} response
 * @param {string} requestedId
 * @returns {{status: string, error: string|null, notFoundCandidate: boolean}}
 */
export function classifyDeleteResponse(response, requestedId) {
  if (response && response.success && response.data && String(response.data.id) === String(requestedId)) {
    return { status: UNDO_SHIFT_STATUS.DELETED, error: null, notFoundCandidate: false }
  }
  const error = (response && response.error) || 'Unknown error'
  const notFoundCandidate = Boolean(
    response && !response.success && response.errorType === NOT_FOUND_ERROR_TYPE && response.shiftReturned === false,
  )
  return { status: UNDO_SHIFT_STATUS.FAILED, error, notFoundCandidate }
}

/**
 * Turn "not found" candidates into NOT_FOUND, unless every answer of the undo was a candidate: then
 * the request itself is the likelier problem, and they all stay FAILED.
 * @param {{status: string, error: string|null, notFoundCandidate: boolean}[]} results
 * @returns {{status: string, error: string|null}[]}
 */
export function resolveUndoResults(results) {
  const allCandidates = results.length > 0 && results.every((r) => r.notFoundCandidate)
  return results.map((r) => {
    if (r.notFoundCandidate && !allCandidates) return { status: UNDO_SHIFT_STATUS.NOT_FOUND, error: r.error }
    if (r.notFoundCandidate && allCandidates) {
      // Kept as a candidate: the user can confirm it after checking Factorial (markNotFoundByUser)
      return { status: UNDO_SHIFT_STATUS.FAILED, error: `Factorial did not find it: ${r.error}`, notFoundCandidate: true }
    }
    return { status: r.status, error: r.error }
  })
}

/**
 * Write the outcome of an undo into a copy of the entry.
 * @param {object} entry
 * @param {{date: string, index: number}[]} targets - As returned by undoTargets, in the same order as outcomes
 * @param {{status: string, error: string|null}[]} outcomes
 * @param {Date} now
 * @returns {object} The updated entry
 */
export function applyUndoOutcome(entry, targets, outcomes, now = new Date()) {
  const updated = structuredClone(entry)
  const at = now.toISOString()
  targets.forEach((target, i) => {
    const day = updated.days.find((d) => d.date === target.date)
    const undo = { status: outcomes[i].status, error: outcomes[i].error, at }
    if (outcomes[i].notFoundCandidate) undo.notFoundCandidate = true
    day.shifts[target.index].undo = undo
  })
  const remaining = undoTargets(updated).length
  const removed = outcomes.filter((o) => o.status !== UNDO_SHIFT_STATUS.FAILED).length
  let status = UNDO_STATUS.DONE
  if (remaining > 0) status = removed > 0 || entry.undo?.status === UNDO_STATUS.PARTIAL ? UNDO_STATUS.PARTIAL : UNDO_STATUS.FAILED
  updated.undo = { status, at }
  return updated
}

/**
 * Summary of an entry's undo for display.
 * @returns {{deleted: number, notFound: number, failed: number}}
 */
export function summarizeUndo(entry) {
  const summary = { deleted: 0, notFound: 0, failed: 0 }
  for (const day of entry.days || []) {
    for (const shift of day.shifts) {
      if (!shift.undo) continue
      if (shift.undo.status === UNDO_SHIFT_STATUS.DELETED) summary.deleted++
      else if (shift.undo.status === UNDO_SHIFT_STATUS.NOT_FOUND) summary.notFound++
      else summary.failed++
    }
  }
  return summary
}

/**
 * Whether every shift still to delete was answered "not found" by Factorial, so the user can confirm
 * that they were deleted by hand (the whole week deleted in Factorial before undoing it here).
 */
export function canMarkNotFound(entry, now = Date.now()) {
  if (isUndoRunning(entry, now)) return false
  const targets = undoTargets(entry)
  if (targets.length === 0) return false
  return targets.every((t) => {
    const shift = entry.days.find((d) => d.date === t.date).shifts[t.index]
    return shift.undo && shift.undo.status === UNDO_SHIFT_STATUS.FAILED && shift.undo.notFoundCandidate === true
  })
}

/**
 * The user confirmed, after checking Factorial, that the shifts Factorial did not find are gone.
 * @returns {object} The updated entry, marked done
 */
export function markNotFoundByUser(entry, now = new Date()) {
  if (!canMarkNotFound(entry)) return entry
  const targets = undoTargets(entry)
  return applyUndoOutcome(
    entry,
    targets,
    targets.map(() => ({ status: UNDO_SHIFT_STATUS.NOT_FOUND, error: 'Confirmed by the user as deleted in Factorial' })),
    now,
  )
}
