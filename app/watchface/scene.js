// Builds the whole face as a flat list of drawing descriptors, in paint
// order. Pure - no Zepp API - so the composition is unit testable and the
// preview tool can render exactly what the watch renders instead of a
// hand-built lookalike that quietly drifts out of sync.
//
// IMPORTANT - why this takes an `env` instead of requiring its siblings:
// `zeus build` glob-scans every .js under app/ and treats each one as its
// own bundle entry. A CommonJS entry cannot resolve relative requires, so
// any module here that requires a sibling fails the build with
// UNRESOLVED_IMPORT. The other pure modules get away with plain requires
// only because they require nothing. This one needs six of them, so they
// are injected: index.js assembles `env` from its own ESM imports, and the
// test suite assembles the same thing with plain requires.
//
// index.js is the only thing that turns these descriptors into widgets.

// Glyph advance widths, mirroring tools/make-digits.js. The two must agree
// or the time kerns wrong; the test suite asserts they do.
const GLYPH_WIDTH = {
  '0': 89, '1': 23, '2': 77, '3': 77, '4': 77,
  '5': 77, '6': 77, '7': 77, '8': 77, '9': 77,
  ':': 9,
}

const IMG = 'images/'

// Fixed number of time-glyph widgets: two hour digits, the colon, two
// minute digits. A one-digit hour leaves the last slot empty.
const TIME_SLOTS = 5

function frameName(key, index) {
  return `${IMG}arc-${key}-${String(index).padStart(2, '0')}.png`
}




