/**
 * scheduler.js - Schedule generation logic ported from random.sh
 * This is an EXACT port of the CLI algorithm
 */

/**
 * Convert time HH:MM to minutes since midnight
 */
export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes since midnight to HH:MM
 */
export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Generate random number in range (inclusive)
 */
export function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generate random time within a range with variance
 */
export function getRandomTimeInRange(startTime, endTime, variance = 5) {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  // Get random time in range
  let randomMinutes = getRandomNumber(startMinutes, endMinutes)

  // Apply variance (avoid exact times)
  const varianceOffset = getRandomNumber(0, variance)
  randomMinutes += varianceOffset

  return minutesToTime(randomMinutes)
}

/**
 * Get day of week from date (1=Monday, 7=Sunday)
 */
export function getDayOfWeek(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDay()
  return day === 0 ? 7 : day // Convert Sunday from 0 to 7
}

/**
 * Check if date is a split shift day
 */
export function isSplitShiftDay(dateStr, splitShiftDays) {
  const dayOfWeek = getDayOfWeek(dateStr)
  return splitShiftDays.includes(dayOfWeek)
}

/**
 * Generate random schedule for a single day
 * EXACT PORT of random::generate_daily_schedule from random.sh
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} targetHours - Target hours for the day
 * @param {object} config - Configuration object
 * @param {boolean} forceSplitShift - Override split shift determination (optional)
 * @returns {object} Schedule object
 */
export function generateDailySchedule(date, targetHours, config, forceSplitShift = null) {
  // Convert target hours to minutes (rounded)
  const targetMinutes = Math.round(targetHours * 60)

  // Generate random clock in time
  const clockInTime = getRandomTimeInRange(
    config.clockInRange.start,
    config.clockInRange.end,
    config.randomVariance
  )

  // Check if it's a split shift day
  // Use forceSplitShift if provided (from special week config), otherwise use global config
  const isSplit = forceSplitShift !== null
    ? forceSplitShift
    : isSplitShiftDay(date, config.splitShiftDays)

  let clockInMinutes = timeToMinutes(clockInTime)
  let lunchStartDatetime = null
  let lunchEndDatetime = null
  let clockOutTime = ''

  if (isSplit) {
    // Split shift: with lunch break

    // Generate random lunch start time within configured range
    // Always respect the user's configured lunch time preference (from CLI)
    const lunchTimeMinutes = getRandomNumber(
      timeToMinutes(config.lunchStartRange.start),
      timeToMinutes(config.lunchStartRange.end)
    )
    const lunchTime = minutesToTime(lunchTimeMinutes)

    // Generate random lunch duration
    const lunchDuration = getRandomNumber(
      config.lunchDuration.min,
      config.lunchDuration.max
    )

    // Calculate lunch end
    const lunchEndTimeMinutes = lunchTimeMinutes + lunchDuration
    const lunchEndTime = minutesToTime(lunchEndTimeMinutes)

    lunchStartDatetime = `${date}T${lunchTime}:00`
    lunchEndDatetime = `${date}T${lunchEndTime}:00`

    // Calculate clock out time properly:
    // 1. Calculate work time before lunch
    // 2. Calculate remaining work time after lunch
    // 3. Clock out = lunch_end + remaining work
    const workBeforeLunch = lunchTimeMinutes - clockInMinutes
    const workAfterLunch = targetMinutes - workBeforeLunch

    // Ensure we have positive work time after lunch
    const validWorkAfterLunch = Math.max(0, workAfterLunch)

    let clockOutMinutes = lunchEndTimeMinutes + validWorkAfterLunch

    // For split shifts only: ensure checkout minutes don't match checkin minutes
    const checkinMinutePart = parseInt(clockInTime.split(':')[1])
    const checkoutMinutePart = clockOutMinutes % 60

    if (checkinMinutePart === checkoutMinutePart) {
      // Add 1-3 minutes to avoid matching
      const adjustment = getRandomNumber(1, 3)
      clockOutMinutes += adjustment
    }

    // No variance added to clock out to maintain exact total hours
    clockOutTime = minutesToTime(clockOutMinutes)
  } else {
    // Continuous shift: no lunch break

    // Calculate clock out time (clock_in + target_minutes)
    // No variance added to maintain exact total hours
    const clockOutMinutes = clockInMinutes + targetMinutes

    clockOutTime = minutesToTime(clockOutMinutes)
  }

  const clockInDatetime = `${date}T${clockInTime}:00`
  const clockOutDatetime = `${date}T${clockOutTime}:00`

  // Build result object
  if (isSplit) {
    return {
      date,
      type: 'split',
      checkin: clockInDatetime,
      lunch_start: lunchStartDatetime,
      lunch_end: lunchEndDatetime,
      checkout: clockOutDatetime
    }
  } else {
    return {
      date,
      type: 'continuous',
      checkin: clockInDatetime,
      checkout: clockOutDatetime
    }
  }
}

/**
 * Get dates for a week starting from given date
 */
export function getWeekDates(weekStart) {
  const dates = []
  const startDate = new Date(weekStart + 'T00:00:00')

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)

    // Use local date format to avoid timezone issues
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
  }

  return dates
}

/**
 * Check if date is a work day
 */
export function isWorkDay(dateStr, workDays, exceptions = []) {
  // Find ALL exceptions that match this date (not just the first one)
  const matchingExceptions = exceptions.filter(e => {
    // Single date exception
    if (e.date === dateStr) return true

    // Date range exception (has endDate)
    if (e.endDate) {
      return dateStr >= e.date && dateStr <= e.endDate
    }

    return false
  })

  // Check if any exception excludes this day (holiday, vacation, sick, other)
  // These take priority over special_week
  const hasExcludingException = matchingExceptions.some(
    e => e.type !== 'special_week'
  )

  if (hasExcludingException) {
    return false
  }

  // Only special_week exceptions (or no exceptions) - check normal work days
  const dayOfWeek = getDayOfWeek(dateStr)
  return workDays.includes(dayOfWeek)
}

/**
 * Generate random schedule for a week
 * EXACT PORT of random::generate_weekly_schedule from random.sh
 * @param {string} weekStart - Week start date in YYYY-MM-DD format (Monday)
 * @param {object} config - Configuration object
 * @param {array} exceptions - Array of exception objects
 * @returns {array} Array of daily schedule objects
 */
export function generateWeeklySchedule(weekStart, config, exceptions = []) {
  // Get all week dates
  const allDates = getWeekDates(weekStart)

  // Check if this week has a special_week exception (modifies weekly hours)
  const specialWeekException = exceptions.find(
    e => e.type === 'special_week' && allDates.includes(e.date)
  )

  // Use special week hours if available, otherwise use default
  const weeklyHours = specialWeekException
    ? specialWeekException.weeklyHours
    : config.weeklyHours

  // Use special week split days if configured, otherwise use global config
  // Check if splitDays property exists (even if empty array)
  const splitShiftDays = (specialWeekException && specialWeekException.hasOwnProperty('splitDays'))
    ? specialWeekException.splitDays // Use configured (can be empty = no split days)
    : config.splitShiftDays // Use global config

  // Count total configured work days in a normal week (without vacations/holidays)
  // This is needed to calculate the daily hours base
  const configuredWorkDays = config.workDays.length

  // SIMPLIFIED DISTRIBUTION LOGIC (from CLI):
  // 1. Calculate average daily hours: weekly_hours / configured_work_days
  // 2. Count actual work days (excluding vacations/holidays)
  // 3. Target total: work_days × average_daily_hours
  // 4. Distribute with variance, adjust last day to exact total

  // Step 1: Calculate base daily hours (average per day)
  const baseDailyHours = weeklyHours / configuredWorkDays

  // Step 2: Count actual work days
  const workDayDates = allDates.filter(date =>
    isWorkDay(date, config.workDays, exceptions)
  )

  const workDaysCount = workDayDates.length

  // If no work days, return empty array
  if (workDaysCount === 0) {
    return []
  }

  // Step 3: Calculate target total hours for THIS week
  // Example: 35h week, 5 configured, 3 actual → 3 × 7h = 21h total
  const targetTotalHours = workDaysCount * baseDailyHours
  const totalTargetMinutes = Math.round(targetTotalHours * 60)

  // Step 4: Count split vs continuous days
  let splitDays = 0
  let continuousDays = 0

  for (const date of workDayDates) {
    if (isSplitShiftDay(date, splitShiftDays)) {
      splitDays++
    } else {
      continuousDays++
    }
  }

  // Step 5: Calculate hours per day type
  // If mixed types: continuous shorter, split longer (compensate)
  // If single type: use base for all
  let continuousMinutes = 0
  let splitMinutes = 0

  if (splitDays > 0 && continuousDays > 0) {
    // Mixed: continuous days shorter (~85% of base), split days compensate
    const baseMinutes = Math.round(baseDailyHours * 60)
    continuousMinutes = Math.round(baseMinutes * 0.85)

    // Split days get remaining hours
    const continuousTotal = continuousDays * continuousMinutes
    const splitTotal = totalTargetMinutes - continuousTotal
    splitMinutes = Math.floor(splitTotal / splitDays)
  } else if (splitDays > 0) {
    // Only split days
    splitMinutes = Math.floor(totalTargetMinutes / splitDays)
  } else if (continuousDays > 0) {
    // Only continuous days
    continuousMinutes = Math.floor(totalTargetMinutes / continuousDays)
  }

  // Step 6: Distribute hours among work days with variance
  const schedules = []
  let accumulatedMinutes = 0

  for (let i = 0; i < workDaysCount; i++) {
    const currentDate = workDayDates[i]

    // Determine base minutes for this day type
    const isSplit = isSplitShiftDay(currentDate, splitShiftDays)
    let targetMinutes = isSplit ? splitMinutes : continuousMinutes

    // Last day: adjust to exact total
    if (i === workDaysCount - 1) {
      targetMinutes = totalTargetMinutes - accumulatedMinutes
    } else {
      // Not last day: add variance (±15 minutes)
      const varianceMinutes = getRandomNumber(-15, 15)
      targetMinutes += varianceMinutes
    }

    // Convert minutes to hours for daily schedule
    const targetHours = targetMinutes / 60

    // Generate daily schedule, passing whether this day should be split
    const dailySchedule = generateDailySchedule(currentDate, targetHours, config, isSplit)
    schedules.push(dailySchedule)

    // Calculate ACTUAL worked minutes from generated schedule (not target)
    // This accounts for minute adjustments in split shifts
    if (i < workDaysCount - 1) {
      const clockIn = timeToMinutes(dailySchedule.checkin.split('T')[1].substring(0, 5))
      const clockOut = timeToMinutes(dailySchedule.checkout.split('T')[1].substring(0, 5))
      let actualMinutes = clockOut - clockIn

      if (dailySchedule.type === 'split') {
        const lunchStart = timeToMinutes(dailySchedule.lunch_start.split('T')[1].substring(0, 5))
        const lunchEnd = timeToMinutes(dailySchedule.lunch_end.split('T')[1].substring(0, 5))
        actualMinutes -= (lunchEnd - lunchStart)
      }

      accumulatedMinutes += actualMinutes
    }
  }

  return schedules
}

