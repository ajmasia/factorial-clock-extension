import { useState, useEffect } from 'react'

function ConfigPage() {
  const [config, setConfig] = useState({
    weeklyHours: 40,
    workDays: [1, 2, 3, 4, 5],
    clockInRange: { start: '07:00', end: '07:30' },
    lunchStartRange: { start: '14:00', end: '15:00' },
    lunchDuration: { min: 45, max: 60 },
    splitShiftDays: [1, 2, 3],
    randomVariance: 5,
    employeeId: 'auto',
  })

  const weekDays = [
    { id: 1, label: 'Mon' },
    { id: 2, label: 'Tue' },
    { id: 3, label: 'Wed' },
    { id: 4, label: 'Thu' },
    { id: 5, label: 'Fri' },
    { id: 6, label: 'Sat' },
    { id: 7, label: 'Sun' },
  ]

  // Load config from Chrome Storage on mount
  useEffect(() => {
    loadConfig()
  }, [])

  // Auto-fetch employee ID if not set
  useEffect(() => {
    if (config.employeeId === 'auto' || config.employeeId === '') {
      autoFetchEmployeeId()
    }
  }, [config.employeeId])

  const autoFetchEmployeeId = async () => {
    try {
      console.log('[ConfigPage] Auto-fetching Employee ID...')
      const response = await chrome.runtime.sendMessage({ action: 'getEmployeeId' })

      if (response.success && response.data) {
        console.log('[ConfigPage] Auto-fetched Employee ID:', response.data)
        setConfig(prev => ({ ...prev, employeeId: String(response.data) }))
        // Save automatically
        chrome.storage.sync.set({ config: { ...config, employeeId: String(response.data) } })
      }
    } catch (error) {
      console.log('[ConfigPage] Auto-fetch failed (will use manual entry):', error.message)
    }
  }

  const loadConfig = async () => {
    const result = await chrome.storage.sync.get(['config'])
    if (result.config) {
      setConfig(result.config)
    }
  }

  const toggleWorkDay = (dayId) => {
    setConfig(prev => ({
      ...prev,
      workDays: prev.workDays.includes(dayId)
        ? prev.workDays.filter(d => d !== dayId)
        : [...prev.workDays, dayId].sort()
    }))
  }

  const toggleSplitDay = (dayId) => {
    setConfig(prev => ({
      ...prev,
      splitShiftDays: prev.splitShiftDays.includes(dayId)
        ? prev.splitShiftDays.filter(d => d !== dayId)
        : [...prev.splitShiftDays, dayId].sort()
    }))
  }

  const handleSave = () => {
    chrome.storage.sync.set({ config }, () => {
      alert('Configuration saved!')
    })
  }

  const handleAutoDetectEmployeeId = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getEmployeeId' })

      if (response.success) {
        setConfig(prev => ({ ...prev, employeeId: String(response.data) }))
        alert(`Employee ID detected: ${response.data}`)
      } else {
        alert(`Failed to detect Employee ID: ${response.error}`)
      }
    } catch (error) {
      console.error('Error auto-detecting Employee ID:', error)
      alert('Failed to detect Employee ID. Please enter it manually.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuration</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure your weekly schedule preferences
        </p>
      </div>

      {/* Weekly Hours */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default Weekly Hours
        </label>
        <input
          type="number"
          value={config.weeklyHours}
          onChange={(e) => setConfig({ ...config, weeklyHours: Number(e.target.value) })}
          className="input"
          min="1"
          max="60"
        />
        <p className="text-xs text-gray-500 mt-1">
          Target hours per week (e.g., 40)
        </p>
      </div>

      {/* Employee ID */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Employee ID
          {config.employeeId && config.employeeId !== 'auto' && (
            <span className="ml-2 text-xs text-green-600 font-normal">✓ Detected</span>
          )}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={config.employeeId}
            onChange={(e) => setConfig({ ...config, employeeId: e.target.value })}
            placeholder="Will be auto-detected"
            className="input flex-1"
            readOnly={config.employeeId && config.employeeId !== 'auto'}
          />
          <button
            onClick={handleAutoDetectEmployeeId}
            className="btn btn-secondary whitespace-nowrap"
          >
            Refresh
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Employee ID is automatically detected from your Factorial session
        </p>
      </div>

      {/* Work Days */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Work Days
        </label>
        <div className="flex gap-2">
          {weekDays.map(day => (
            <button
              key={day.id}
              onClick={() => toggleWorkDay(day.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                config.workDays.includes(day.id)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Split Shift Days */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Split Shift Days (Jornada Partida)
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Days with lunch break (split shift). These days will be longer (7:30-8:30h).
        </p>
        <div className="flex gap-2">
          {weekDays.map(day => (
            <button
              key={day.id}
              onClick={() => toggleSplitDay(day.id)}
              disabled={!config.workDays.includes(day.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                config.splitShiftDays.includes(day.id)
                  ? 'bg-blue-600 text-white'
                  : config.workDays.includes(day.id)
                  ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lunch Range */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lunch Start Time Range (Split Days)
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-600">From</label>
            <input
              type="time"
              value={config.lunchStartRange.start}
              onChange={(e) => setConfig({
                ...config,
                lunchStartRange: { ...config.lunchStartRange, start: e.target.value }
              })}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">To</label>
            <input
              type="time"
              value={config.lunchStartRange.end}
              onChange={(e) => setConfig({
                ...config,
                lunchStartRange: { ...config.lunchStartRange, end: e.target.value }
              })}
              className="input mt-1"
            />
          </div>
        </div>
      </div>

      {/* Lunch Duration */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lunch Duration Range (Split Days)
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Random lunch duration in minutes for split shift days
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-600">Min (minutes)</label>
            <input
              type="number"
              value={config.lunchDuration.min}
              onChange={(e) => setConfig({
                ...config,
                lunchDuration: { ...config.lunchDuration, min: Number(e.target.value) }
              })}
              className="input mt-1"
              min="15"
              max="120"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Max (minutes)</label>
            <input
              type="number"
              value={config.lunchDuration.max}
              onChange={(e) => setConfig({
                ...config,
                lunchDuration: { ...config.lunchDuration, max: Number(e.target.value) }
              })}
              className="input mt-1"
              min="15"
              max="120"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Current range: {config.lunchDuration.min}-{config.lunchDuration.max} minutes
        </p>
      </div>

      {/* Clock In Range */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Clock In Time Range
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-600">From</label>
            <input
              type="time"
              value={config.clockInRange.start}
              onChange={(e) => setConfig({
                ...config,
                clockInRange: { ...config.clockInRange, start: e.target.value }
              })}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">To</label>
            <input
              type="time"
              value={config.clockInRange.end}
              onChange={(e) => setConfig({
                ...config,
                clockInRange: { ...config.clockInRange, end: e.target.value }
              })}
              className="input mt-1"
            />
          </div>
        </div>
      </div>

      {/* Random Variance */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Random Variance (minutes)
        </label>
        <input
          type="range"
          value={config.randomVariance}
          onChange={(e) => setConfig({ ...config, randomVariance: Number(e.target.value) })}
          className="w-full"
          min="0"
          max="15"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>0 min</span>
          <span className="font-medium text-primary-600">{config.randomVariance} min</span>
          <span>15 min</span>
        </div>
      </div>

      {/* Save Button */}
      <button onClick={handleSave} className="btn btn-primary w-full">
        💾 Save Configuration
      </button>
    </div>
  )
}

export default ConfigPage
