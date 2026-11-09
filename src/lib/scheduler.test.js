import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  getWeekDates,
  isWorkDay,
  generateWeeklySchedule,
  calculateTotalHours,
} from './scheduler.js'

// Monday 2026-11-09 … Sunday 2026-11-15
const WEEK = '2026-11-09'
const RUNS = 300

const BASE_CONFIG = {
  weeklyHours: 40,
  workDays: [1, 2, 3, 4, 5],
  clockInRange: { start: '07:00', end: '07:30' },
  lunchStartRange: { start: '14:00', end: '15:00' },
  lunchDuration: { min: 45, max: 60 },
  splitShiftDays: [1, 2, 3],
  randomVariance: 5,
}

const minutesOf = (datetime) => timeToMinutes(datetime.split('T')[1].substring(0, 5))

/** Returns the days of a schedule whose times are not in a valid order. */
function invalidDays(schedule) {
  return schedule.filter((day) => {
    const checkin = minutesOf(day.checkin)
    const checkout = minutesOf(day.checkout)
    if (day.type !== 'split') return !(checkin < checkout)
    const lunchStart = minutesOf(day.lunch_start)
    const lunchEnd = minutesOf(day.lunch_end)
    return !(checkin < lunchStart && lunchStart < lunchEnd && lunchEnd < checkout)
  })
}

/** Generates the week RUNS times and collects every invalid day and every weekly total. */
function sample(config, exceptions = []) {
  const invalid = []
  const totals = new Set()
  for (let i = 0; i < RUNS; i++) {
    const schedule = generateWeeklySchedule(WEEK, config, exceptions)
    invalid.push(...invalidDays(schedule))
    totals.add(calculateTotalHours(schedule).totalMinutes)
  }
  return { invalid, totals: [...totals] }
}

describe('time helpers', () => {
  it('converts between HH:MM and minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('07:30')).toBe(450)
    expect(minutesToTime(450)).toBe('07:30')
    expect(minutesToTime(timeToMinutes('23:59'))).toBe('23:59')
  })

  it('numbers days from Monday = 1 to Sunday = 7', () => {
    expect(getDayOfWeek('2026-11-09')).toBe(1)
    expect(getDayOfWeek('2026-11-15')).toBe(7)
  })

  it('returns the seven dates of a week, across a month boundary', () => {
    expect(getWeekDates(WEEK)).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
      '2026-11-13', '2026-11-14', '2026-11-15',
    ])
    expect(getWeekDates('2026-11-30').slice(0, 3)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02'])
  })
})

describe('isWorkDay', () => {
  const workDays = [1, 2, 3, 4, 5]

  it('follows the configured work days without exceptions', () => {
    expect(isWorkDay('2026-11-09', workDays)).toBe(true)
    expect(isWorkDay('2026-11-14', workDays)).toBe(false)
  })

  it('excludes single-date and range exceptions', () => {
    const exceptions = [
      { date: '2026-11-09', type: 'holiday' },
      { date: '2026-11-11', endDate: '2026-11-12', type: 'vacation' },
    ]
    expect(isWorkDay('2026-11-09', workDays, exceptions)).toBe(false)
    expect(isWorkDay('2026-11-10', workDays, exceptions)).toBe(true)
    expect(isWorkDay('2026-11-11', workDays, exceptions)).toBe(false)
    expect(isWorkDay('2026-11-12', workDays, exceptions)).toBe(false)
  })

  it('lets an excluding exception win over a special week on the same day (#1)', () => {
    const exceptions = [
      { date: '2026-11-09', type: 'special_week', weeklyHours: 30 },
      { date: '2026-11-09', type: 'vacation' },
    ]
    expect(isWorkDay('2026-11-09', workDays, exceptions)).toBe(false)
  })
})

