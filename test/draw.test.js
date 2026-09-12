const test = require('node:test')
const assert = require('node:assert')
const {
  Canvas,
  fillCircle,
  fillEllipse,
  fillCapsule,
  fillPoly,
  fillPath,
  downsample,
  renderSupersampled,
} = require('../tools/draw.js')

function alphaAt(canvas, x, y) {
  return canvas.getPixel(x, y).a
}

test('a filled circle is opaque at its centre', () => {
  const c = new Canvas(20, 20)
  fillCircle(c, 10, 10, 6, 0xff0000)
  assert.strictEqual(alphaAt(c, 10, 10), 255)
  const px = c.getPixel(10, 10)
  assert.strictEqual(px.r, 255)
  assert.strictEqual(px.g, 0)
  assert.strictEqual(px.b, 0)
})

test('a filled circle is transparent well outside its radius', () => {
  const c = new Canvas(20, 20)
  fillCircle(c, 10, 10, 6, 0xff0000)
  assert.strictEqual(alphaAt(c, 1, 1), 0)
  assert.strictEqual(alphaAt(c, 18, 18), 0)
})

test('a filled circle is transparent outside its bounding box (no bleed)', () => {
  const c = new Canvas(20, 20)
  fillCircle(c, 10, 10, 6, 0xff0000)
  assert.strictEqual(alphaAt(c, 19, 19), 0)
})

test('an ellipse is opaque at centre, transparent far outside', () => {
  const c = new Canvas(30, 30)
  fillEllipse(c, 15, 15, 10, 5, 0x00ff00)
  assert.strictEqual(alphaAt(c, 15, 15), 255)
  assert.strictEqual(alphaAt(c, 15, 29), 0)
  assert.strictEqual(alphaAt(c, 29, 15), 0)
})

test('a capsule covers both of its endpoints', () => {
  const c = new Canvas(40, 40)
  fillCapsule(c, 5, 20, 35, 20, 6, 0x0000ff)
  assert.strictEqual(alphaAt(c, 5, 20), 255)
  assert.strictEqual(alphaAt(c, 35, 20), 255)
})

test('a capsule covers points along its shaft and not far off it', () => {
  const c = new Canvas(40, 40)
  fillCapsule(c, 5, 20, 35, 20, 6, 0x0000ff)
  assert.strictEqual(alphaAt(c, 20, 20), 255, 'midpoint of the shaft')
  assert.strictEqual(alphaAt(c, 20, 39), 0, 'far off the shaft')
})

test('a zero-length capsule degenerates to a disc at the shared point', () => {
  const c = new Canvas(20, 20)
  fillCapsule(c, 10, 10, 10, 10, 8, 0x0000ff)
  assert.strictEqual(alphaAt(c, 10, 10), 255)
  assert.strictEqual(alphaAt(c, 1, 1), 0)
})

test('fillPoly fills a triangle and leaves its exterior untouched', () => {
  const c = new Canvas(30, 30)
  fillPoly(
    c,
    [
      [5, 25],
      [25, 25],
      [15, 5],
    ],
    0xffff00
  )
  // Centroid of the triangle.
  assert.strictEqual(alphaAt(c, 15, 20), 255)
  // Outside the triangle entirely.
  assert.strictEqual(alphaAt(c, 2, 2), 0)
  assert.strictEqual(alphaAt(c, 28, 28), 0)
})

test('alpha compositing lets a translucent shape blend over an opaque one', () => {
  const c = new Canvas(10, 10)
  fillCircle(c, 5, 5, 5, 0xff0000)
  fillCircle(c, 5, 5, 5, { r: 0, g: 0, b: 255, a: 128 })
  const px = c.getPixel(5, 5)
  assert.strictEqual(px.a, 255)
  // Blended toward blue but not pure blue.
  assert.ok(px.b > 100 && px.b < 255, `expected a blend, got b=${px.b}`)
  assert.ok(px.r > 0 && px.r < 255, `expected a blend, got r=${px.r}`)
})

test('downsample rejects a factor that does not evenly divide the canvas', () => {
  const c = new Canvas(10, 10)
  assert.throws(() => downsample(c, 3))
})

test('downsample produces the expected smaller dimensions', () => {
  const c = new Canvas(16, 16)
  fillCircle(c, 8, 8, 8, 0xffffff)
  const small = downsample(c, 4)
  assert.strictEqual(small.width, 4)
  assert.strictEqual(small.height, 4)
})

test('renderSupersampled returns a canvas at the requested target size, not the scaled-up size', () => {
  const out = renderSupersampled(11, 7, 4, (big, s) => {
    assert.strictEqual(big.width, 44)
    assert.strictEqual(big.height, 28)
    assert.strictEqual(s, 4)
    fillCircle(big, 22, 14, 10, 0x00ff00)
  })
  assert.strictEqual(out.width, 11)
  assert.strictEqual(out.height, 7)
})

