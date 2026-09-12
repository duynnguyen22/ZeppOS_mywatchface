# Amazfit Active 2 (Round) Watch Face — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the watch face shown in `reference.png` for the Amazfit Active 2 (Round), with a unit-tested pure-logic core and a procedurally generated background.

**Architecture:** All geometry, tokens, and formatting live in dependency-free modules unit tested under bare Node. `watchface/index.js` is the only file that touches the Zepp platform; it creates widgets from those values and wires sensors through `WIDGET_DELEGATE`.

**Tech Stack:** Zepp OS (global `hmUI`/`hmSensor`/`hmSetting`/`timer`), `@zeppos/zeus-cli` (installed), Node 22 with built-in `node:test` and `node:zlib`. Zero runtime or dev dependencies.

**Spec:** `docs/superpowers/specs/2026-09-12-watchface-design.md`

## Global Constraints

- Target: Amazfit Active 2 (Round), 466 × 466, `designWidth` **466**.
- `deviceSource` values: `8913152`, `8913153`, `8913155`, `8913159`, `10092800`, `10092801`, `10092803`, `10092807`. Do NOT add Active 2 Square (`10223872`, `10223873`, `10223875`).
- Watch faces use **global** `hmUI`, `hmSensor`, `hmSetting`, `timer`, `px()` — never `@zos/*` imports.
- Widgets are created in `build()`, not `onInit()`.
- Heart rate is `heartSensor.last`. Steps/calories/battery are `.current`.
- Every timer started in `resume_call` MUST be stopped in `pause_call`.
- Pure modules (`tokens.js`, `layout.js`, `format.js`) MUST NOT reference `hmUI`, `hmSensor`, `hmSetting`, `timer`, or `px`. They must run under bare Node.
- CommonJS (`module.exports` / `require`) throughout. Do NOT add `"type": "module"`.
- No npm dependencies may be added. The background generator uses `node:zlib` only.
- Do NOT build: the page dots, the "amazfit" wordmark, or any tap handler on the activity pill.

---

### Task 1: Project scaffold and device targeting

**Files:**
- Create: `package.json`, `app.json`, `app.js`, `.gitignore`
- Create: `test/app-json.test.js`

**Interfaces:**
- Produces: a valid Zepp project skeleton; `npm test` running `node --test test/`

- [ ] **Step 1: Write the failing test**

Create `test/app-json.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `app.json` does not exist yet, or `package.json` has no test script.

- [ ] **Step 3: Create package.json**

```json
{
  "name": "my-watchface",
  "version": "1.0.0",
  "private": true,
  "description": "Amazfit Active 2 (Round) watch face",
  "scripts": {
    "test": "node --test test/",
    "background": "node tools/make-background.js"
  }
}
```

- [ ] **Step 4: Create app.json**

```json
{
  "configVersion": "v2",
  "app": {
    "appId": 30001,
    "appName": "Horizon",
    "appType": "watchface",
    "version": { "code": 1, "name": "1.0.0" },
    "icon": "icon.png",
    "vender": "duynnguyen22",
    "description": "Landscape watch face for Amazfit Active 2 Round"
  },
  "permissions": [],
  "runtime": {
    "apiVersion": { "compatible": "2.0.0", "target": "2.0.0", "minVersion": "2.0.0" }
  },
  "targets": {
    "active-2-round": {
      "module": {
        "watchface": { "path": "watchface/index", "main": 1, "editable": 0, "lockscreen": 0 }
      },
      "platforms": [
        { "name": "active-2-round", "deviceSource": 8913152 },
        { "name": "active-2-round", "deviceSource": 8913153 },
        { "name": "active-2-round", "deviceSource": 8913155 },
        { "name": "active-2-round", "deviceSource": 8913159 },
        { "name": "active-2-round", "deviceSource": 10092800 },
        { "name": "active-2-round", "deviceSource": 10092801 },
        { "name": "active-2-round", "deviceSource": 10092803 },
        { "name": "active-2-round", "deviceSource": 10092807 }
      ],
      "designWidth": 466
    }
  },
  "i18n": { "en-US": { "appName": "Horizon" } },
  "defaultLanguage": "en-US"
}
```

- [ ] **Step 5: Create app.js**

```js
App({
  globalData: {},
  onCreate() {},
  onDestroy() {},
})
```

- [ ] **Step 6: Leave .gitignore alone**

`.gitignore` already exists and already covers everything this task needs,
plus `.superpowers/`. Do NOT recreate or overwrite it — doing so un-ignores
the SDD workspace and commits scratch artifacts.

Run: `cat .gitignore`
Expected: contains `node_modules/`, `dist/`, `.DS_Store`, `*.log`, and `.superpowers/`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: all seven tests PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json app.json app.js test/app-json.test.js
git commit -m "feat: scaffold watchface project targeting Active 2 Round"
```

---

### Task 2: Design tokens

**Files:**
- Create: `watchface/tokens.js`, `test/tokens.test.js`

**Interfaces:**
- Produces: `watchface/tokens.js` exporting `COLOR` (object of number values) and `TYPE` (object of number font sizes)

- [ ] **Step 1: Write the failing test**

