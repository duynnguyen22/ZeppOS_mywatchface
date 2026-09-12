const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const { createScene, GLYPH_WIDTH, TIME_SLOTS } = require('../app/watchface/scene.js')
const tokens = require('../app/watchface/tokens.js')
const layout = require('../app/watchface/layout.js')
const gauge = require('../app/watchface/gauge.js')
const digits = require('../app/watchface/digits.js')
const format = require('../app/watchface/format.js')

// scene.js takes its dependencies as an argument so that zeus can bundle
// it (see the note at the top of that file). The face assembles the same
// bundle from its ESM imports.
const env = Object.assign({}, tokens, layout, gauge, digits, format)
const buildScene = createScene(env)

const FULL = {
  hour: 10, minute: 28, weekday: 6, day: 12,
  battery: 78, steps: 8421, stress: 32, kcal: 520, stepGoal: null,
}
const EMPTY = {
  hour: 0, minute: 0, weekday: 1, day: 1,
  battery: null, steps: null, stress: null, kcal: null, stepGoal: null,
}

const ASSETS = path.join(__dirname, '..', 'app', 'assets', 'active-2-round')

test('the scene draws the background first, so nothing is painted over', () => {
  const els = buildScene(FULL)
  assert.strictEqual(els[0].src, 'images/bg.png')
})

test('every image the scene references actually exists on disk', () => {
  // A missing asset does not error on device: getImageInfo returns 0x0 and
  // the widget silently draws nothing. With ~90 generated arc frames, one
  // wrong index would be invisible until someone noticed a blank gauge.
  const seen = new Set()
  for (const data of [FULL, EMPTY, { ...FULL, battery: 100, steps: 99999, stress: 100, kcal: 9999 }]) {
    for (const el of buildScene(data)) {
      if (el.kind === 'image' && el.src) seen.add(el.src)
    }
  }
  assert.ok(seen.size > 10, 'expected the scene to reference many images')
  for (const src of seen) {
    assert.ok(fs.existsSync(path.join(ASSETS, src)), `missing asset ${src}`)
  }
})

test('every arc frame index the gauges can produce has a file', () => {
  // Walk the full 0-100% range rather than trusting a couple of samples.
  for (let pct = 0; pct <= 100; pct++) {
    for (const el of buildScene({ ...FULL, battery: pct, steps: pct * 200, kcal: pct * 8, stress: pct })) {
      if (el.kind === 'image' && el.src) {
        assert.ok(fs.existsSync(path.join(ASSETS, el.src)), `missing ${el.src} at ${pct}%`)
      }
    }
  }
})

test('glyph widths agree with the generated PNGs', () => {
  // scene.js kerns the time from this table; make-digits.js draws the
  // glyphs from its own. If the two drift, the clock kerns wrong.
  for (const [char, width] of Object.entries(GLYPH_WIDTH)) {
    const name = char === ':' ? 'colon' : char
    const file = path.join(ASSETS, 'images', `dw-${name}.png`)
    assert.ok(fs.existsSync(file), `missing glyph ${name}`)
    const png = fs.readFileSync(file)
    assert.strictEqual(png.readUInt32BE(16), width, `glyph "${char}" PNG width != table`)
  }
})

test('the time run stays centred whether the hour has one digit or two', () => {
  const centre = (data) => {
    const glyphs = buildScene(data).filter((e) => e.key && e.key.startsWith('time.') && e.src)
    const left = Math.min(...glyphs.map((g) => g.x))
    const right = Math.max(...glyphs.map((g) => g.x + g.w))
    return (left + right) / 2
  }
  assert.strictEqual(centre({ ...FULL, hour: 10 }), centre({ ...FULL, hour: 9 }))
})

test('a one-digit hour leaves a spare time slot with no source', () => {
  const slots = buildScene({ ...FULL, hour: 9 }).filter((e) => e.key && e.key.startsWith('time.'))
  assert.strictEqual(slots.length, TIME_SLOTS)
  assert.strictEqual(slots.filter((s) => !s.src).length, 1)
})

