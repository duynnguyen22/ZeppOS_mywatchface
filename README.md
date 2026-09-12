# Horizon — Amazfit Active 2 (Round) Watch Face

A custom Zepp OS watch face for the **Amazfit Active 2, Round variant**,
implementing the design in [`reference.png`](./reference.png): a dark teal
mountain/lake scene, a two-tone digital clock, weather, battery, three
stat cards (steps, heart rate, calories), and an activity summary pill.

| | |
|---|---|
| Target device | Amazfit Active 2 — **Round** |
| Screen | 466 × 466, circular |
| Platform | Zepp OS 5.0 |
| API level | 4.2 |
| App type | `watchface` |
| App name | Horizon |

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
    index.js             the only file that touches the Zepp platform (hmUI, hmSensor, ...)
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
docs/, .superpowers/     spec and planning artifacts from the build process
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

None of these three files import `hmUI`, `hmSensor`, or any other Zepp
global, so `test/*.test.js` exercises them directly with `node --test`.

`app/watchface/index.js` is the **only** file that touches the Zepp
platform: it creates widgets with `hmUI.createWidget`, reads sensors, and
wires the `resume_call`/`pause_call` timer lifecycle. It imports its
numbers from `tokens.js` and `layout.js` rather than hardcoding them.

`fitsOnFace()` (in `layout.js`) is the key correctness check: it takes an
element's rectangle and validates every corner against the circular
bezel (screen center + radius), which is the thing that catches
round-screen clipping — a rectangle that would look fine on a square
screen but has its corner cut off by the bezel on this round one. Every
rect in the layout table is checked against it in the test suite.

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

## Known unverified items

None of the following could be checked without real hardware or the
Zepp OS Simulator, neither of which is available in the environment this
was built in. Only `npm test` (55/55 passing) and `npm run build`
(produces a `.zab`) have been verified.

- **Nothing has been rendered.** The face has not been seen in the
  simulator or on a device — only its build output and unit tests are
  verified.
- **Font metrics.** `TYPE.TIME` (`app/watchface/tokens.js`) is `76`px,
  and the hour/minute split (`RECT.TIME` in `app/watchface/layout.js`,
  divided in half in `app/watchface/index.js`) is derived
  proportionally from measuring `reference.png`, not from real glyph
  metrics. Where the hour and minute meet at the colon will likely need
  nudging once it's actually visible.
- **Distance sensor units.** In `app/watchface/index.js`,
  `distanceSensor.current` is **assumed** to be metres and is divided by
  1000 before formatting as km. If the on-device reading turns out to be
  in different units (e.g. already km, or off by 1000x), that one line
  is the fix.
- **Weather forecast shape.** `weatherSensor.getForecastWeather().data[0]`
  is assumed to have `.high` and `.low` fields, per the documented
  sensor shape — this is unverified against the actual firmware. The
  code checks that `today` exists before reading it, so a shape mismatch
  degrades the hi/lo text to whatever it was initialized to (blank)
  rather than crashing.

## A note on `hmUI.show_level.ONAL_AOD`

`app/watchface/index.js` uses `hmUI.show_level.ONLY_NORMAL |
hmUI.show_level.ONAL_AOD` to mark widgets (time, date) that should
render in both normal and always-on-display mode. `ONAL_AOD` is spelled
correctly — it's a typo in Zepp's own platform API (not `ON_AOD` or
`AOD` as you might expect), confirmed against the bundled `@zeppos/zeus-cli`
templates. Don't "fix" the spelling — doing so will silently break
always-on display, since the corrected name doesn't exist on the
platform.
