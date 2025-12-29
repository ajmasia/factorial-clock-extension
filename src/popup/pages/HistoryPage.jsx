import { useState, useEffect } from 'react'

function HistoryPage() {
  const [history, setHistory] = useState([])
  const [expandedId, setExpandedId] = useState(null)

  // Load history from Chrome Storage on mount
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    const result = await chrome.storage.sync.get(['history'])
    if (result.history) {
      setHistory(result.history)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this schedule from history?')) return

    const updatedHistory = history.filter(item => item.id !== id)
    await chrome.storage.sync.set({ history: updatedHistory })
    setHistory(updatedHistory)
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const formatDateTime = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">History</h2>
        <p className="text-sm text-gray-600 mt-1">
          View previously generated and applied schedules
        </p>
      </div>

      {/* History List */}
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="card text-center py-8">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-600">No schedules generated yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Go to Generate tab to create your first schedule
            </p>
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      Week of {item.weekStart}
                    </h3>
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>📅 {item.schedule?.length || 0} days</span>
                    <span>⏱️ {item.totals?.formatted || '0h 0m'}</span>
                    <span>🕐 {formatDateTime(item.appliedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-red-600 hover:text-red-700 font-medium text-sm ml-3"
                >
                  Delete
                </button>
              </div>

              {/* Expanded Details */}
              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-2">
                    {item.schedule?.map((day) => (
                      <div
                        key={day.date}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {day.dayName} - {day.date}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {day.clockIn} - {day.clockOut}
                            {day.type === 'split' && day.raw?.lunch_start && (
                              <span className="ml-2">
                                (Lunch: {day.raw.lunch_start.split('T')[1].substring(0, 5)} - {day.raw.lunch_end.split('T')[1].substring(0, 5)})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-primary-600 font-medium">
                          {day.total}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Weekly Total</span>
                    <span className="text-lg font-bold text-primary-600">
                      {item.totals?.formatted || '0h 0m'}
                    </span>
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

export default HistoryPage
