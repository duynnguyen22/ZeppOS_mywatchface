const test = require('node:test')
const assert = require('node:assert')
const f = require('../watchface/format.js')

test('pad2 pads and preserves', () => {
  assert.strictEqual(f.pad2(0), '00')
  assert.strictEqual(f.pad2(7), '07')
  assert.strictEqual(f.pad2(42), '42')
})

test('formatHour in 24-hour mode pads', () => {
  assert.strictEqual(f.formatHour(0, false), '00')
  assert.strictEqual(f.formatHour(9, false), '09')
  assert.strictEqual(f.formatHour(23, false), '23')
})

test('formatHour in 12-hour mode has no leading zero', () => {
  assert.strictEqual(f.formatHour(13, true), '1')
  assert.strictEqual(f.formatHour(9, true), '9')
})

test('formatHour maps midnight and noon to 12', () => {
  assert.strictEqual(f.formatHour(0, true), '12')
  assert.strictEqual(f.formatHour(12, true), '12')
})

test('formatMinute always pads', () => {
  assert.strictEqual(f.formatMinute(8), '08')
  assert.strictEqual(f.formatMinute(59), '59')
})

test('meridiem splits at noon', () => {
  assert.strictEqual(f.meridiem(0), 'AM')
  assert.strictEqual(f.meridiem(11), 'AM')
  assert.strictEqual(f.meridiem(12), 'PM')
  assert.strictEqual(f.meridiem(23), 'PM')
})

test('formatDate renders uppercase weekday and month', () => {
  assert.strictEqual(f.formatDate(2, 9, 12), 'TUE, SEP 12')
  assert.strictEqual(f.formatDate(7, 1, 1), 'SUN, JAN 1')
})

test('formatDate handles every weekday and month', () => {
  for (let week = 1; week <= 7; week++) {
    for (let month = 1; month <= 12; month++) {
      const out = f.formatDate(week, month, 15)
      assert.match(out, /^[A-Z]{3}, [A-Z]{3} 15$/, `bad output ${out}`)
    }
  }
})

test('formatSteps groups thousands', () => {
  assert.strictEqual(f.formatSteps(8560), '8,560')
  assert.strictEqual(f.formatSteps(999), '999')
  assert.strictEqual(f.formatSteps(0), '0')
  assert.strictEqual(f.formatSteps(1234567), '1,234,567')
})

test('formatBattery clamps and suffixes', () => {
  assert.strictEqual(f.formatBattery(80), '80%')
  assert.strictEqual(f.formatBattery(-5), '0%')
  assert.strictEqual(f.formatBattery(140), '100%')
})

test('formatTemp appends a degree sign', () => {
  assert.strictEqual(f.formatTemp(28), '28°')
  assert.strictEqual(f.formatTemp(-3), '-3°')
})

test('formatHiLo renders both bounds', () => {
  assert.strictEqual(f.formatHiLo(32, 24), 'H:32° L:24°')
})

test('formatHeart renders a dash when unavailable', () => {
  assert.strictEqual(f.formatHeart(72), '72')
  assert.strictEqual(f.formatHeart(0), '--')
  assert.strictEqual(f.formatHeart(null), '--')
  assert.strictEqual(f.formatHeart(undefined), '--')
})

test('formatCalories rounds to whole numbers', () => {
  assert.strictEqual(f.formatCalories(320.4), '320')
  assert.strictEqual(f.formatCalories(0), '0')
})

test('formatDistance keeps one decimal', () => {
  assert.strictEqual(f.formatDistance(2.5), '2.5 km')
  assert.strictEqual(f.formatDistance(10), '10.0 km')
})

test('formatDuration renders minutes and hours', () => {
  assert.strictEqual(f.formatDuration(24), '24 min')
  assert.strictEqual(f.formatDuration(90), '1h 30min')
  assert.strictEqual(f.formatDuration(60), '1h 00min')
})

test('unavailable numeric values degrade rather than print NaN', () => {
  assert.strictEqual(f.formatSteps(null), '0')
  assert.strictEqual(f.formatCalories(null), '0')
  assert.strictEqual(f.formatTemp(null), '--°')
})
