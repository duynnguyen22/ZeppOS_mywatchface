# Amazfit Active 2 (Round) Watch Face — Visual Design Spec

Implements the layout in `reference.png` for a 466 × 466 round screen.

## Verified platform API

All of the following was verified against the templates bundled with the
installed `@zeppos/zeus-cli` and against shipping community watch faces —
none of it is assumed.

- Watch faces use **global objects**, not `@zos/*` imports: `hmUI`,
  `hmSensor`, `hmSetting`, `timer`, and `px()`.
- Lifecycle is `WatchFace({ onInit(), build(), onDestroy() })`. Widgets are
  created in **`build()`**.
- `app.json` uses `configVersion: "v2"` with
  `targets.<name>.platforms[] = { name, deviceSource }` and `designWidth`.

### Sensors and their real property names

| Sensor | Constant | Property |
|---|---|---|
| Time | `hmSensor.id.TIME` | `hour`, `minute`, `second`, `day`, `month`, `year`, `week` |
| Battery | `hmSensor.id.BATTERY` | `current` |
| Steps | `hmSensor.id.STEP` | `current` |
| Heart rate | `hmSensor.id.HEART` | `last` |
| Calories | `hmSensor.id.CALORIE` | `current` |
| Weather | `hmSensor.id.WEATHER` | `current`, `cityName`, `getForecastWeather()` |

Heart rate is `last`, not `current`. This is the single easiest property to
get wrong.

### Refresh mechanism

Watch faces do not poll freely. Redraws are driven by:

```js
hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
  resume_call: () => { /* start timer or subscribe */ },
  pause_call: () => { /* stop timer or unsubscribe */ },
})
```

with `hmSetting.getScreenType()` selecting behaviour: in
`hmSetting.screen_type.WATCHFACE` use `timer.createTimer(...)`; in
`hmSetting.screen_type.AOD` subscribe to
`timeSensor.event.MINUTEEND` instead. Failing to stop timers in
`pause_call` drains the battery.

12/24-hour preference is `hmSetting.getTimeFormat() === 0` for 12-hour.

## Scope: what is and is not built

The reference is a product mockup, and three of its elements cannot exist
on a real watch face. They are **deliberately not built**:

1. **"Outdoor Run" pill with chevron** — watch faces cannot host tap
   targets that launch workouts. It is rendered as a **static display
   element** showing the last recorded activity, with no interactivity and
   no chevron affordance implying a tap.
2. **The three page dots** — these belong to the system launcher's widget
   carousel, not to the face. Drawing them would imply navigation that
   does not exist.
3. **"amazfit" wordmark** — system branding from the mockup.

**Bar charts in the stat cards** are rendered, but the watch face API
exposes no per-hour history for steps, heart rate, or calories. They are
therefore **static decorative bars** and are documented as such in code. A
future change could drive them from real data only if the API gains it.

## Layout

Coordinates are for a 466 × 466 design space, derived by proportional
measurement from the reference. Every element is validated at build time by
`fitsOnFace()` against the circular bezel.

| Element | x | y | w | h |
|---|---|---|---|---|
| Background image | 0 | 0 | 466 | 466 |
| Date (`TUE, SEP 12`) | 88 | 58 | 290 | 28 |
| Weather icon | 70 | 76 | 30 | 30 |
| Temperature (`28°`) | 106 | 76 | 80 | 30 |
| Hi/lo (`H:32° L:24°`) | 70 | 104 | 140 | 22 |
| Battery icon | 352 | 78 | 34 | 20 |
| Battery percent (`80%`) | 330 | 100 | 66 | 24 |
| Time block | 40 | 118 | 340 | 84 |
| AM/PM suffix | 388 | 156 | 44 | 26 |
| Tagline | 53 | 204 | 360 | 24 |
| Stat card 1 | 46 | 234 | 118 | 88 |
| Stat card 2 | 174 | 234 | 118 | 88 |
| Stat card 3 | 302 | 234 | 118 | 88 |
| Activity pill | 86 | 343 | 294 | 59 |

Within each stat card: icon at `+10,+10` (22 × 22), value text at
`+36,+8` (72 × 26), label at `+10,+36` (98 × 18), bar chart occupying
`+10,+60` (98 × 20) as 9 bars of width 8 with 3px gaps.

## Colour

| Token | Value | Use |
|---|---|---|
| `BG_DEEP` | `0x050b0d` | Backdrop base, AOD background |
| `MINT` | `0x4fe8b0` | Minute digits, steps accent |
| `CORAL` | `0xff5b6a` | Heart rate accent |
| `AMBER` | `0xffa53d` | Calories accent |
| `WHITE` | `0xffffff` | Hour digits, primary values |
| `MUTED` | `0x8a9ba0` | Labels, hi/lo, tagline |
| `CARD_BG` | `0x111d1f` | Stat card and pill fill |

The two-tone time is the design's signature: **hour in `WHITE`, minute in
`MINT`**, rendered as two separate TEXT widgets so the colours differ.

## Background image

Generated procedurally as a 466 × 466 PNG by a build script using only
Node's built-in `zlib` — no image library is installed or added. The script
draws a dark teal vertical gradient, a sun disc, three layered mountain
silhouettes, and a water band with a reflected sun. Regenerating is
deterministic, and the script is committed so the asset can be rebuilt.

## Always-on display

AOD is built in from the start. The AOD variant drops the background image,
the cards, the pill, and the bar charts, keeping only the time and date on a
flat `BG_DEEP` fill. Widgets are assigned `show_level` accordingly:
`hmUI.show_level.ONLY_NORMAL` for the rich elements and
`hmUI.show_level.ONLY_NORMAL | hmUI.show_level.ONAL_AOD` for time and date.

## Architecture

Pure, Node-testable modules with no Zepp imports:

- `watchface/tokens.js` — colour and typography constants
- `watchface/layout.js` — screen geometry, `polar()`, `fitsOnFace()`, and
  the element rectangle table above
- `watchface/format.js` — all display string formatting
- `tools/make-background.js` — PNG generator

The Zepp-dependent shell:

- `watchface/index.js` — creates widgets, wires sensors and delegates

Only `index.js` touches the platform. Everything else is unit tested.

## Success criteria

1. `npm test` passes.
2. `zeus build` produces a package.
3. Every element passes `fitsOnFace()` — nothing clipped by the bezel.
4. Hour and minute render in different colours.
5. Timers are stopped in `pause_call`.
6. The AOD variant renders time and date only.
