const test = require('node:test')
const assert = require('node:assert')
const { SCREEN, CENTER, RADIUS, polar, fitsOnFace, RECT, statCard, CARD, CARD_INSET } = require('../app/watchface/layout.js')

function close(actual, expected, tol = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`)
}

test('screen constants match the Active 2 Round', () => {
  assert.deepStrictEqual(SCREEN, { width: 466, height: 466 })
  assert.deepStrictEqual(CENTER, { x: 233, y: 233 })
  assert.strictEqual(RADIUS, 233)
})

test('polar 0 degrees points to 12 o clock', () => {
  const p = polar(0, 100)
  close(p.x, 233); close(p.y, 133)
})

test('polar 90 degrees points to 3 o clock', () => {
  const p = polar(90, 100)
  close(p.x, 333); close(p.y, 233)
})

test('polar 180 degrees points to 6 o clock', () => {
  const p = polar(180, 100)
  close(p.x, 233); close(p.y, 333)
})

test('polar 270 degrees points to 9 o clock', () => {
  const p = polar(270, 100)
  close(p.x, 133); close(p.y, 233)
})

test('polar with zero distance is the centre', () => {
  const p = polar(45, 0)
  close(p.x, 233); close(p.y, 233)
})

test('a centred rect fits', () => {
  assert.strictEqual(fitsOnFace({ x: 183, y: 183, w: 100, h: 100 }), true)
})

test('a bounding-box corner rect does not fit the circle', () => {
  assert.strictEqual(fitsOnFace({ x: 0, y: 0, w: 100, h: 100 }), false)
})

test('the full square does not fit the circle', () => {
  assert.strictEqual(fitsOnFace({ x: 0, y: 0, w: 466, h: 466 }), false)
})

test('margin shrinks the usable area', () => {
  const wide = { x: 3, y: 233, w: 460, h: 1 }
  assert.strictEqual(fitsOnFace(wide, 0), true)
  assert.strictEqual(fitsOnFace(wide, 50), false)
})

test('every laid-out element stays inside the bezel', () => {
  for (const [name, rect] of Object.entries(RECT)) {
    if (name === 'BACKGROUND') continue
    assert.strictEqual(fitsOnFace(rect, 4), true, `${name} is clipped by the bezel`)
  }
})

test('the background covers the whole screen', () => {
  assert.deepStrictEqual(RECT.BACKGROUND, { x: 0, y: 0, w: 466, h: 466 })
})

test('three stat cards are evenly spaced and do not overlap', () => {
  const cards = [statCard(0), statCard(1), statCard(2)]
  for (const card of cards) {
    assert.strictEqual(card.w, 118)
    assert.strictEqual(card.h, 88)
    assert.strictEqual(card.y, 234)
  }
  const gap1 = cards[1].x - (cards[0].x + cards[0].w)
  const gap2 = cards[2].x - (cards[1].x + cards[1].w)
  assert.strictEqual(gap1, gap2)
  assert.ok(gap1 > 0, 'cards must not overlap')
})

test('the stat card row is horizontally centred', () => {
  const first = statCard(0)
  const last = statCard(2)
  const leftGap = first.x
  const rightGap = 466 - (last.x + last.w)
  assert.strictEqual(leftGap, rightGap)
})

test('statCard rejects an out-of-range index', () => {
  assert.throws(() => statCard(3))
  assert.throws(() => statCard(-1))
})

test('the card icon and value have clear separation, not just a few px', () => {
  const iconRight = CARD_INSET.ICON.dx + CARD_INSET.ICON.w
  const gap = CARD_INSET.VALUE.dx - iconRight
  assert.ok(gap >= 6, `icon-to-value gap is only ${gap}px`)
})

test('every CARD_INSET rect sits within the card bounds', () => {
  for (const [name, inset] of Object.entries(CARD_INSET)) {
    const right = inset.dx + inset.w
    const bottom = inset.dy + inset.h
    assert.ok(right <= CARD.w, `${name} right edge (${right}) exceeds card width (${CARD.w})`)
    assert.ok(bottom <= CARD.h, `${name} bottom edge (${bottom}) exceeds card height (${CARD.h})`)
  }
})
