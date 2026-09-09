import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVirtualPaymentParams,
  getVirtualProductId,
  parseVirtualPaymentProxyPlanId,
} from './_virtual-payment.js'
import { getPurchaseItem } from './_fulfillment.js'

test('published virtual product ids map to the membership catalog', () => {
  assert.equal(getVirtualProductId('trial'), 'member_trial_7d')
  assert.equal(getVirtualProductId('monthly'), 'member_month_30d')
  assert.equal(getVirtualProductId('quarterly'), 'member_quarter_90d')
  assert.equal(getVirtualProductId('yearly'), 'member_year_365d')
  assert.throws(() => getVirtualProductId('points_3'), /尚未配置/)
})

test('virtual payment parameters contain the published product and signed payload', () => {
  const item = getPurchaseItem('trial')
  assert.ok(item)

  const result = buildVirtualPaymentParams(
    '00000000-0000-0000-0000-000000000001',
    item,
    'session-key',
    { offerId: '1450606533', env: 0, appKey: 'app-key' },
    '20260731123456789000',
  )
  const signData = JSON.parse(result.paymentParams.signData)

  assert.equal(result.outTradeNo, '20260731123456789000')
  assert.equal(result.paymentParams.mode, 'short_series_goods')
  assert.equal(signData.productId, 'member_trial_7d')
  assert.equal(signData.goodsPrice, 100)
  assert.equal(signData.offerId, '1450606533')
  assert.equal(result.paymentParams.paySig.length, 64)
  assert.equal(result.paymentParams.signature.length, 64)
  assert.notEqual(result.paymentParams.paySig, result.paymentParams.signature)
})

test('legacy cloud proxy payload is decoded into virtual payment actions', () => {
  assert.deepEqual(
    parseVirtualPaymentProxyPlanId('xpay:create:trial::login-code'),
    {
      action: 'createVirtualOrder',
      planId: 'trial',
      loginCode: 'login-code',
      outTradeNo: '',
    },
  )
  assert.deepEqual(
    parseVirtualPaymentProxyPlanId('xpay:confirm:monthly:order-123:login-code'),
    {
      action: 'confirmVirtualOrder',
      planId: 'monthly',
      loginCode: 'login-code',
      outTradeNo: 'order-123',
    },
  )
  assert.equal(parseVirtualPaymentProxyPlanId('monthly'), null)
  assert.equal(parseVirtualPaymentProxyPlanId('xpay:confirm:monthly::login-code'), null)
})
