/**
 * Configuration persistence (chrome.storage.sync, key "config")
 */

const CONFIG_KEY = 'config'

// Default configuration, used on install and when nothing is stored yet
export const DEFAULT_CONFIG = {
  weeklyHours: 40,
  workDays: [1, 2, 3, 4, 5], // Monday to Friday
  clockInRange: { start: '07:00', end: '07:30' },
  lunchStartRange: { start: '14:00', end: '15:00' },
  lunchDuration: { min: 45, max: 60 },
  splitShiftDays: [1, 2, 3], // Mon, Tue, Wed
  randomVariance: 5,
  employeeId: '', // Employee ID number (auto-detected from Factorial)
}

/**
 * Store the Employee ID without touching the rest of the stored configuration.
 * Reads the configuration at write time, so a page that still holds stale or
 * default values cannot overwrite what the user saved.
 * @param {string|number} employeeId
 * @returns {Promise<object>} The configuration as stored
 */
export async function saveEmployeeId(employeeId) {
  const stored = await chrome.storage.sync.get([CONFIG_KEY])
  const config = {
    ...DEFAULT_CONFIG,
    ...(stored[CONFIG_KEY] || {}),
    employeeId: String(employeeId),
  }
  await chrome.storage.sync.set({ [CONFIG_KEY]: config })
  return config
}
