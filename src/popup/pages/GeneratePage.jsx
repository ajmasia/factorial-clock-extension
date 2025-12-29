import { useState, useEffect } from 'react'

function GeneratePage() {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [schedule, setSchedule] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState('')

  // Get current week in YYYY-Www format
  useEffect(() => {
    const weekInfo = getISOWeek(new Date())
    setSelectedWeek(`${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`)
  }, [])

  // Get ISO week number and year from date (ISO 8601 - week starts on Monday)
  function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7 // Monday = 1, Sunday = 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum) // Thursday of this week

    // Get the ISO week-year (year of the Thursday)
    const year = d.getUTCFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)

    return { year, week: weekNumber }
  }

  // Get week number from date (for compatibility)
  function getWeekNumber(date) {
    return getISOWeek(date).week
  }

  // Convert YYYY-Www to Monday date (local timezone)
  function weekToDate(weekString) {
    const [year, week] = weekString.split('-W').map(Number)
    const jan4 = new Date(year, 0, 4)
    const monday = new Date(jan4)
    monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1)
    monday.setDate(monday.getDate() + (week - 1) * 7)

    // Use local date format to avoid timezone issues
    const y = monday.getFullYear()
    const m = String(monday.getMonth() + 1).padStart(2, '0')
    const d = String(monday.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Navigate to previous week
  function goToPreviousWeek() {
    const currentMonday = new Date(weekToDate(selectedWeek))
    currentMonday.setDate(currentMonday.getDate() - 7)
    const weekInfo = getISOWeek(currentMonday)
    setSelectedWeek(`${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`)
  }

  // Navigate to current week
  function goToCurrentWeek() {
    const now = new Date()
    const weekInfo = getISOWeek(now)
    setSelectedWeek(`${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`)
  }

  // Navigate to next week
  function goToNextWeek() {
    const currentMonday = new Date(weekToDate(selectedWeek))
    currentMonday.setDate(currentMonday.getDate() + 7)
    const weekInfo = getISOWeek(currentMonday)
    setSelectedWeek(`${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`)
  }

  // Get date range for display (Monday - Sunday)
  function getWeekRange(weekString) {
    const monday = new Date(weekToDate(weekString))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const formatDate = (date, showYear = false) => {
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return showYear ? `${day}/${month}/${year}` : `${day}/${month}`
    }

    // Show year if the week spans across different years
    const showYears = monday.getFullYear() !== sunday.getFullYear()

    if (showYears) {
      return `${formatDate(monday, true)} - ${formatDate(sunday, true)}`
    } else {
      return `${formatDate(monday)} - ${formatDate(sunday)}`
    }
  }

  const handleGenerate = async () => {
    setLoading(true)
    setSchedule(null)

    try {
      const weekStart = weekToDate(selectedWeek)

      // Call background script to generate schedule
      const response = await chrome.runtime.sendMessage({
        action: 'generateSchedule',
        data: { weekStart }
      })

      if (response.success) {
        setSchedule(response.data)
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      alert(`Failed to generate schedule: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!schedule) return

    if (!confirm('Apply this schedule to Factorial?')) {
      return
    }

    setApplying(true)

    try {
      // Apply schedule
      const response = await chrome.runtime.sendMessage({
        action: 'applySchedule',
        data: schedule
      })

      if (response.success) {
        // Save to history
        console.log('Saving to history...', schedule)
        const historyResponse = await chrome.runtime.sendMessage({
          action: 'saveToHistory',
          data: schedule
        })
        console.log('History save response:', historyResponse)

        if (historyResponse.success) {
          console.log('Saved to history successfully')
        } else {
          console.error('Failed to save to history:', historyResponse.error)
        }

        alert(`Schedule applied successfully! ${response.data.shiftsCreated} shifts created.`)
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      alert(`Failed to apply schedule: ${error.message}`)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Generate Week</h2>
        <p className="text-sm text-gray-600 mt-1">
          Generate random schedule for current or selected week
        </p>
      </div>

      {/* Week Selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Week
        </label>

        {/* Week Navigation */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={goToPreviousWeek}
            className="btn btn-secondary flex-shrink-0"
            disabled={!selectedWeek}
          >
            ← Previous
          </button>
          <button
            onClick={goToCurrentWeek}
            className="btn btn-primary flex-1"
            disabled={!selectedWeek}
          >
            This Week
          </button>
          <button
            onClick={goToNextWeek}
            className="btn btn-secondary flex-shrink-0"
            disabled={!selectedWeek}
          >
            Next →
          </button>
        </div>

        {/* Week Range Display */}
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            {selectedWeek ? (
              <>
                Week {selectedWeek.split('-W')[1]}, {selectedWeek.split('-W')[0]}
              </>
            ) : '-'}
          </div>
          <div className="font-semibold text-gray-900">
            {selectedWeek ? getWeekRange(selectedWeek) : '-'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Starts Monday: {selectedWeek ? weekToDate(selectedWeek) : '-'}
          </div>
        </div>

      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !selectedWeek}
        className="btn btn-primary w-full"
      >
        {loading ? '⏳ Generating...' : '🎲 Generate Schedule'}
      </button>

      {/* Schedule Preview */}
      {schedule && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Preview</h3>
            <span className="text-sm text-gray-500">Week of {schedule.weekStart}</span>
          </div>

          <div className="space-y-2">
            {schedule.schedule.map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-gray-900">
                      {day.dayName} - {day.date}
                    </div>
                    {day.type === 'split' && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                        Split
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {day.clockIn} - {day.clockOut}
                  </div>
                  {day.type === 'split' && day.raw.lunch_start && (
                    <div className="text-xs text-gray-500 mt-1">
                      🍽️ Lunch: {day.raw.lunch_start.split('T')[1].substring(0, 5)} - {day.raw.lunch_end.split('T')[1].substring(0, 5)}
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium text-primary-600">
                  {day.total}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">Weekly Total</span>
              <span className="text-lg font-bold text-primary-600">
                {schedule.totals.formatted}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="btn btn-secondary flex-1"
            >
              🔄 Regenerate
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="btn btn-primary flex-1"
            >
              {applying ? '⏳ Applying...' : '✓ Apply to Factorial'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneratePage
