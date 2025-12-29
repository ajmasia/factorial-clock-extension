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

  if (request.action === 'createShift') {
    console.log('[Factorial API] Creating shift:', request.data)
    createShift(request.data)
      .then(shift => {
        console.log('[Factorial API] Shift created:', shift)
        sendResponse({ success: true, data: shift })
      })
      .catch(error => {
        // Only log detailed errors if it's not an overlap error
        if (!error.message.includes('overlaps with shift')) {
          console.error('[Factorial API] Error creating shift:', error)
        }
        sendResponse({ success: false, error: error.message })
      })
    return true
  }
})

/**
 * Get employee ID from Factorial API
 */
async function getEmployeeId() {
  console.log('[Factorial API] Getting employee ID...')

  const response = await fetch('https://app.factorialhr.com/api/v1/core/employees/me', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to get employee ID: HTTP ${response.status}`)
  }

  const data = await response.json()
  console.log('[Factorial API] Employee ID:', data.id)

  if (!data.id) {
    throw new Error('Employee ID not found in response')
  }

  return data.id
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

    // Only log detailed errors if it's not an overlap error
    if (!errorMsg.includes('overlaps with shift')) {
      console.error('[Factorial API] GraphQL errors:', errors)
    }

    throw new Error(errorMsg)
  }

  const shift = result?.data?.attendanceMutations?.createAttendanceShift?.shift
  if (!shift) {
    console.error('[Factorial API] No shift in response:', result)
    throw new Error('Shift creation failed: No shift returned')
  }

  console.log('[Factorial API] Shift created:', shift.id)
  return shift
}
