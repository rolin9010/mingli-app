import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMiniProgramMeasurementUrl,
  hasAuthenticatedMiniProgramHistorySession,
  resolveMiniProgramArchiveDestination,
} from '../src/lib/miniProgramEntry.js'

test('empty mini-program account enters the measurement flow', () => {
  assert.equal(resolveMiniProgramArchiveDestination(0), 'measurement')
})

test('mini-program account with personal archives stays in history', () => {
  assert.equal(resolveMiniProgramArchiveDestination(1), 'history')
  assert.equal(resolveMiniProgramArchiveDestination(2), 'history')
})

test('measurement URLs preserve mini-program mode and optional guidance', () => {
  assert.equal(buildMiniProgramMeasurementUrl(), '/?miniprogram=1')
  assert.equal(
    buildMiniProgramMeasurementUrl(true),
    '/?miniprogram=1&onboarding=1',
  )
})

test('mini-program history is writable only for the matching authenticated session', () => {
  assert.equal(hasAuthenticatedMiniProgramHistorySession('user-1', 'user-1'), true)
  assert.equal(hasAuthenticatedMiniProgramHistorySession('user-1', 'user-2'), false)
  assert.equal(hasAuthenticatedMiniProgramHistorySession('user-1', null), false)
  assert.equal(hasAuthenticatedMiniProgramHistorySession('', 'user-1'), false)
})
