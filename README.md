# Horizon — Amazfit Active 2 (Round) Watch Face

A custom Zepp OS watch face for the **Amazfit Active 2, Round variant**,
implementing the design in [`reference-new.png`](./reference-new.png): a
black AMOLED face with a battery arc, a large two-tone digital clock in a
generated squared typeface, and three metrics (steps, heart rate, calories)
on ring gauges, wrapped in sparse technical chrome.

The design brief is deliberately restrictive, and the code enforces the
parts of it that are enforceable:

- **One accent colour.** Black, white, one neutral grey, one gold. A test
  fails if any second chromatic hue enters the palette.
- **A 20-25px safe area**, not merely "not clipped by the bezel".
- **No invented data.** A sensor with no reading renders `--` and an empty
  gauge. The bpm dial in particular is never filled in from another
  metric to keep it looking alive.

| | |
|---|---|
| Target device | Amazfit Active 2 — **Round** |
| Screen | 466 × 466, circular |
| Device platform | Zepp OS 5.0 |
| Device API level | 4.2 |
| **Project API target** | **2.0.0**, per `apiVersion` in `app/app.json` |
| App type | `watchface` |
| App name | Horizon |

The "Device platform"/"Device API level" rows above describe the hardware
this face runs on. They are **not** the API surface this project is
written against: `app/app.json` deliberately declares
`runtime.apiVersion.{compatible,target,minVersion}` as `"2.0.0"`, and the
code only uses the 2.0.0 API surface, even though it runs fine on the
newer OS 5.0 / API 4.2 hardware. Don't write API-4.2-only calls expecting
them to work here.

## Round vs. Square — read this before you touch `app.json`

The Amazfit Active 2 ships in two physically different variants:

| Variant | Resolution | Shape |
|---|---|---|
| **Round** (this project) | 466 × 466 | Circular |
| Square | 390 × 450 | Rectangular |

These are **separate Zepp build targets** with separate `deviceSource`
values. A face laid out for one does **not** fit the other — geometry,
the circular bezel clipping check, and the background art are all
Round-specific. This project targets Round only. `app/app.json` declares
exactly one target, `active-2-round`, with these eight `deviceSource`
values:

```
8913152  8913153  8913155  8913159
10092800 10092801 10092803 10092807
```

Do not add a Square target to this project without redoing the layout —
`app/watchface/layout.js` assumes a 466×466 circle.

## Project layout

```
app/                     the actual Zepp OS app (this is zeus's project root)
  app.json               app manifest — targets, deviceSource list, designWidth
  app.js                 app-level lifecycle (minimal; watch face logic lives below)
  watchface/
    index.js             the only file that touches the Zepp platform (@zos/* modules)
    scene.js              builds the whole face as drawing descriptors (pure)
    tokens.js             colour + typography constants (pure data)
    layout.js             screen geometry, polar(), fitsOnFace(), arcBox(), rects
    gauge.js              ratio -> sprite frame / lit dash count (pure)
    digits.js             kerning for the generated time glyphs (pure)
    format.js              display-string formatting (pure functions)
  assets/active-2-round/
    icon.png               app icon
    images/bg.png           generated static chrome
    images/d[wb]-*.png      generated time glyphs, white and accent sets
    images/arc-*.png        generated gauge fill frames
    images/ic-*.png         generated metric glyphs
  dist/                    zeus build output (.zab packages) — gitignored

test/                    unit tests (Node's built-in test runner) — NOT inside app/
tools/                   asset-generating build scripts — NOT inside app/
  make-background.js      generates the static chrome, images/bg.png
  make-icon.js             generates the app icon
  make-icons.js            generates the three metric glyphs
  make-digits.js           generates the time glyph set (0-9 and the colon)
  make-arcs.js             generates the gauge fill frames
  draw.js                  shapes: arcs, paths, rounded rects, blur, erase
  png.js                   shared zlib-only PNG encoder

reference-new.png        the design mockup this face implements
docs/                    spec and planning artifacts from the build process
```

