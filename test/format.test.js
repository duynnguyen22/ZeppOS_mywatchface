const test = require('node:test')
const assert = require('node:assert')
const {
  WEEKDAYS, NO_VALUE, pad2, formatHour, formatMinute, formatDate,
  formatSteps, formatBattery, formatMetric,
} = require('../app/watchface/format.js')

test('pad2 pads single digits and leaves doubles alone', () => {
  assert.strictEqual(pad2(7), '07')
  assert.strictEqual(pad2(23), '23')
})

test('formatHour in 24-hour mode pads to two digits', () => {
  assert.strictEqual(formatHour(9, false), '09')
  assert.strictEqual(formatHour(17, false), '17')
})

test('formatHour in 12-hour mode drops the leading zero', () => {
  assert.strictEqual(formatHour(9, true), '9')
  assert.strictEqual(formatHour(17, true), '5')
})

test('formatHour renders both midnight and noon as 12, not 0', () => {
  assert.strictEqual(formatHour(0, true), '12')
  assert.strictEqual(formatHour(12, true), '12')
})

test('formatMinute always pads', () => {
  assert.strictEqual(formatMinute(5), '05')
  assert.strictEqual(formatMinute(41), '41')
})

test('formatDate renders weekday and day, matching the reference', () => {
  assert.strictEqual(formatDate(6, 12), 'SAT · 12')
})

test('formatDate maps all seven weekdays, Monday first', () => {
  // The platform's Time.getDay() is 1-7 starting Monday. Getting this
  // backwards shows the wrong day every day, which is easy to miss.
  const got = [1, 2, 3, 4, 5, 6, 7].map((w) => formatDate(w, 1).split(' ')[0])
  assert.deepStrictEqual(got, WEEKDAYS)
})

test('formatDate degrades rather than printing undefined for a bad weekday', () => {
  assert.strictEqual(formatDate(0, 12), NO_VALUE)
  assert.strictEqual(formatDate(8, 12), NO_VALUE)
})

test('formatSteps groups thousands', () => {
  assert.strictEqual(formatSteps(8421), '8,421')
  assert.strictEqual(formatSteps(999), '999')
  assert.strictEqual(formatSteps(10582), '10,582')
})

test('formatSteps keeps a real zero but dashes a missing reading', () => {
  assert.strictEqual(formatSteps(0), '0')
  assert.strictEqual(formatSteps(null), NO_VALUE)
  assert.strictEqual(formatSteps(undefined), NO_VALUE)
})

test('formatBattery clamps to 0-100', () => {
  assert.strictEqual(formatBattery(78), '78%')
  assert.strictEqual(formatBattery(140), '100%')
  assert.strictEqual(formatBattery(-5), '0%')
})

test('formatBattery dashes a missing reading', () => {
  assert.strictEqual(formatBattery(null), '--%')
})

test('formatMetric rounds to whole numbers', () => {
  assert.strictEqual(formatMetric(519.6), '520')
  assert.strictEqual(formatMetric(32), '32')
})

test('formatMetric keeps a real zero but dashes a missing reading', () => {
  assert.strictEqual(formatMetric(0), '0')
  assert.strictEqual(formatMetric(null), NO_VALUE)
})

test('no formatter ever emits NaN or undefined for a junk reading', () => {
  const junk = [null, undefined, NaN, 'abc', {}]
  for (const v of junk) {
    for (const [name, fn] of Object.entries({ formatSteps, formatBattery, formatMetric })) {
      const out = fn(v)
      assert.ok(typeof out === 'string', `${name} must return a string`)
      assert.ok(!/NaN|undefined/.test(out), `${name}(${String(v)}) produced "${out}"`)
    }
  }
})
