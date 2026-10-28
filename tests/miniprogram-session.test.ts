import test from 'node:test'
import assert from 'node:assert/strict'
import { isReadOnlyMiniProgramHistoryPath } from '../src/lib/miniProgramEntry'

test('history fallback accepts a signed mini-program archive path', () => {
  assert.equal(
    isReadOnlyMiniProgramHistoryPath('/?miniprogram=1&view=history&uid=user-1'),
    true,
  )
})

test('history fallback rejects unrelated mini-program pages', () => {
  assert.equal(isReadOnlyMiniProgramHistoryPath('/?miniprogram=1&onboarding=1'), false)
  assert.equal(isReadOnlyMiniProgramHistoryPath('/?miniprogram=1&view=history'), false)
  assert.equal(
    isReadOnlyMiniProgramHistoryPath('https://example.com/?miniprogram=1&view=history&uid=user-1'),
    false,
  )
})
