const test = require('node:test')
const assert = require('node:assert')
const { readHeartRate } = require('../app/watchface/sensors.js')

// --- readHeartRate ----------------------------------------------------
// The bug this covers: the face read heart rate with getCurrent(), which
// the platform documents as "needs to be used in the onCurrentChange
// callback function" - it reports an in-progress continuous measurement,
// which a watch face never starts. On real hardware it is therefore 0 all
// day; the simulator ignores the distinction and hands back whatever its
// sensor panel is set to, which is why this looked fine in development.
//
// getLast() is the one a face wants: the most recent single or background
// monitoring measurement.

function fakeSensor(values) {
  const sensor = {}
  for (const name of Object.keys(values)) {
    const value = values[name]
    sensor[name] = () => {
      if (value instanceof Error) throw value
      return value
    }
  }
  return sensor
}

test('reads the last measurement, not the in-progress one', () => {
  // What the real watch hands back: a genuine reading from background
  // monitoring, and 0 for a continuous measurement nobody started.
  assert.strictEqual(readHeartRate(fakeSensor({ getLast: 62, getCurrent: 0 })), 62)
})

test('prefers the last measurement even when both report', () => {
  assert.strictEqual(readHeartRate(fakeSensor({ getLast: 62, getCurrent: 88 })), 62)
})

test('falls back to the current measurement when there is no last one', () => {
  // The simulator populates getCurrent() and not getLast(), and on the
  // watch a non-zero getCurrent() means a measurement really is running.
  assert.strictEqual(readHeartRate(fakeSensor({ getLast: 0, getCurrent: 75 })), 75)
})

test('falls back when the runtime has no getLast at all', () => {
  assert.strictEqual(readHeartRate(fakeSensor({ getCurrent: 75 })), 75)
})

test('a zero reading is no reading, not a heart rate of zero', () => {
  // A living wearer never reads 0 bpm. Showing "0" is a lie; '--' is not.
  assert.strictEqual(readHeartRate(fakeSensor({ getLast: 0, getCurrent: 0 })), null)
})

test('a negative or nonsensical reading is no reading', () => {
  assert.strictEqual(readHeartRate(fakeSensor({ getLast: -1, getCurrent: -1 })), null)
  assert.strictEqual(readHeartRate(fakeSensor({ getLast: NaN, getCurrent: NaN })), null)
  assert.strictEqual(readHeartRate(fakeSensor({ getLast: Infinity, getCurrent: Infinity })), null)
  assert.strictEqual(readHeartRate(fakeSensor({ getLast: '62', getCurrent: '62' })), null)
})

test('an absent sensor is no reading rather than a crash', () => {
  assert.strictEqual(readHeartRate(null), null)
  assert.strictEqual(readHeartRate(undefined), null)
  assert.strictEqual(readHeartRate({}), null)
})

test('a throwing sensor is no reading rather than a black screen', () => {
  // Permission denied throws on this platform, and an uncaught throw in
  // build() is swallowed by the toolchain, leaving a black face.
  assert.strictEqual(readHeartRate(fakeSensor({
    getLast: new Error('PERMISSION DENIED data:user.hd.heart_rate'),
    getCurrent: new Error('PERMISSION DENIED data:user.hd.heart_rate'),
  })), null)
})

test('a throwing getLast still lets getCurrent report', () => {
  assert.strictEqual(readHeartRate(fakeSensor({
    getLast: new Error('not supported'),
    getCurrent: 75,
  })), 75)
})
