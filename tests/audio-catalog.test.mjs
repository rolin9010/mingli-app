import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RELAX_AUDIO_FILES,
  getRelaxAudioBlobPath,
  resolveRelaxAudioFile,
} from '../api/_signed.ts'

test('the member audio proxy allows all relax audio IDs used by the mini program', () => {
  const expectedIds = [
    'seated-relaxation',
    'training-modes',
    'female-guidance',
    'deep-relaxation-fire',
    'deep-relaxation-sanjiao',
    'deep-relaxation-30',
    'sleep-training-1',
    'throat-relaxation',
    'low-mood-relaxation',
    'starship-sleep',
    'anxiety-advanced-clean',
    'anxiety-advanced-music',
    'anxiety-body-release',
    'standing-guidance',
  ]

  assert.deepEqual(Object.keys(RELAX_AUDIO_FILES), expectedIds)
  for (const id of expectedIds) {
    assert.match(resolveRelaxAudioFile(id), /\.m4a$/)
    assert.equal(getRelaxAudioBlobPath(id), `media/relax-audio/${RELAX_AUDIO_FILES[id]}`)
  }
  assert.equal(resolveRelaxAudioFile('missing'), null)
})
