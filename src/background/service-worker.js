// Background Service Worker for Factorial Clock Extension
import {
  generateWeeklySchedule,
  calculateTotalHours,
  formatScheduleForDisplay
} from '../lib/scheduler.js'
import { TIMING, STORAGE, ERROR_STRINGS, API } from '../lib/constants.js'
import { planShifts, summarizeDays, buildHistoryEntry, SHIFT_STATUS } from '../lib/apply-results.js'
import { loadHistory, saveHistory } from '../lib/history-storage.js'
import { DEFAULT_CONFIG } from '../lib/config-storage.js'
import { isOverlapError } from '../lib/factorial-errors.js'
import {
  undoTargets,
  canUndo,
  classifyDeleteResponse,
  resolveUndoResults,
  applyUndoOutcome,
  summarizeUndo,
  markNotFoundByUser,
  UNDO_STATUS
} from '../lib/undo.js'

console.log('Factorial Clock: Background service worker loaded')

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason)

  if (details.reason === 'install') {
    // Set default configuration
    chrome.storage.sync.set({
      config: DEFAULT_CONFIG,
      exceptions: []
    }, () => {
      console.log('Default configuration saved')
    })
    // History is not initialized here: loadHistory() handles a missing key and
    // migrates any history synced from an older version.
  }
})

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request)

  switch (request.action) {
    case 'generateSchedule':
      handleGenerateSchedule(request.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true // Keep channel open for async response

    case 'applySchedule':
      handleApplySchedule(request.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true

    case 'undoWeek':
      handleUndoWeek(request.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true

    case 'markUndoRemoved':
      handleMarkUndoRemoved(request.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true

    case 'getEmployeeId':
      handleGetEmployeeId()
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true

    default:
      sendResponse({ success: false, error: 'Unknown action' })
  }
})

/**
 * Generate schedule using real logic
 */
async function handleGenerateSchedule(data) {
  console.log('Generating schedule...', data)

  try {
    // Get config and exceptions from storage
    const storage = await chrome.storage.sync.get(['config', 'exceptions'])
    const config = storage.config || DEFAULT_CONFIG
    const exceptions = storage.exceptions || []

    const { weekStart } = data

    // Generate schedule using real logic
    const schedule = generateWeeklySchedule(weekStart, config, exceptions)

    // Calculate totals
    const totals = calculateTotalHours(schedule)

    // Format for display
    const formatted = formatScheduleForDisplay(schedule)

    return {
      weekStart,
      schedule: formatted,
      raw: schedule,
      totals
    }
  } catch (error) {
    console.error('Generation failed:', error)
    throw error
  }
}

/**
 * Get or create a Factorial tab for sending messages
 * Returns: { tab, wasCreated: boolean }
 */
async function getFactorialTab() {
  console.log('[getFactorialTab] Looking for Factorial tabs...')

  const tabs = await chrome.tabs.query({
    url: 'https://app.factorialhr.com/*'
  })

  console.log(`[getFactorialTab] Found ${tabs.length} Factorial tab(s)`)
  tabs.forEach((tab, index) => {
    console.log(`  Tab ${index + 1}: id=${tab.id}, active=${tab.active}, status=${tab.status}, url=${tab.url}`)
  })

  // Check all existing tabs (don't filter by active, since popup is the active one)
  console.log(`[getFactorialTab] Checking all tabs for ready content script...`)
  for (const tab of tabs) {
    if (tab.status === 'complete') {
      console.log(`[getFactorialTab] Testing tab ${tab.id}...`)
      const isReady = await testContentScript(tab.id)
      if (isReady) {
        console.log(`[Service Worker] Using existing Factorial tab ${tab.id}`)
        return { tab, wasCreated: false }
      } else {
        // If tab exists but content script isn't ready, try to inject it
        console.log(`[getFactorialTab] Tab ${tab.id} exists but content script not ready, attempting reload...`)
        try {
          await chrome.tabs.reload(tab.id)
          await new Promise(resolve => setTimeout(resolve, TIMING.CONTENT_SCRIPT_READY_DELAY))
          const isReadyAfterReload = await testContentScript(tab.id)
          if (isReadyAfterReload) {
            console.log(`[Service Worker] Using Factorial tab ${tab.id} after reload`)
            return { tab, wasCreated: false }
          }
        } catch (error) {
          console.log(`[getFactorialTab] Failed to reload tab ${tab.id}:`, error)
        }
      }
    }
  }

  // No suitable tab found, create new one
  console.log('[Service Worker] Creating Factorial tab...')
  const tab = await chrome.tabs.create({
    url: 'https://app.factorialhr.com/',
    active: false  // Create in background to avoid interrupting user
  })

  await new Promise(resolve => {
    const listener = (tabId, info) => {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        console.log('[Service Worker] Tab loaded, waiting for content script...')
        setTimeout(resolve, TIMING.CONTENT_SCRIPT_READY_DELAY)
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })

  // Verify content script is ready
  const isReady = await testContentScript(tab.id)
  if (!isReady) {
    throw new Error('Content script not responding. Please refresh the Factorial page.')
  }

  return { tab, wasCreated: true }
}

/**
 * Test if content script is loaded and responding
 */
async function testContentScript(tabId) {
  try {
    // First verify the tab still exists
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    if (!tab) {
      console.log(`[testContentScript] Tab ${tabId} does not exist`)
      return false
    }

    console.log(`[testContentScript] Testing tab ${tabId} - URL: ${tab.url}, status: ${tab.status}`)

    return new Promise(resolve => {
      chrome.tabs.sendMessage(
        tabId,
        { action: 'ping' },
        (response) => {
          if (chrome.runtime.lastError) {
            // Content script not loaded or not responding
            console.log(`[testContentScript] Tab ${tabId} - No response: ${chrome.runtime.lastError.message}`)
            resolve(false)
            return
          }

          if (response && response.success && response.data === 'pong') {
            console.log(`[testContentScript] Tab ${tabId} - Content script is ready ✓`)
            resolve(true)
          } else {
            console.log(`[testContentScript] Tab ${tabId} - Invalid response:`, response)
            resolve(false)
          }
        }
      )
    })
  } catch (error) {
    console.log(`[testContentScript] Error testing tab ${tabId}:`, error)
    return false
  }
}

/**
 * Create shift via content script
 */
async function createShift(tabId, employeeId, clockIn, clockOut, date) {
  console.log('[createShift]', { employeeId, clockIn, clockOut, date })

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: 'createShift',
        data: { employeeId, clockIn, clockOut, date }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[createShift] Runtime error:', chrome.runtime.lastError)
          reject(new Error(`Content script not responding: ${chrome.runtime.lastError.message}`))
          return
        }

        if (!response) {
          reject(new Error('No response from content script'))
          return
        }

        if (response.success) {
          console.log('[createShift] Success:', response.data)
          resolve(response.data)
        } else {
          const error = new Error(response.error || 'Unknown error')
          error.code = response.errorCode || null
          error.type = response.errorType || null
          reject(error)
        }
      }
    )
  })
}

