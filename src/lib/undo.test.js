import { describe, it, expect } from 'vitest'
import {
  undoTargets,
  canUndo,
  isValidShiftId,
  canMarkNotFound,
  markNotFoundByUser,
  classifyDeleteResponse,
  resolveUndoResults,
  applyUndoOutcome,
  summarizeUndo,
  UNDO_SHIFT_STATUS as U,
  UNDO_STATUS,
  STALE_UNDO_MS,
} from './undo.js'
import { SHIFT_STATUS } from './apply-results.js'

const created = (id, extra = {}) => ({ clockIn: `c${id}`, clockOut: `o${id}`, id, status: SHIFT_STATUS.CREATED, ...extra })
const failed = () => ({ clockIn: 'x', clockOut: 'y', id: null, status: SHIFT_STATUS.FAILED, error: 'overlap' })

const entry = (overrides = {}) => ({
  id: 1,
  days: [
    { date: '2026-11-09', shifts: [created('11'), created('12')] },
    { date: '2026-11-10', shifts: [failed()] },
    { date: '2026-11-11', shifts: [created('31')] },
  ],
  ...overrides,
})

const deleted = (id) => ({ success: true, data: { id } })
const notFound = () => ({ success: false, error: 'Solicitud no válida', errorType: 'malformed_request', shiftReturned: false })
const rejected = (error = 'boom') => ({ success: false, error, errorType: 'other', shiftReturned: false })

describe('undoTargets', () => {
  it('targets only created shifts with a stored identifier', () => {
    expect(undoTargets(entry()).map((t) => t.id)).toEqual(['11', '12', '31'])
  })

  it('never targets a created shift without an identifier', () => {
    const e = entry({ days: [{ date: '2026-11-09', shifts: [created(null), created('12')] }] })
    expect(undoTargets(e).map((t) => t.id)).toEqual(['12'])
  })

  it('skips shifts already deleted or not found, but retries failed ones', () => {
    const e = entry({
      days: [{
        date: '2026-11-09',
        shifts: [
          created('11', { undo: { status: U.DELETED } }),
          created('12', { undo: { status: U.NOT_FOUND } }),
          created('13', { undo: { status: U.FAILED } }),
        ],
      }],
    })
    expect(undoTargets(e).map((t) => t.id)).toEqual(['13'])
  })

  it('returns nothing for entries from older versions, without days', () => {
    expect(undoTargets({ id: 1, schedule: [] })).toEqual([])
  })
})

describe('canUndo', () => {
  const now = Date.parse('2026-11-09T12:00:00Z')

  it('allows an undo when there is something to delete', () => {
    expect(canUndo(entry(), now)).toBe(true)
  })

  it('refuses a second undo while one is in progress', () => {
    const e = entry({ undo: { status: UNDO_STATUS.IN_PROGRESS, startedAt: new Date(now - 1000).toISOString() } })
    expect(canUndo(e, now)).toBe(false)
  })

  it('allows restarting an undo left in progress for too long', () => {
    const e = entry({ undo: { status: UNDO_STATUS.IN_PROGRESS, startedAt: new Date(now - STALE_UNDO_MS - 1).toISOString() } })
    expect(canUndo(e, now)).toBe(true)
  })

  it('refuses when nothing is left to delete', () => {
    const e = entry({ days: [{ date: '2026-11-09', shifts: [created('11', { undo: { status: U.DELETED } })] }] })
    expect(canUndo(e, now)).toBe(false)
  })
})

describe('classifyDeleteResponse', () => {
  it('counts a deletion only when Factorial returns the same shift identifier', () => {
    expect(classifyDeleteResponse(deleted('11'), '11').status).toBe(U.DELETED)
    expect(classifyDeleteResponse(deleted(11), '11').status).toBe(U.DELETED)
    expect(classifyDeleteResponse(deleted('99'), '11').status).toBe(U.FAILED)
  })

  it('marks malformed_request without a shift as a not-found candidate', () => {
    const r = classifyDeleteResponse(notFound(), '11')
    expect(r).toMatchObject({ status: U.FAILED, notFoundCandidate: true })
  })

  it('treats any other error as a failure with its message', () => {
    expect(classifyDeleteResponse(rejected('Not authenticated'), '11')).toEqual({
      status: U.FAILED, error: 'Not authenticated', notFoundCandidate: false,
    })
    expect(classifyDeleteResponse(undefined, '11').status).toBe(U.FAILED)
  })
})

