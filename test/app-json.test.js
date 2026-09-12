const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'app', 'app.json'), 'utf8')
)

const ROUND_SOURCES = [
  8913152, 8913153, 8913155, 8913159,
  10092800, 10092801, 10092803, 10092807,
]
const SQUARE_SOURCES = [10223872, 10223873, 10223875]

test('declared as a watchface', () => {
  assert.strictEqual(config.app.appType, 'watchface')
})

test('exactly one target', () => {
  assert.strictEqual(Object.keys(config.targets).length, 1)
})

test('designWidth is 466', () => {
  assert.strictEqual(Object.values(config.targets)[0].designWidth, 466)
})

test('all deviceSource values are Active 2 Round', () => {
  const target = Object.values(config.targets)[0]
  const declared = target.platforms.map((p) => p.deviceSource)
  assert.ok(declared.length > 0)
  for (const source of declared) {
    assert.ok(ROUND_SOURCES.includes(source), `bad deviceSource ${source}`)
  }
})

test('every Round deviceSource is covered', () => {
  const declared = Object.values(config.targets)[0]
    .platforms.map((p) => p.deviceSource)
  for (const source of ROUND_SOURCES) {
    assert.ok(declared.includes(source), `missing deviceSource ${source}`)
  }
})

test('Active 2 Square is not targeted', () => {
  const serialised = JSON.stringify(config)
  for (const source of SQUARE_SOURCES) {
    assert.ok(!serialised.includes(String(source)), `square source ${source}`)
  }
})

test('watchface entry path is declared', () => {
  const wf = Object.values(config.targets)[0].module.watchface
  assert.strictEqual(wf.path, 'watchface/index')
  assert.strictEqual(wf.main, 1)
})

test('permissions match the sensors the face actually reads', () => {
  // An undeclared sensor throws PERMISSION DENIED on construction and the
  // metric silently stays empty; a declared-but-unused one asks the wearer
  // for access the face never needs. Both are defects.
  const declared = new Set(config.permissions)
  assert.ok(declared.has('data:user.hd.step'), 'steps ring needs the step permission')
  assert.ok(declared.has('data:user.hd.calorie'), 'kcal ring needs the calorie permission')
  for (const gone of ['data:user.hd.weather', 'data:user.hd.distance', 'data:user.hd.heart_rate']) {
    assert.ok(!declared.has(gone), `${gone} is no longer read by this face`)
  }
})