/**
 * Apply schedule to Factorial via GraphQL API
 */
async function handleApplySchedule(scheduleData) {
  console.log('Applying schedule to Factorial...', scheduleData)

  let tab = null
  let wasCreated = false
  let historyResult = null

  try {
    // Get configuration
    const storage = await chrome.storage.sync.get(['config'])
    // Copy: config is modified below and must not alter the shared defaults
    const config = { ...(storage.config || DEFAULT_CONFIG) }

    // Auto-fetch Employee ID if not configured
    let employeeId = config.employeeId
    if (!employeeId || employeeId === 'auto' || employeeId === '') {
      console.log('Employee ID not configured, attempting auto-fetch...')
      try {
        employeeId = await handleGetEmployeeId()
        console.log('Auto-fetched Employee ID:', employeeId)

        // Save to config for next time
        config.employeeId = String(employeeId)
        await chrome.storage.sync.set({ config })
      } catch (error) {
        console.error('Failed to auto-fetch Employee ID:', error)
        throw new Error('Employee ID not configured and auto-fetch failed. Please set it manually in Configuration tab.')
      }
    } else {
      employeeId = parseInt(employeeId)
    }

    console.log('Using Employee ID:', employeeId)

    // Authentication is checked by the Factorial API itself: the content script
    // sends the browser's cookies and maps an HTTP 401 to a "Not authenticated" error.

    // Per-day, per-shift results (#18): every created shift keeps its Factorial identifier
    const days = []

    console.log(`Processing ${scheduleData.raw.length} days...`)

    // Get or create Factorial tab once for all shifts
    const result = await getFactorialTab()
    tab = result.tab
    wasCreated = result.wasCreated
    console.log(`Using Factorial tab ${tab.id}`)

    let authError = null

    try {
      for (const day of scheduleData.raw) {
        const date = day.date
        const dayResult = { date, shifts: [] }
        days.push(dayResult)
        let dayFailed = false

        for (const [index, planned] of planShifts(day).entries()) {
          if (dayFailed) {
            // Same as before #18: once a shift of the day fails, the rest of the day is not created
            dayResult.shifts.push({ ...planned, id: null, status: SHIFT_STATUS.SKIPPED, error: 'an earlier shift of the day failed' })
            continue
          }
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, TIMING.SHIFT_APPLICATION_DELAY))
          }

          try {
            const shift = await createShift(tab.id, employeeId, planned.clockIn, planned.clockOut, date)
            // Without an identifier the shift cannot be undone later; it is still recorded as created
            const id = shift && shift.id != null ? String(shift.id) : null
            dayResult.shifts.push({ ...planned, id, status: SHIFT_STATUS.CREATED })
            console.log(`  ${date} shift ${index + 1} created: ${shift.id}`)
          } catch (error) {
            const errorMsg = error.message
            dayResult.shifts.push({ ...planned, id: null, status: SHIFT_STATUS.FAILED, error: errorMsg, errorCode: error.code || null })
            dayFailed = true

            if (errorMsg.includes(ERROR_STRINGS.NOT_AUTHENTICATED)) {
              console.error('❌ Authentication error - stopping process')
              authError = error
              break
            }
            if (isOverlapError(error)) {
              console.log(`  ${date}: overlaps an existing shift`)
            } else {
              console.error(`✗ Failed to create shift for ${date}:`, errorMsg, error.code ? `(code ${error.code})` : '')
            }
          }
        }

        if (authError) break

        // Small delay between days
        await new Promise(resolve => setTimeout(resolve, TIMING.DAY_APPLICATION_DELAY))
      }
    } finally {
      // Record the week whenever a shift was created, even if the loop stopped early, so created shifts
      // keep their identifiers (#18). A week where nothing was created is not recorded: the apply error
      // already tells the user, and retries do not push real entries out of the 50-entry limit.
      if (summarizeDays(days).created > 0) {
        historyResult = await recordHistoryEntry(scheduleData, days)
      }
    }

    if (authError) throw authError

    const { created: shiftsCreated, failed } = summarizeDays(days)
    console.log(`Finished processing. Shifts created: ${shiftsCreated}, failed: ${failed}`)

    if (failed > 0) {
      const failures = days.flatMap(d => d.shifts.filter(s => s.status === SHIFT_STATUS.FAILED))
      const hasOverlapErrors = failures.some(f => isOverlapError({ message: f.error, code: f.errorCode }))

      // Overlaps are an expected outcome, not an extension error: not logged as errors or warnings (#38)
      const onlyOverlaps = failures.every(f => isOverlapError({ message: f.error, code: f.errorCode }))
      if (onlyOverlaps) {
        console.log('Some shifts overlap existing ones:', failures.length)
      } else {
        console.warn('Some shifts failed:', failures)
      }
      if (hasOverlapErrors && shiftsCreated === 0) {
        const error = new Error(`Cannot create shifts: All dates already have existing shifts in Factorial. Please review and delete existing shifts for these dates in Factorial before applying a new schedule.`)
        error.expected = onlyOverlaps
        throw error
      } else if (hasOverlapErrors) {
        const error = new Error(`${shiftsCreated} shifts created, ${failed} failed. Some dates already have existing shifts in Factorial. Please review and delete conflicting shifts before retrying.`)
        error.expected = onlyOverlaps
        throw error
      } else {
        throw new Error(`${shiftsCreated} shifts created, ${failed} failed. First error: ${failures[0].error}`)
      }
    }

    console.log(`Successfully created ${shiftsCreated} shifts`)

    // Close the tab if we created it
    if (wasCreated) {
      console.log('[Service Worker] Closing temporary Factorial tab...')
      await chrome.tabs.remove(tab.id).catch(() => {
        // Ignore errors if tab was already closed
      })
    }

    return {
      success: true,
      shiftsCreated,
      appliedAt: new Date().toISOString(),
      // null when nothing had to be recorded
      historySaved: historyResult ? historyResult.saved : null,
      historyError: historyResult ? historyResult.error : null
    }
  } catch (error) {
    if (error.expected) {
      console.log('Apply stopped:', error.message)
    } else {
      console.error('Apply failed:', error)
    }

    // Close the tab if we created it, even on error
    if (wasCreated && tab) {
      console.log('[Service Worker] Closing temporary Factorial tab after error...')
      await chrome.tabs.remove(tab.id).catch(() => {
        // Ignore errors if tab was already closed
      })
    }

    if (historyResult && !historyResult.saved) {
      error.message += ` (History could not be saved: ${historyResult.error})`
    }
    throw error
  }
}