test('the hour is white and the minute is the accent', () => {
  const glyphs = buildScene(FULL).filter((e) => e.key && e.key.startsWith('time.') && e.src)
  assert.ok(glyphs[0].src.includes('dw-'), 'hour glyph should use the white set')
  assert.ok(glyphs[glyphs.length - 1].src.includes('db-'), 'minute glyph should use the accent set')
})

test('missing sensor readings render as dashes, never as zero or a guess', () => {
  const texts = buildScene(EMPTY).filter((e) => e.kind === 'text').map((e) => e.text)
  assert.ok(texts.includes('--'), 'a missing metric should show a dash')
  assert.ok(texts.includes('--%'), 'a missing battery should show --%')
  assert.ok(!texts.includes('0'), 'a missing reading must not be rendered as zero')
})

test('a missing reading leaves its gauge empty rather than full', () => {
  const arcs = buildScene(EMPTY).filter((e) => e.key && e.key.startsWith('arc.'))
  for (const arc of arcs) {
    assert.ok(arc.src.endsWith('-00.png'), `${arc.key} should be the empty frame, got ${arc.src}`)
  }
})

test('the stress dial never falls back to heart rate', () => {
  // The brief rules heart rate out entirely. If stress is unavailable the
  // dial shows a dash - substituting a different metric under a STRESS
  // label would misreport what the wearer is looking at.
  const labels = buildScene(EMPTY).filter((e) => e.kind === 'text').map((e) => String(e.text).toUpperCase())
  assert.ok(labels.includes('STRESS'))
  for (const bad of ['BPM', 'HR', 'HEART']) {
    assert.ok(!labels.includes(bad), `the face must never label anything ${bad}`)
  }
})

test('every element the scene emits stays inside the safe area', () => {
  for (const el of buildScene(FULL)) {
    if (el.src === 'images/bg.png') continue
    if (!el.src && el.w <= 1) continue // collapsed spare time slot
    // Arc sprites are excluded here on purpose: their bounding box has
    // transparent corners that sit outside the safe area while the ink
    // never does. Their real swept extent is checked properly in
    // layout.test.js ("no point an arc actually sweeps falls outside the
    // bezel"), which walks the arc rather than its box.
    if (el.key && el.key.startsWith('arc.')) continue
    assert.strictEqual(
      layout.fitsOnFace({ x: el.x, y: el.y, w: el.w, h: el.h }, layout.SAFE_MARGIN),
      true,
      `${el.key || el.src || el.text} breaks the safe area`
    )
  }
})

test('arc sprite boxes stay on screen even though their corners are empty', () => {
  // The weaker guarantee that still matters for an arc: the image must fit
  // the physical 466x466 panel, or the widget is cropped.
  for (const el of buildScene(FULL)) {
    if (!el.key || !el.key.startsWith('arc.')) continue
    assert.ok(el.x >= 0 && el.y >= 0, `${el.key} starts off-screen`)
    assert.ok(el.x + el.w <= layout.SCREEN.width, `${el.key} runs off the right edge`)
    assert.ok(el.y + el.h <= layout.SCREEN.height, `${el.key} runs off the bottom`)
  }
})

test('extreme values do not shift the layout', () => {
  // The guideline requires the composition to hold as numbers grow.
  const boxOf = (data, key) => {
    const el = buildScene(data).find((e) => e.key === key)
    return `${el.x},${el.y},${el.w},${el.h}`
  }
  for (const key of ['steps.value', 'kcal.value', 'stress.value', 'battery.pct']) {
    assert.strictEqual(
      boxOf({ ...FULL, steps: 8, kcal: 4, stress: 1, battery: 5 }, key),
      boxOf({ ...FULL, steps: 199999, kcal: 9999, stress: 100, battery: 100 }, key),
      `${key} moved when its value grew`
    )
  }
})
