/**
 * Shifts that already exist in Factorial for a generated week (#19)
 */

/**
 * Group Factorial's shift nodes by day.
 * Factorial returns `clockIn`/`clockOut` with the current date and the shift's wall-clock time, so the day
 * comes from `date` and only the HH:MM of the times is used.
 * @param {{id: number|string, date: string, clockIn: string|null, clockOut: string|null}[]} nodes
 * @returns {Object<string, {id: string, clockIn: string|null, clockOut: string|null}[]>} shifts by YYYY-MM-DD
 */
export function groupShiftsByDate(nodes) {
  const byDate = {}
  for (const node of nodes || []) {
    if (!node || typeof node.date !== 'string') continue
    const shift = {
      id: String(node.id),
      clockIn: hhmm(node.clockIn),
      clockOut: hhmm(node.clockOut),
    }
    ;(byDate[node.date] ||= []).push(shift)
  }
  for (const date of Object.keys(byDate)) {
    byDate[date].sort((a, b) => (a.clockIn || '').localeCompare(b.clockIn || ''))
  }
  return byDate
}

function hhmm(datetime) {
  return typeof datetime === 'string' && datetime.length >= 16 ? datetime.slice(11, 16) : null
}

/**
 * Which generated days are included by default: a day that already has any shift in Factorial is
 * excluded. When the check could not run, every day is included (behaviour before #19).
 * @param {{date: string}[]} days - Generated days
 * @param {{checked: boolean, byDate?: object}} existing
 * @returns {Object<string, boolean>} included by date
 */
export function defaultIncludedDays(days, existing) {
  const included = {}
  for (const day of days || []) {
    const shifts = existing && existing.checked ? existing.byDate?.[day.date] : null
    included[day.date] = !(shifts && shifts.length > 0)
  }
  return included
}

/**
 * The dates to send when applying. Undefined `included` means every day (older callers).
 * @param {{date: string}[]} days
 * @param {Object<string, boolean>|undefined} included
 * @returns {string[]}
 */
export function datesToApply(days, included) {
  return (days || []).map((d) => d.date).filter((date) => !included || included[date] !== false)
}
