// Content script for making authenticated API calls to Factorial
// This runs in the context of the Factorial page and has access to cookies

console.log('[Factorial API Content Script] Loaded on', window.location.href)

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Factorial API] Received message:', request.action, request)

  if (request.action === 'ping') {
    sendResponse({ success: true, data: 'pong' })
    return
  }

  if (request.action === 'getEmployeeId') {
    getEmployeeId()
      .then(id => {
        console.log('[Factorial API] Employee ID:', id)
        sendResponse({ success: true, data: id })
      })
      .catch(error => {
        console.error('[Factorial API] Error getting employee ID:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true // Keep channel open for async response
  }

  if (request.action === 'deleteShift') {
    deleteShift(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message, errorType: null, errorCode: null, shiftReturned: false, fatal: true }))
    return true
  }

  if (request.action === 'createShift') {
    console.log('[Factorial API] Creating shift:', request.data)
    createShift(request.data)
      .then(shift => {
        console.log('[Factorial API] Shift created:', shift)
        sendResponse({ success: true, data: shift })
      })
      .catch(error => {
        // Classified by the service worker (#38); a rejection by Factorial is not an extension error
        console.log('[Factorial API] Shift not created:', error.message)
        sendResponse({ success: false, error: error.message, errorCode: error.code || null, errorType: error.type || null })
      })
    return true
  }
})

/**
 * Get employee ID from Factorial API using credentials endpoint
 */
async function getEmployeeId() {
  console.log('[Factorial API] Getting employee credentials...')

  const response = await fetch('https://app.factorialhr.com/resources/api_public/credentials', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  })

  console.log('[Factorial API] Response status:', response.status)

  if (!response.ok) {
    throw new Error(`Failed to get credentials: HTTP ${response.status}`)
  }

  const result = await response.json()
  console.log('[Factorial API] Credentials response:', result)

  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    throw new Error('Invalid credentials response format')
  }

  const credentials = result.data[0]

  if (!credentials.employee_id) {
    throw new Error('Employee ID not found in credentials')
  }

  console.log('[Factorial API] ✓ Employee ID found:', credentials.employee_id)
  return credentials.employee_id
}

/**
 * Create shift via GraphQL API
 */
