import { useState, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

function DatePicker({ value, onChange, placeholder = 'Select date', onValidChange }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [inputValue, setInputValue] = useState(value || '')
  const [hasError, setHasError] = useState(false)

  // Sync input value with prop value
  useEffect(() => {
    setInputValue(value || '')
    setHasError(false)
  }, [value])

  const handleSelect = (date) => {
    if (date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      onChange(dateStr)
      setInputValue(dateStr)
      setShowCalendar(false)
      setHasError(false)
      if (onValidChange) onValidChange(true)
    }
  }

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Clear value if empty
    if (!newValue) {
      onChange('')
      setHasError(false)
      if (onValidChange) onValidChange(true)
      return
    }

    // Validate date format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
      const date = new Date(newValue + 'T00:00:00')
      if (!isNaN(date.getTime())) {
        onChange(newValue)
        setHasError(false)
        if (onValidChange) onValidChange(true)
      } else {
        // Invalid date
        onChange('')
        setHasError(true)
        if (onValidChange) onValidChange(false)
      }
    } else if (newValue.length === 10) {
      // Format complete but invalid
      onChange('')
      setHasError(true)
      if (onValidChange) onValidChange(false)
    } else {
      // Still typing
      onChange('')
      setHasError(false)
      if (onValidChange) onValidChange(false)
    }
  }

  const handleInputBlur = () => {
    // If input is empty, clear the value
    if (!inputValue) {
      onChange('')
      setHasError(false)
      if (onValidChange) onValidChange(true)
      return
    }

    // Validate format on blur
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inputValue)) {
      // Invalid format
      setHasError(true)
      if (onValidChange) onValidChange(false)
      return
    }

    // Validate date is valid
    const date = new Date(inputValue + 'T00:00:00')
    if (isNaN(date.getTime())) {
      // Invalid date
      setHasError(true)
      if (onValidChange) onValidChange(false)
    }
  }

  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined

  return (
    <div>
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="YYYY-MM-DD"
            className={`input pr-10 ${hasError ? 'border-red-500 focus:ring-red-500' : ''}`}
            maxLength={10}
          />
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>

        {showCalendar && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowCalendar(false)}
            />

            {/* Calendar */}
            <div className="absolute right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-3">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleSelect}
                weekStartsOn={1}
              />
            </div>
          </>
        )}
      </div>

      {hasError && (
        <p className="text-xs text-red-600 mt-1">Invalid date format or value</p>
      )}
    </div>
  )
}

export default DatePicker