describe('generateWeeklySchedule', () => {
  it('produces valid days and exactly 40 h for the default configuration', () => {
    const { invalid, totals } = sample(BASE_CONFIG)
    expect(invalid).toEqual([])
    expect(totals).toEqual([40 * 60])
  })

  it('produces valid days and exactly 40 h with continuous shifts only', () => {
    const { invalid, totals } = sample({ ...BASE_CONFIG, splitShiftDays: [] })
    expect(invalid).toEqual([])
    expect(totals).toEqual([40 * 60])
  })

  it('reduces the target proportionally when days are excluded', () => {
    const exceptions = [{ date: '2026-11-13', type: 'holiday' }]
    const { invalid, totals } = sample(BASE_CONFIG, exceptions)
    expect(invalid).toEqual([])
    expect(totals).toEqual([32 * 60])
    expect(generateWeeklySchedule(WEEK, BASE_CONFIG, exceptions).map((d) => d.date))
      .not.toContain('2026-11-13')
  })

  it('returns no days when the whole week is excluded', () => {
    const exceptions = [{ date: '2026-11-09', endDate: '2026-11-15', type: 'vacation' }]
    expect(generateWeeklySchedule(WEEK, BASE_CONFIG, exceptions)).toEqual([])
  })

  it('derives the daily base from the number of configured work days', () => {
    // 4-day week: 32 h / 4 days = 8 h per day. A hard-coded 5-day divisor would give 25.6 h.
    const { invalid, totals } = sample({ ...BASE_CONFIG, workDays: [1, 2, 3, 4], weeklyHours: 32 })
    expect(invalid).toEqual([])
    expect(totals).toEqual([32 * 60])
  })

  it('uses split shifts only on the configured split days', () => {
    const schedule = generateWeeklySchedule(WEEK, BASE_CONFIG)
    expect(schedule.map((d) => d.type)).toEqual(['split', 'split', 'split', 'continuous', 'continuous'])
    for (const day of schedule) {
      expect(day.lunch_start !== undefined).toBe(day.type === 'split')
      expect(day.lunch_end !== undefined).toBe(day.type === 'split')
    }
  })

  it('varies the length of days other than the last one', () => {
    // Thursday is continuous and not the last day, so only the ±15 min variance changes its length.
    const thursdayLengths = new Set()
    for (let i = 0; i < RUNS; i++) {
      const thursday = generateWeeklySchedule(WEEK, BASE_CONFIG)[3]
      thursdayLengths.add(minutesOf(thursday.checkout) - minutesOf(thursday.checkin))
    }
    expect(thursdayLengths.size).toBeGreaterThan(1)
  })

  it('never ends a split day on the same minute it started', () => {
    for (let i = 0; i < RUNS; i++) {
      for (const day of generateWeeklySchedule(WEEK, BASE_CONFIG)) {
        if (day.type !== 'split') continue
        expect(minutesOf(day.checkout) % 60).not.toBe(minutesOf(day.checkin) % 60)
      }
    }
  })

  it('falls back to the global split days when a special week has no splitDays', () => {
    const exceptions = [{ date: '2026-11-09', type: 'special_week', weeklyHours: 40 }]
    const schedule = generateWeeklySchedule(WEEK, BASE_CONFIG, exceptions)
    expect(schedule.map((d) => d.type)).toEqual(['split', 'split', 'split', 'continuous', 'continuous'])
  })

  it('applies a single-date special week to its own week', () => {
    const exceptions = [{ date: '2026-11-09', type: 'special_week', weeklyHours: 35, splitDays: [] }]
    const schedule = generateWeeklySchedule(WEEK, BASE_CONFIG, exceptions)
    expect(calculateTotalHours(schedule).totalMinutes).toBe(35 * 60)
    expect(schedule.every((d) => d.type === 'continuous')).toBe(true)
  })

  // Known bug #12: when the daily target is shorter than clock-in → lunch, the afternoon block
  // becomes 0 minutes and the last day gets a negative duration. Remove `.fails` when #12 is fixed.
  it.fails('produces valid days for a 25 h week with split shifts (#12)', () => {
    const { invalid, totals } = sample({ ...BASE_CONFIG, weeklyHours: 25 })
    // The total is already right today; it stays asserted so a fix cannot trade it for validity.
    expect(totals).toEqual([25 * 60])
    expect(invalid).toEqual([])
  })

  // Known bug #13: a special week range only applies to the week of its start date.
  // Remove `.fails` when #13 is fixed.
  it.fails('applies a special week range to every week it covers (#13)', () => {
    const exceptions = [
      { date: '2026-11-02', endDate: '2026-11-15', type: 'special_week', weeklyHours: 30, splitDays: [] },
    ]
    const schedule = generateWeeklySchedule(WEEK, BASE_CONFIG, exceptions)
    expect(calculateTotalHours(schedule).totalMinutes).toBe(30 * 60)
  })
})
