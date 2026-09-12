const test = require('node:test')
const assert = require('node:assert')
const {
  SCREEN, CENTER, RADIUS, polar, fitsOnFace, RECT, GAUGE, ARC_FRAMES, SAFE_MARGIN,
  arcBox, TIME_CENTRE,
} = require('../app/watchface/layout.js')

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

test('every laid-out element respects the safe area, not just the bezel', () => {
  // The guideline asks for a 20-25px margin inside the circular boundary,
  // which is stricter than merely "not clipped". Checking the loose
  // condition would let content creep into the curve where it looks wrong
  // long before it is actually cut off.
  assert.ok(SAFE_MARGIN >= 20 && SAFE_MARGIN <= 25, 'safe margin must be 20-25px')
  for (const [name, rect] of Object.entries(RECT)) {
    if (name === 'BACKGROUND') continue
    assert.strictEqual(
      fitsOnFace(rect, SAFE_MARGIN),
      true,
      `${name} breaks the ${SAFE_MARGIN}px safe area`
    )
  }
})

test('the background covers the whole screen', () => {
  assert.deepStrictEqual(RECT.BACKGROUND, { x: 0, y: 0, w: 466, h: 466 })
})

test('every gauge has a sane track: positive band, positive sweep', () => {
  for (const [name, g] of Object.entries(GAUGE)) {
    assert.ok(g.rOuter > g.rInner, `${name} band must have thickness`)
    assert.ok(g.span > 0 && g.span <= 360, `${name} span out of range`)
    assert.ok(g.start >= 0 && g.start < 360, `${name} start out of range`)
    assert.ok(g.dir === 1 || g.dir === -1, `${name} dir must be +1 or -1`)
  }
})

test('no point an arc actually sweeps falls outside the bezel', () => {
  // Deliberately NOT the bounding square of the gauge's circle: an arc
  // only occupies its own sweep, and the battery arc's circle extends well
  // past the bezel in directions the arc never reaches. Sample the swept
  // outer edge instead.
  for (const [name, g] of Object.entries(GAUGE)) {
    for (let t = 0; t <= 1; t += 0.02) {
      const deg = g.start + g.dir * g.span * t
      const rad = ((deg - 90) * Math.PI) / 180
      const x = g.cx + g.rOuter * Math.cos(rad)
      const y = g.cy + g.rOuter * Math.sin(rad)
      const fromCentre = Math.hypot(x - CENTER.x, y - CENTER.y)
      assert.ok(
        fromCentre <= RADIUS - 2,
        `${name} reaches ${fromCentre.toFixed(1)}px from centre at ${deg.toFixed(0)}deg`
      )
    }
  }
})

test('the battery arc is deliberately not concentric with the face', () => {
  // Measured off the reference: its centre sits well above the screen
  // centre, which is what makes it read flatter than a bezel arc. If this
  // ever equals CENTER.y again, someone has "corrected" it by mistake.
  assert.notStrictEqual(GAUGE.BATTERY.cy, CENTER.y)
  assert.ok(GAUGE.BATTERY.cy < CENTER.y)
})

test('the two ring gauges mirror each other about the face centre', () => {
  assert.strictEqual(CENTER.x - GAUGE.STEPS.cx, GAUGE.KCAL.cx - CENTER.x)
  assert.strictEqual(GAUGE.STEPS.cy, GAUGE.KCAL.cy)
  assert.strictEqual(GAUGE.STEPS.dir, -GAUGE.KCAL.dir)
})

test('the dashed dial declares how many dashes it has', () => {
  assert.ok(Number.isInteger(GAUGE.STRESS.dashes) && GAUGE.STRESS.dashes > 0)
})

test('there are enough arc frames for a visually smooth fill', () => {
  assert.ok(Number.isInteger(ARC_FRAMES) && ARC_FRAMES >= 11)
})

test('the time run is centred near the middle of the face', () => {
  assert.ok(Math.abs(TIME_CENTRE.x - CENTER.x) < 20)
})

test('the three gauge value readouts do not overlap each other', () => {
  const boxes = [RECT.STEPS_VALUE, RECT.STRESS_VALUE, RECT.KCAL_VALUE]
    .slice()
    .sort((a, b) => a.x - b.x)
  for (let i = 1; i < boxes.length; i++) {
    assert.ok(
      boxes[i].x >= boxes[i - 1].x + boxes[i - 1].w,
      `gauge readouts overlap at index ${i}`
    )
  }
})

// --- arcBox -----------------------------------------------------------
// Arc fills ship as sprite frames. The generator crops each frame to the
// arc's own bounds and the face places it at the same origin, so BOTH
// sides must derive that box from one function - if they disagree by a
// pixel the fill sits off its track.

test('arcBox is tight: much smaller than the gauge circle for a short sweep', () => {
  const box = arcBox(GAUGE.BATTERY)
  const full = GAUGE.BATTERY.rOuter * 2
  assert.ok(box.h < full / 2, `a 76deg sweep should not need a ${full}px tall box`)
})

test('arcBox contains every point the arc sweeps, at both radii', () => {
  for (const [name, g] of Object.entries(GAUGE)) {
    const box = arcBox(g)
    for (let t = 0; t <= 1; t += 0.01) {
      const deg = g.start + g.dir * g.span * t
      const rad = ((deg - 90) * Math.PI) / 180
      for (const r of [g.rInner, g.rOuter]) {
        const x = g.cx + r * Math.cos(rad)
        const y = g.cy + r * Math.sin(rad)
        assert.ok(
          x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h,
          `${name}: point at ${deg.toFixed(0)}deg r${r} falls outside arcBox`
        )
      }
    }
  }
})

test('arcBox leaves room for the round caps, not just the centreline', () => {
  const g = GAUGE.STEPS
  const box = arcBox(g)
  const capR = (g.rOuter - g.rInner) / 2
  const rad = ((g.start - 90) * Math.PI) / 180
  const mid = (g.rInner + g.rOuter) / 2
  // The far edge of the cap at the sweep's start.
  const capEdgeY = g.cy + mid * Math.sin(rad) - capR
  assert.ok(capEdgeY >= box.y, 'the start cap pokes out of the top of arcBox')
})

test('arcBox returns whole pixels, since it becomes an image origin', () => {
  for (const [name, g] of Object.entries(GAUGE)) {
    const box = arcBox(g)
    for (const k of ['x', 'y', 'w', 'h']) {
      assert.ok(Number.isInteger(box[k]), `${name} arcBox.${k} must be an integer`)
    }
  }
})

test('no metric value box overlaps the label beneath it', () => {
  const pairs = [
    ['steps', RECT.STEPS_VALUE, RECT.STEPS_LABEL],
    ['stress', RECT.STRESS_VALUE, RECT.STRESS_LABEL],
    ['kcal', RECT.KCAL_VALUE, RECT.KCAL_LABEL],
  ]
  for (const [name, value, label] of pairs) {
    assert.ok(
      label.y >= value.y + value.h,
      `${name}: value bottom ${value.y + value.h} overlaps label top ${label.y}`
    )
  }
})

test('no metric icon overlaps the value beneath it', () => {
  const pairs = [
    ['steps', RECT.STEPS_ICON, RECT.STEPS_VALUE],
    ['stress', RECT.STRESS_ICON, RECT.STRESS_VALUE],
    ['kcal', RECT.KCAL_ICON, RECT.KCAL_VALUE],
  ]
  for (const [name, icon, value] of pairs) {
    assert.ok(value.y >= icon.y + icon.h, `${name}: icon overlaps its value`)
  }
})
