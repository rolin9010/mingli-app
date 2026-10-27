import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BIRTH_YEAR_MAX,
  BIRTH_YEARS,
} from '../src/lib/birthDateOptions.ts'

test('birth year options include today and extend through 2050', () => {
  const currentYear = new Date().getFullYear()
  assert.ok(BIRTH_YEAR_MAX >= currentYear)
  assert.equal(BIRTH_YEAR_MAX, 2050)
  assert.equal(BIRTH_YEARS[0], 2050)
  assert.equal(BIRTH_YEARS[BIRTH_YEARS.length - 1], 1906)
  assert.ok(BIRTH_YEARS.includes(currentYear))
})

test('every selectable birth year is a four-digit integer', () => {
  assert.equal(BIRTH_YEARS.length, 2050 - 1906 + 1)
  assert.ok(BIRTH_YEARS.every(Number.isInteger))
})
