import { describe, it, expect } from 'vitest'
import { planShifts, summarizeDays, buildHistoryEntry, SHIFT_STATUS, ENTRY_STATUS } from './apply-results.js'

const SPLIT_DAY = {
  date: '2026-11-09',
  type: 'split',
  checkin: '2026-11-09T07:12:00',
  lunch_start: '2026-11-09T14:05:00',
  lunch_end: '2026-11-09T14:55:00',
  checkout: '2026-11-09T16:40:00',
}
const CONTINUOUS_DAY = {
  date: '2026-11-12',
  type: 'continuous',
  checkin: '2026-11-12T07:20:00',
  checkout: '2026-11-12T14:08:00',
}

const created = (id) => ({ clockIn: 'a', clockOut: 'b', id, status: SHIFT_STATUS.CREATED })
const failed = (error) => ({ clockIn: 'a', clockOut: 'b', id: null, status: SHIFT_STATUS.FAILED, error })
const skipped = () => ({ clockIn: 'a', clockOut: 'b', id: null, status: SHIFT_STATUS.SKIPPED, error: 'x' })

describe('planShifts', () => {
  it('plans two shifts around lunch for a split day', () => {
    const shifts = planShifts(SPLIT_DAY)
    expect(shifts).toHaveLength(2)
    expect(shifts[0].clockIn.startsWith('2026-11-09T07:12:00')).toBe(true)
    expect(shifts[0].clockOut.startsWith('2026-11-09T14:05:00')).toBe(true)
    expect(shifts[1].clockIn.startsWith('2026-11-09T14:55:00')).toBe(true)
    expect(shifts[1].clockOut.startsWith('2026-11-09T16:40:00')).toBe(true)
  })

  it('plans one shift for a continuous day', () => {
    const shifts = planShifts(CONTINUOUS_DAY)
    expect(shifts).toHaveLength(1)
    expect(shifts[0].clockIn.startsWith('2026-11-12T07:20:00')).toBe(true)
    expect(shifts[0].clockOut.startsWith('2026-11-12T14:08:00')).toBe(true)
  })

  it('adds the local timezone offset', () => {
    expect(planShifts(CONTINUOUS_DAY)[0].clockIn).toMatch(/[+-]\d{2}:\d{2}$/)
  })
})

describe('summarizeDays', () => {
  it('counts shifts, not days', () => {
    const days = [
      { date: '2026-11-09', shifts: [created('1'), failed('overlap')] },
      { date: '2026-11-12', shifts: [created('2')] },
    ]
    expect(summarizeDays(days)).toEqual({ created: 2, failed: 1, skipped: 0, total: 3 })
  })

  it('does not count a skipped shift as failed', () => {
    const days = [{ date: '2026-11-09', shifts: [failed('overlaps with shift'), skipped()] }]
    expect(summarizeDays(days)).toEqual({ created: 0, failed: 1, skipped: 1, total: 2 })
  })
})

describe('buildHistoryEntry', () => {
  const scheduleData = { weekStart: '2026-11-09', schedule: [], raw: [], totals: { formatted: '40h 0m' } }
  const now = new Date('2026-11-09T10:00:00Z')

  it('marks a week with every shift created as applied and keeps the identifiers', () => {
    const days = [{ date: '2026-11-09', shifts: [created('11'), created('12')] }]
    const entry = buildHistoryEntry(scheduleData, days, now)
    expect(entry.status).toBe(ENTRY_STATUS.APPLIED)
    expect(entry.days[0].shifts.map((s) => s.id)).toEqual(['11', '12'])
    expect(entry.appliedAt).toBe('2026-11-09T10:00:00.000Z')
    expect(entry.id).toBe(now.getTime())
  })

  it('marks a week with created and failed shifts as partial', () => {
    const days = [{ date: '2026-11-09', shifts: [created('11'), failed('overlaps with shift')] }]
    expect(buildHistoryEntry(scheduleData, days, now).status).toBe(ENTRY_STATUS.PARTIAL)
  })

  it('marks a week with a created shift and a skipped one as partial', () => {
    const days = [{ date: '2026-11-09', shifts: [created('11')] }, { date: '2026-11-10', shifts: [failed('x'), skipped()] }]
    expect(buildHistoryEntry(scheduleData, days, now).status).toBe(ENTRY_STATUS.PARTIAL)
  })

  it('marks a week where every shift failed as failed', () => {
    const days = [{ date: '2026-11-09', shifts: [failed('overlaps with shift')] }]
    expect(buildHistoryEntry(scheduleData, days, now).status).toBe(ENTRY_STATUS.FAILED)
  })

  it('keeps the fields the History page already shows', () => {
    const entry = buildHistoryEntry(scheduleData, [], now)
    expect(entry).toMatchObject({ weekStart: '2026-11-09', schedule: [], raw: [], totals: { formatted: '40h 0m' } })
  })
})
