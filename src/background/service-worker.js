// Background Service Worker for Factorial Clock Extension
import {
  generateWeeklySchedule,
  calculateTotalHours,
  formatScheduleForDisplay
} from '../lib/scheduler.js'
import { TIMING, STORAGE, COOKIES, ERROR_STRINGS, API } from '../lib/constants.js'
import { formatDateTimeWithTimezone } from '../lib/time-utils.js'

console.log('Factorial Clock: Background service worker loaded')

// Default configuration
const DEFAULT_CONFIG = {
  weeklyHours: 40,
  workDays: [1, 2, 3, 4, 5], // Monday to Friday
  clockInRange: { start: '07:00', end: '07:30' },
  lunchStartRange: { start: '14:00', end: '15:00' },
  lunchDuration: { min: 45, max: 60 },
  splitShiftDays: [1, 2, 3], // Mon, Tue, Wed
  randomVariance: 5,
  employeeId: '', // Employee ID number (auto-detected from Factorial)
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason)

  if (details.reason === 'install') {
    // Set default configuration
    chrome.storage.sync.set({
      config: DEFAULT_CONFIG,
      history: [],
      exceptions: []
    }, () => {
      console.log('Default configuration saved')
    })
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

    case 'saveToHistory':
      handleSaveToHistory(request.data)
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
  const tabs = await chrome.tabs.query({
    url: 'https://app.factorialhr.com/*'
  })

  // Check existing tabs
  for (const tab of tabs) {
    if (tab.status === 'complete') {
      const isReady = await testContentScript(tab.id)
      if (isReady) {
        console.log(`[Service Worker] Using existing Factorial tab ${tab.id}`)
        return { tab, wasCreated: false }
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
      return false
    }

    return new Promise(resolve => {
      chrome.tabs.sendMessage(
        tabId,
        { action: 'ping' },
        (response) => {
          if (chrome.runtime.lastError) {
            // Silently fail - this is expected when content script isn't loaded
            resolve(false)
            return
          }

          if (response && response.success && response.data === 'pong') {
            console.log('[testContentScript] Content script is ready')
            resolve(true)
          } else {
            resolve(false)
          }
        }
      )
    })
  } catch (error) {
    return false
  }
}

/**
 * Create shift via content script
 */
async function createShift(tabId, sessionCookie, employeeId, clockIn, clockOut, date) {
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
          // Only log detailed errors if it's not an overlap error
          if (!response.error.includes(ERROR_STRINGS.SHIFT_OVERLAP)) {
            console.error('[createShift] Error:', response.error)
          }
          reject(new Error(response.error || 'Unknown error'))
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

  try {
    // Get configuration
    const storage = await chrome.storage.sync.get(['config'])
    let config = storage.config || DEFAULT_CONFIG

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

    // Get session cookie
    const cookies = await chrome.cookies.getAll({
      domain: '.factorialhr.com',
      name: COOKIES.FACTORIAL_SESSION
    })

    if (cookies.length === 0) {
      await chrome.tabs.create({
        url: 'https://app.factorialhr.com/',
        active: true
      })
      throw new Error('Not authenticated. Please log in to Factorial in your browser, then try again.')
    }

    const sessionCookie = cookies[0].value
    console.log('Session cookie found:', sessionCookie.substring(0, 20) + '...')

    let shiftsCreated = 0
    const errors = []

    console.log(`Processing ${scheduleData.raw.length} days...`)

    // Get or create Factorial tab once for all shifts
    const result = await getFactorialTab()
    tab = result.tab
    wasCreated = result.wasCreated
    console.log(`Using Factorial tab ${tab.id}`)

    // Process each day in the schedule
    for (const day of scheduleData.raw) {
      const date = day.date

      try {
        if (day.type === 'split') {
          // Split shift: create two separate shifts (checkin->lunch_start, lunch_end->checkout)
          console.log(`Creating split shift for ${date}...`)

          // Convert datetime strings to ISO format with timezone
          const checkin = formatDateTimeWithTimezone(day.checkin)
          const lunchStart = formatDateTimeWithTimezone(day.lunch_start)
          const lunchEnd = formatDateTimeWithTimezone(day.lunch_end)
          const checkout = formatDateTimeWithTimezone(day.checkout)

          console.log(`  Shift 1: ${checkin} -> ${lunchStart}`)
          const shift1 = await createShift(tab.id, sessionCookie, employeeId, checkin, lunchStart, date)
          console.log(`  Shift 1 created with ID: ${shift1.id}`)
          shiftsCreated++

          // Small delay between shifts
          await new Promise(resolve => setTimeout(resolve, TIMING.SHIFT_APPLICATION_DELAY))

          console.log(`  Shift 2: ${lunchEnd} -> ${checkout}`)
          const shift2 = await createShift(tab.id, sessionCookie, employeeId, lunchEnd, checkout, date)
          console.log(`  Shift 2 created with ID: ${shift2.id}`)
          shiftsCreated++

        } else {
          // Continuous shift: create one shift (checkin->checkout)
          console.log(`Creating continuous shift for ${date}...`)

          const checkin = formatDateTimeWithTimezone(day.checkin)
          const checkout = formatDateTimeWithTimezone(day.checkout)

          console.log(`  Times: ${checkin} -> ${checkout}`)
          console.log(`  Employee ID: ${employeeId}, Date: ${date}`)

          const shift = await createShift(tab.id, sessionCookie, employeeId, checkin, checkout, date)
          console.log(`  Shift created successfully with ID: ${shift.id}`)
          shiftsCreated++
        }

        console.log(`✓ Day ${date} completed. Total shifts created: ${shiftsCreated}`)

        // Small delay between days
        await new Promise(resolve => setTimeout(resolve, TIMING.DAY_APPLICATION_DELAY))

      } catch (error) {
        const errorMsg = error.message
        const isOverlapError = errorMsg.includes(ERROR_STRINGS.SHIFT_OVERLAP)
        const isAuthError = errorMsg.includes(ERROR_STRINGS.NOT_AUTHENTICATED)

        // If authentication error, stop processing immediately
        if (isAuthError) {
          console.error('❌ Authentication error - stopping process')
          throw error
        }

        // Only log non-overlap errors
        if (!isOverlapError) {
          console.error(`✗ Failed to create shift for ${date}:`, error)
          console.error(`  Error details:`, errorMsg)
        }

        errors.push({ date, error: errorMsg })
      }
    }

    console.log(`Finished processing. Shifts created: ${shiftsCreated}, Errors: ${errors.length}`)

    if (errors.length > 0) {
      console.warn('Some shifts failed:', errors)

      // Check if errors are due to overlapping shifts
      const hasOverlapErrors = errors.some(e => e.error.includes(ERROR_STRINGS.SHIFT_OVERLAP))

      if (hasOverlapErrors && shiftsCreated === 0) {
        throw new Error(`Cannot create shifts: All dates already have existing shifts in Factorial. Please review and delete existing shifts for these dates in Factorial before applying a new schedule.`)
      } else if (hasOverlapErrors) {
        throw new Error(`${shiftsCreated} shifts created, ${errors.length} failed. Some dates already have existing shifts in Factorial. Please review and delete conflicting shifts before retrying.`)
      } else {
        throw new Error(`${shiftsCreated} shifts created, ${errors.length} failed. First error: ${errors[0].error}`)
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
      appliedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Apply failed:', error)

    // Close the tab if we created it, even on error
    if (wasCreated && tab) {
      console.log('[Service Worker] Closing temporary Factorial tab after error...')
      await chrome.tabs.remove(tab.id).catch(() => {
        // Ignore errors if tab was already closed
      })
    }

    throw error
  }
}

/**
 * Save schedule to history
 */
async function handleSaveToHistory(scheduleData) {
  console.log('[handleSaveToHistory] Called with:', scheduleData)
  try {
    const storage = await chrome.storage.sync.get(['history'])
    const history = storage.history || []
    console.log('[handleSaveToHistory] Current history length:', history.length)

    const historyEntry = {
      id: Date.now(),
      weekStart: scheduleData.weekStart,
      schedule: scheduleData.schedule,
      raw: scheduleData.raw,
      totals: scheduleData.totals,
      appliedAt: new Date().toISOString(),
      status: 'applied'
    }

    history.unshift(historyEntry) // Add to beginning
    console.log('[handleSaveToHistory] Added entry, new length:', history.length)

    // Keep only last N entries
    const trimmedHistory = history.slice(0, STORAGE.MAX_HISTORY_ENTRIES)

    await chrome.storage.sync.set({ history: trimmedHistory })
    console.log('[handleSaveToHistory] Saved to storage successfully')

    return historyEntry
  } catch (error) {
    console.error('[handleSaveToHistory] Save to history failed:', error)
    throw error
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
