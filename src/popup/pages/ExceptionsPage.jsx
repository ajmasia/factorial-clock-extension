import { useState, useEffect } from 'react'
import DatePicker from '../components/DatePicker'

function ExceptionsPage() {
  const [exceptions, setExceptions] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [newException, setNewException] = useState({
    date: '',
    endDate: '', // For date ranges (vacation, holiday, etc.)
    type: 'holiday',
    reason: '',
    weeklyHours: 40, // For special_week type
    splitDays: [] // For special_week type: which days are split shifts
  })
  const [isStartDateValid, setIsStartDateValid] = useState(true)
  const [isEndDateValid, setIsEndDateValid] = useState(true)

  const weekDays = [
    { id: 1, label: 'Lun' },
    { id: 2, label: 'Mar' },
    { id: 3, label: 'Mié' },
    { id: 4, label: 'Jue' },
    { id: 5, label: 'Vie' },
    { id: 6, label: 'Sáb' },
    { id: 7, label: 'Dom' },
  ]

  const toggleSplitDay = (dayId) => {
    setNewException(prev => ({
      ...prev,
      splitDays: prev.splitDays.includes(dayId)
        ? prev.splitDays.filter(d => d !== dayId)
        : [...prev.splitDays, dayId].sort()
    }))
  }

  // Get unique exception types from user's exceptions
  const getUniqueTypes = () => {
    const types = [...new Set(exceptions.map(e => e.type))]
    return types.sort()
  }

  // Filter exceptions by type
  const getFilteredExceptions = () => {
    if (filterType === 'all') {
      return exceptions
    }
    return exceptions.filter(e => e.type === filterType)
  }

  // Check if form is valid
  const isFormValid = () => {
    // Required fields
    if (!newException.date || !newException.reason) {
      return false
    }

    // Date validation states
    if (!isStartDateValid || !isEndDateValid) {
      return false
    }

    // End date must be after or equal to start date
    if (newException.endDate && newException.endDate < newException.date) {
      return false
    }

    // Special week validation
    if (newException.type === 'special_week') {
      const hours = Number(newException.weeklyHours)
      if (!newException.weeklyHours || isNaN(hours) || hours <= 0 || hours > 168) {
        return false
      }
    }

    return true
  }

  // Load exceptions from Chrome Storage on mount
  useEffect(() => {
    loadExceptions()
  }, [])

  const loadExceptions = async () => {
    const result = await chrome.storage.sync.get(['exceptions'])
    if (result.exceptions) {
      setExceptions(result.exceptions)
    }
  }

  const saveExceptions = async (updatedExceptions) => {
    await chrome.storage.sync.set({ exceptions: updatedExceptions })
    setExceptions(updatedExceptions)
  }

  const handleEdit = (exception) => {
    setEditingId(exception.id)
    setNewException({
      date: exception.date,
      endDate: exception.endDate || '',
      type: exception.type,
      reason: exception.reason,
      weeklyHours: exception.weeklyHours || 40,
      splitDays: exception.splitDays || []
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setNewException({
      date: '',
      endDate: '',
      type: 'holiday',
      reason: '',
      weeklyHours: 40,
      splitDays: []
    })
    setIsStartDateValid(true)
    setIsEndDateValid(true)
  }

  const handleAdd = async () => {
    if (!newException.date || !newException.reason) {
      alert('Please fill all required fields')
      return
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newException.date)) {
      alert('Invalid start date format. Please use YYYY-MM-DD')
      return
    }

    // Validate date is valid
    const startDate = new Date(newException.date + 'T00:00:00')
    if (isNaN(startDate.getTime())) {
      alert('Invalid start date. Please enter a valid date.')
      return
    }

    // Validate end date if provided
    if (newException.endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newException.endDate)) {
        alert('Invalid end date format. Please use YYYY-MM-DD')
        return
      }

      const endDate = new Date(newException.endDate + 'T00:00:00')
      if (isNaN(endDate.getTime())) {
        alert('Invalid end date. Please enter a valid date.')
        return
      }

      if (endDate < startDate) {
        alert('End date must be equal to or after start date')
        return
      }
    }

    // For special_week, validate weekly hours
    if (newException.type === 'special_week' && !newException.weeklyHours) {
      alert('Please specify weekly hours for special week')
      return
    }

    // Validate weekly hours is a valid number
    if (newException.type === 'special_week') {
      const hours = Number(newException.weeklyHours)
      if (isNaN(hours) || hours <= 0 || hours > 168) {
        alert('Weekly hours must be between 1 and 168')
        return
      }
    }

    const exception = {
      id: editingId || Date.now(),
      date: newException.date,
      type: newException.type,
      reason: newException.reason
    }

    // Add endDate for date ranges (if provided)
    if (newException.endDate && newException.endDate >= newException.date) {
      exception.endDate = newException.endDate
    }

    // Add weeklyHours and splitDays for special_week type
    if (newException.type === 'special_week') {
      exception.weeklyHours = Number(newException.weeklyHours)
      // Always save splitDays (even if empty) to override global config
      // Empty array = no split days for this week
      exception.splitDays = newException.splitDays
    }

    let updatedExceptions
    if (editingId) {
      // Update existing exception
      updatedExceptions = exceptions.map(e => e.id === editingId ? exception : e)
    } else {
      // Add new exception
      updatedExceptions = [...exceptions, exception]
    }

    await saveExceptions(updatedExceptions)

    // Reset form
    setNewException({
      date: '',
      endDate: '',
      type: 'holiday',
      reason: '',
      weeklyHours: 40,
      splitDays: []
    })
    setIsStartDateValid(true)
    setIsEndDateValid(true)

    if (editingId) {
      setEditingId(null)
    } else {
      setShowAddForm(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this exception?')) return

    const updatedExceptions = exceptions.filter(e => e.id !== id)
    await saveExceptions(updatedExceptions)
  }

  const getTypeEmoji = (type) => {
    switch (type) {
      case 'holiday': return '🎉'
      case 'vacation': return '🏖️'
      case 'sick': return '🤒'
      case 'special_week': return '⭐'
      default: return '📅'
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'holiday': return 'Holiday'
      case 'vacation': return 'Vacation'
      case 'sick': return 'Sick Leave'
      case 'special_week': return 'Special Week'
      default: return 'Other'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Exceptions</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage holidays, vacations, and special weeks
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary"
        >
          + Add Exception
        </button>
      </div>

      {/* Filter */}
      {exceptions.length > 0 && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by type:</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              All ({exceptions.length})
            </button>
            {getUniqueTypes().map(type => {
              const count = exceptions.filter(e => e.type === type).length
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    filterType === type
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {getTypeEmoji(type)} {getTypeLabel(type)} ({count})
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">
            {editingId ? 'Edit Exception' : 'New Exception'}
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <select
              value={newException.type}
              onChange={(e) => setNewException({ ...newException, type: e.target.value })}
              className="input"
            >
              <option value="holiday">🎉 Holiday</option>
              <option value="vacation">🏖️ Vacation</option>
              <option value="sick">🤒 Sick Leave</option>
              <option value="special_week">⭐ Special Week</option>
              <option value="other">📅 Other</option>
            </select>
            {newException.type === 'special_week' && (
              <p className="text-xs text-gray-500 mt-1">
                Special weeks have custom weekly hours (e.g., 35h for short weeks)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <DatePicker
              value={newException.date}
              onChange={(date) => setNewException({ ...newException, date })}
              onValidChange={setIsStartDateValid}
              placeholder="Select start date"
            />
          </div>

          {newException.type !== 'special_week' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (Optional)
              </label>
              <DatePicker
                value={newException.endDate}
                onChange={(date) => setNewException({ ...newException, endDate: date })}
                onValidChange={setIsEndDateValid}
                placeholder="Select end date"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for single day, or select to create a date range
              </p>
            </div>
          )}

          {newException.type === 'special_week' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weekly Hours
                </label>
                <input
                  type="number"
                  value={newException.weeklyHours}
                  onChange={(e) => setNewException({ ...newException, weeklyHours: e.target.value })}
                  placeholder="e.g., 35"
                  className="input"
                  min="1"
                  max="60"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Total hours for this week (instead of default weekly hours)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Split Days (Optional)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Select which days have lunch break (split shift) for this special week. Leave empty to use global config.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {weekDays.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleSplitDay(day.id)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        newException.splitDays.includes(day.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason
            </label>
            <input
              type="text"
              value={newException.reason}
              onChange={(e) => setNewException({ ...newException, reason: e.target.value })}
              placeholder="e.g., Christmas Day, Summer vacation, etc."
              className="input"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!isFormValid()}
              className={`btn flex-1 ${isFormValid() ? 'btn-primary' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
            >
              {editingId ? '✓ Save' : '✓ Add'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingId(null)
                setNewException({
                  date: '',
                  endDate: '',
                  type: 'holiday',
                  reason: '',
                  weeklyHours: 40,
                  splitDays: []
                })
                setIsStartDateValid(true)
                setIsEndDateValid(true)
              }}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Exceptions List */}
      <div className="space-y-2">
        {exceptions.length === 0 ? (
          <div className="card text-center py-8">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-600">No exceptions configured</p>
            <p className="text-sm text-gray-500 mt-1">
              Add holidays, vacations, or special weeks
            </p>
          </div>
        ) : getFilteredExceptions().length === 0 ? (
          <div className="card text-center py-8">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-gray-600">No exceptions found</p>
            <p className="text-sm text-gray-500 mt-1">
              No exceptions match the selected filter
            </p>
          </div>
        ) : (
          getFilteredExceptions()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((exception) => (
              <div key={exception.id}>
                {editingId === exception.id ? (
                  // Edit form inline
                  <div className="card space-y-4 border-2 border-primary-500">
                    <h3 className="font-semibold text-gray-900">Edit Exception</h3>
                    {/* Reuse the same form content */}
                    {/* Type field - same as add form */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                      <select value={newException.type} onChange={(e) => setNewException({ ...newException, type: e.target.value })} className="input">
                        <option value="holiday">🎉 Holiday</option>
                        <option value="vacation">🏖️ Vacation</option>
                        <option value="sick">🤒 Sick Leave</option>
                        <option value="special_week">⭐ Special Week</option>
                        <option value="other">📅 Other</option>
                      </select>
                    </div>
                    {/* Start Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <DatePicker value={newException.date} onChange={(date) => setNewException({ ...newException, date })} onValidChange={setIsStartDateValid} />
                    </div>
                    {/* End Date */}
                    {newException.type !== 'special_week' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date (Optional)</label>
                        <DatePicker value={newException.endDate} onChange={(date) => setNewException({ ...newException, endDate: date })} onValidChange={setIsEndDateValid} />
                      </div>
                    )}
                    {/* Special week fields */}
                    {newException.type === 'special_week' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Hours</label>
                          <input type="number" value={newException.weeklyHours} onChange={(e) => setNewException({ ...newException, weeklyHours: e.target.value })} className="input" min="1" max="60" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Split Days (Optional)</label>
                          <div className="flex gap-2 flex-wrap">
                            {weekDays.map(day => (
                              <button key={day.id} type="button" onClick={() => toggleSplitDay(day.id)} className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${newException.splitDays.includes(day.id) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                                {day.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    {/* Reason */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                      <input type="text" value={newException.reason} onChange={(e) => setNewException({ ...newException, reason: e.target.value })} className="input" />
                    </div>
                    {/* Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAdd}
                        disabled={!isFormValid()}
                        className={`btn flex-1 ${isFormValid() ? 'btn-primary' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      >
                        ✓ Save
                      </button>
                      <button onClick={handleCancelEdit} className="btn btn-secondary flex-1">Cancel</button>
                    </div>
                  </div>
                ) : (
                  // Display exception
                  <div className="card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getTypeEmoji(exception.type)}</span>
                        <div>
                          <div className="font-medium text-gray-900">{exception.reason}</div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <span>📅 {exception.date}{exception.endDate && ` - ${exception.endDate}`}</span>
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{getTypeLabel(exception.type)}</span>
                            {exception.type === 'special_week' && (<span className="text-primary-600 font-medium">⏱️ {exception.weeklyHours}h week</span>)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handleEdit(exception)} className="text-primary-600 hover:text-primary-700 font-medium text-sm">Edit</button>
                        <button onClick={() => handleDelete(exception.id)} className="text-red-600 hover:text-red-700 font-medium text-sm">Delete</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
        )}
      </div>
    </div>
  )
}

export default ExceptionsPage