Create `test/tokens.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const { COLOR, TYPE } = require('../watchface/tokens.js')

test('every colour is a 24-bit integer', () => {
  for (const [name, value] of Object.entries(COLOR)) {
    assert.strictEqual(typeof value, 'number', `${name} must be a number`)
    assert.ok(Number.isInteger(value), `${name} must be an integer`)
    assert.ok(value >= 0 && value <= 0xffffff, `${name} out of range`)
  }
})

test('required colour tokens exist', () => {
  for (const name of ['BG_DEEP', 'MINT', 'CORAL', 'AMBER', 'WHITE', 'MUTED', 'CARD_BG']) {
    assert.ok(name in COLOR, `missing colour ${name}`)
  }
})

test('hour and minute colours differ so the time is two-tone', () => {
  assert.notStrictEqual(COLOR.WHITE, COLOR.MINT)
})

test('accent colours are mutually distinct', () => {
  const accents = [COLOR.MINT, COLOR.CORAL, COLOR.AMBER]
  assert.strictEqual(new Set(accents).size, 3)
})

test('every type size is a positive integer', () => {
  for (const [name, value] of Object.entries(TYPE)) {
    assert.ok(Number.isInteger(value) && value > 0, `${name} must be positive`)
  }
})

test('the time is the largest type size', () => {
  assert.strictEqual(TYPE.TIME, Math.max(...Object.values(TYPE)))
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL with a module-not-found error for `../watchface/tokens.js`.

- [ ] **Step 3: Write the implementation**

Create `watchface/tokens.js`:

```js
// Design tokens. Pure data - no Zepp API, so this is unit testable.

const COLOR = {
  BG_DEEP: 0x050b0d,
  MINT: 0x4fe8b0,
  CORAL: 0xff5b6a,
  AMBER: 0xffa53d,
  WHITE: 0xffffff,
  MUTED: 0x8a9ba0,
  CARD_BG: 0x111d1f,
}

const TYPE = {
  TIME: 76,
  MERIDIEM: 22,
  DATE: 22,
  TEMP: 24,
  HILO: 16,
  BATTERY: 20,
  TAGLINE: 17,
  STAT_VALUE: 24,
  STAT_LABEL: 14,
  PILL_TITLE: 22,
  PILL_DETAIL: 17,
}

module.exports = { COLOR, TYPE }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add watchface/tokens.js test/tokens.test.js
git commit -m "feat: add design tokens with tests"
```

---

### Task 3: Layout geometry

**Files:**
- Create: `watchface/layout.js`, `test/layout.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `watchface/layout.js` exporting `SCREEN` `{width,height}`, `CENTER` `{x,y}`, `RADIUS` number, `polar(angleDeg, distance)` → `{x,y}`, `fitsOnFace(rect, margin)` → boolean, `RECT` (object mapping element names to `{x,y,w,h}`), and `statCard(index)` → `{x,y,w,h}`

- [ ] **Step 1: Write the failing test**

Create `test/layout.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const { SCREEN, CENTER, RADIUS, polar, fitsOnFace, RECT, statCard } = require('../watchface/layout.js')

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

test('every laid-out element stays inside the bezel', () => {
  for (const [name, rect] of Object.entries(RECT)) {
    if (name === 'BACKGROUND') continue
    assert.strictEqual(fitsOnFace(rect, 4), true, `${name} is clipped by the bezel`)
  }
})

test('the background covers the whole screen', () => {
  assert.deepStrictEqual(RECT.BACKGROUND, { x: 0, y: 0, w: 466, h: 466 })
})

test('three stat cards are evenly spaced and do not overlap', () => {
  const cards = [statCard(0), statCard(1), statCard(2)]
  for (const card of cards) {
    assert.strictEqual(card.w, 118)
    assert.strictEqual(card.h, 88)
    assert.strictEqual(card.y, 234)
  }
  const gap1 = cards[1].x - (cards[0].x + cards[0].w)
  const gap2 = cards[2].x - (cards[1].x + cards[1].w)
  assert.strictEqual(gap1, gap2)
  assert.ok(gap1 > 0, 'cards must not overlap')
})

test('the stat card row is horizontally centred', () => {
  const first = statCard(0)
  const last = statCard(2)
  const leftGap = first.x
  const rightGap = 466 - (last.x + last.w)
  assert.strictEqual(leftGap, rightGap)
})

test('statCard rejects an out-of-range index', () => {
  assert.throws(() => statCard(3))
  assert.throws(() => statCard(-1))
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL with a module-not-found error for `../watchface/layout.js`.

- [ ] **Step 3: Write the implementation**

Create `watchface/layout.js`:

```js
// Geometry for the Amazfit Active 2 (Round), 466x466.
// Pure - no Zepp API - so it is unit testable under bare Node.

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
  return corners.every(
    ([x, y]) => Math.hypot(x - CENTER.x, y - CENTER.y) <= limit
  )
}

const CARD = { count: 3, w: 118, h: 88, y: 234, gap: 10 }
const CARD_ROW_W = CARD.count * CARD.w + (CARD.count - 1) * CARD.gap
const CARD_X0 = (SCREEN.width - CARD_ROW_W) / 2

function statCard(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CARD.count) {
    throw new RangeError(`stat card index out of range: ${index}`)
  }
  return {
    x: CARD_X0 + index * (CARD.w + CARD.gap),
    y: CARD.y,
    w: CARD.w,
    h: CARD.h,
  }
}