/**
 * Calculate total hours from schedule
 */
export function calculateTotalHours(schedule) {
  let totalMinutes = 0

  for (const day of schedule) {
    const clockIn = timeToMinutes(day.checkin.split('T')[1].substring(0, 5))
    const clockOut = timeToMinutes(day.checkout.split('T')[1].substring(0, 5))

    let dayMinutes = clockOut - clockIn

    // Subtract lunch if split shift
    if (day.type === 'split') {
      const lunchStart = timeToMinutes(day.lunch_start.split('T')[1].substring(0, 5))
      const lunchEnd = timeToMinutes(day.lunch_end.split('T')[1].substring(0, 5))
      const lunchMinutes = lunchEnd - lunchStart
      dayMinutes -= lunchMinutes
    }

    totalMinutes += dayMinutes
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return {
    hours,
    minutes,
    totalMinutes,
    formatted: `${hours}h ${minutes}m`
  }
}

/**
 * Get day name from date
 */
export function getDayName(dateStr) {
  const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const date = new Date(dateStr + 'T00:00:00')
  return daysEs[date.getDay()]
}

/**
 * Format schedule for display
 */
export function formatScheduleForDisplay(schedule) {
  return schedule.map(day => {
    const clockInTime = day.checkin.split('T')[1].substring(0, 5)
    const clockOutTime = day.checkout.split('T')[1].substring(0, 5)

    const clockInMinutes = timeToMinutes(clockInTime)
    const clockOutMinutes = timeToMinutes(clockOutTime)
    let totalMinutes = clockOutMinutes - clockInMinutes

    if (day.type === 'split') {
      const lunchStartTime = day.lunch_start.split('T')[1].substring(0, 5)
      const lunchEndTime = day.lunch_end.split('T')[1].substring(0, 5)
      const lunchMinutes = timeToMinutes(lunchEndTime) - timeToMinutes(lunchStartTime)
      totalMinutes -= lunchMinutes
    }

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return {
      date: day.date,
      dayName: getDayName(day.date),
      clockIn: clockInTime,
      clockOut: clockOutTime,
      total: `${hours}h ${minutes}m`,
      type: day.type,
      raw: day
    }
  })
}
