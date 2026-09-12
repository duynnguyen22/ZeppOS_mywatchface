const test = require('node:test')
const assert = require('node:assert')
const { COLOR, TYPE } = require('../watchface/tokens.js')

test('every colour is a 24-bit integer', () => {
  for (const [name, value] of Object.entries(COLOR)) {
    assert.strictEqual(typeof value, 'number', `${name} must be a number`)
    assert.ok(Number.isInteger(value), `${name} must be an integer`)
    assert.ok(value >= 0 && value <= 0xffffff, `${name} out of range`)
  }
})

test('required colour tokens exist', () => {
  for (const name of ['BG_DEEP', 'MINT', 'CORAL', 'AMBER', 'WHITE', 'MUTED', 'CARD_BG']) {
    assert.ok(name in COLOR, `missing colour ${name}`)
  }
})

test('hour and minute colours differ so the time is two-tone', () => {
  assert.notStrictEqual(COLOR.WHITE, COLOR.MINT)
})

test('accent colours are mutually distinct', () => {
  const accents = [COLOR.MINT, COLOR.CORAL, COLOR.AMBER]
  assert.strictEqual(new Set(accents).size, 3)
})

test('every type size is a positive integer', () => {
  for (const [name, value] of Object.entries(TYPE)) {
    assert.ok(Number.isInteger(value) && value > 0, `${name} must be positive`)
  }
})

test('the time is the largest type size', () => {
  assert.strictEqual(TYPE.TIME, Math.max(...Object.values(TYPE)))
})
