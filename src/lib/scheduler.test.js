import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  generateDailySchedule,
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  getWeekDates,
  isWorkDay,
  generateWeeklySchedule,
  calculateTotalHours,
  MIN_AFTERNOON_MINUTES,
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

  it('produces valid days for a 25 h week with split shifts (#12)', () => {
    const { invalid, totals } = sample({ ...BASE_CONFIG, weeklyHours: 25 })
    expect(totals).toEqual([25 * 60])
    expect(invalid).toEqual([])
  })

  it('turns days too short for a split shift into continuous days (#12)', () => {
    // 25 h: split days get about 5.5 h; from ~07:15 even a 14:00 lunch leaves no afternoon.
    for (let i = 0; i < RUNS; i++) {
      const schedule = generateWeeklySchedule(WEEK, { ...BASE_CONFIG, weeklyHours: 25 })
      expect(schedule.every((d) => d.type === 'continuous')).toBe(true)
    }
  })

  it('keeps Mon–Wed split in a normal 40 h week (#12)', () => {
    for (let i = 0; i < RUNS; i++) {
      const types = generateWeeklySchedule(WEEK, BASE_CONFIG).map((d) => d.type)
      expect(types).toEqual(['split', 'split', 'split', 'continuous', 'continuous'])
    }
  })

  // [weekly hours, whether split days must appear with every day configured as split]
  // (null: depends on the draws — the last day takes the remainder of the week)
  it.each([[20, false], [25, false], [30, null], [35, null], [40, true], [45, true]])(
    'keeps lunch in the configured range and %s h weeks with ≥ 60 min after lunch (#12)',
    (weeklyHours, expectSplitDays) => {
      const config = { ...BASE_CONFIG, weeklyHours, splitShiftDays: [1, 2, 3, 4, 5] }
      const lunchFrom = timeToMinutes(config.lunchStartRange.start)
      const lunchTo = timeToMinutes(config.lunchStartRange.end)
      const { invalid, totals } = sample(config)
      expect(invalid).toEqual([])
      expect(totals).toEqual([weeklyHours * 60])
      let splitDays = 0
      for (let i = 0; i < RUNS; i++) {
        for (const day of generateWeeklySchedule(WEEK, config)) {
          if (day.type !== 'split') continue
          splitDays++
          const lunchStart = minutesOf(day.lunch_start)
          expect(lunchStart).toBeGreaterThanOrEqual(lunchFrom)
          expect(lunchStart).toBeLessThanOrEqual(lunchTo)
          const lunchLength = minutesOf(day.lunch_end) - lunchStart
          expect(lunchLength).toBeGreaterThanOrEqual(config.lunchDuration.min)
          expect(lunchLength).toBeLessThanOrEqual(config.lunchDuration.max)
          expect(minutesOf(day.checkout) - minutesOf(day.lunch_end)).toBeGreaterThanOrEqual(60)
        }
      }
      if (expectSplitDays !== null) expect(splitDays > 0).toBe(expectSplitDays)
    },
  )

})

// Deterministic checks of a single split day (#12). Clock-in is fixed at 07:00 and lunch at 14:00
// by single-value ranges, so 7 h are worked before lunch; Math.random is stubbed only where a value
// still has to be chosen (lunch length and the 1-3 min adjustment).
describe('generateDailySchedule boundaries (#12)', () => {
  const DATE = '2026-11-09'
  const FIXED = {
    ...BASE_CONFIG,
    clockInRange: { start: '07:00', end: '07:00' },
    lunchStartRange: { start: '14:00', end: '14:00' },
    lunchDuration: { min: 45, max: 45 },
    randomVariance: 0,
  }

  /** getRandomNumber(min, max) = floor(r * (max - min + 1)) + min; returns the r picking `value`. */
  const pick = (value, min, max) => (value - min + 0.5) / (max - min + 1)

  /** Stub Math.random for the draws in order: clock-in, variance, lunch start, lunch length, adjustment. */
  function stubRandom(values) {
    let i = 0
    vi.spyOn(Math, 'random').mockImplementation(() => (i < values.length ? values[i++] : 0))
  }

  afterEach(() => vi.restoreAllMocks())

  it('stays split with exactly 60 min after lunch', () => {
    const day = generateDailySchedule(DATE, 8, FIXED, true) // 480 min: 420 before lunch, 60 after
    expect(day.type).toBe('split')
    expect(day.lunch_start).toBe(`${DATE}T14:00:00`)
    expect(minutesOf(day.checkout) - minutesOf(day.lunch_end)).toBe(60)
  })

  it('becomes continuous with 59 min after lunch', () => {
    const day = generateDailySchedule(DATE, 479 / 60, FIXED, true)
    expect(day.type).toBe('continuous')
    expect(day.checkout).toBe(`${DATE}T14:59:00`)
  })

  it('never starts lunch at the check-in minute when the lunch range overlaps check-in', () => {
    stubRandom([0, 0, 0, 0, 0]) // lowest lunch start allowed
    const config = { ...FIXED, lunchStartRange: { start: '06:00', end: '07:30' } }
    const day = generateDailySchedule(DATE, 8, config, true)
    expect(day.type).toBe('split')
    expect(minutesOf(day.lunch_start)).toBeGreaterThan(minutesOf(day.checkin))
  })

  it('lengthens lunch up to exactly the maximum to avoid a matching checkout minute', () => {
    // Lunch 57 min (range 45-60), afternoon 63 min → checkout 16:00 matches check-in :00.
    // Adjustment 3 → 57 + 3 = 60 = max is allowed → checkout 16:03.
    const config = { ...FIXED, lunchDuration: { min: 45, max: 60 } }
    stubRandom([0, 0, 0, pick(57, 45, 60), pick(3, 1, 3)])
    const day = generateDailySchedule(DATE, 483 / 60, config, true)
    expect(minutesOf(day.lunch_end) - minutesOf(day.lunch_start)).toBe(60)
    expect(day.checkout).toBe(`${DATE}T16:03:00`)
  })

  it('shortens lunch down to exactly the minimum when lengthening would exceed the maximum', () => {
    // Lunch 48 min (range 45-50), afternoon 72 min → checkout 16:00 matches. 48 + 3 > 50, 48 - 3 = 45 = min.
    const config = { ...FIXED, lunchDuration: { min: 45, max: 50 } }
    stubRandom([0, 0, 0, pick(48, 45, 50), pick(3, 1, 3)])
    const day = generateDailySchedule(DATE, 492 / 60, config, true) // 420 before lunch + 72 after
    expect(minutesOf(day.lunch_end) - minutesOf(day.lunch_start)).toBe(45)
    expect(day.checkout).toBe(`${DATE}T15:57:00`)
  })

  it('keeps the matching minute when no lunch length in the range can absorb the adjustment', () => {
    // Fixed 60 min lunch: neither 63 nor 57 fits, so lunch stays 60 and the checkout keeps :00.
    // Accepted trade-off: worked minutes stay exact.
    const config = { ...FIXED, lunchDuration: { min: 60, max: 60 } }
    stubRandom([0, 0, 0, 0, pick(3, 1, 3)])
    const day = generateDailySchedule(DATE, 480 / 60, config, true) // afternoon 60 → 16:00
    expect(minutesOf(day.lunch_end) - minutesOf(day.lunch_start)).toBe(60)
    expect(day.checkout).toBe(`${DATE}T16:00:00`)
  })
})

describe('known bugs', () => {
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
