import { useState, useEffect } from 'react'
import { loadHistory as loadStoredHistory, saveHistory } from '../../lib/history-storage.js'
import { summarizeDays, SHIFT_STATUS } from '../../lib/apply-results.js'
import { undoTargets, canUndo, canMarkNotFound, isUndoRunning, UNDO_STATUS, UNDO_SHIFT_STATUS } from '../../lib/undo.js'

const UNDO_BADGE = {
  [UNDO_STATUS.IN_PROGRESS]: { label: 'undoing…', className: 'bg-blue-100 text-blue-700' },
  [UNDO_STATUS.DONE]: { label: 'undone', className: 'bg-gray-200 text-gray-700' },
  [UNDO_STATUS.PARTIAL]: { label: 'partially undone', className: 'bg-yellow-100 text-yellow-800' },
  [UNDO_STATUS.FAILED]: { label: 'undo failed', className: 'bg-red-100 text-red-700' },
}

const STATUS_BADGE = {
  applied: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-700',
}

// "2026-11-09T07:12:00+01:00" → "07:12"
const timeOf = (isoDateTime) => isoDateTime.slice(11, 16)

function HistoryPage() {
  const [history, setHistory] = useState([])
  const [expandedId, setExpandedId] = useState(null)

  const [busyId, setBusyId] = useState(null)

  // Load history on mount, and follow changes made by the service worker (an undo in progress, #18)
  useEffect(() => {
    loadHistory()
    const onChanged = (changes, area) => {
      if (area === 'local' && changes.history) setHistory(changes.history.newValue || [])
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const handleUndo = async (item) => {
    const targets = undoTargets(item)
    const list = targets.map((t) => `  ${t.date}  ${timeOf(t.clockIn)} - ${timeOf(t.clockOut)}`).join('\n')
    const message =
      `Delete these ${targets.length} shift(s) from Factorial?\n\n${list}\n\n` +
      'They are deleted even if you edited them in Factorial afterwards. ' +
      'Shifts you added yourself are not touched.'
    if (!confirm(message)) return

    setBusyId(item.id)
    try {
      const response = await chrome.runtime.sendMessage({ action: 'undoWeek', data: { entryId: item.id } })
      if (!response.success) {
        alert(`Undo failed: ${response.error}`)
      } else {
        const { summary, remaining } = response.data
        let text = `Deleted: ${summary.deleted}. Not found in Factorial: ${summary.notFound}.`
        if (remaining > 0) text += `\n${remaining} shift(s) could not be deleted; see the details and retry.`
        alert(text)
      }
    } catch (error) {
      alert(`Undo failed: ${error.message}`)
    } finally {
      setBusyId(null)
      loadHistory()
    }
  }

  const handleMarkRemoved = async (item) => {
    const message =
      'Factorial did not find any of these shifts. Mark them as removed?\n\n' +
      'Do this only after checking in Factorial that this week has no shifts left from the extension.'
    if (!confirm(message)) return
    const response = await chrome.runtime.sendMessage({ action: 'markUndoRemoved', data: { entryId: item.id } })
    if (!response.success) alert(`Could not update the entry: ${response.error}`)
    loadHistory()
  }

  const loadHistory = async () => {
    setHistory(await loadStoredHistory())
  }

  const handleDelete = async (id) => {
    const item = history.find(entry => entry.id === id)
    if (item && isUndoRunning(item)) {
      alert('This week is being undone. Wait until it finishes before deleting it from History.')
      return
    }
    if (!confirm('Delete this schedule from history?')) return

    // Re-read so changes made meanwhile by the service worker are kept
    const updatedHistory = (await loadStoredHistory()).filter(entry => entry.id !== id)
    await saveHistory(updatedHistory)
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
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_BADGE[item.status] || STATUS_BADGE.applied}`}>
                      {item.status}
                    </span>
                    {item.undo && UNDO_BADGE[item.undo.status] && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${UNDO_BADGE[item.undo.status].className}`}>
                        {UNDO_BADGE[item.undo.status].label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>📅 {item.schedule?.length || 0} days</span>
                    {item.days && (() => {
                      const { created, total } = summarizeDays(item.days)
                      return <span>✅ {created}/{total} shifts</span>
                    })()}
                    <span>⏱️ {item.totals?.formatted || '0h 0m'}</span>
                    <span>🕐 {formatDateTime(item.appliedAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-3">
                  {canUndo(item) && (
                    <button
                      onClick={() => handleUndo(item)}
                      disabled={busyId !== null}
                      className="text-primary-600 hover:text-primary-700 font-medium text-sm disabled:opacity-50"
                    >
                      {busyId === item.id ? 'Undoing…' : item.undo ? 'Retry undo' : 'Undo week'}
                    </button>
                  )}
                  {canMarkNotFound(item) && (
                    <button
                      onClick={() => handleMarkRemoved(item)}
                      className="text-gray-600 hover:text-gray-800 font-medium text-sm"
                    >
                      Mark as removed
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    Delete
                  </button>
                </div>
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
                  {/* Per-shift results, stored since #18 (older entries have none) */}
                  {item.days && (
                    <div className="mt-3 space-y-1">
                      <div className="text-xs font-semibold text-gray-700">Shifts in Factorial</div>
                      {item.days.map((day) => day.shifts.map((shift, index) => (
                        <div key={`${day.date}-${index}`} className="flex items-start justify-between text-xs">
                          <span className="text-gray-700">
                            {day.date} · {timeOf(shift.clockIn)} - {timeOf(shift.clockOut)}
                          </span>
                          {shift.status === SHIFT_STATUS.CREATED && shift.undo ? (
                            shift.undo.status === UNDO_SHIFT_STATUS.DELETED ? (
                              <span className="text-gray-600">deleted</span>
                            ) : shift.undo.status === UNDO_SHIFT_STATUS.NOT_FOUND ? (
                              <span className="text-yellow-700 text-right ml-2">not found (probably deleted already)</span>
                            ) : (
                              <span className="text-red-700 text-right ml-2">not deleted: {shift.undo.error}</span>
                            )
                          ) : shift.status === SHIFT_STATUS.CREATED ? (
                            <span className="text-green-700">created</span>
                          ) : shift.status === SHIFT_STATUS.SKIPPED ? (
                            <span className="text-gray-500 text-right ml-2">skipped: {shift.error}</span>
                          ) : (
                            <span className="text-red-700 text-right ml-2">failed: {shift.error}</span>
                          )}
                        </div>
                      )))}
                    </div>
                  )}
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
