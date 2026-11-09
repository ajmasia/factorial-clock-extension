import { describe, it, expect, afterEach } from 'vitest'
import { isOverlapError, OVERLAP_CODES } from './factorial-errors.js'

describe('isOverlapError (#38)', () => {
  afterEach(() => {
    OVERLAP_CODES.length = 0
  })

  it('recognises the English overlap message', () => {
    expect(isOverlapError({ message: 'overlaps with shift from 07:13 to 14:44 on 2026-11-03' })).toBe(true)
  })

  it('recognises the Spanish overlap message', () => {
    expect(isOverlapError({ message: 'se solapa con el turno de 07:13 a 14:44 del 2026-11-03' })).toBe(true)
  })

  it('ignores case', () => {
    expect(isOverlapError({ message: 'Se solapa con el turno de 07:13 a 14:44' })).toBe(true)
  })

  it('does not treat other errors as overlaps', () => {
    expect(isOverlapError({ message: 'Not authenticated. Please log in to Factorial in your browser first.' })).toBe(false)
    expect(isOverlapError({ message: 'HTTP 500: Internal Server Error' })).toBe(false)
    expect(isOverlapError({ message: '' })).toBe(false)
    expect(isOverlapError({})).toBe(false)
    expect(isOverlapError()).toBe(false)
  })

  it('recognises an overlap by a known code whatever the message language', () => {
    OVERLAP_CODES.push('shift_overlap')
    expect(isOverlapError({ message: 'chevauche le poste', code: 'shift_overlap' })).toBe(true)
    expect(isOverlapError({ message: 'chevauche le poste', code: 'other' })).toBe(false)
  })
})