test('supersampling smooths a circle edge: a downsampled boundary pixel is partially transparent', () => {
  // At 1x, a circle boundary pixel is a hard 0-or-255 alpha step. At 4x
  // supersampling + downsample, the same boundary pixel should land
  // somewhere in between - that partial coverage is what reads as a
  // smooth edge instead of a jagged one.
  const out = renderSupersampled(20, 20, 4, (big, s) => {
    fillCircle(big, 10 * s, 10 * s, 6 * s, 0xffffff)
  })
  // Sample a ring of pixels near the circle boundary (radius 6 from centre
  // (10,10)) and require at least one with 0 < alpha < 255.
  let sawPartial = false
  for (let x = 0; x < 20; x++) {
    for (let y = 0; y < 20; y++) {
      const a = out.getPixel(x, y).a
      if (a > 0 && a < 255) sawPartial = true
    }
  }
  assert.ok(sawPartial, 'expected at least one partially-covered edge pixel')
})

// --- Rotated ellipses -------------------------------------------------
// The footprint sole leans; an axis-aligned ellipse reads as an egg. The
// rotation argument is optional, so every existing call site keeps working.

test('an ellipse rotated a quarter turn swaps which axis is long', () => {
  const c = new Canvas(40, 40)
  // rx=14, ry=4, turned 90 degrees: the long axis now runs vertically.
  fillEllipse(c, 20, 20, 14, 4, 0x00ff00, undefined, Math.PI / 2)
  assert.strictEqual(alphaAt(c, 20, 9), 255, '11px above centre, inside the now-vertical long axis')
  assert.strictEqual(alphaAt(c, 9, 20), 0, '11px left of centre, outside the now-short axis')
})

test('an unrotated ellipse is unchanged when the angle is omitted', () => {
  const c = new Canvas(40, 40)
  fillEllipse(c, 20, 20, 14, 4, 0x00ff00)
  assert.strictEqual(alphaAt(c, 9, 20), 255, 'long axis still horizontal')
  assert.strictEqual(alphaAt(c, 20, 9), 0, 'short axis still vertical')
})

test('a 45-degree rotated ellipse covers its diagonal but not its anti-diagonal', () => {
  const c = new Canvas(60, 60)
  fillEllipse(c, 30, 30, 20, 5, 0x00ff00, undefined, Math.PI / 4)
  // 12px along the down-right diagonal is well inside the long axis.
  assert.strictEqual(alphaAt(c, 30 + 12, 30 + 12), 255)
  // The same distance along the other diagonal is outside the short axis.
  assert.strictEqual(alphaAt(c, 30 + 12, 30 - 12), 0)
})

// --- Curved paths -----------------------------------------------------
// A flame silhouette is curved. fillPath samples quadratic segments into a
// dense polygon and hands it to the existing even-odd rasteriser.

test('fillPath with only straight segments fills the same area as fillPoly', () => {
  const viaPath = new Canvas(30, 30)
  const viaPoly = new Canvas(30, 30)
  const pts = [[5, 5], [25, 5], [15, 25]]
  fillPath(viaPath, pts.map(([x, y]) => ({ x, y })), 0xff0000)
  fillPoly(viaPoly, pts, 0xff0000)
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      assert.strictEqual(
        alphaAt(viaPath, x, y),
        alphaAt(viaPoly, x, y),
        `pixel ${x},${y} differs between fillPath and fillPoly`
      )
    }
  }
})

test('a control handle bulges the edge outward past the straight chord', () => {
  const c = new Canvas(40, 40)
  // A triangle whose top edge bows upward via a control point above it.
  fillPath(
    c,
    [
      { x: 5, y: 20 },
      { x: 35, y: 20, cx: 20, cy: 2 },
      { x: 20, y: 35 },
    ],
    0xff0000
  )
  assert.strictEqual(alphaAt(c, 20, 19), 255, 'inside the straight chord')
  assert.strictEqual(alphaAt(c, 20, 12), 255, 'above the chord, under the bulge')
  assert.strictEqual(alphaAt(c, 20, 1), 0, 'beyond even the control point')
})

test('a control handle pinches the edge inward when placed inside the shape', () => {
  const c = new Canvas(40, 40)
  // Same outline, but the handle sits below the chord, cutting a notch in.
  fillPath(
    c,
    [
      { x: 5, y: 20 },
      { x: 35, y: 20, cx: 20, cy: 30 },
      { x: 20, y: 35 },
    ],
    0xff0000
  )
  assert.strictEqual(alphaAt(c, 20, 19), 0, 'the chord line is now outside the pinched edge')
  assert.strictEqual(alphaAt(c, 20, 30), 255, 'still filled below the notch')
})

test('fillPath closes the path automatically, wrapping the last point to the first', () => {
  const c = new Canvas(30, 30)
  // Three points, no explicit closing segment.
  fillPath(c, [{ x: 5, y: 5 }, { x: 25, y: 5 }, { x: 15, y: 25 }], 0xff0000)
  assert.strictEqual(alphaAt(c, 15, 10), 255, 'interior is filled, so the outline closed')
})