describe('resolveUndoResults', () => {
  const r = (response) => classifyDeleteResponse(response, '11')

  it('turns not-found candidates into not found when other shifts were deleted', () => {
    const out = resolveUndoResults([classifyDeleteResponse(deleted('11'), '11'), r(notFound())])
    expect(out.map((o) => o.status)).toEqual([U.DELETED, U.NOT_FOUND])
  })

  it('treats a week where every answer is malformed_request as a failure the user can confirm', () => {
    const out = resolveUndoResults([r(notFound()), r(notFound())])
    expect(out.map((o) => o.status)).toEqual([U.FAILED, U.FAILED])
    expect(out.every((o) => o.notFoundCandidate)).toBe(true)
    expect(out[0].error).toMatch(/^Factorial did not find it/)
  })

  it('keeps not found when the rest failed for another reason', () => {
    const out = resolveUndoResults([r(rejected()), r(notFound())])
    expect(out.map((o) => o.status)).toEqual([U.FAILED, U.NOT_FOUND])
  })
})

describe('applyUndoOutcome', () => {
  const now = new Date('2026-11-09T12:00:00Z')

  it('marks the entry done when every target is deleted or not found', () => {
    const e = entry()
    const targets = undoTargets(e)
    const updated = applyUndoOutcome(e, targets, [
      { status: U.DELETED, error: null }, { status: U.NOT_FOUND, error: 'x' }, { status: U.DELETED, error: null },
    ], now)
    expect(updated.undo).toEqual({ status: UNDO_STATUS.DONE, at: now.toISOString() })
    expect(updated.days[0].shifts[1].undo.status).toBe(U.NOT_FOUND)
    expect(summarizeUndo(updated)).toEqual({ deleted: 2, notFound: 1, failed: 0 })
    expect(e.undo).toBeUndefined() // input not mutated
  })

  it('marks the entry partial when some deletions failed, and a retry targets only those', () => {
    const e = entry()
    const updated = applyUndoOutcome(e, undoTargets(e), [
      { status: U.DELETED, error: null }, { status: U.FAILED, error: 'boom' }, { status: U.DELETED, error: null },
    ], now)
    expect(updated.undo.status).toBe(UNDO_STATUS.PARTIAL)
    expect(undoTargets(updated).map((t) => t.id)).toEqual(['12'])

    const retried = applyUndoOutcome(updated, undoTargets(updated), [{ status: U.DELETED, error: null }], now)
    expect(retried.undo.status).toBe(UNDO_STATUS.DONE)
    expect(summarizeUndo(retried)).toEqual({ deleted: 3, notFound: 0, failed: 0 })
  })

  it('marks the entry failed when nothing could be deleted', () => {
    const e = entry()
    const updated = applyUndoOutcome(e, undoTargets(e), undoTargets(e).map(() => ({ status: U.FAILED, error: 'boom' })), now)
    expect(updated.undo.status).toBe(UNDO_STATUS.FAILED)
  })

  it('stays partial when a retry after a partial undo fails again', () => {
    const e = entry()
    const partial = applyUndoOutcome(e, undoTargets(e), [
      { status: U.DELETED, error: null }, { status: U.FAILED, error: 'boom' }, { status: U.DELETED, error: null },
    ], now)
    const retried = applyUndoOutcome(partial, undoTargets(partial), [{ status: U.FAILED, error: 'boom' }], now)
    expect(retried.undo.status).toBe(UNDO_STATUS.PARTIAL)
  })
})

describe('a week already deleted by hand in Factorial', () => {
  const now = new Date('2026-11-09T12:00:00Z')
  const classify = (targets, responses) =>
    resolveUndoResults(targets.map((t, i) => classifyDeleteResponse(responses[i], t.id)))

  it('offers to confirm when Factorial finds none of the shifts, and marks the week done on confirmation', () => {
    const e = entry()
    const targets = undoTargets(e)
    const afterUndo = applyUndoOutcome(e, targets, classify(targets, targets.map(() => notFound())), now)
    expect(afterUndo.undo.status).toBe(UNDO_STATUS.FAILED)
    expect(canMarkNotFound(afterUndo)).toBe(true)

    const confirmed = markNotFoundByUser(afterUndo, now)
    expect(confirmed.undo.status).toBe(UNDO_STATUS.DONE)
    expect(summarizeUndo(confirmed)).toEqual({ deleted: 0, notFound: 3, failed: 0 })
  })

  it('does not offer the confirmation when a shift failed for another reason', () => {
    const e = entry()
    const targets = undoTargets(e)
    const afterUndo = applyUndoOutcome(e, targets, classify(targets, [rejected(), rejected(), rejected()]), now)
    expect(canMarkNotFound(afterUndo)).toBe(false)
    expect(markNotFoundByUser(afterUndo, now)).toBe(afterUndo)
  })

  it('needs no confirmation when only some shifts were deleted by hand', () => {
    const e = entry()
    const targets = undoTargets(e)
    const afterUndo = applyUndoOutcome(e, targets, classify(targets, [deleted('11'), notFound(), deleted('31')]), now)
    expect(afterUndo.undo.status).toBe(UNDO_STATUS.DONE)
    expect(canMarkNotFound(afterUndo)).toBe(false)
  })

  it('only targets the shifts that were created in a partially applied week', () => {
    const e = entry() // day 2026-11-10 failed to apply
    expect(undoTargets(e).some((t) => t.date === '2026-11-10')).toBe(false)
  })
})

