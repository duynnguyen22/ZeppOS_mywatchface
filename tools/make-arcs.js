// Generates the filled portion of every gauge as pre-rendered frames.
//
// Why sprites rather than an arc widget: this runtime has no verified
// primitive for drawing an arbitrary arc, and FILL_RECT is axis-aligned
// only. Betting the face on an unverified widget risks the silent black
// screen this project has hit before. Frames cost package size and
// quantise the fill to 5% steps, which is invisible on a battery or a
// step goal.
//
// Each frame is cropped to layout.arcBox() - the SAME function the face
// uses to place it - so the sprite lands exactly on its track.

const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')
const { Canvas, fillArc, fillCircle, boxBlur, compositeOver, downsample } = require('./draw.js')
const { COLOR } = require('../app/watchface/tokens.js')
const { GAUGE, ARC_FRAMES, arcBox } = require('../app/watchface/layout.js')

const SS = 3 // supersampling factor
const GLOW_RADIUS = 3
const GLOW_STRENGTH = 0.22

// Render one arc frame at `ratio` fill, cropped to the gauge's arcBox.
function renderArc(g, ratio) {
  const box = arcBox(g)
  const big = new Canvas(box.w * SS, box.h * SS)
  const cx = (g.cx - box.x) * SS
  const cy = (g.cy - box.y) * SS

  if (ratio > 0) {
    const shape = new Canvas(big.width, big.height)
    const swept = g.span * ratio
    const from = g.dir === 1 ? g.start : g.start - swept
    fillArc(
      shape, cx, cy, g.rInner * SS, g.rOuter * SS,
      ((from % 360) + 360) % 360, ((from + swept) % 360 + 360) % 360,
      COLOR.ACCENT, undefined, true
    )
    compositeOver(big, boxBlur(shape, GLOW_RADIUS * SS), GLOW_STRENGTH)
    compositeOver(big, shape, 1)
  }
  return { box, buffer: downsample(big, SS).toBuffer() }
}

// The stress dial is discrete: `lit` dashes drawn bold, the rest absent
// (the unlit ticks live in the static background).
function renderDashes(g, lit) {
  const box = arcBox(g)
  const big = new Canvas(box.w * SS, box.h * SS)
  const cx = (g.cx - box.x) * SS
  const cy = (g.cy - box.y) * SS
  const step = g.span / g.dashes
  const width = step * 0.55 // leaves a visible gap between dashes

  if (lit > 0) {
    const shape = new Canvas(big.width, big.height)
    for (let i = 0; i < lit; i++) {
      const from = g.start + i * step
      fillArc(
        shape, cx, cy, g.rInner * SS, g.rOuter * SS,
        ((from % 360) + 360) % 360, ((from + width) % 360 + 360) % 360,
        COLOR.ACCENT, undefined, true
      )
    }
    compositeOver(big, boxBlur(shape, GLOW_RADIUS * SS), GLOW_STRENGTH)
    compositeOver(big, shape, 1)
  }
  return { box, buffer: downsample(big, SS).toBuffer() }
}

const outDir = path.join(__dirname, '..', 'app', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })

let files = 0
let bytes = 0
function emit(name, frame) {
  const png = encodePNG(frame.box.w, frame.box.h, frame.buffer)
  fs.writeFileSync(path.join(outDir, `${name}.png`), png)
  files++
  bytes += png.length
}

for (const key of ['BATTERY', 'STEPS', 'KCAL']) {
  const g = GAUGE[key]
  for (let i = 0; i < ARC_FRAMES; i++) {
    emit(`arc-${key.toLowerCase()}-${String(i).padStart(2, '0')}`, renderArc(g, i / (ARC_FRAMES - 1)))
  }
}
for (let lit = 0; lit <= GAUGE.STRESS.dashes; lit++) {
  emit(`arc-stress-${String(lit).padStart(2, '0')}`, renderDashes(GAUGE.STRESS, lit))
}

console.log(`wrote ${files} arc frames, ${(bytes / 1024).toFixed(1)} KB total`)
for (const [k, g] of Object.entries(GAUGE)) {
  const b = arcBox(g)
  console.log(`  ${k.padEnd(8)} ${b.w}x${b.h} at (${b.x},${b.y})`)
}
