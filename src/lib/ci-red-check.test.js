import { it, expect } from 'vitest'

// Throwaway: deliberately failing test to verify that a red CI check blocks merging (#15). Never merge.
it('fails on purpose', () => {
  expect(1).toBe(2)
})