/**
 * Replace one History entry by id (re-reading History so concurrent changes are kept).
 */
async function updateHistoryEntry(entryId, update) {
  const history = await loadHistory()
  const index = history.findIndex(e => e.id === entryId)
  if (index === -1) throw new Error('History entry not found')
  history[index] = update(history[index])
  await saveHistory(history)
  return history[index]
}

/**
 * Delete in Factorial the shifts an applied week created (#18). Only shifts with a stored identifier
 * are deleted. The progress is recorded in History, so closing the popup does not lose the result,
 * and the same entry cannot be undone twice at the same time.
 */
// Entries being undone by this service worker; checked and set before any await, so two messages
// for the same entry cannot both start an undo
const undoLocks = new Set()

async function handleUndoWeek({ entryId }) {
  if (undoLocks.has(entryId)) throw new Error('An undo is already in progress for this week.')
  undoLocks.add(entryId)
  try {
    return await runUndoWeek(entryId)
  } finally {
    undoLocks.delete(entryId)
  }
}

async function runUndoWeek(entryId) {
  const history = await loadHistory()
  const entry = history.find(e => e.id === entryId)
  if (!entry) throw new Error('History entry not found')
  if (!canUndo(entry)) {
    throw new Error(entry.undo?.status === UNDO_STATUS.IN_PROGRESS
      ? 'An undo is already in progress for this week.'
      : 'Nothing to undo for this week.')
  }

  const previousUndo = entry.undo || null
  const targets = undoTargets(entry)
  await updateHistoryEntry(entryId, e => ({ ...e, undo: { status: UNDO_STATUS.IN_PROGRESS, startedAt: new Date().toISOString() } }))

  let tab = null
  let wasCreated = false
  let fatalError = null
  const results = []
  try {
    const found = await getFactorialTab()
    tab = found.tab
    wasCreated = found.wasCreated

    for (const target of targets) {
      const response = await sendDeleteShift(tab.id, target.id)
      const result = classifyDeleteResponse(response, target.id)
      results.push(result)
      console.log(`[undo] ${target.date} shift ${target.id}: ${result.status}${result.error ? ` (${result.error})` : ''}`)

      // The request itself failed (logged out, login page, schema change): stop before anything else
      if (response && response.fatal) {
        // Not an answer about this shift: it stays a target for a retry
        results.pop()
        fatalError = result.error
        break
      }
      await new Promise(resolve => setTimeout(resolve, TIMING.SHIFT_APPLICATION_DELAY))
    }
  } catch (error) {
    console.error('[undo] Failed:', error)
    fatalError = error.message
  } finally {
    if (wasCreated && tab) {
      await chrome.tabs.remove(tab.id).catch(() => {})
    }
  }

  const settled = results
  const anyRemoved = settled.some(r => r.status !== 'failed')
  if (fatalError && !anyRemoved) {
    // Nothing was deleted: leave the entry as it was before the undo
    await updateHistoryEntry(entryId, e => {
      const restored = { ...e }
      if (previousUndo) restored.undo = previousUndo
      else delete restored.undo
      return restored
    })
    throw new Error(fatalError)
  }

  // Shifts not reached (stopped early) keep their previous state and stay as targets for a retry
  const reached = targets.slice(0, settled.length)
  const outcomes = resolveUndoResults(settled)
  const updated = await updateHistoryEntry(entryId, e => {
    const base = { ...e }
    if (previousUndo) base.undo = previousUndo
    else delete base.undo
    return applyUndoOutcome(base, reached, outcomes)
  })

  return { undo: updated.undo, summary: summarizeUndo(updated), remaining: undoTargets(updated).length }
}

