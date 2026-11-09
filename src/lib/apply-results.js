/**
 * Results of applying a generated week to Factorial, shift by shift (#18)
 */

import { formatDateTimeWithTimezone } from './time-utils.js'

// EXCLUDED: a day the user left out because it already had shifts in Factorial (#19)
export const SHIFT_STATUS = { CREATED: 'created', FAILED: 'failed', SKIPPED: 'skipped', EXCLUDED: 'excluded' }
export const ENTRY_STATUS = { APPLIED: 'applied', PARTIAL: 'partial', FAILED: 'failed' }

/**
 * The shifts to create for a generated day: one for a continuous day, two for a split day.
 * @param {object} day - A day from generateWeeklySchedule
 * @returns {{clockIn: string, clockOut: string}[]} ISO datetimes with the local timezone
 */
export function planShifts(day) {
  if (day.type === 'split') {
    return [
      { clockIn: formatDateTimeWithTimezone(day.checkin), clockOut: formatDateTimeWithTimezone(day.lunch_start) },
      { clockIn: formatDateTimeWithTimezone(day.lunch_end), clockOut: formatDateTimeWithTimezone(day.checkout) },
    ]
  }
  return [{ clockIn: formatDateTimeWithTimezone(day.checkin), clockOut: formatDateTimeWithTimezone(day.checkout) }]
}

/**
 * Count created, failed, skipped and excluded shifts. A skipped shift was not attempted because an
 * earlier shift of the same day failed; an excluded one belongs to a day the user left out (#19).
 * Neither counts as failed, and excluded shifts are not part of `total`.
 * @param {{shifts: object[]}[]} days
 * @returns {{created: number, failed: number, skipped: number, excluded: number, total: number}}
 */
export function summarizeDays(days) {
  let created = 0
  let failed = 0
  let skipped = 0
  let excluded = 0
  for (const day of days) {
    for (const shift of day.shifts) {
      if (shift.status === SHIFT_STATUS.CREATED) created++
      else if (shift.status === SHIFT_STATUS.SKIPPED) skipped++
      else if (shift.status === SHIFT_STATUS.EXCLUDED) excluded++
      else failed++
    }
  }
  return { created, failed, skipped, excluded, total: created + failed + skipped }
}

/**
 * Build the History entry for an applied week.
 * @param {object} scheduleData - The generated week (weekStart, schedule, raw, totals)
 * @param {{date: string, shifts: object[]}[]} days - Per-day shift results
 * @param {Date} now
 * @returns {object} History entry
 */
export function buildHistoryEntry(scheduleData, days, now = new Date()) {
  const { created, failed, skipped } = summarizeDays(days)
  let status = ENTRY_STATUS.APPLIED
  if (failed + skipped > 0) status = created > 0 ? ENTRY_STATUS.PARTIAL : ENTRY_STATUS.FAILED

  return {
    id: now.getTime(),
    weekStart: scheduleData.weekStart,
    schedule: scheduleData.schedule,
    raw: scheduleData.raw,
    totals: scheduleData.totals,
    appliedAt: now.toISOString(),
    status,
    days,
  }
}
