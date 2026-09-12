const test = require('node:test')
const assert = require('node:assert')
const { ratio, bandRatio, frameIndex, litDashes, resolveTarget } = require('../app/watchface/gauge.js')

// --- ratio ------------------------------------------------------------
// Everything on this face that fills - the battery arc, both rings, the
// dashed dial - reduces to one number in 0..1. Sensors on this platform
// return null before their first reading, so that case is not academic.

test('ratio is the plain fraction of the target', () => {
  assert.strictEqual(ratio(5000, 10000), 0.5)
  assert.strictEqual(ratio(2500, 10000), 0.25)
})

test('ratio clamps above the target rather than overfilling the ring', () => {
  assert.strictEqual(ratio(15000, 10000), 1)
})

test('ratio treats a missing reading as empty, not as NaN', () => {
  assert.strictEqual(ratio(null, 10000), 0)
  assert.strictEqual(ratio(undefined, 10000), 0)
})

test('ratio treats a nonsensical target as empty rather than dividing by zero', () => {
  assert.strictEqual(ratio(500, 0), 0)
  assert.strictEqual(ratio(500, -1), 0)
})

test('ratio clamps a negative reading to empty', () => {
  assert.strictEqual(ratio(-20, 10000), 0)
})

// --- frameIndex -------------------------------------------------------
// Arc fills are pre-rendered sprites, so a ratio has to pick the nearest
// frame. Frame 0 is empty and the last frame is full.

test('frameIndex picks the first frame when empty and the last when full', () => {
  assert.strictEqual(frameIndex(0, 21), 0)
  assert.strictEqual(frameIndex(1, 21), 20)
})

test('frameIndex rounds to the nearest frame rather than truncating', () => {
  // 21 frames = 20 gaps of 5%. 0.13 sits nearer the 15% frame than the 10%.
  assert.strictEqual(frameIndex(0.13, 21), 3)
  assert.strictEqual(frameIndex(0.11, 21), 2)
})

test('frameIndex never returns an out-of-range index for out-of-range input', () => {
  assert.strictEqual(frameIndex(-5, 21), 0)
  assert.strictEqual(frameIndex(99, 21), 20)
})

// --- litDashes --------------------------------------------------------
// The middle dial is drawn as discrete dashes, so its ratio quantises to a
// whole number of lit segments.

test('litDashes lights none when empty and all when full', () => {
  assert.strictEqual(litDashes(0, 24), 0)
  assert.strictEqual(litDashes(1, 24), 24)
})

test('litDashes rounds to whole segments', () => {
  assert.strictEqual(litDashes(0.5, 24), 12)
  assert.strictEqual(litDashes(0.52, 24), 12)
})

// --- resolveTarget ----------------------------------------------------
// The step goal may come from the user's Zepp settings; everything else
// falls back to a constant. A sensor that returns 0 or junk must not make
// the ring divide by zero.

test('resolveTarget prefers a usable sensor goal', () => {
  assert.strictEqual(resolveTarget(12000, 10000), 12000)
})

test('resolveTarget falls back when the sensor gives nothing usable', () => {
  assert.strictEqual(resolveTarget(null, 10000), 10000)
  assert.strictEqual(resolveTarget(0, 10000), 10000)
  assert.strictEqual(resolveTarget(-3, 10000), 10000)
  assert.strictEqual(resolveTarget('lots', 10000), 10000)
})

// --- bandRatio --------------------------------------------------------
// Heart rate has no natural zero the way a step goal does: a living wearer
// never reads 0 bpm, so filling from 0 would leave the dial parked around
// a third and barely moving. It fills across a resting-to-effort band
// instead, so the dashes travel over the range readings actually occupy.

test('bandRatio is empty at the floor and full at the ceiling', () => {
  assert.strictEqual(bandRatio(40, 40, 180), 0)
  assert.strictEqual(bandRatio(180, 40, 180), 1)
})

test('bandRatio is the fraction of the way through the band', () => {
  assert.strictEqual(bandRatio(110, 40, 180), 0.5)
  assert.strictEqual(bandRatio(75, 40, 180), 0.25)
})

test('bandRatio clamps outside the band rather than over- or underfilling', () => {
  assert.strictEqual(bandRatio(35, 40, 180), 0)
  assert.strictEqual(bandRatio(210, 40, 180), 1)
})

test('bandRatio treats a missing reading as empty, not as NaN', () => {
  assert.strictEqual(bandRatio(null, 40, 180), 0)
  assert.strictEqual(bandRatio(undefined, 40, 180), 0)
  assert.strictEqual(bandRatio('72', 40, 180), 0)
})

test('bandRatio treats a nonsensical band as empty rather than dividing by zero', () => {
  assert.strictEqual(bandRatio(100, 40, 40), 0)
  assert.strictEqual(bandRatio(100, 180, 40), 0)
  assert.strictEqual(bandRatio(100, null, 180), 0)
})