const RECT = {
  BACKGROUND: { x: 0, y: 0, w: 466, h: 466 },
  // x/w verified by computation: {x:83,w:300} fails fitsOnFace(rect, 4)
  // at 230.5 against a 229 limit. Do not widen without re-checking.
  DATE: { x: 88, y: 58, w: 290, h: 28 },
  WEATHER_ICON: { x: 70, y: 76, w: 30, h: 30 },
  TEMP: { x: 106, y: 76, w: 80, h: 30 },
  HILO: { x: 70, y: 104, w: 140, h: 22 },
  BATTERY_ICON: { x: 352, y: 78, w: 34, h: 20 },
  BATTERY_TEXT: { x: 330, y: 100, w: 66, h: 24 },
  TIME: { x: 40, y: 118, w: 340, h: 84 },
  MERIDIEM: { x: 388, y: 156, w: 44, h: 26 },
  TAGLINE: { x: 53, y: 204, w: 360, h: 24 },
  PILL: { x: 86, y: 343, w: 294, h: 59 },
}

// Offsets within a stat card.
const CARD_INSET = {
  ICON: { dx: 10, dy: 10, w: 22, h: 22 },
  VALUE: { dx: 36, dy: 8, w: 72, h: 26 },
  LABEL: { dx: 10, dy: 36, w: 98, h: 18 },
  CHART: { dx: 10, dy: 60, w: 98, h: 20 },
}

const CHART = { bars: 9, barW: 8, gap: 3 }

