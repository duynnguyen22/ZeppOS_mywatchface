// Generates the glyph icons used by the weather readout, the three stat
// cards, and the activity pill - replacing the flat FILL_RECT circle
// placeholders with real artwork. Deterministic, dependency-free (built on
// tools/draw.js and tools/png.js only).

const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')
const {
  renderSupersampled,
  fillCircle,
  fillEllipse,
  fillCapsule,
  fillPoly,
  fillPath,
} = require('./draw.js')
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
    const ellipse = (cx, cy, rx, ry, color, angle) =>
      fillEllipse(big, cx * u, cy * u, rx * u, ry * u, color, undefined, angle)
    const capsule = (x1, y1, x2, y2, thickness, color) =>
      fillCapsule(big, x1 * u, y1 * u, x2 * u, y2 * u, thickness * u, color)
    const poly = (points, color) => fillPoly(big, points.map(([x, y]) => [x * u, y * u]), color)
    const path = (points, color) =>
      fillPath(
        big,
        points.map((p) => ({
          x: p.x * u,
          y: p.y * u,
          cx: p.cx === undefined ? undefined : p.cx * u,
          cy: p.cy === undefined ? undefined : p.cy * u,
        })),
        color
      )
    draw({ circle, ellipse, capsule, poly, path })
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

// A footprint. The sole is ONE continuous outline, not a pad plus a heel:
// wide at the ball, pinched at the arch, rounded at the heel. Two separate
// blobs read as two blobs at 26px - the pinch is what says "foot". The
// outer (left) edge stays convex and the inner edge concave, which is the
// asymmetry the eye actually uses to recognise the shape.
const steps = icon('ic-steps', SIZE_CARD, ({ circle, path }) => {
  path(
    [
      { x: 12, y: 19, cx: 7, cy: 27 }, // closing segment: convex outer edge
      { x: 22, y: 15, cx: 16, cy: 12 }, // over the ball of the foot
      { x: 29, y: 22, cx: 30, cy: 16 },
      { x: 26, y: 31, cx: 24.5, cy: 26 }, // arch, pinched inward
      { x: 24, y: 41, cx: 31, cy: 38 }, // heel
      { x: 16, y: 33, cx: 16, cy: 41 },
    ],
    COLOR.MINT
  )
  // Four toes arcing over the ball - fewer and larger than a literal five,
  // which at this size would merge into a single bar.
  circle(9.5, 11.5, 3.2, COLOR.MINT)
  circle(17, 7, 3.0, COLOR.MINT)
  circle(23.5, 6.5, 2.7, COLOR.MINT)
  circle(29, 9, 2.4, COLOR.MINT)
})

// A heart with a real notch at the top and a real point at the bottom.
// The lobes are curve segments rather than two pasted circles, so the
// silhouette narrows towards the point instead of staying round-bottomed.
const heart = icon('ic-heart', SIZE_CARD, ({ path }) => {
  path(
    [
      { x: 22, y: 13, cx: 18, cy: 5 }, // closing segment dips into the notch
      { x: 34, y: 6, cx: 26, cy: 4 },
      { x: 39, y: 20, cx: 42, cy: 11 },
      { x: 22, y: 39, cx: 34, cy: 31 },
      { x: 5, y: 20, cx: 10, cy: 31 },
      { x: 10, y: 6, cx: 2, cy: 11 },
    ],
    COLOR.CORAL
  )
})

// A flame. The previous version was an ellipse and a polygon fighting each
// other, which read as a leaf. This is one continuous silhouette: a wide
// round base and a narrow tip leaning right off a kicked-in left shoulder.
// The wide base against the narrow lean is what separates "fire" from "leaf".
const flame = icon('ic-flame', SIZE_CARD, ({ path }) => {
  path(
    [
      { x: 27, y: 3, cx: 21, cy: 11 }, // sharp tip, leaning right
      { x: 36, y: 26, cx: 35, cy: 12 }, // right edge, convex and full
      { x: 22, y: 41, cx: 35, cy: 38 }, // wide round base
      { x: 8, y: 27, cx: 9, cy: 38 },
      { x: 13, y: 14, cx: 6, cy: 19 }, // left lobe: the licking tongue
      { x: 20, y: 19, cx: 16, cy: 20 }, // valley between tongue and tip
    ],
    COLOR.AMBER
  )
})

// A running figure. The head is deliberately detached from the shoulders -
// standard for a running pictogram, and the only way the head survives as a
// head once a 44-unit drawing is rasterised at 35px. Limbs are thinner than
// before and the stride is wider, so arms stop merging into the torso.
const runner = icon('ic-runner', SIZE_PILL, ({ circle, capsule }) => {
  const LIMB = 3.6
  const SHIN = 3.2
  circle(29.5, 7, 4.2, COLOR.MINT)
  capsule(26, 17, 19.5, 27, 6, COLOR.MINT)
  // Front arm, raised and bent forward.
  capsule(25, 18, 16, 16, LIMB, COLOR.MINT)
  capsule(16, 16, 12, 9, SHIN, COLOR.MINT)
  // Back arm, swinging behind.
  capsule(26, 20, 33, 25, LIMB, COLOR.MINT)
  capsule(33, 25, 39, 22, SHIN, COLOR.MINT)
  // Front leg, knee lifted.
  capsule(20, 26, 11, 24, 4.2, COLOR.MINT)
  capsule(11, 24, 6, 32, SHIN, COLOR.MINT)
  // Back leg, extended behind and pushing off.
  capsule(21, 27, 29, 33, 4.2, COLOR.MINT)
  capsule(29, 33, 37, 30, SHIN, COLOR.MINT)
})

const icons = [weather, steps, heart, flame, runner]

const outDir = path.join(__dirname, '..', 'app', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })
for (const { name, size, buffer } of icons) {
  const outPath = path.join(outDir, `${name}.png`)
  fs.writeFileSync(outPath, encodePNG(size, size, buffer))
  console.log(`wrote ${outPath}`)
}
