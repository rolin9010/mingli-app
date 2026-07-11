import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAttach, getPurchaseItem } from './_fulfillment.js'

test('membership catalog includes the configured points bonuses', () => {
  const expected = {
    trial: 1,
    monthly: 3,
    quarterly: 8,
    yearly: 22,
  }

  for (const [id, bonusPoints] of Object.entries(expected)) {
    const item = getPurchaseItem(id)
    assert.ok(item)
    assert.equal(item.kind, 'membership')
    assert.equal(item.bonusPoints, bonusPoints)
  }
})

test('membership attach carries server-owned price, duration and bonus', () => {
  const item = getPurchaseItem('monthly')
  assert.ok(item)

  assert.deepEqual(JSON.parse(buildAttach('user-1', item)), {
    userId: 'user-1',
    kind: 'membership',
    itemId: 'monthly',
    planId: 'monthly',
    days: 30,
    bonusPoints: 3,
    priceFen: 1800,
  })
})

test('points purchases remain separate products in the same catalog', () => {
  const item = getPurchaseItem('points_22')
  assert.ok(item)
  assert.equal(item.kind, 'points')

  assert.deepEqual(JSON.parse(buildAttach('user-1', item)), {
    userId: 'user-1',
    kind: 'points',
    itemId: 'points_22',
    points: 22,
    priceFen: 1800,
  })
})

test('unknown products are rejected', () => {
  assert.equal(getPurchaseItem('not-a-product'), null)
})
