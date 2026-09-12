// Generates the three metric glyphs: a footprint, a heart for the bpm
// dial, and a flame. All in the single accent colour - the palette rule
// allows no second hue, so these are not colour-coded per metric.
//
// Icons are AUTHORED in a 0..44 coordinate space but RENDERED at the exact
// pixel size of the widget that shows them. Zepp IMG widgets do not scale
// their source: they draw at native size and crop to the widget box, so a
// 44x44 asset in a 24x24 slot loses most of the glyph.

const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')
const {
  renderSupersampled, fillCircle, fillEllipse, fillCapsule, fillPath, fillRoundRect,
} = require('./draw.js')
const { COLOR } = require('../app/watchface/tokens.js')
const { RECT } = require('../app/watchface/layout.js')

const AUTHOR = 44
const SCALE = 4

function icon(name, box, draw) {
  const canvas = renderSupersampled(box.w, box.h, SCALE, (big, s) => {
    // unit space (0..AUTHOR) -> supersampled pixels, preserving aspect
    const u = (s * Math.min(box.w, box.h)) / AUTHOR
    const ox = (box.w * s - AUTHOR * u) / 2
    const oy = (box.h * s - AUTHOR * u) / 2
    const P = (x, y) => [ox + x * u, oy + y * u]
    draw({
      circle: (x, y, r) => {
        const [px, py] = P(x, y)
        fillCircle(big, px, py, r * u, COLOR.ACCENT)
      },
      ellipse: (x, y, rx, ry, angle) => {
        const [px, py] = P(x, y)
        fillEllipse(big, px, py, rx * u, ry * u, COLOR.ACCENT, undefined, angle)
      },
      capsule: (x1, y1, x2, y2, t) => {
        const [ax, ay] = P(x1, y1)
        const [bx, by] = P(x2, y2)
        fillCapsule(big, ax, ay, bx, by, t * u, COLOR.ACCENT)
      },
      rr: (x, y, w, h, r) => {
        const [px, py] = P(x, y)
        fillRoundRect(big, px, py, w * u, h * u, r * u, COLOR.ACCENT)
      },
      path: (pts) =>
        fillPath(
          big,
          pts.map((p) => {
            const [px, py] = P(p.x, p.y)
            const c = p.cx === undefined ? {} : { cx: ox + p.cx * u, cy: oy + p.cy * u }
            return { x: px, y: py, ...c }
          }),
          COLOR.ACCENT
        ),
    })
  })
  return { name, w: box.w, h: box.h, buffer: canvas.toBuffer() }
}

// A footprint: one continuous sole pinched at the arch, with four toes.
// The pinch is what says "foot" - two separate blobs read as two blobs.
const steps = icon('ic-steps', RECT.STEPS_ICON, ({ circle, path }) => {
  path(
    [
      { x: 12, y: 19, cx: 7, cy: 27 },
      { x: 22, y: 15, cx: 16, cy: 12 },
      { x: 29, y: 22, cx: 30, cy: 16 },
      { x: 26, y: 31, cx: 24.5, cy: 26 },
      { x: 24, y: 41, cx: 31, cy: 38 },
      { x: 16, y: 33, cx: 16, cy: 41 },
    ]
  )
  circle(9.5, 11.5, 3.2)
  circle(17, 7, 3.0)
  circle(23.5, 6.5, 2.7)
  circle(29, 9, 2.4)
})

// A heart for the bpm dial - the smallest glyph on the face, so it is
// built from primitives that survive being rasterised at 17px rather than
// from a curve whose shoulders would vanish.
const hr = icon('ic-hr', RECT.HR_ICON, ({ circle, path }) => {
  // Two lobes and a wedge. The lobes' outer edges (x=5 and x=39) are
  // exactly where the wedge's top corners sit, so the silhouette closes
  // into one shape with no notch at the shoulders.
  circle(11.5, 16, 11)
  circle(32.5, 16, 11)
  path([
    { x: 0.5, y: 17.5 },
    { x: 43.5, y: 17.5 },
    { x: 22, y: 42 },
  ])
})

// A flame: one continuous silhouette with a wide base and a licking tongue
// on the left. The tongue is what separates "fire" from "leaf".
const kcal = icon('ic-kcal', RECT.KCAL_ICON, ({ path }) => {
  path([
    { x: 27, y: 3, cx: 21, cy: 11 },
    { x: 36, y: 26, cx: 35, cy: 12 },
    { x: 22, y: 41, cx: 35, cy: 38 },
    { x: 8, y: 27, cx: 9, cy: 38 },
    { x: 13, y: 14, cx: 6, cy: 19 },
    { x: 20, y: 19, cx: 16, cy: 20 },
  ])
})

const outDir = path.join(__dirname, '..', 'app', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })
for (const { name, w, h, buffer } of [steps, hr, kcal]) {
  fs.writeFileSync(path.join(outDir, `${name}.png`), encodePNG(w, h, buffer))
  console.log(`wrote ${name}.png (${w}x${h})`)
}