describe('safety rules pinned independently (review of #18 PR 2)', () => {
  const now = Date.parse('2026-11-09T12:00:00Z')

  it('never targets a failed or skipped shift, even with an identifier', () => {
    const e = entry({ days: [{ date: '2026-11-09', shifts: [
      { clockIn: 'a', clockOut: 'b', id: '77', status: SHIFT_STATUS.FAILED, error: 'x' },
      { clockIn: 'a', clockOut: 'b', id: '78', status: SHIFT_STATUS.SKIPPED, error: 'x' },
      created('79'),
    ] }] })
    expect(undoTargets(e).map((t) => t.id)).toEqual(['79'])
  })

  it('never targets an identifier that would change when sent as a number', () => {
    expect(isValidShiftId('603271014')).toBe(true)
    expect(isValidShiftId(603271014)).toBe(true)
    for (const id of ['9007199254740993', '1e3', '0x10', ' 12', '12 ', '-5', '1.5', '', null, undefined, '012']) {
      expect(isValidShiftId(id)).toBe(false)
    }
    const e = entry({ days: [{ date: '2026-11-09', shifts: [created('9007199254740993'), created('80')] }] })
    expect(undoTargets(e).map((t) => t.id)).toEqual(['80'])
  })

  it('does not count a deletion when the content script reports failure, even with the same id', () => {
    expect(classifyDeleteResponse({ success: false, data: { id: '11' } }, '11').status).toBe(U.FAILED)
  })

  it('is not a not-found candidate when Factorial returned a shift or did not say', () => {
    const base = { success: false, error: 'x', errorType: 'malformed_request' }
    expect(classifyDeleteResponse({ ...base, shiftReturned: true }, '11').notFoundCandidate).toBe(false)
    expect(classifyDeleteResponse(base, '11').notFoundCandidate).toBe(false)
  })

  it('does not offer "Mark as removed" when one remaining failure is not a not-found', () => {
    const e = entry({ days: [{ date: '2026-11-09', shifts: [
      created('11', { undo: { status: U.FAILED, error: 'not found', notFoundCandidate: true } }),
      created('12', { undo: { status: U.FAILED, error: 'boom' } }),
    ] }], undo: { status: UNDO_STATUS.FAILED } })
    expect(canMarkNotFound(e, now)).toBe(false)
    expect(markNotFoundByUser(e, new Date(now))).toBe(e)
  })

  it('does not offer "Mark as removed" while an undo is running', () => {
    const e = entry({ days: [{ date: '2026-11-09', shifts: [
      created('11', { undo: { status: U.FAILED, error: 'not found', notFoundCandidate: true } }),
    ] }], undo: { status: UNDO_STATUS.IN_PROGRESS, startedAt: new Date(now - 1000).toISOString() } })
    expect(canMarkNotFound(e, now)).toBe(false)
  })

  it('counts failed deletions in the summary', () => {
    const e = entry()
    const updated = applyUndoOutcome(e, undoTargets(e), [
      { status: U.DELETED, error: null }, { status: U.FAILED, error: 'boom' }, { status: U.FAILED, error: 'boom' },
    ], new Date(now))
    expect(summarizeUndo(updated)).toEqual({ deleted: 1, notFound: 0, failed: 2 })
  })

  it('treats an undo exactly at the stale limit as still running', () => {
    const e = entry({ undo: { status: UNDO_STATUS.IN_PROGRESS, startedAt: new Date(now - STALE_UNDO_MS).toISOString() } })
    expect(canUndo(e, now)).toBe(false)
  })

  it('never blocks an entry whose undo start time is unreadable', () => {
    for (const startedAt of [undefined, null, 'not a date']) {
      expect(canUndo(entry({ undo: { status: UNDO_STATUS.IN_PROGRESS, startedAt } }), now)).toBe(true)
    }
  })
})
