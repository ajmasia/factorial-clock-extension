/**
 * History persistence
 *
 * History lives in chrome.storage.local. chrome.storage.sync allows only 8,192 bytes
 * per item and one applied week takes about 2,250 bytes, so the history array no
 * longer fit there after the fourth week.
 */

const HISTORY_KEY = 'history'

/**
 * Load the applied-schedule history.
 * On first use, moves a history left in chrome.storage.sync by older versions
 * into chrome.storage.local and removes it from sync.
 * @returns {Promise<Array>} History entries, newest first
 */
export async function loadHistory() {
  const local = await chrome.storage.local.get([HISTORY_KEY])
  if (Array.isArray(local[HISTORY_KEY])) {
    return local[HISTORY_KEY]
  }

  const sync = await chrome.storage.sync.get([HISTORY_KEY])
  const history = Array.isArray(sync[HISTORY_KEY]) ? sync[HISTORY_KEY] : []

  await chrome.storage.local.set({ [HISTORY_KEY]: history })
  if (sync[HISTORY_KEY] !== undefined) {
    // The migration is already complete; a leftover sync copy is harmless.
    await chrome.storage.sync.remove(HISTORY_KEY).catch(error => {
      console.warn('[history-storage] Could not remove history from sync:', error)
    })
  }

  return history
}

/**
 * Save the applied-schedule history.
 * @param {Array} history - History entries, newest first
 */
export async function saveHistory(history) {
  await chrome.storage.local.set({ [HISTORY_KEY]: history })
}