/**
 * The user confirmed that the shifts Factorial did not find were deleted by hand (#18).
 */
async function handleMarkUndoRemoved({ entryId }) {
  const updated = await updateHistoryEntry(entryId, e => markNotFoundByUser(e))
  return { undo: updated.undo, summary: summarizeUndo(updated) }
}

/**
 * Ask the content script to delete one shift; resolves with its answer, never rejects for Factorial errors.
 */
function sendDeleteShift(tabId, id) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'deleteShift', data: { id } }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: `Content script not responding: ${chrome.runtime.lastError.message}`, errorType: null, shiftReturned: false })
        return
      }
      resolve(response || { success: false, error: 'No response from content script', errorType: null, shiftReturned: false })
    })
  })
}

/**
 * Add an applied week to History (#18). Never throws: a failed save is reported to the caller,
 * so it cannot turn a successful apply into an error (see #8).
 * @returns {Promise<{saved: boolean, error: string|null}>}
 */
async function recordHistoryEntry(scheduleData, days) {
  try {
    const history = await loadHistory()
    history.unshift(buildHistoryEntry(scheduleData, days))
    await saveHistory(history.slice(0, STORAGE.MAX_HISTORY_ENTRIES))
    return { saved: true, error: null }
  } catch (error) {
    console.error('[recordHistoryEntry] Save to history failed:', error)
    return { saved: false, error: error.message || 'unknown error' }
  }
}

/**
 * Get Employee ID from Factorial API
 */
async function handleGetEmployeeId() {
  console.log('[handleGetEmployeeId] Fetching credentials from API...')

  try {
    // Use versioned API endpoint
    const url = API.CREDENTIALS_URL

    console.log('[handleGetEmployeeId] Request URL:', url)

    // Make request with credentials: 'include' to send cookies automatically
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Accept': 'application/json'
      }
    })

    console.log('[handleGetEmployeeId] Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[handleGetEmployeeId] Error response:', errorText)
      throw new Error(`API request failed: HTTP ${response.status}`)
    }

    const text = await response.text()
    const result = text ? JSON.parse(text) : {}

    console.log('[handleGetEmployeeId] Credentials response:', result)

    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
      throw new Error('Invalid credentials response format')
    }

    const credentials = result.data[0]

    if (!credentials.employee_id) {
      throw new Error('Employee ID not found in credentials')
    }

    console.log('[handleGetEmployeeId] ✓ Employee ID found:', credentials.employee_id)
    return credentials.employee_id

  } catch (error) {
    console.error('[handleGetEmployeeId] Failed:', error)
    throw error
  }
}
