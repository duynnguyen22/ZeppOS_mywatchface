# Verified Zepp OS runtime API (Amazfit Active 2 Round, simulator v2.1.2)

Every fact here was probed **on the running simulator**, not taken from docs.
The original implementation used the Zepp OS 1.x global objects, which do
**not exist** on this runtime — that is why the face rendered a black screen.

## The failure

```
TypeError: cannot read property 'getScreenType' of undefined
at build (/watchface/index.js:367)
```

Probing `typeof` for each legacy global returned `undefined` for ALL of them:
`hmUI`, `hmSetting`, `hmSensor`, `hmApp`, `hmFS`, `timer`, `px`.

The watch face module is wrapped by the toolchain in a `try/catch` that only
`console.log`s the error, so a throw produces a silent black screen.

## Correct API

| Old global | New |
|---|---|
| `hmUI` | `import * as hmUI from '@zos/ui'` |
| `hmSensor` | `import { Time, Battery, ... } from '@zos/sensor'` — **classes**, instantiate with `new` |
| `hmSetting.getScreenType()` | `import { getScene, SCENE_AOD } from '@zos/app'` |
| `hmSetting.getTimeFormat()` | `new Time().getHourFormat()` vs `TIME_HOUR_FORMAT_12` |
| `timer.createTimer/stopTimer` | native `setInterval` / `clearInterval` |
| `px` | `import { px } from '@zos/utils'` |

`@zos/display` does **not** have `getScreenType` — it only handles brightness
and screen-off. Scene detection lives in `@zos/app`.

## Verified constant values

- `getScene()` → `1`; `SCENE_WATCHFACE` = 1, `SCENE_AOD` = 3
- `TIME_HOUR_FORMAT_12` = 0, `TIME_HOUR_FORMAT_24` = 1
- `hmUI.show_level.ONLY_NORMAL` = 1, `ONAL_AOD` = 2 (`ONLY_AOD` is an alias, also 2)
- `hmUI.widget`: `IMG`=1, `TEXT`=2, `FILL_RECT`=4, `STROKE_RECT`=5, `WIDGET_DELEGATE`=35
- `hmUI.align.CENTER_H` = 16; `hmUI.prop.TEXT` = 11, `hmUI.prop.MORE` = 0

## Sensor classes — getter methods, not properties

```js
new Battery().getCurrent()      // battery %
new Step().getCurrent()
new HeartRate().getCurrent()
new Calorie().getCurrent()
new Distance().getCurrent()
new Weather().getForecast()     // { cityName, tideData, forecastData: { count, data } }
```

`Time` instance methods: `getHours() getMinutes() getSeconds() getDay()
getDate() getMonth() getFullYear() getHourFormat() onPerMinute() offPerMinute()`

`getDay()` is **1-7 starting Monday** — verified: 2026-09-12 is a Saturday and
returned `6`, which matches `WEEKDAYS[week - 1]` in `format.js`.
`getMonth()` is **1-based** — returned `9` for September.

## Permissions are mandatory

`app.json` had `"permissions": []`, and every health sensor threw:

```
Error: PERMISSION DENIED data:user.hd.step
```

Required entries — without these the stat cards stay empty even with correct API:

```json
"permissions": [
  "data:user.hd.step",
  "data:user.hd.heart_rate",
  "data:user.hd.calorie",
  "data:user.hd.distance",
  "data:user.hd.weather"
]
```

After adding them the sensors returned real values (step 300, heart 75,
calorie 300, distance 0).

## How to debug this runtime

The device console is NOT in the `zeus dev` terminal — it is in the
simulator's own Console panel. It can be read programmatically over the
simulator's Electron DevTools socket:

```bash
PORT=$(cat ~/Library/Application\ Support/simulator/DevToolsActivePort | head -1)
curl -s http://127.0.0.1:$PORT/json/list     # get webSocketDebuggerUrl
# then Runtime.evaluate: document.body.innerText   (with the Console tab open)
```

Installed apps and their deployed files live in
`~/Library/Application Support/simulator/apps/app<appId>/device/`.
