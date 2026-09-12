# Horizon — Amazfit Active 2 (Round) Watch Face

A custom Zepp OS watch face for the **Amazfit Active 2, Round variant**,
implementing the design in [`reference.png`](./reference.png): a dark teal
mountain/lake scene, a two-tone digital clock, weather, battery, three
stat cards (steps, heart rate, calories), and an activity summary pill.

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
    tokens.js             colour + typography constants (pure data)
    layout.js             screen geometry, polar(), fitsOnFace(), element rects
    format.js              display-string formatting (pure functions)
  assets/active-2-round/
    icon.png               app icon
    images/bg.png           generated background artwork
  dist/                    zeus build output (.zab packages) — gitignored

test/                    unit tests (Node's built-in test runner) — NOT inside app/
tools/                   asset-generating build scripts — NOT inside app/
  make-background.js      generates assets/active-2-round/images/bg.png
  make-icon.js             generates assets/active-2-round/icon.png
  png.js                   shared zlib-only PNG encoder

reference.png            the design mockup this face implements
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
| `npm run background` | `node tools/make-background.js` — regenerates `app/assets/active-2-round/images/bg.png`. |
| `npm run icon` | `node tools/make-icon.js` — regenerates `app/assets/active-2-round/icon.png`. |

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

- `app/watchface/tokens.js` — colour and typography constants
- `app/watchface/layout.js` — screen geometry, `polar()`, `fitsOnFace()`,
  and the table of element rectangles (position/size for every widget)
- `app/watchface/format.js` — all display-string formatting (time, date,
  battery, temperature, steps, heart rate, calories, distance)

None of these three files import any `@zos/*` module, so
`test/*.test.js` exercises them directly with `node --test`.

`app/watchface/index.js` is the **only** file that touches the Zepp
platform: it creates widgets with `hmUI.createWidget`, reads sensors, and
wires the `resume_call`/`pause_call` timer lifecycle. Colours and text
sizes come from `tokens.js`, and the base element rectangles come from
`layout.js`'s `RECT`/`statCard()` — but not everything is sourced that
way: some interior offsets (e.g. the pill's icon and text positions) and
most `radius` values are hardcoded inline in `index.js`.

`fitsOnFace()` (in `layout.js`) is the key correctness check: it takes an
element's rectangle and validates every corner against the circular
bezel (screen center + radius), which is the thing that catches
round-screen clipping — a rectangle that would look fine on a square
screen but has its corner cut off by the bezel on this round one. Every
entry in the base `RECT` table is checked against it in the test suite
(`test/layout.test.js`), at test time — not build time. Positions derived
by arithmetic in `index.js` (card insets, chart bar positions, the pill
interior offsets, the hour/minute split) are not covered by this check.

## Not implemented from the reference

Four elements from `reference.png` are deliberately not built, because
they either can't exist on a watch face or would mean showing fake data
as real:

- **The "Outdoor Run" pill is not interactive and has no chevron.**
  Watch faces cannot host tap targets that launch workouts — the
  platform doesn't expose that hook. It's also been re-titled **"Today"**
  and shows the wearer's actual distance for the day (or `--` if the
  sensor has no value), rather than the reference's static
  "2.5 km · 24 min", which would otherwise be fabricated data presented
  as if it were real.
- **The three page-indicator dots are not drawn.** They belong to the
  system launcher's widget carousel (the UI for swiping between watch
  faces/widgets), not to the face itself — a face has no way to draw
  into that chrome.
- **The "amazfit" wordmark is not drawn.** It's system/product branding
  from the marketing mockup, not something a third-party watch face is
  meant to render.
- **The bar charts in the stat cards are static decoration, not live
  data.** The watch face sensor API exposes current values for steps,
  heart rate, and calories, but no per-hour history for any of them —
  there is nothing to chart. The bars are fixed decorative shapes; this
  is called out in a comment at the point they're drawn in
  `app/watchface/index.js`.

## What is verified, and what is not

Verified against the running Zepp OS Simulator (Active 2, firmware
v1.1.0, simulator v2.1.2):

- `npm test` — 59/59 passing.
- `npm run build` — produces an installable `.zab`.
- The face **loads with no runtime error**. The simulator's device
  console shows the module loading with no `ERROR >` line following it.
- The background asset resolves on device: `getImageInfo('images/bg.png')`
  returns `{width: 466, height: 466}` (a missing path returns `0x0`).
- Health sensors return real values once the permissions above are
  declared (step, heart rate and calorie all read back).
- `Time.getDay()` is 1-7 Monday-first and `getMonth()` is 1-based,
  matching `format.js` — confirmed against a known date.

Still NOT verified:

- **Pixel-level appearance.** The device screen is rendered by QEMU in a
  native window that is not capturable from a script, so the actual
  composition — spacing, overlap, colour against the backdrop — has not
  been inspected. The face loads cleanly and its widgets are created,
  but "renders without error" is not the same as "looks right".
- **Font metrics.** `TYPE.TIME` (`app/watchface/tokens.js`) is `76`px,
  and the hour/minute split (`RECT.TIME` in `app/watchface/layout.js`,
  halved in `index.js`) is derived by measuring `reference.png`, not
  from real glyph metrics. Where the hour and minute meet at the colon
  will likely need nudging.
- **Distance sensor units.** `new Distance().getCurrent()` is **assumed**
  to be metres and divided by 1000. If the on-device reading is off by
  1000x, that one line in `app/watchface/index.js` is the fix.
- **Current temperature.** `Weather.getForecast()` is the only weather
  API and its per-day entry is `{high, low, index}` — there is no
  current-temperature field in the simulator. The code tries `current`,
  `temp` and `temperature` before falling back to `--°`, in case real
  firmware exposes one. Hi/lo come from `high`/`low`, which read `0` in
  the simulator because it has no real weather data.
- **On a physical watch.** Everything above is the simulator. The real
  device has not been tested.

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
import { Time, Battery, Step, HeartRate, Calorie, Distance, Weather,
         TIME_HOUR_FORMAT_12 } from '@zos/sensor'
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
  "data:user.hd.heart_rate",
  "data:user.hd.calorie",
  "data:user.hd.distance",
  "data:user.hd.weather"
]
```

Without these, constructing `Step`, `HeartRate`, `Calorie` or `Distance`
throws `PERMISSION DENIED data:user.hd.<name>` and the stat cards stay
empty. This fails the same silent way as the API mismatch above.

## A note on `hmUI.show_level.ONAL_AOD`

`app/watchface/index.js` uses `hmUI.show_level.ONLY_NORMAL |
hmUI.show_level.ONAL_AOD` to mark widgets (time, date) that should
render in both normal and always-on-display mode. `ONAL_AOD` is spelled
correctly — it's a typo in Zepp's own platform API (not `ON_AOD` or
`AOD` as you might expect), confirmed against the bundled `@zeppos/zeus-cli`
templates. Don't "fix" the spelling — doing so will silently break
always-on display, since the corrected name doesn't exist on the
platform.
