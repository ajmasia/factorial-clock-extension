import { describe, it, expect } from 'vitest'
import { groupShiftsByDate, defaultIncludedDays, datesToApply } from './existing-shifts.js'

// Shape observed in Factorial on 2026-11-09: the date part of clockIn is the current date, not the shift's day
const node = (id, date, from, to) => ({
  id,
  date,
  referenceDate: date,
  clockIn: `2026-11-09T${from}:00+00:00`,
  clockOut: `2026-11-09T${to}:00+00:00`,
  minutes: 60,
  workable: true,
})

const WEEK = ['2026-11-02', '2026-11-03', '2026-11-04'].map((date) => ({ date }))

describe('groupShiftsByDate', () => {
  it('groups by the shift date, not by the date inside clockIn', () => {
    const byDate = groupShiftsByDate([node(1, '2026-11-03', '07:30', '15:00')])
    expect(Object.keys(byDate)).toEqual(['2026-11-03'])
    expect(byDate['2026-11-03']).toEqual([{ id: '1', clockIn: '07:30', clockOut: '15:00' }])
  })

  it('keeps several shifts of a day, in time order', () => {
    const byDate = groupShiftsByDate([node(2, '2026-11-03', '15:00', '18:00'), node(1, '2026-11-03', '07:30', '14:00')])
    expect(byDate['2026-11-03'].map((s) => s.clockIn)).toEqual(['07:30', '15:00'])
  })

  it('tolerates missing times and ignores malformed nodes', () => {
    const byDate = groupShiftsByDate([{ id: 3, date: '2026-11-04', clockIn: null, clockOut: null }, null, { id: 4 }])
    expect(byDate).toEqual({ '2026-11-04': [{ id: '3', clockIn: null, clockOut: null }] })
    expect(groupShiftsByDate(undefined)).toEqual({})
  })
})

describe('defaultIncludedDays', () => {
  it('excludes days that already have shifts and includes the rest', () => {
    const existing = { checked: true, byDate: groupShiftsByDate([node(1, '2026-11-03', '07:30', '15:00')]) }
    expect(defaultIncludedDays(WEEK, existing)).toEqual({ '2026-11-02': true, '2026-11-03': false, '2026-11-04': true })
  })

  it('includes every day when the check could not run', () => {
    expect(defaultIncludedDays(WEEK, { checked: false, reason: 'no session' })).toEqual({
      '2026-11-02': true, '2026-11-03': true, '2026-11-04': true,
    })
    expect(defaultIncludedDays(WEEK, undefined)['2026-11-03']).toBe(true)
  })

  it('ignores existing shifts on days that were not generated', () => {
    const existing = { checked: true, byDate: groupShiftsByDate([node(1, '2026-11-08', '10:00', '11:00')]) }
    expect(Object.values(defaultIncludedDays(WEEK, existing)).every(Boolean)).toBe(true)
  })
})

describe('datesToApply', () => {
  it('sends only the included days', () => {
    expect(datesToApply(WEEK, { '2026-11-02': true, '2026-11-03': false, '2026-11-04': true })).toEqual(['2026-11-02', '2026-11-04'])
  })

  it('sends a day the user included even if it already has shifts', () => {
    expect(datesToApply(WEEK, { '2026-11-03': true })).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  })

  it('sends every day when no selection is given', () => {
    expect(datesToApply(WEEK, undefined)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  })

  it('sends nothing when every day is excluded', () => {
    expect(datesToApply(WEEK, { '2026-11-02': false, '2026-11-03': false, '2026-11-04': false })).toEqual([])
  })
})
