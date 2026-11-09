import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_CONFIG, saveEmployeeId } from './config-storage.js'

function mockStorage(initial = {}) {
  const data = structuredClone(initial)
  globalThis.chrome = {
    storage: {
      sync: {
        async get(keys) {
          const out = {}
          for (const k of keys) if (k in data) out[k] = structuredClone(data[k])
          return out
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) data[k] = structuredClone(v)
        },
      },
    },
  }
  return data
}

const SAVED = {
  ...DEFAULT_CONFIG,
  weeklyHours: 35,
  workDays: [1, 2, 3, 4],
  splitShiftDays: [2],
  employeeId: '',
}

describe('saveEmployeeId (#11)', () => {
  let data

  beforeEach(() => {
    data = mockStorage({ config: SAVED })
  })

  it('changes only employeeId in the stored configuration', async () => {
    await saveEmployeeId(12345)
    expect(data.config).toEqual({ ...SAVED, employeeId: '12345' })
  })

  it('keeps values saved after the page was opened', async () => {
    // The page opened with defaults; the user saved 30 h meanwhile.
    data.config = { ...SAVED, weeklyHours: 30 }
    await saveEmployeeId('12345')
    expect(data.config.weeklyHours).toBe(30)
  })

  it('fills a missing configuration with the defaults', async () => {
    data = mockStorage({})
    await saveEmployeeId('12345')
    expect(data.config).toEqual({ ...DEFAULT_CONFIG, employeeId: '12345' })
  })
})
