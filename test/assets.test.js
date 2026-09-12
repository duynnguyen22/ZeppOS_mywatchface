const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'app', 'app.json'), 'utf8')
)

// app.json's `app.icon` is resolved relative to `assets/<target>/` (flat),
// the same convention the build's [RESIZE] step and `tools/make-icon.js`
// use. Reading it here (rather than hardcoding 'icon.png') means this test
// keeps following app.json if that field ever changes.
const targetName = Object.keys(config.targets)[0]
const iconRelPath = config.app.icon
const iconAbsPath = path.join(
  __dirname, '..', 'app', 'assets', targetName, iconRelPath
)

test('the icon file exists at the exact path app.json resolves it to', () => {
  assert.ok(
    fs.existsSync(iconAbsPath),
    `expected icon at ${iconAbsPath} (from app.json app.icon="${iconRelPath}"); ` +
      `run "npm run icon" to generate it`
  )
})

test('the icon file is a valid PNG', () => {
  const bytes = fs.readFileSync(iconAbsPath)
  assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE))
})

// index.js references the background as 'images/bg.png', resolved from
// assets/<target>/. Nothing else guards this file: delete or truncate it
// and the build still succeeds while the face renders black.
const bgAbsPath = path.join(
  __dirname, '..', 'app', 'assets', targetName, 'images', 'bg.png'
)

test('the background file exists and is non-empty', () => {
  assert.ok(
    fs.existsSync(bgAbsPath),
    `expected background at ${bgAbsPath}; run "npm run background" to generate it`
  )
  const { size } = fs.statSync(bgAbsPath)
  assert.ok(size > 0, `${bgAbsPath} exists but is empty`)
})

test('the background file is a valid PNG', () => {
  const bytes = fs.readFileSync(bgAbsPath)
  assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE))
})

// index.js references these as 'images/ic-*.png', resolved from
// assets/<target>/, one per metric. Guarded the same way as bg.png above: nothing
// else catches a missing or truncated icon file, and a missing asset makes
// hmUI.getImageInfo() return 0x0, so the widget silently draws nothing.
const iconNames = ['ic-steps', 'ic-hr', 'ic-kcal']

for (const name of iconNames) {
  const iconPath = path.join(
    __dirname, '..', 'app', 'assets', targetName, 'images', `${name}.png`
  )

  test(`${name}.png exists and is non-empty`, () => {
    assert.ok(
      fs.existsSync(iconPath),
      `expected icon at ${iconPath}; run "npm run icons" to generate it`
    )
    const { size } = fs.statSync(iconPath)
    assert.ok(size > 0, `${iconPath} exists but is empty`)
  })

  test(`${name}.png is a valid PNG`, () => {
    const bytes = fs.readFileSync(iconPath)
    assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE))
  })
}

// zeus build glob-scans every .js under app/ and treats each as its own
// bundle entry. A CommonJS entry cannot resolve a relative require, so a
// module here that requires a sibling fails the build with
// UNRESOLVED_IMPORT - and the failure looks like a toolchain bug, not a
// code smell. scene.js takes its dependencies as an argument for exactly
// this reason; this test stops anyone reintroducing the trap.
test('no watchface module requires a sibling module', () => {
  const dir = path.join(__dirname, '..', 'app', 'watchface')
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8')
    const offenders = source.match(/require\(\s*['"]\.\.?\//g)
    assert.strictEqual(
      offenders,
      null,
      `${file} requires a sibling module, which breaks zeus build`
    )
  }
})
