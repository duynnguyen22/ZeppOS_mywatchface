// Generates the glyph icons used by the weather readout, the three stat
// cards, and the activity pill - replacing the flat FILL_RECT circle
// placeholders with real artwork. Deterministic, dependency-free (built on
// tools/draw.js and tools/png.js only).

const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')
const { renderSupersampled, fillCircle, fillEllipse, fillCapsule, fillPoly } = require('./draw.js')
const { COLOR } = require('../app/watchface/tokens.js')

// Icons are AUTHORED in a 0..44 coordinate space, but each one is RENDERED
// at the exact pixel size of the widget that displays it. This matters:
// Zepp IMG widgets do not scale their source - they draw at native size and
// crop to the widget box. A 44x44 asset in a 22x22 slot loses three quarters
// of the glyph, which is why these first appeared as unrecognisable blobs.
const AUTHOR = 44
const SCALE = 4
const CLOUD = 0xdfe8ea

// Output sizes, each matching its widget box exactly.
const SIZE_WEATHER = 30 // RECT.WEATHER_ICON
const SIZE_CARD = 26    // CARD_INSET.ICON
const SIZE_PILL = 35    // pill icon box in index.js

function icon(name, outSize, draw) {
  const canvas = renderSupersampled(outSize, outSize, SCALE, (big, s) => {
    // unit space (0..AUTHOR) -> supersampled pixels
    const u = (s * outSize) / AUTHOR
    const circle = (cx, cy, r, color) => fillCircle(big, cx * u, cy * u, r * u, color)
    const ellipse = (cx, cy, rx, ry, color) =>
      fillEllipse(big, cx * u, cy * u, rx * u, ry * u, color)
    const capsule = (x1, y1, x2, y2, thickness, color) =>
      fillCapsule(big, x1 * u, y1 * u, x2 * u, y2 * u, thickness * u, color)
    const poly = (points, color) => fillPoly(big, points.map(([x, y]) => [x * u, y * u]), color)
    draw({ circle, ellipse, capsule, poly })
  })
  return { name, size: outSize, buffer: canvas.toBuffer() }
}

// Sun behind a cloud: sun disc peeking from the upper right, cloud built
// from overlapping circles plus a rounded base.
const weather = icon('ic-weather', SIZE_WEATHER, ({ circle, capsule }) => {
  circle(32, 11, 7.5, COLOR.AMBER)
  capsule(11, 27, 33, 27, 15, CLOUD)
  circle(15, 20, 7.5, CLOUD)
  circle(23, 16.5, 9.5, CLOUD)
  circle(31, 20.5, 7, CLOUD)
})

// A footprint: one large rounded sole plus a row of toe circles above it -
// reads more clearly than a shoe at this size.
const steps = icon('ic-steps', SIZE_CARD, ({ ellipse, circle }) => {
  ellipse(23, 30, 10, 13, COLOR.MINT)
  circle(11.5, 15, 3.1, COLOR.MINT)
  circle(18, 10.5, 3.6, COLOR.MINT)
  circle(25, 9.5, 3.8, COLOR.MINT)
  circle(31.5, 12, 3.3, COLOR.MINT)
  circle(36, 17.5, 2.8, COLOR.MINT)
})

// A heart: two overlapping circles for the lobes plus a downward triangle
// for the point, smoothed by the circles covering the triangle's top edge.
const heart = icon('ic-heart', SIZE_CARD, ({ poly, circle }) => {
  poly(
    [
      [7, 19],
      [37, 19],
      [22, 38],
    ],
    COLOR.CORAL
  )
  circle(16, 17, 9, COLOR.CORAL)
  circle(28, 17, 9, COLOR.CORAL)
})

// A rounded teardrop: a wide round base (an ellipse) plus a tapering tip
// that leans to one side (a polygon licking up and over), the same colour
// so the two shapes read as one continuous flame.
const flame = icon('ic-flame', SIZE_CARD, ({ ellipse, poly }) => {
  ellipse(22, 29, 8.5, 10, COLOR.AMBER)
  poly(
    [
      [26, 6],
      [30, 14],
      [29.8, 25],
      [14.2, 25],
      [17, 15],
    ],
    COLOR.AMBER
  )
})

// A running figure: head, torso, and angled limbs built from capsules in a
// forward-leaning stride.
const runner = icon('ic-runner', SIZE_PILL, ({ circle, capsule }) => {
  circle(27, 10, 4.6, COLOR.MINT)
  capsule(25, 15, 18, 25, 6.5, COLOR.MINT)
  // Arms.
  capsule(23, 17, 14, 14, 4, COLOR.MINT)
  capsule(23, 19, 30, 25, 4, COLOR.MINT)
  // Front leg, bent and lifted.
  capsule(19, 24, 12, 21, 5.2, COLOR.MINT)
  capsule(12, 21, 7, 29, 4.2, COLOR.MINT)
  // Back leg, extended behind.
  capsule(20, 23, 29, 30, 5.2, COLOR.MINT)
  capsule(29, 30, 35, 26, 4.2, COLOR.MINT)
})

const icons = [weather, steps, heart, flame, runner]

const outDir = path.join(__dirname, '..', 'app', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })
for (const { name, size, buffer } of icons) {
  const outPath = path.join(outDir, `${name}.png`)
  fs.writeFileSync(outPath, encodePNG(size, size, buffer))
  console.log(`wrote ${outPath}`)
}
