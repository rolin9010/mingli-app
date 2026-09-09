import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAttach, getPurchaseEligibilityError, getPurchaseItem } from './_fulfillment.js'

test('membership catalog includes the configured points bonuses', () => {
  const expected = {
    trial: 3,
    monthly: 9,
    quarterly: 30,
    yearly: 90,
  }

  for (const [id, bonusPoints] of Object.entries(expected)) {
    const item = getPurchaseItem(id)
    assert.ok(item)
    assert.equal(item.kind, 'membership')
    assert.equal(item.bonusPoints, bonusPoints)
  }
})

test('legacy trial membership remains in the catalog for delayed fulfillment', () => {
  const item = getPurchaseItem('trial')
  assert.ok(item)
  assert.equal(item.priceFen, 100)
})

test('trial membership is no longer available for new purchases', () => {
  const trial = getPurchaseItem('trial')
  const monthly = getPurchaseItem('monthly')

  assert.ok(trial)
  assert.ok(monthly)
  assert.equal(getPurchaseEligibilityError(trial, false), '7天新人试用已下架，请选择月度、季度或年度会员')
  assert.equal(getPurchaseEligibilityError(trial, true), '7天新人试用已下架，请选择月度、季度或年度会员')
  assert.equal(getPurchaseEligibilityError(monthly, true), null)
})

test('membership attach stays below WeChat Pay 128-byte limit', () => {
  const item = getPurchaseItem('monthly')
  assert.ok(item)

  assert.deepEqual(JSON.parse(buildAttach('user-1', item)), {
    u: 'user-1',
    i: 'monthly',
  })
  assert.ok(Buffer.byteLength(buildAttach('12345678-1234-1234-1234-123456789012', item)) <= 128)
})

test('points purchases remain separate products in the same catalog', () => {
  const item = getPurchaseItem('points_22')
  assert.ok(item)
  assert.equal(item.kind, 'points')

  assert.deepEqual(JSON.parse(buildAttach('user-1', item)), {
    u: 'user-1',
    i: 'points_22',
  })
})

test('unknown products are rejected', () => {
  assert.equal(getPurchaseItem('not-a-product'), null)
})
