/**
 * Constants for the application
 * Centralizes magic numbers and strings to improve maintainability
 */

// Timing constants (milliseconds)
export const TIMING = {
  CONTENT_SCRIPT_READY_DELAY: 1500,  // Wait time for content script to load
  SHIFT_APPLICATION_DELAY: 500,      // Delay between creating shifts
  DAY_APPLICATION_DELAY: 300,        // Delay between processing days
}

// Storage limits
export const STORAGE = {
  MAX_HISTORY_ENTRIES: 50,  // Maximum number of history entries to keep
}

// Cookie names
export const COOKIES = {
  FACTORIAL_SESSION: '_factorial_session_v2',
}

// Error message strings
export const ERROR_STRINGS = {
  SHIFT_OVERLAP: 'overlaps with shift',
  NOT_AUTHENTICATED: 'Not authenticated',
}

// API endpoints
export const API = {
  CREDENTIALS_URL: 'https://api.factorialhr.com/api/2025-10-01/resources/api_public/credentials',
}
