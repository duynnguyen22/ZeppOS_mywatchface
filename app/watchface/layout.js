// Geometry for the Amazfit Active 2 (Round), 466x466.
// Pure - no Zepp API - so it is unit testable under bare Node.
//
// Every number here was measured off reference.png by fitting circles to
// the artwork rather than estimated by eye. The battery arc in particular
// is NOT concentric with the face: its centre sits 76px above the screen
// centre, which is why it looks flatter than a plain bezel arc.

const SCREEN = { width: 466, height: 466 }
const CENTER = { x: SCREEN.width / 2, y: SCREEN.height / 2 }
const RADIUS = SCREEN.width / 2

// Angle in degrees clockwise from 12 o'clock.
function polar(angleDeg, distance) {
  const radians = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER.x + distance * Math.cos(radians),
    y: CENTER.y + distance * Math.sin(radians),
  }
}

// True when all four corners sit inside the circular face, inset by
// `margin`. This is what catches content the round bezel would clip.
function fitsOnFace(rect, margin = 0) {
  const limit = RADIUS - margin
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
  ]
  return corners.every(([x, y]) => Math.hypot(x - CENTER.x, y - CENTER.y) <= limit)
}

// The four things that fill. `start` is degrees clockwise from 12 and
// `span` is how far the track runs; `dir` is +1 for a fill that grows
// clockwise and -1 for one that grows anticlockwise. The two ring gauges
// mirror each other so both fills sweep INWARD toward the face centre,
// which is what the reference does.
const GAUGE = {
  BATTERY: { cx: 233, cy: 157, rInner: 120, rOuter: 127, start: 322, span: 76, dir: 1 },
  STEPS: { cx: 125, cy: 334, rInner: 46, rOuter: 52, start: 0, span: 180, dir: 1 },
  KCAL: { cx: 341, cy: 334, rInner: 46, rOuter: 52, start: 0, span: 180, dir: -1 },
  STRESS: { cx: 233, cy: 334, rInner: 33, rOuter: 38, start: 292, span: 120, dir: 1, dashes: 24 },
}

// Sprite granularity for the three smooth arcs: 21 frames = 5% steps.
const ARC_FRAMES = 21

// The guideline asks for a 20-25px margin inside the bezel. Everything in
// RECT is checked against this in the test suite, not just against the
// physical screen edge.
const SAFE_MARGIN = 22

const RECT = {
  BACKGROUND: { x: 0, y: 0, w: 466, h: 466 },

  BATTERY_ICON: { x: 219, y: 56, w: 31, h: 18 },
  BATTERY_PCT: { x: 173, y: 80, w: 120, h: 28 },
  BATTERY_LABEL: { x: 163, y: 107, w: 140, h: 16 },

  // The run area for the generated time glyphs. Individual glyph x
  // positions come from digits.centreRun(), not from this rect.
  TIME: { x: 38, y: 158, w: 390, h: 84 },
  DATE: { x: 143, y: 255, w: 180, h: 24 },

  TAGLINE_L: { x: 28, y: 207, w: 66, h: 42 },
  TAGLINE_R: { x: 372, y: 207, w: 66, h: 42 },
  TAGLINE_B: { x: 143, y: 396, w: 180, h: 26 },

  // Value and label boxes are sized to the measured text bounds, not
  // padded out - an over-tall value box collides with the label beneath it.
  STEPS_ICON: { x: 113, y: 300, w: 24, h: 28 },
  STEPS_VALUE: { x: 65, y: 329, w: 120, h: 20 },
  STEPS_LABEL: { x: 75, y: 351, w: 100, h: 14 },

  STRESS_ICON: { x: 225, y: 311, w: 16, h: 19 },
  STRESS_VALUE: { x: 193, y: 332, w: 80, h: 18 },
  STRESS_LABEL: { x: 183, y: 350, w: 100, h: 14 },

  KCAL_ICON: { x: 329, y: 301, w: 22, h: 27 },
  KCAL_VALUE: { x: 281, y: 329, w: 120, h: 20 },
  KCAL_LABEL: { x: 291, y: 350, w: 100, h: 16 },
}

// Tight pixel bounds of a gauge's swept band, including its round caps.
// The sprite generator crops each arc frame to exactly this box and the
// face places the image at exactly this origin, so both sides must call
// this rather than each computing bounds their own way.
function arcBox(g) {
  const capR = (g.rOuter - g.rInner) / 2
  const mid = (g.rInner + g.rOuter) / 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const note = (x, y) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  // Walk the sweep finely enough that no extremum between samples is
  // missed, tracking both edges of the band.
  const steps = Math.max(72, Math.ceil(g.span))
  for (let i = 0; i <= steps; i++) {
    const deg = g.start + g.dir * g.span * (i / steps)
    const rad = ((deg - 90) * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    note(g.cx + g.rInner * cos, g.cy + g.rInner * sin)
    note(g.cx + g.rOuter * cos, g.cy + g.rOuter * sin)
  }
  // The caps bulge past both ends of the band.
  for (const deg of [g.start, g.start + g.dir * g.span]) {
    const rad = ((deg - 90) * Math.PI) / 180
    const cx = g.cx + mid * Math.cos(rad)
    const cy = g.cy + mid * Math.sin(rad)
    note(cx - capR, cy - capR)
    note(cx + capR, cy + capR)
  }
  const x = Math.floor(minX)
  const y = Math.floor(minY)
  return { x, y, w: Math.ceil(maxX) - x, h: Math.ceil(maxY) - y }
}

// Where the time's glyph run is centred. Slightly right of the face
// centre, matching the reference.
const TIME_CENTRE = { x: 238, y: 158 }
const TIME_GAP = 10

module.exports = {
  SCREEN, CENTER, RADIUS, polar, fitsOnFace,
  RECT, GAUGE, ARC_FRAMES, SAFE_MARGIN, arcBox, TIME_CENTRE, TIME_GAP,
}