// `env` supplies the modules this one cannot require (see the note above).
// Returns a buildScene(data) closure; `data` carries raw sensor readings,
// where null means "no reading yet".
function createScene(env) {
  const { COLOR, TYPE, GOAL, TAGLINE, TRACKING } = env
  const { RECT, GAUGE, ARC_FRAMES, arcBox, TIME_CENTRE, TIME_GAP } = env
  const { ratio, frameIndex, litDashes, resolveTarget } = env
  const { centreRun } = env
  const { formatSteps, formatMetric, formatBattery, formatDate } = env

  // One arc sprite, placed at the origin the generator cropped it to.
  function arcElement(key, gauge, index) {
    const box = arcBox(gauge)
    return {
      kind: 'image',
      key: `arc.${key}`,
      src: frameName(key, index),
      x: box.x, y: box.y, w: box.w, h: box.h,
    }
  }

  function text(rect, value, size, color, align = 'center', tracking = 0, key) {
    return {
      kind: 'text',
      key,
      text: value,
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      size, color, align, tracking,
    }
  }

  // A stacked block of small caps, one line per entry.
  function taglineBlock(rect, lines, align) {
    const lineHeight = Math.floor(rect.h / lines.length)
    return lines.map((line, i) =>
      text(
        { x: rect.x, y: rect.y + i * lineHeight, w: rect.w, h: lineHeight },
        line, TYPE.TAGLINE, COLOR.SECONDARY, align, TRACKING
      )
    )
  }

  return function buildScene(data) {
  const els = []

  // Layer 1: the static chrome - ring, ticks, gauge tracks.
  els.push({ kind: 'image', src: `${IMG}bg.png`, ...RECT.BACKGROUND })

  // Layer 2: the filled portion of each gauge.
  els.push(arcElement('battery', GAUGE.BATTERY,
    frameIndex(ratio(data.battery, 100), ARC_FRAMES)))
  els.push(arcElement('steps', GAUGE.STEPS,
    frameIndex(ratio(data.steps, resolveTarget(data.stepGoal, GOAL.STEPS)), ARC_FRAMES)))
  els.push(arcElement('kcal', GAUGE.KCAL,
    frameIndex(ratio(data.kcal, GOAL.KCAL), ARC_FRAMES)))
  els.push(arcElement('stress', GAUGE.STRESS,
    litDashes(ratio(data.stress, GOAL.STRESS), GAUGE.STRESS.dashes)))

  // Layer 4: the battery readout. The glyph is two rects rather than an
  // image because FILL_RECT is one of the few widgets verified on this
  // runtime, and the shape is axis-aligned so it does not need more.
  const bi = RECT.BATTERY_ICON
  els.push({ kind: 'strokeRect', x: bi.x, y: bi.y, w: bi.w - 4, h: bi.h, color: COLOR.ACCENT })
  els.push({ kind: 'rect', x: bi.x + bi.w - 3, y: bi.y + 5, w: 3, h: bi.h - 10, color: COLOR.ACCENT })
  els.push({
    kind: 'rect',
    key: 'battery.fill',
    x: bi.x + 3, y: bi.y + 3,
    w: Math.max(1, Math.round(((bi.w - 10) * ratio(data.battery, 100)))),
    h: bi.h - 6,
    color: COLOR.ACCENT,
  })
  els.push(text(RECT.BATTERY_PCT, formatBattery(data.battery), TYPE.BATTERY_PCT, COLOR.WHITE,
    'center', 0, 'battery.pct'))
  els.push(text(RECT.BATTERY_LABEL, 'BATTERY', TYPE.LABEL, COLOR.SECONDARY, 'center', TRACKING))

  // Layer 5: the time, as generated glyph images. The hour is white and
  // the minute the accent, which is the face's only two-tone moment.
  const hh = String(data.hour)
  const mm = String(data.minute).padStart(2, '0')
  const chars = [...hh, ':', ...mm]
  let pastColon = false
  let slot = 0
  for (const g of centreRun(chars, GLYPH_WIDTH, TIME_GAP, TIME_CENTRE.x)) {
    // 'w' is the white hour set, 'b' the accent minute set. The colon
    // belongs to the minute, matching the reference.
    const variant = g.char === ':' || pastColon ? 'b' : 'w'
    if (g.char === ':') pastColon = true
    const name = g.char === ':' ? 'colon' : g.char
    els.push({
      kind: 'image',
      key: `time.${slot++}`,
      aod: true, // the time survives into always-on display
      src: `${IMG}d${variant}-${name}.png`,
      x: g.x, y: TIME_CENTRE.y, w: GLYPH_WIDTH[g.char], h: TYPE.TIME,
    })
  }
  // Pad to a fixed slot count so index.js can create the widgets once and
  // simply hide the spare when the hour drops to a single digit.
  while (slot < TIME_SLOTS) {
    els.push({ kind: 'image', key: `time.${slot++}`, aod: true, src: null, x: 0, y: 0, w: 1, h: 1 })
  }

  // Layer 6: the date.
  els.push(text(RECT.DATE, formatDate(data.weekday, data.day), TYPE.DATE, COLOR.WHITE,
    'center', TRACKING, 'date'))
  els[els.length - 1].aod = true

  // Layer 7: the three metrics.
  els.push({ kind: 'image', src: `${IMG}ic-steps.png`, ...RECT.STEPS_ICON })
  els.push(text(RECT.STEPS_VALUE, formatSteps(data.steps), TYPE.METRIC_VALUE, COLOR.WHITE,
    'center', 0, 'steps.value'))
  els.push(text(RECT.STEPS_LABEL, 'STEPS', TYPE.LABEL, COLOR.SECONDARY, 'center', TRACKING))

  els.push({ kind: 'image', src: `${IMG}ic-stress.png`, ...RECT.STRESS_ICON })
  els.push(text(RECT.STRESS_VALUE, formatMetric(data.stress), TYPE.METRIC_VALUE, COLOR.WHITE,
    'center', 0, 'stress.value'))
  els.push(text(RECT.STRESS_LABEL, 'STRESS', TYPE.LABEL, COLOR.SECONDARY, 'center', TRACKING))

  els.push({ kind: 'image', src: `${IMG}ic-kcal.png`, ...RECT.KCAL_ICON })
  els.push(text(RECT.KCAL_VALUE, formatMetric(data.kcal), TYPE.METRIC_VALUE, COLOR.WHITE,
    'center', 0, 'kcal.value'))
  els.push(text(RECT.KCAL_LABEL, 'kcal', TYPE.METRIC_UNIT, COLOR.SECONDARY, 'center', TRACKING))

  // Layer 8: the static taglines.
  els.push(...taglineBlock(RECT.TAGLINE_L, TAGLINE.LEFT, 'left'))
  els.push(...taglineBlock(RECT.TAGLINE_R, TAGLINE.RIGHT, 'right'))
  els.push(...taglineBlock(RECT.TAGLINE_B, TAGLINE.BOTTOM, 'center'))

  return els
  }
}

module.exports = { createScene, GLYPH_WIDTH, TIME_SLOTS }
