import assert from 'node:assert/strict'
import test from 'node:test'

import { hasActiveMembership } from './_membership-access.js'

test('accepts only an unexpired paid membership row', () => {
  const now = Date.parse('2026-08-27T00:00:00.000Z')
  assert.equal(hasActiveMembership([{ expires_at: '2026-08-28T00:00:00.000Z' }], now), true)
  assert.equal(hasActiveMembership([{ expires_at: '2026-08-26T00:00:00.000Z' }], now), false)
  assert.equal(hasActiveMembership([{ expires_at: null }], now), false)
  assert.equal(hasActiveMembership([], now), false)
})
