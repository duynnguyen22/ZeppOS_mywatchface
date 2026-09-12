const test = require('node:test')
const assert = require('node:assert')
const { COLOR, TYPE, GOAL, NO_VALUE, TAGLINE, TRACKING } = require('../app/watchface/tokens.js')

test('every colour is a 24-bit integer', () => {
  for (const [name, value] of Object.entries(COLOR)) {
    assert.strictEqual(typeof value, 'number', `${name} must be a number`)
    assert.ok(Number.isInteger(value), `${name} must be an integer`)
    assert.ok(value >= 0 && value <= 0xffffff, `${name} out of range`)
  }
})

test('required colour tokens exist', () => {
  for (const name of ['BG', 'WHITE', 'SECONDARY', 'ACCENT', 'CHROME']) {
    assert.ok(name in COLOR, `missing colour ${name}`)
  }
})

test('the background is pure black so the OLED can switch pixels off', () => {
  assert.strictEqual(COLOR.BG, 0x000000)
})

test('the palette stays tiny', () => {
  // The guideline treats palette creep as a defect. If someone adds a
  // sixth colour they should have to justify it by editing this number.
  assert.strictEqual(Object.keys(COLOR).length, 5)
})

test('there is exactly ONE chromatic accent; everything else is neutral', () => {
  // A neutral has all three channels within a few points of each other.
  // This is the test that catches "just one more colour" - a green or
  // blue slipped into the palette fails here, which is the point.
  const chroma = (c) => {
    const r = (c >> 16) & 255
    const g = (c >> 8) & 255
    const b = c & 255
    return Math.max(r, g, b) - Math.min(r, g, b)
  }
  const coloured = Object.entries(COLOR).filter(([, v]) => chroma(v) > 40)
  assert.deepStrictEqual(
    coloured.map(([k]) => k),
    ['ACCENT'],
    `expected only ACCENT to be chromatic, got ${coloured.map(([k]) => k).join(', ')}`
  )
})

test('the accent is the warm gold the guideline specifies', () => {
  const b = COLOR.ACCENT & 255
  const r = (COLOR.ACCENT >> 16) & 255
  assert.ok(r > b, 'the accent must read warm gold, not cool')
})

test('hour and minute colours differ so the time reads two-tone', () => {
  assert.notStrictEqual(COLOR.WHITE, COLOR.ACCENT)
})

test('the filled accent is brighter than the track behind it', () => {
  const lum = (c) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)
  assert.ok(lum(COLOR.ACCENT) > lum(COLOR.CHROME))
})

test('labels are dimmer than values so the hierarchy holds', () => {
  const lum = (c) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)
  assert.ok(lum(COLOR.SECONDARY) < lum(COLOR.WHITE))
})

test('every type size is a positive integer', () => {
  for (const [name, value] of Object.entries(TYPE)) {
    assert.ok(Number.isInteger(value) && value > 0, `${name} must be positive`)
  }
})

test('the time is the largest type size', () => {
  assert.strictEqual(TYPE.TIME, Math.max(...Object.values(TYPE)))
})

test('every goal is a positive number the rings can divide by', () => {
  // HR is a band rather than a denominator - it is checked below instead.
  for (const [name, value] of Object.entries(GOAL)) {
    if (name === 'HR') continue
    assert.ok(typeof value === 'number' && value > 0, `${name} must be positive`)
  }
})

test('the heart rate band is a usable range, not a denominator', () => {
  // bandRatio divides by MAX - MIN, so an inverted or empty band would
  // silently park the dial at empty forever.
  assert.ok(Number.isFinite(GOAL.HR.MIN) && GOAL.HR.MIN > 0)
  assert.ok(Number.isFinite(GOAL.HR.MAX) && GOAL.HR.MAX > GOAL.HR.MIN)
  // A resting adult pulse has to sit inside the band, or the dial reads
  // empty all day and tells the wearer nothing.
  assert.ok(GOAL.HR.MIN < 60 && GOAL.HR.MAX > 100)
})

test('every tagline block is a non-empty list of non-empty strings', () => {
  for (const [name, lines] of Object.entries(TAGLINE)) {
    assert.ok(Array.isArray(lines) && lines.length > 0, `${name} must have lines`)
    for (const line of lines) {
      assert.ok(typeof line === 'string' && line.length > 0, `${name} has an empty line`)
    }
  }
})

test('there is a placeholder for a sensor with no reading', () => {
  assert.ok(typeof NO_VALUE === 'string' && NO_VALUE.length > 0)
})

test('small-caps tracking is within the range the guideline asks for', () => {
  assert.ok(TRACKING >= 2 && TRACKING <= 4, 'letter spacing must be 2-4px')
})