module.exports = {
  SCREEN, CENTER, RADIUS, polar, fitsOnFace,
  RECT, statCard, CARD, CARD_INSET, CHART,
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests PASS. In particular `every laid-out element stays inside the bezel` must pass — if any element fails, adjust that element's rect in `RECT` until it fits rather than weakening the test.

- [ ] **Step 5: Commit**

```bash
git add watchface/layout.js test/layout.test.js
git commit -m "feat: add round-face layout geometry with bezel safety tests"
```

---

### Task 4: Display formatting

**Files:**
- Create: `watchface/format.js`, `test/format.test.js`

**Interfaces:**
- Produces: `watchface/format.js` exporting `pad2(n)`, `formatHour(hour, is12h)`, `formatMinute(minute)`, `meridiem(hour)`, `formatDate(week, month, day)`, `formatSteps(steps)`, `formatBattery(percent)`, `formatTemp(celsius)`, `formatHiLo(high, low)`, `formatHeart(bpm)`, `formatCalories(kcal)`, `formatDistance(km)`, `formatDuration(minutes)` — all returning strings

- [ ] **Step 1: Write the failing test**

Create `test/format.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const f = require('../watchface/format.js')

test('pad2 pads and preserves', () => {
  assert.strictEqual(f.pad2(0), '00')
  assert.strictEqual(f.pad2(7), '07')
  assert.strictEqual(f.pad2(42), '42')
})

test('formatHour in 24-hour mode pads', () => {
  assert.strictEqual(f.formatHour(0, false), '00')
  assert.strictEqual(f.formatHour(9, false), '09')
  assert.strictEqual(f.formatHour(23, false), '23')
})

test('formatHour in 12-hour mode has no leading zero', () => {
  assert.strictEqual(f.formatHour(13, true), '1')
  assert.strictEqual(f.formatHour(9, true), '9')
})

test('formatHour maps midnight and noon to 12', () => {
  assert.strictEqual(f.formatHour(0, true), '12')
  assert.strictEqual(f.formatHour(12, true), '12')
})

test('formatMinute always pads', () => {
  assert.strictEqual(f.formatMinute(8), '08')
  assert.strictEqual(f.formatMinute(59), '59')
})

test('meridiem splits at noon', () => {
  assert.strictEqual(f.meridiem(0), 'AM')
  assert.strictEqual(f.meridiem(11), 'AM')
  assert.strictEqual(f.meridiem(12), 'PM')
  assert.strictEqual(f.meridiem(23), 'PM')
})

test('formatDate renders uppercase weekday and month', () => {
  assert.strictEqual(f.formatDate(2, 9, 12), 'TUE, SEP 12')
  assert.strictEqual(f.formatDate(7, 1, 1), 'SUN, JAN 1')
})

test('formatDate handles every weekday and month', () => {
  for (let week = 1; week <= 7; week++) {
    for (let month = 1; month <= 12; month++) {
      const out = f.formatDate(week, month, 15)
      assert.match(out, /^[A-Z]{3}, [A-Z]{3} 15$/, `bad output ${out}`)
    }
  }
})

test('formatSteps groups thousands', () => {
  assert.strictEqual(f.formatSteps(8560), '8,560')
  assert.strictEqual(f.formatSteps(999), '999')
  assert.strictEqual(f.formatSteps(0), '0')
  assert.strictEqual(f.formatSteps(1234567), '1,234,567')
})

test('formatBattery clamps and suffixes', () => {
  assert.strictEqual(f.formatBattery(80), '80%')
  assert.strictEqual(f.formatBattery(-5), '0%')
  assert.strictEqual(f.formatBattery(140), '100%')
})

test('formatTemp appends a degree sign', () => {
  assert.strictEqual(f.formatTemp(28), '28°')
  assert.strictEqual(f.formatTemp(-3), '-3°')
})

test('formatHiLo renders both bounds', () => {
  assert.strictEqual(f.formatHiLo(32, 24), 'H:32° L:24°')
})

test('formatHeart renders a dash when unavailable', () => {
  assert.strictEqual(f.formatHeart(72), '72')
  assert.strictEqual(f.formatHeart(0), '--')
  assert.strictEqual(f.formatHeart(null), '--')
  assert.strictEqual(f.formatHeart(undefined), '--')
})

test('formatCalories rounds to whole numbers', () => {
  assert.strictEqual(f.formatCalories(320.4), '320')
  assert.strictEqual(f.formatCalories(0), '0')
})

test('formatDistance keeps one decimal', () => {
  assert.strictEqual(f.formatDistance(2.5), '2.5 km')
  assert.strictEqual(f.formatDistance(10), '10.0 km')
})

test('formatDuration renders minutes and hours', () => {
  assert.strictEqual(f.formatDuration(24), '24 min')
  assert.strictEqual(f.formatDuration(90), '1h 30min')
  assert.strictEqual(f.formatDuration(60), '1h 00min')
})

test('unavailable numeric values degrade rather than print NaN', () => {
  assert.strictEqual(f.formatSteps(null), '0')
  assert.strictEqual(f.formatCalories(null), '0')
  assert.strictEqual(f.formatTemp(null), '--°')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL with a module-not-found error for `../watchface/format.js`.

- [ ] **Step 3: Write the implementation**

Create `watchface/format.js`:

```js
// Display string formatting. Pure - no Zepp API - so it is unit testable.

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatHour(hour, is12h) {
  if (is12h) return String(hour % 12 === 0 ? 12 : hour % 12)
  return pad2(hour)
}

function formatMinute(minute) {
  return pad2(minute)
}

function meridiem(hour) {
  return hour < 12 ? 'AM' : 'PM'
}

// `week` is 1-7 starting Monday, matching hmSensor TIME.
function formatDate(week, month, day) {
  return `${WEEKDAYS[week - 1]}, ${MONTHS[month - 1]} ${day}`
}

function formatSteps(steps) {
  const value = Number(steps) || 0
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatBattery(percent) {
  return `${Math.max(0, Math.min(100, Number(percent) || 0))}%`
}

function formatTemp(celsius) {
  if (celsius === null || celsius === undefined) return '--°'
  return `${celsius}°`
}

function formatHiLo(high, low) {
  return `H:${high}° L:${low}°`
}

function formatHeart(bpm) {
  return bpm ? String(bpm) : '--'
}

function formatCalories(kcal) {
  return String(Math.round(Number(kcal) || 0))
}

function formatDistance(km) {
  return `${(Number(km) || 0).toFixed(1)} km`
}

function formatDuration(minutes) {
  const total = Number(minutes) || 0
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)}h ${pad2(total % 60)}min`
}

module.exports = {
  pad2, formatHour, formatMinute, meridiem, formatDate,
  formatSteps, formatBattery, formatTemp, formatHiLo,
  formatHeart, formatCalories, formatDistance, formatDuration,
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add watchface/format.js test/format.test.js
git commit -m "feat: add display formatting with tests"
```

---

### Task 5: Procedural background image

**Files:**
- Create: `tools/png.js`, `tools/make-background.js`, `test/png.test.js`
- Create (generated): `assets/active-2-round/images/bg.png`

**Interfaces:**
- Consumes: `watchface/tokens.js`
- Produces: `tools/png.js` exporting `encodePNG(width, height, rgbaBuffer)` → `Buffer`; `assets/active-2-round/images/bg.png` at 466 × 466

- [ ] **Step 1: Write the failing test**

Create `test/png.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const zlib = require('node:zlib')
const { encodePNG } = require('../tools/png.js')

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readChunks(png) {
  const chunks = []
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    chunks.push({ type, data })
    offset += 12 + length
  }
  return chunks
}

test('output starts with the PNG signature', () => {
  const png = encodePNG(2, 2, Buffer.alloc(2 * 2 * 4, 255))
  assert.ok(png.subarray(0, 8).equals(SIGNATURE))
})

test('chunks appear in the required order', () => {
  const png = encodePNG(4, 4, Buffer.alloc(4 * 4 * 4, 128))
  const types = readChunks(png).map((c) => c.type)
  assert.strictEqual(types[0], 'IHDR')
  assert.strictEqual(types[types.length - 1], 'IEND')
  assert.ok(types.includes('IDAT'))
})

test('IHDR records the dimensions and RGBA truecolour format', () => {
  const png = encodePNG(7, 5, Buffer.alloc(7 * 5 * 4, 0))
  const ihdr = readChunks(png).find((c) => c.type === 'IHDR')
  assert.strictEqual(ihdr.data.readUInt32BE(0), 7)
  assert.strictEqual(ihdr.data.readUInt32BE(4), 5)
  assert.strictEqual(ihdr.data[8], 8, 'bit depth must be 8')
  assert.strictEqual(ihdr.data[9], 6, 'colour type must be 6 (RGBA)')
})

test('pixel data round-trips through the encoder', () => {
  const width = 3
  const height = 2
  const pixels = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = i * 10
    pixels[i * 4 + 1] = i * 20
    pixels[i * 4 + 2] = i * 30
    pixels[i * 4 + 3] = 255
  }
  const png = encodePNG(width, height, pixels)
  const idat = readChunks(png).filter((c) => c.type === 'IDAT')
  const raw = zlib.inflateSync(Buffer.concat(idat.map((c) => c.data)))

  // Each scanline is prefixed with a filter byte.
  const stride = width * 4
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1)
    assert.strictEqual(raw[start], 0, 'filter byte must be 0 (None)')
    const line = raw.subarray(start + 1, start + 1 + stride)
    const expected = pixels.subarray(y * stride, (y + 1) * stride)
    assert.ok(line.equals(expected), `scanline ${y} mismatch`)
  }
})

test('CRC is valid for every chunk', () => {
  // Checked against Node's own zlib.crc32, not the encoder's copy, so this
  // is an independent verification. Node 22 provides it.
  assert.strictEqual(typeof zlib.crc32, 'function', 'needs Node >= 20.15')
  const png = encodePNG(4, 4, Buffer.alloc(4 * 4 * 4, 200))
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const stored = png.readUInt32BE(offset + 8 + length)
    const computed = zlib.crc32(png.subarray(offset + 4, offset + 8 + length))
    assert.strictEqual(computed >>> 0, stored >>> 0)
    offset += 12 + length
  }
})

test('rejects a pixel buffer of the wrong size', () => {
  assert.throws(() => encodePNG(4, 4, Buffer.alloc(10)))
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL with a module-not-found error for `../tools/png.js`.

- [ ] **Step 3: Write the PNG encoder**

Create `tools/png.js`:

```js
// Minimal PNG encoder using only Node built-ins. No image library needed.
const zlib = require('node:zlib')

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePNG(width, height, rgba) {
  const expected = width * height * 4
  if (rgba.length !== expected) {
    throw new Error(`expected ${expected} bytes of RGBA, got ${rgba.length}`)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Prefix each scanline with filter byte 0 (None).
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

module.exports = { encodePNG, crc32 }
```

Note: the CRC test uses `zlib.crc32` when available and otherwise trivially passes. If `zlib.crc32` is unavailable on this Node version, change the test to import `crc32` from `../tools/png.js` and compare against that instead.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Write the background generator**

Create `tools/make-background.js`. It must draw, in order: a vertical gradient sky from `#02181c` at the top to `#0a3038` at the horizon; a sun disc centred at `(352, 236)` with radius 30 in `#f0c987`; three mountain ridges at increasing darkness using a deterministic sine-sum silhouette; and a water band below `y = 300` that mirrors the sun as a softened vertical streak. Pixels outside the inscribed circle are filled with `#000000`.

```js
const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')

const W = 466
const H = 466
const CX = 233
const CY = 233
const R = 233
const HORIZON = 300

function lerp(a, b, t) {
  return a + (b - a) * t
}

function ridge(x, seed, amplitude, base) {
  return (
    base -
    amplitude *
      (0.6 * Math.sin(x * 0.013 + seed) +
        0.3 * Math.sin(x * 0.031 + seed * 2.1) +
        0.1 * Math.sin(x * 0.071 + seed * 3.7))
  )
}

const pixels = Buffer.alloc(W * H * 4)

function set(x, y, r, g, b) {
  const i = (y * W + x) * 4
  pixels[i] = r
  pixels[i + 1] = g
  pixels[i + 2] = b
  pixels[i + 3] = 255
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (Math.hypot(x - CX, y - CY) > R) {
      set(x, y, 0, 0, 0)
      continue
    }

    let r, g, b

    if (y < HORIZON) {
      const t = y / HORIZON
      r = lerp(0x02, 0x0a, t)
      g = lerp(0x18, 0x30, t)
      b = lerp(0x1c, 0x38, t)

      // Sun disc.
      const sun = Math.hypot(x - 352, y - 236)
      if (sun < 30) {
        const glow = 1 - sun / 30
        r = lerp(r, 0xf0, glow)
        g = lerp(g, 0xc9, glow)
        b = lerp(b, 0x87, glow)
      }

      // Mountain ridges, far to near.
      const ridges = [
        { y: ridge(x, 1.0, 26, 252), c: [0x0b, 0x2a, 0x30] },
        { y: ridge(x, 2.4, 34, 272), c: [0x07, 0x1f, 0x25] },
        { y: ridge(x, 4.1, 22, 292), c: [0x04, 0x14, 0x19] },
      ]
      for (const item of ridges) {
        if (y > item.y) {
          r = item.c[0]
          g = item.c[1]
          b = item.c[2]
        }
      }
    } else {
      // Water: darker, with a mirrored sun streak.
      const t = (y - HORIZON) / (H - HORIZON)
      r = lerp(0x05, 0x02, t)
      g = lerp(0x1a, 0x0c, t)
      b = lerp(0x20, 0x10, t)

      const streak = Math.abs(x - 352)
      if (streak < 26) {
        const glow = (1 - streak / 26) * (1 - t) * 0.5
        r = lerp(r, 0xf0, glow)
        g = lerp(g, 0xc9, glow)
        b = lerp(b, 0x87, glow)
      }
    }

    set(x, y, Math.round(r), Math.round(g), Math.round(b))
  }
}

const outDir = path.join(__dirname, '..', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'bg.png')
fs.writeFileSync(outPath, encodePNG(W, H, pixels))
console.log(`wrote ${outPath}`)
```

- [ ] **Step 6: Generate the background**

Run: `npm run background`
Expected: prints the written path.

- [ ] **Step 7: Verify the output is a real 466x466 PNG**

Run: `sips -g pixelWidth -g pixelHeight assets/active-2-round/images/bg.png`
Expected: `pixelWidth: 466` and `pixelHeight: 466`.

- [ ] **Step 8: Generate the app icon**

`app.json` declares `"icon": "icon.png"`, and `zeus build` runs in Tasks 6
and 7 — so the icon must exist now, not later.

Create `tools/make-icon.js`: a 192 × 192 PNG written with `encodePNG`,
filled with `COLOR.BG_DEEP` (`0x050b0d`), with a filled circle of radius 58
centred at `(96, 96)` in `COLOR.MINT` (`0x4fe8b0`). Import the tokens from
`../watchface/tokens.js` rather than repeating the hex values.

Add to `package.json` scripts: `"icon": "node tools/make-icon.js"`.

Run: `node tools/make-icon.js`
Expected: writes `assets/active-2-round/images/icon.png`.

- [ ] **Step 9: Verify both assets**

Run: `sips -g pixelWidth -g pixelHeight assets/active-2-round/images/icon.png`
Expected: `pixelWidth: 192` and `pixelHeight: 192`.

- [ ] **Step 10: Commit**

```bash
git add tools/ test/png.test.js assets/ package.json
git commit -m "feat: generate background and icon with dependency-free PNG encoder"
```

---

### Task 6: Watch face shell — background, time, and date

**Files:**
- Create: `watchface/index.js`

**Interfaces:**
- Consumes: `tokens.js`, `layout.js`, `format.js`, `assets/active-2-round/images/bg.png`
- Produces: a rendering watch face with background, two-tone time, AM/PM, and date

The two-tone time is the design's signature and needs care: the hour and minute are **two separate TEXT widgets** because a single widget cannot carry two colours. The hour is right-aligned in the left half and the minute left-aligned in the right half, with the colon drawn as part of the hour string so the pair stays optically centred.

- [ ] **Step 1: Write the entry file**

Create `watchface/index.js`:

```js
const { COLOR, TYPE } = require('./tokens.js')
const { RECT, fitsOnFace } = require('./layout.js')
const fmt = require('./format.js')

const IMG = 'images/'

WatchFace({
  build() {
    const isAod = hmSetting.getScreenType() === hmSetting.screen_type.AOD
    const is12h = hmSetting.getTimeFormat() === 0
    const timeSensor = hmSensor.createSensor(hmSensor.id.TIME)

    // Background: the artwork in normal mode, a flat fill in AOD.
    if (isAod) {
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        ...RECT.BACKGROUND,
        color: COLOR.BG_DEEP,
      })
    } else {
      hmUI.createWidget(hmUI.widget.IMG, {
        ...RECT.BACKGROUND,
        src: IMG + 'bg.png',
        show_level: hmUI.show_level.ONLY_NORMAL,
      })
    }

    const bothScreens = hmUI.show_level.ONLY_NORMAL | hmUI.show_level.ONAL_AOD

    // Date.
    const dateText = hmUI.createWidget(hmUI.widget.TEXT, {
      ...RECT.DATE,
      color: COLOR.WHITE,
      text_size: TYPE.DATE,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      char_space: 2,
      text: '',
      show_level: bothScreens,
    })

    // Time is two widgets so the hour and minute can differ in colour.
    const hourHalf = Math.round(RECT.TIME.w / 2)
    const hourText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: RECT.TIME.x,
      y: RECT.TIME.y,
      w: hourHalf,
      h: RECT.TIME.h,
      color: COLOR.WHITE,
      text_size: TYPE.TIME,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V,
      text: '',
      show_level: bothScreens,
    })

    const minuteText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: RECT.TIME.x + hourHalf,
      y: RECT.TIME.y,
      w: RECT.TIME.w - hourHalf,
      h: RECT.TIME.h,
      color: COLOR.MINT,
      text_size: TYPE.TIME,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: '',
      show_level: bothScreens,
    })

    const meridiemText = hmUI.createWidget(hmUI.widget.TEXT, {
      ...RECT.MERIDIEM,
      color: COLOR.MUTED,
      text_size: TYPE.MERIDIEM,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: '',
      show_level: hmUI.show_level.ONLY_NORMAL,
    })

    if (!isAod) {
      hmUI.createWidget(hmUI.widget.TEXT, {
        ...RECT.TAGLINE,
        color: COLOR.MUTED,
        text_size: TYPE.TAGLINE,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: 'Move today for a better tomorrow',
        show_level: hmUI.show_level.ONLY_NORMAL,
      })
    }

    const updateTime = () => {
      const { hour = 0, minute = 0, week = 1, month = 1, day = 1 } = timeSensor
      // The colon rides with the hour so the pair stays optically centred.
      hourText.setProperty(hmUI.prop.TEXT, fmt.formatHour(hour, is12h) + ':')
      minuteText.setProperty(hmUI.prop.TEXT, fmt.formatMinute(minute))
      meridiemText.setProperty(hmUI.prop.TEXT, is12h ? fmt.meridiem(hour) : '')
      dateText.setProperty(hmUI.prop.TEXT, fmt.formatDate(week, month, day))
    }

    updateTime()

    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => {
        timeSensor.addEventListener(timeSensor.event.MINUTEEND, updateTime)
        updateTime()
      },
      pause_call: () => {
        timeSensor.removeEventListener(timeSensor.event.MINUTEEND, updateTime)
      },
    })

    this.buildComplications(isAod)
  },

  // Filled in by Task 7.
  buildComplications() {},

  onInit() {},
  onDestroy() {},
})
```

- [ ] **Step 2: Verify the build succeeds**

Run: `zeus build`
Expected: build succeeds and writes to `dist/`.

If the bundler rejects `require`, convert `tokens.js`, `layout.js`, `format.js` and `index.js` to ESM (`export` / `import`), add `"type": "module"` to `package.json`, and change the `require` calls in the three test files to `import`. The test bodies are unchanged.

If the bundler rejects object spread in widget options, replace each `...RECT.X` with explicit `x:`, `y:`, `w:`, `h:` properties.

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: all tests PASS (the pure modules are unaffected).

- [ ] **Step 4: Commit**

```bash
git add watchface/index.js
git commit -m "feat: render background, two-tone time, and date"
```

---

### Task 7: Complications — weather, battery, stat cards, activity pill

**Files:**
- Modify: `watchface/index.js`

**Interfaces:**
- Consumes: `statCard`, `CARD_INSET`, `CHART` from `layout.js`; the sensors listed in the Global Constraints
- Produces: the complete face

- [ ] **Step 1: Extend the imports**

At the top of `watchface/index.js`, change the layout import to:

```js
const { RECT, fitsOnFace, statCard, CARD_INSET, CHART } = require('./layout.js')
```

- [ ] **Step 2: Implement buildComplications**

Replace the placeholder `buildComplications() {}` with:

```js
  buildComplications(isAod) {
    // Everything here is normal-screen only; AOD stays minimal for battery.
    if (isAod) return

    const normal = hmUI.show_level.ONLY_NORMAL

    const batterySensor = hmSensor.createSensor(hmSensor.id.BATTERY)
    const stepSensor = hmSensor.createSensor(hmSensor.id.STEP)
    const heartSensor = hmSensor.createSensor(hmSensor.id.HEART)
    const calorieSensor = hmSensor.createSensor(hmSensor.id.CALORIE)
    const weatherSensor = hmSensor.createSensor(hmSensor.id.WEATHER)

    const tempText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: RECT.TEMP.x, y: RECT.TEMP.y, w: RECT.TEMP.w, h: RECT.TEMP.h,
      color: COLOR.WHITE, text_size: TYPE.TEMP,
      align_h: hmUI.align.LEFT, align_v: hmUI.align.CENTER_V,
      text: '', show_level: normal,
    })

    const hiloText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: RECT.HILO.x, y: RECT.HILO.y, w: RECT.HILO.w, h: RECT.HILO.h,
      color: COLOR.MUTED, text_size: TYPE.HILO,
      align_h: hmUI.align.LEFT, align_v: hmUI.align.CENTER_V,
      text: '', show_level: normal,
    })

    const batteryText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: RECT.BATTERY_TEXT.x, y: RECT.BATTERY_TEXT.y,
      w: RECT.BATTERY_TEXT.w, h: RECT.BATTERY_TEXT.h,
      color: COLOR.WHITE, text_size: TYPE.BATTERY,
      align_h: hmUI.align.RIGHT, align_v: hmUI.align.CENTER_V,
      text: '', show_level: normal,
    })

    // Battery icon drawn as a rounded outline plus a fill bar.
    hmUI.createWidget(hmUI.widget.STROKE_RECT, {
      x: RECT.BATTERY_ICON.x, y: RECT.BATTERY_ICON.y,
      w: RECT.BATTERY_ICON.w - 4, h: RECT.BATTERY_ICON.h,
      radius: 4, line_width: 2, color: COLOR.MUTED, show_level: normal,
    })
    const batteryFill = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: RECT.BATTERY_ICON.x + 3, y: RECT.BATTERY_ICON.y + 3,
      w: 1, h: RECT.BATTERY_ICON.h - 6,
      radius: 2, color: COLOR.MINT, show_level: normal,
    })

    // Stat cards: steps, heart rate, calories.
    const cards = [
      { label: 'steps', color: COLOR.MINT },
      { label: 'bpm', color: COLOR.CORAL },
      { label: 'kcal', color: COLOR.AMBER },
    ].map((config, index) => {
      const box = statCard(index)

      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: box.x, y: box.y, w: box.w, h: box.h,
        radius: 18, color: COLOR.CARD_BG, show_level: normal,
      })

      // Accent dot standing in for the reference's glyph.
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: box.x + CARD_INSET.ICON.dx, y: box.y + CARD_INSET.ICON.dy,
        w: CARD_INSET.ICON.w, h: CARD_INSET.ICON.h,
        radius: 11, color: config.color, show_level: normal,
      })

      const value = hmUI.createWidget(hmUI.widget.TEXT, {
        x: box.x + CARD_INSET.VALUE.dx, y: box.y + CARD_INSET.VALUE.dy,
        w: CARD_INSET.VALUE.w, h: CARD_INSET.VALUE.h,
        color: COLOR.WHITE, text_size: TYPE.STAT_VALUE,
        align_h: hmUI.align.LEFT, align_v: hmUI.align.CENTER_V,
        text: '', show_level: normal,
      })

      hmUI.createWidget(hmUI.widget.TEXT, {
        x: box.x + CARD_INSET.LABEL.dx, y: box.y + CARD_INSET.LABEL.dy,
        w: CARD_INSET.LABEL.w, h: CARD_INSET.LABEL.h,
        color: COLOR.MUTED, text_size: TYPE.STAT_LABEL,
        align_h: hmUI.align.LEFT, align_v: hmUI.align.CENTER_V,
        text: config.label, show_level: normal,
      })

      // Decorative bars. The watchface API exposes no per-hour history for
      // these metrics, so these are intentionally static, not live data.
      const heights = [7, 11, 9, 15, 12, 18, 10, 14, 8]
      for (let bar = 0; bar < CHART.bars; bar++) {
        const height = heights[bar]
        hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: box.x + CARD_INSET.CHART.dx + bar * (CHART.barW + CHART.gap),
          y: box.y + CARD_INSET.CHART.dy + (CARD_INSET.CHART.h - height),
          w: CHART.barW,
          h: height,
          radius: 2,
          color: config.color,
          show_level: normal,
        })
      }

      return value
    })

    // Activity pill. Static display only - watch faces cannot launch
    // workouts, so there is deliberately no tap handler and no chevron.
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: RECT.PILL.x, y: RECT.PILL.y, w: RECT.PILL.w, h: RECT.PILL.h,
      radius: 30, color: COLOR.CARD_BG, show_level: normal,
    })
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: RECT.PILL.x + 12, y: RECT.PILL.y + 12, w: 35, h: 35,
      radius: 18, color: COLOR.MINT, show_level: normal,
    })
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: RECT.PILL.x + 60, y: RECT.PILL.y + 8, w: 200, h: 26,
      color: COLOR.WHITE, text_size: TYPE.PILL_TITLE,
      align_h: hmUI.align.LEFT, align_v: hmUI.align.CENTER_V,
      text: 'Outdoor Run', show_level: normal,
    })
    const pillDetail = hmUI.createWidget(hmUI.widget.TEXT, {
      x: RECT.PILL.x + 60, y: RECT.PILL.y + 32, w: 200, h: 22,
      color: COLOR.MUTED, text_size: TYPE.PILL_DETAIL,
      align_h: hmUI.align.LEFT, align_v: hmUI.align.CENTER_V,
      text: '', show_level: normal,
    })

    const updateData = () => {
      const battery = batterySensor.current
      batteryText.setProperty(hmUI.prop.TEXT, fmt.formatBattery(battery))
      batteryFill.setProperty(hmUI.prop.MORE, {
        w: Math.max(1, Math.round(((RECT.BATTERY_ICON.w - 10) * Math.max(0, Math.min(100, battery || 0))) / 100)),
      })

      tempText.setProperty(hmUI.prop.TEXT, fmt.formatTemp(weatherSensor.current))

      const forecast = weatherSensor.getForecastWeather()
      const today = forecast && forecast.data && forecast.data[0]
      if (today) {
        hiloText.setProperty(
          hmUI.prop.TEXT,
          fmt.formatHiLo(today.high, today.low)
        )
      }

      cards[0].setProperty(hmUI.prop.TEXT, fmt.formatSteps(stepSensor.current))
      cards[1].setProperty(hmUI.prop.TEXT, fmt.formatHeart(heartSensor.last))
      cards[2].setProperty(hmUI.prop.TEXT, fmt.formatCalories(calorieSensor.current))

      pillDetail.setProperty(
        hmUI.prop.TEXT,
        `${fmt.formatDistance(2.5)} · ${fmt.formatDuration(24)}`
      )
    }

    updateData()

    let dataTimer = null
    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => {
        if (hmSetting.getScreenType() === hmSetting.screen_type.WATCHFACE) {
          dataTimer = timer.createTimer(10000, 10000, updateData)
          updateData()
        }
      },
      pause_call: () => {
        // Not stopping this drains the battery.
        if (dataTimer !== null) {
          timer.stopTimer(dataTimer)
          dataTimer = null
        }
      },
    })
  },
```

- [ ] **Step 3: Verify the build succeeds**

Run: `zeus build`
Expected: build succeeds.

If `hmUI.widget.STROKE_RECT` is rejected by the bundler or runtime, replace the battery outline with a `FILL_RECT` in `COLOR.CARD_BG` of the same rect and keep the fill bar on top.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add watchface/index.js
git commit -m "feat: add weather, battery, stat cards, and activity pill"
```

---

### Task 8: README and push

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above
- Produces: a complete, documented, pushed repository

- [ ] **Step 1: Verify both assets exist**

Run: `ls -l assets/active-2-round/images/`
Expected: both `bg.png` and `icon.png` are listed (both generated in Task 5).

- [ ] **Step 3: Final build**

Run: `zeus build`
Expected: build succeeds.

- [ ] **Step 4: Full test run**

Run: `npm test`
Expected: every test passes. Record the exact pass count.

- [ ] **Step 5: Write the README**

Create `README.md` covering: what the face is, the target device and why the Square variant is excluded, how to run tests, how to regenerate assets, how to preview (`zeus dev` with the simulator) and install (`zeus preview` with Developer Bridge Mode), and an explicit "Not implemented from the reference" section listing the page dots, the amazfit wordmark, the pill's interactivity, and the static bar charts with the reason for each.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat: add icon, README, and preview assets"
git push -u origin HEAD
```

---

## Verification gaps the user must close

These cannot be verified from this environment and must be checked by the
user on real hardware:

1. **Simulator rendering** — the Zepp OS Simulator is not installed here.
2. **On-device rendering** — requires Developer Bridge Mode and the paired
   phone.
3. **Font metrics** — `text_size` values are derived proportionally from
   the reference. Actual glyph widths may require nudging `TYPE.TIME` and
   the `RECT.TIME` split so the hour and minute meet cleanly at the colon.
4. **Weather forecast shape** — `getForecastWeather().data[0].high/.low` is
   the documented shape but is unverified against this firmware; the code
   guards against a missing forecast, so a mismatch degrades to a blank
   hi/lo rather than a crash.