### Why `test/` and `tools/` are NOT inside `app/`

This is the one non-obvious thing in the repo. `zeus build` glob-scans
**every** `.js` file under its project root and tries to treat each one as
a bundle entry point. It has no exclude mechanism, and `.gitignore` has no
effect on it — it walks the filesystem, not git's tracked-file list.

If a test file or a Node build script (which `require`/`import`s things
like `node:test` or `node:zlib` in ways the Zepp bundler can't resolve)
sits anywhere under `app/`, `zeus build` fails with `UNRESOLVED_IMPORT`.

That's why the Zepp app itself lives in `app/`, while `test/` and `tools/`
sit at the repo root, outside zeus's scan path. If a future change moves
either directory back under `app/`, the build will break the same way —
don't do it.

## Commands

All commands run from the repo root via `npm`.

| Command | What it does |
|---|---|
| `npm test` | Runs all unit tests (`test/**/*.test.js`) under plain Node — no simulator or device needed. |
| `npm run build` | `cd app && zeus build` — produces an installable `.zab` package under `app/dist/`. |
| `npm run dev` | `cd app && zeus dev` — starts the Zepp OS Simulator dev server. |
| `npm run preview` | `cd app && zeus preview` — generates a QR code to install on a real watch via the Zepp app. |
| `npm run assets` | Regenerates **every** generated asset (chrome, app icon, metric glyphs, time glyphs, arc frames). Deterministic: re-running produces byte-identical files. |
| `npm run background` | Regenerates the static chrome, `images/bg.png`. |
| `npm run icon` | Regenerates the app icon. |
| `npm run icons` | Regenerates the three metric glyphs. |
| `npm run digits` | Regenerates the time glyph set. |
| `npm run arcs` | Regenerates the gauge fill frames. |

`zeus build`/`dev`/`preview` are **zeus-cli** commands that must run with
`app/` as the current directory — that's why the npm scripts `cd app`
first. Running bare `zeus build` from the repo root will fail (or worse,
pick up `test/` and `tools/` as noted above); always go through the npm
scripts, or `cd app` yourself first.

## How to see it on a watch

**Simulator (no hardware required):**

1. Download the Zepp OS Simulator from the Zepp developer site.
2. Run `npm run dev`. This starts the dev server and (with the simulator
   running) pushes the face to it for live preview.

**Real device:**

1. In the Zepp phone app, enable **Developer Mode** / **Bridge Mode** for
   your watch.
2. Make sure your phone and the computer running `npm run preview` are on
   the same network.
3. Run `zeus login` once (interactively, inside `app/`) to authenticate
   the CLI with your Zepp developer account.
4. Run `npm run preview`. It prints a QR code — scan it from the Zepp app
   to install the face on the watch.

## Architecture

The design goal was to make a watch face **unit-testable**, which is
unusual — most watch face code is tightly coupled to the platform and can
only be checked by eyeballing it on a device. Here, everything that is
pure geometry, tokens, or string formatting lives in dependency-free
modules that run under bare Node:

- `app/watchface/tokens.js` — colour, typography and goal constants
- `app/watchface/layout.js` — screen geometry, `polar()`, `fitsOnFace()`,
  `arcBox()`, and the table of element rectangles
- `app/watchface/gauge.js` — a reading and a target become a sprite frame
  index or a count of lit dashes
- `app/watchface/digits.js` — kerning for the generated time glyphs
- `app/watchface/format.js` — display-string formatting (time, date,
  battery, steps, and any plain metric)
- `app/watchface/scene.js` — composes all of the above into the full list
  of drawing descriptors

`scene.js` is the useful one: because it is pure, the entire composition
can be rendered off-device and inspected before anything is flashed, and
the tests can assert things like "no element breaks the safe area" and
"every image the face references exists on disk" without a simulator.

None of these files import any `@zos/*` module, so
`test/*.test.js` exercises them directly with `node --test`.

`app/watchface/index.js` is the **only** file that touches the Zepp
platform: it creates widgets with `hmUI.createWidget`, reads sensors, and
wires the `resume_call`/`pause_call` timer lifecycle. It decides nothing
about appearance — it walks the descriptor list from `scene.js`, creates a
widget per entry, and on each tick pushes new values into the entries that
carry a `key`. Adding an element means editing `scene.js`, not this file.

`fitsOnFace()` (in `layout.js`) is the key correctness check: it takes an
element's rectangle and validates every corner against the circular
bezel (screen center + radius), which is the thing that catches
round-screen clipping — a rectangle that would look fine on a square
screen but has its corner cut off by the bezel on this round one. Every
entry in `RECT` is checked against it at test time, and so is every
element `scene.js` emits — including the derived ones, such as each time
glyph's kerned position. The one deliberate exception is the arc sprites,
whose bounding boxes have transparent corners outside the safe area while
their ink never is; those are checked by walking the swept arc instead.

## Rendering strategy, and why some of it is baked

The brief asks for vector rendering rather than image assets. Most of the
face obeys that — every value is a live widget — but the circular geometry
cannot, and it is worth knowing why before "fixing" it.

This runtime has **no verified primitive for an angled line or an
arbitrary arc**. `FILL_RECT` is axis-aligned only, and `ARC_PROGRESS` is
unverified here; betting the face on it risks the silent black screen this
project has hit before. So:

- **Static chrome** — the outer ring, the ticks, the brackets, the
  unfilled gauge tracks — is baked into one generated `bg.png`. It is
  static by definition, so nothing dynamic is lost.
- **Gauge fills** are pre-rendered sprite frames at 5% granularity, each
  cropped by `layout.arcBox()` to its own tight bounds. All 88 frames come
  to 72 KB because of that cropping; the battery arc's frame is 160x34
  rather than the 254x254 its full circle would need.
- **The time** is generated glyph artwork, because the platform's text
  widgets can only use the system font and the squared numerals are the
  design's whole character.
- **Everything else** — every number, label and the battery fill — is a
  live `TEXT` or `FILL_RECT` widget.

`layout.arcBox()` is used by both the generator and the face, so a sprite
can never land off its track.

## scene.js takes its dependencies as an argument

`zeus build` glob-scans every `.js` under `app/` and treats each one as a
bundle entry. **A CommonJS entry cannot resolve a relative `require`**, so
any module under `app/watchface/` that requires a sibling fails the build
with `UNRESOLVED_IMPORT`. The other pure modules get away with it only
because they require nothing.

`scene.js` needs five of them, so they are injected: `index.js` assembles
the bundle from its own ESM imports and the test suite assembles the same
thing with plain requires. A test in `test/assets.test.js` fails if anyone
reintroduces a sibling `require`.

Related: `index.js` reaches these CommonJS modules through **namespace**
imports and destructures them. Calling a member directly
(`scene.createScene(...)`) makes rollup warn that the export cannot be
found — the prelude to a runtime failure.

## Not implemented from the reference

- **Weather, SpO2, notifications and music are absent by design**, per the
  brief. Their permissions have been removed from `app.json` too.
- **The bpm dial reads `--` until the optical sensor samples.** It runs on
  its own schedule, not the face's, so an empty dial shortly after a wrist
  raise is expected rather than a fault. The dial spans a 40-180bpm band
  instead of 0-180: a dial filling from zero would sit near a third all
  day and never visibly move.
- **Always-on display shows the time and date only.** Arcs and metrics
  there would cost battery for something the panel barely renders.

## What is verified, and what is not

Verified locally:

- `npm test` — 157/157 passing.
- `npm run build` — produces a 270 KB `.zab` with no rollup warnings.
- `npm run assets` — regenerating every asset is byte-identical, so the
  artwork is reproducible from source.
- The full composition renders correctly off-device: `scene.js` is pure,
  so a preview tool renders the exact descriptor list the watch consumes.
  Checked at both extremes — a full face and one with a dead battery, a
  one-digit hour and a silent heart rate sensor.

Still **not** verified:

- **Anything on real hardware, or even the simulator.** This redesign has
  not been run on a device. "Builds cleanly" is not "renders correctly".
- **Whether `Step.getTarget()` exists.** The steps ring prefers the goal
  set in the Zepp app and falls back to 10,000 when the call is absent.
- **System font metrics.** Every text widget is sized from the reference's
  measured pixel bounds, not from real glyph metrics, so the small caps
  may need nudging once seen on the panel.

## API generation: this targets `@zos/*`, not the `hm*` globals

This is the single most important thing to know before editing
`app/watchface/index.js`.

Older Zepp OS watch face examples — including the templates bundled with
`zeus-cli` itself, and most tutorials online — use global objects:
`hmUI`, `hmSensor`, `hmSetting`, `timer`, `px`. **Those globals do not
exist on this runtime.** Every one of them is `undefined`. Code written
against them throws on first use, and because the toolchain wraps the
watch face in a `try/catch` that only `console.log`s, the failure is
silent: you get a black screen with no visible error.

This project uses the current module API:

```js
import * as hmUI from '@zos/ui'
import { getScene, SCENE_AOD } from '@zos/app'
import { Time, Battery, Step, Calorie } from '@zos/sensor'
```

Note in particular:

- Sensors are **classes with getter methods**: `new Battery().getCurrent()`,
  not `sensor.current`.
- AOD detection is `getScene() === SCENE_AOD` from `@zos/app`.
  `@zos/display` does **not** have `getScreenType` — it only handles
  brightness and screen-off.
- Timers are native `setInterval` / `clearInterval`.
- `Time` exposes `onPerMinute()` / `offPerMinute()` for minute ticks.

`docs/ZEPP-API-FINDINGS.md` records the full mapping with the exact
constant values, all probed live against the running simulator, plus how
to read the device console programmatically when debugging.

## Permissions are required for the health sensors

`app/app.json` declares:

```json
"permissions": [
  "data:user.hd.step",
  "data:user.hd.calorie",
  "data:user.hd.heart_rate"
]
```

Without these, constructing `Step`, `Calorie` or `HeartRate` throws
`PERMISSION DENIED data:user.hd.<name>` and the metric sits empty. This
fails the same silent way as the API mismatch above — which is why every
sensor here is constructed and read inside a `try`, and a failure renders
`--` rather than taking the face down.

## Heart rate: `getLast()`, never `getCurrent()`

`HeartRate.getCurrent()` is documented as needing "to be used in the
`onCurrentChange` callback function" — it reports a **continuous
measurement in progress**, which a watch face never starts. On the watch
it therefore reads `0` all day. The simulator does not model the
distinction and answers `getCurrent()` from its sensor panel, so a face
built on it passes every check on the desk and shows `0` on the wrist.

`app/watchface/sensors.js` reads `getLast()` — the most recent single or
background-monitoring measurement — and treats `0` as *no reading*, so the
face shows `--` and an empty dial rather than a heart rate of zero. It
falls back to `getCurrent()` only when that is the only positive value,
which keeps the simulator usable and, on the watch, means a measurement
genuinely is running.

`onLastChange` (API level 2.1) pushes a fresh reading as soon as one
lands; the 30-second poll covers firmware that lacks it.
`onCurrentChange` is deliberately **not** used — it would start a
continuous measurement and keep the optical sensor running down the
battery.

If the dial still reads `--` on a real watch, check that heart-rate
monitoring is actually switched on in the watch's own health settings.
Nothing the face does can make the sensor sample on its own.

## A note on `hmUI.show_level.ONAL_AOD`

`app/watchface/index.js` uses `hmUI.show_level.ONLY_NORMAL |
hmUI.show_level.ONAL_AOD` to mark widgets (time, date) that should
render in both normal and always-on-display mode. `ONAL_AOD` is spelled
correctly — it's a typo in Zepp's own platform API (not `ON_AOD` or
`AOD` as you might expect), confirmed against the bundled `@zeppos/zeus-cli`
templates. Don't "fix" the spelling — doing so will silently break
always-on display, since the corrected name doesn't exist on the
platform.