async function createShift({ employeeId, clockIn, clockOut, date }) {
  console.log('[Factorial API] Creating shift:', { employeeId, clockIn, clockOut, date })

  const mutation = `
mutation CreateAttendanceShift($clockIn: ISO8601DateTime, $clockOut: ISO8601DateTime, $date: ISO8601Date!, $employeeId: Int!, $halfDay: String, $locationType: AttendanceShiftLocationTypeEnum, $observations: String, $referenceDate: ISO8601Date!, $source: AttendanceEnumsShiftSourceEnum, $timeSettingsBreakConfigurationId: Int, $workable: Boolean) {
  attendanceMutations {
    createAttendanceShift(
      clockIn: $clockIn
      clockOut: $clockOut
      date: $date
      employeeId: $employeeId
      halfDay: $halfDay
      locationType: $locationType
      observations: $observations
      referenceDate: $referenceDate
      source: $source
      timeSettingsBreakConfigurationId: $timeSettingsBreakConfigurationId
      workable: $workable
    ) {
      errors {
        ... on SimpleError {
          message
          type
          code
          __typename
        }
        ... on StructuredError {
          field
          messages
          __typename
        }
        __typename
      }
      shift {
        id
        clockIn
        clockOut
        date
        __typename
      }
      __typename
    }
    __typename
  }
}
`

  const payload = {
    operationName: 'CreateAttendanceShift',
    variables: {
      date: date,
      employeeId: employeeId,
      clockIn: clockIn,
      clockOut: clockOut,
      referenceDate: date,
      source: 'desktop',
      workable: true
    },
    query: mutation
  }

  const response = await fetch('https://api.factorialhr.com/graphql?CreateAttendanceShift', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify(payload)
  })

  console.log('[Factorial API] Response status:', response.status, response.statusText)
  console.log('[Factorial API] Response headers:', {
    contentType: response.headers.get('Content-Type'),
    contentLength: response.headers.get('Content-Length')
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('[Factorial API] Error response body:', text.substring(0, 500))

    // Check for authentication errors
    if (response.status === 401) {
      throw new Error('Not authenticated. Please log in to Factorial in your browser first.')
    }

    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  // Check if response is JSON
  const contentType = response.headers.get('Content-Type')
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text()
    console.error('[Factorial API] Non-JSON response:', text.substring(0, 500))
    throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`)
  }

  const result = await response.json()
  console.log('[Factorial API] Response:', result)

  // Check for GraphQL errors
  const errors = result?.data?.attendanceMutations?.createAttendanceShift?.errors || []
  if (errors.length > 0) {
    const errorMsg = errors[0].messages?.[0] || errors[0].message || 'Unknown error'
    // Keep Factorial's language-independent fields for the service worker (#38)
    const error = new Error(errorMsg)
    error.code = errors[0].code || null
    error.type = errors[0].type || null
    throw error
  }

  const shift = result?.data?.attendanceMutations?.createAttendanceShift?.shift
  if (!shift) {
    console.error('[Factorial API] No shift in response:', result)
    throw new Error('Shift creation failed: No shift returned')
  }

  console.log('[Factorial API] Shift created:', shift.id)
  return shift
}

/**
 * Delete a shift via GraphQL (#18). The identifier is sent as an integer: for this API the argument
 * is `Int!` (an `ID!` variable is rejected with variableMismatch). Never throws for Factorial's answer:
 * it returns what Factorial said so the service worker can classify it.
 * @returns {Promise<{success: boolean, data?: {id: string}, error?: string, errorType?: string|null, errorCode?: string|null, shiftReturned: boolean}>}
 */
async function deleteShift({ id }) {
  // Only ids that convert to an integer exactly: a rounded id would point to another shift
  const text = String(id)
  const numericId = Number(text)
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(numericId) || String(numericId) !== text) {
    return { success: false, error: `Invalid shift identifier: ${id}`, errorType: null, errorCode: null, shiftReturned: false, fatal: false }
  }

  const response = await fetch('https://api.factorialhr.com/graphql?DeleteAttendanceShift', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({
      operationName: 'DeleteAttendanceShift',
      variables: { id: numericId },
      query: `mutation DeleteAttendanceShift($id: Int!) {
  attendanceMutations {
    deleteAttendanceShift(id: $id) {
      errors {
        ... on SimpleError { message type code __typename }
        ... on StructuredError { field messages __typename }
        __typename
      }
      shift { id __typename }
      __typename
    }
    __typename
  }
}`
    })
  })

  // `fatal`: the request itself did not work (logged out, login page, schema change). The service
  // worker stops the undo; it is never read as "shift not found".
  if (response.status === 401) {
    return { success: false, error: 'Not authenticated. Please log in to Factorial in your browser first.', errorType: null, errorCode: null, shiftReturned: false, fatal: true }
  }
  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, errorType: null, errorCode: null, shiftReturned: false, fatal: true }
  }
  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) {
    return { success: false, error: 'Not authenticated or unexpected response from Factorial. Please log in to Factorial and try again.', errorType: null, errorCode: null, shiftReturned: false, fatal: true }
  }

  const result = await response.json()
  if (Array.isArray(result?.errors) && result.errors.length > 0) {
    return { success: false, error: result.errors[0].message || 'GraphQL error', errorType: 'graphql', errorCode: result.errors[0].extensions?.code || null, shiftReturned: false, fatal: true }
  }

  const payload = result?.data?.attendanceMutations?.deleteAttendanceShift
  const errors = payload?.errors || []
  const shift = payload?.shift || null

  if (errors.length > 0) {
    const first = errors[0]
    console.log('[Factorial API] Shift not deleted:', first.messages?.[0] || first.message)
    return {
      success: false,
      error: first.messages?.[0] || first.message || 'Unknown error',
      errorType: first.type || null,
      errorCode: first.code || null,
      shiftReturned: shift !== null
    }
  }
  if (!shift) {
    return { success: false, error: 'Shift deletion failed: no shift returned', errorType: null, errorCode: null, shiftReturned: false }
  }
  return { success: true, data: { id: String(shift.id) }, shiftReturned: true }
}
