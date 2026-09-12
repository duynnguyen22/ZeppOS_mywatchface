// Generates the static chrome: everything on the face that never changes.
//
// Why this is one image rather than widgets: the ring, the ticks and the
// decorative arcs are all off-axis, and this runtime has no verified
// primitive for drawing an angled line or an arbitrary arc. Nothing
// dynamic lives here - every value that changes is a live widget drawn on
// top - so baking the static geometry costs no interactivity.
//
// Restraint is the brief: these marks are atmosphere and structure, not
// information. They must not compete with the time.

const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')
const {
  Canvas, fillArc, fillRoundRect, downsample,
} = require('./draw.js')
const { COLOR } = require('../app/watchface/tokens.js')
const { SCREEN, CENTER, GAUGE } = require('../app/watchface/layout.js')

const SS = 3
const W = SCREEN.width
const Hh = SCREEN.height

const big = new Canvas(W * SS, Hh * SS)
const CX = CENTER.x * SS
const CY = CENTER.y * SS

// Thin concentric circle, in whole-face coordinates.
function ring(radius, thickness, color, alpha, from = 0, to = 359.99) {
  fillArc(
    big, CX, CY,
    (radius - thickness / 2) * SS, (radius + thickness / 2) * SS,
    from, to, color, alpha
  )
}

// A radial tick: a slice of a ring band at one angle.
function tick(deg, rFrom, rTo, widthDeg, color, alpha) {
  fillArc(big, CX, CY, rFrom * SS, rTo * SS, deg - widthDeg / 2, deg + widthDeg / 2, color, alpha)
}

// An arc belonging to a gauge, in that gauge's own coordinate system.
function gaugeArc(g, from, span, color, alpha, caps) {
  fillArc(
    big, g.cx * SS, g.cy * SS, g.rInner * SS, g.rOuter * SS,
    ((from % 360) + 360) % 360, ((from + span) % 360 + 360) % 360,
    color, alpha, caps
  )
}

// --- Layer 2: the outer technical ring --------------------------------
ring(218, 1, COLOR.CHROME, 210)

// --- Layer 3: sparse secondary geometry -------------------------------
// Four arc segments rather than a second full circle - the guideline is
// explicit that a dense concentric scale is the failure mode here.
for (const from of [24, 114, 204, 294]) ring(196, 1, COLOR.CHROME, 150, from, from + 48)

// Two dim accent arcs, upper left and upper right, echoing the reference.
ring(207, 1.5, COLOR.ACCENT, 70, 296, 340)
ring(207, 1.5, COLOR.ACCENT, 70, 20, 64)

// Cardinal markers only. Twelve of these would be a clock scale.
for (const deg of [0, 180]) tick(deg, 205, 219, 0.5, COLOR.SECONDARY, 200)
for (const deg of [90, 270]) tick(deg, 209, 219, 0.5, COLOR.SECONDARY, 130)

// Small asymmetric brackets at the flanks - technical punctuation.
for (const deg of [270, 90]) {
  tick(deg - 11, 200, 214, 0.4, COLOR.SECONDARY, 110)
  tick(deg + 11, 200, 214, 0.4, COLOR.SECONDARY, 110)
  ring(200, 1, COLOR.SECONDARY, 110, deg - 11, deg + 11)
}

// --- Layer 4: the unfilled gauge tracks -------------------------------
gaugeArc(GAUGE.BATTERY, GAUGE.BATTERY.start, GAUGE.BATTERY.span, COLOR.CHROME, 255, true)
for (const key of ['STEPS', 'KCAL']) {
  const g = GAUGE[key]
  gaugeArc(g, 0, 359.99, COLOR.CHROME, 190) // a full circle behind each ring
}

// The stress dial's unlit ticks: fine hairlines, deliberately much lighter
// than the bold dashes that light up over them.
{
  const g = GAUGE.STRESS
  const step = g.span / g.dashes
  for (let i = 0; i < g.dashes; i++) {
    gaugeArc(g, g.start + i * step, step * 0.3, COLOR.CHROME, 235)
  }
}

// --- Layer 8: micro indicators ----------------------------------------
// Hairline rules flanking the middle dial.
for (const x of [189, 276]) {
  fillRoundRect(big, x * SS, 317 * SS, 1 * SS, 35 * SS, 0, COLOR.CHROME, 220)
}
// The small double dash above the bottom tagline.
fillRoundRect(big, 225 * SS, 382 * SS, 16 * SS, 1 * SS, 0, COLOR.SECONDARY, 120)
fillRoundRect(big, 227 * SS, 388 * SS, 12 * SS, 1 * SS, 0, COLOR.SECONDARY, 90)

// Shallow arcs sweeping under the metric row, closing the composition.
ring(150, 1, COLOR.CHROME, 170, 148, 176)
ring(150, 1, COLOR.CHROME, 170, 184, 212)

// --- Flatten onto black -----------------------------------------------
// The face is composited over an opaque black ground: unlit AMOLED pixels.
const small = downsample(big, SS)
const out = Buffer.alloc(W * Hh * 4)
for (let i = 0; i < W * Hh; i++) {
  const a = small.data[i * 4 + 3] / 255
  out[i * 4] = Math.round(small.data[i * 4] * a)
  out[i * 4 + 1] = Math.round(small.data[i * 4 + 1] * a)
  out[i * 4 + 2] = Math.round(small.data[i * 4 + 2] * a)
  out[i * 4 + 3] = 255
}

const outDir = path.join(__dirname, '..', 'app', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'bg.png')
const png = encodePNG(W, Hh, out)
fs.writeFileSync(outPath, png)
console.log(`wrote ${outPath} (${(png.length / 1024).toFixed(1)} KB)`)
