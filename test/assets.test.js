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
