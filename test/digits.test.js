const test = require('node:test')
const assert = require('node:assert')
const { runWidth, centreRun } = require('../app/watchface/digits.js')

// The time is placed as individual glyph images, so the face has to do its
// own kerning. Widths are per-glyph because "1" is far narrower than the
// rest - the reference's "1" is 24px against 78px for "2".
const W = { '0': 89, '1': 24, '2': 78, '8': 77, ':': 9 }
const GAP = 10

test('runWidth sums the glyphs and the gaps between them', () => {
  // three glyphs -> two gaps
  assert.strictEqual(runWidth(['1', '0', ':'], W, GAP), 24 + 89 + 9 + 2 * GAP)
})

test('runWidth of a single glyph adds no gap', () => {
  assert.strictEqual(runWidth(['8'], W, GAP), 77)
})

test('runWidth of nothing is zero', () => {
  assert.strictEqual(runWidth([], W, GAP), 0)
})

test('centreRun places glyphs left to right, each after the last plus the gap', () => {
  const placed = centreRun(['1', '0'], W, GAP, 100)
  assert.deepStrictEqual(placed.map((g) => g.char), ['1', '0'])
  assert.strictEqual(placed[1].x - (placed[0].x + W['1']), GAP)
})

test('centreRun centres the whole run on the given x', () => {
  const placed = centreRun(['1', '0'], W, GAP, 100)
  const total = runWidth(['1', '0'], W, GAP)
  assert.strictEqual(placed[0].x, 100 - total / 2)
  const right = placed[1].x + W['0']
  assert.strictEqual(right, 100 + total / 2)
})

test('centreRun keeps a one-digit hour centred rather than shifting the face', () => {
  const two = centreRun(['1', '0', ':', '2', '8'], W, GAP, 233)
  const one = centreRun(['8', ':', '2', '8'], W, GAP, 233)
  const mid = (p) => p[0].x + runWidth(p.map((g) => g.char), W, GAP) / 2
  assert.strictEqual(mid(two), 233)
  assert.strictEqual(mid(one), 233)
})

test('centreRun reports an unknown glyph rather than silently placing it at zero', () => {
  assert.throws(() => centreRun(['1', 'Z'], W, GAP, 100), /Z/)
})
