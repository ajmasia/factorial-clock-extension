/**
 * Time and date utility functions
 */

/**
 * Format datetime string to ISO format with timezone
 * @param {string} dateTimeStr - DateTime in format "YYYY-MM-DDTHH:MM:SS"
 * @returns {string} ISO datetime with timezone, e.g. "2025-12-30T08:00:00+01:00"
 *
 * @example
 * formatDateTimeWithTimezone("2025-12-30T08:00:00")
 * // Returns: "2025-12-30T08:00:00+01:00" (with local timezone)
 */
export function formatDateTimeWithTimezone(dateTimeStr) {
  const date = new Date(dateTimeStr)

  // Get timezone offset in hours and minutes
  const tzOffset = -date.getTimezoneOffset()
  const tzHours = Math.floor(Math.abs(tzOffset) / 60)
  const tzMinutes = Math.abs(tzOffset) % 60
  const tzSign = tzOffset >= 0 ? '+' : '-'

  const tzString = `${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`

  // Return ISO string without 'Z' + timezone
  return dateTimeStr + tzString
}
