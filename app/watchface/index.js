import * as hmUI from '@zos/ui'
import { getScene, SCENE_AOD, SCENE_WATCHFACE } from '@zos/app'
import { Time, Battery, Step, Calorie, HeartRate } from '@zos/sensor'

import * as tokens from './tokens.js'
import * as layout from './layout.js'
import * as gauge from './gauge.js'
import * as digits from './digits.js'
import * as format from './format.js'
// Namespace import, not a named one: these modules are CommonJS and
// rollup cannot statically see their named exports.
import * as scene from './scene.js'
import * as sensors from './sensors.js'

const { COLOR } = tokens
const { RECT } = layout

// scene.js cannot require these itself - zeus treats every .js under app/
// as a bundle entry, and a CommonJS entry cannot resolve relative
// requires. Assembling the bundle here, where ESM imports do resolve, is
// what keeps the build working. See the note at the top of scene.js.
//
// Destructured rather than called as `scene.createScene(...)`: rollup
// cannot statically see named exports on a CommonJS entry and warns on a
// direct member call, which on this toolchain is the prelude to a silent
// black screen. Destructuring is the access pattern the rest of this file
// already uses for the other CommonJS modules.
const { createScene } = scene
const { readHeartRate } = sensors
const SCENE_ENV = Object.assign({}, tokens, layout, gauge, digits, format)

// This is the ONLY file that touches the Zepp platform. Everything about
// what the face looks like lives in scene.js, which is pure and testable;
// this file's whole job is turning those descriptors into widgets and
// keeping the changing ones up to date.
//
// API generation matters here: this runtime has NO hmUI/hmSensor globals.
// Code written against them throws on first use and the toolchain swallows
// the error, leaving a black screen. See docs/ZEPP-API-FINDINGS.md.

const ALIGN = {
  left: hmUI.align.LEFT,
  center: hmUI.align.CENTER_H,
  right: hmUI.align.RIGHT,
}

// A sensor reading, or null if the sensor is absent or not yet reporting.
// Constructing an unsupported sensor class throws on this platform, so
// every read is guarded rather than assumed.
function read(sensor) {
  if (!sensor) return null
  try {
    const value = sensor.getCurrent()
    return typeof value === 'number' && isFinite(value) ? value : null
  } catch (e) {
    return null
  }
}

function makeSensor(Ctor) {
  if (typeof Ctor !== 'function') return null
  try {
    return new Ctor()
  } catch (e) {
    return null
  }
}

// The step goal the wearer set in the Zepp app, when the runtime exposes
// it. Absent on some firmware, so the ring falls back to GOAL.STEPS.
function readStepGoal(sensor) {
  if (!sensor || typeof sensor.getTarget !== 'function') return null
  try {
    const target = sensor.getTarget()
    return typeof target === 'number' && target > 0 ? target : null
  } catch (e) {
    return null
  }
}

WatchFace({
  build() {
    const buildScene = createScene(SCENE_ENV)
    const isAod = getScene() === SCENE_AOD
    const time = new Time()
    const battery = makeSensor(Battery)
    const step = makeSensor(Step)
    const calorie = makeSensor(Calorie)

    // Read through readHeartRate(), never with getCurrent() directly: see
    // sensors.js for why getCurrent() reads 0 all day on real hardware
    // while the simulator answers it happily. Until the sensor has a
    // reading - the optical sensor samples on its own schedule, not ours -
    // the dial stays empty and the value shows '--'. It is never filled in
    // from another metric.
    const heart = makeSensor(HeartRate)

    function collect() {
      return {
        hour: time.getHours(),
        minute: time.getMinutes(),
        weekday: time.getDay(),
        day: time.getDate(),
        battery: read(battery),
        steps: read(step),
        hr: readHeartRate(heart),
        kcal: read(calorie),
        stepGoal: readStepGoal(step),
      }
    }

    const bothScreens = hmUI.show_level.ONLY_NORMAL | hmUI.show_level.ONAL_AOD
    const normalOnly = hmUI.show_level.ONLY_NORMAL

    // In AOD only the time and date are drawn, on unlit black. Arcs and
    // metrics there would cost battery for something barely rendered.
    if (isAod) {
      hmUI.createWidget(hmUI.widget.FILL_RECT, { ...RECT.BACKGROUND, color: COLOR.BG })
    }

    // Create every widget once; remember the ones that change.
    const dynamic = {}

    for (const el of buildScene(collect())) {
      if (isAod && !el.aod) continue
      const level = el.aod ? bothScreens : normalOnly
      let widget = null

      if (el.kind === 'image') {
        widget = hmUI.createWidget(hmUI.widget.IMG, {
          x: el.x, y: el.y, w: el.w, h: el.h,
          src: el.src || '',
          show_level: level,
        })
      } else if (el.kind === 'text') {
        widget = hmUI.createWidget(hmUI.widget.TEXT, {
          x: el.x, y: el.y, w: el.w, h: el.h,
          color: el.color,
          text_size: el.size,
          align_h: ALIGN[el.align] || hmUI.align.CENTER_H,
          align_v: hmUI.align.CENTER_V,
          char_space: el.tracking || 0,
          text: el.text,
          show_level: level,
        })
      } else if (el.kind === 'rect') {
        widget = hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: el.x, y: el.y, w: el.w, h: el.h,
          color: el.color,
          show_level: level,
        })
      } else if (el.kind === 'strokeRect') {
        widget = hmUI.createWidget(hmUI.widget.STROKE_RECT, {
          x: el.x, y: el.y, w: el.w, h: el.h,
          color: el.color,
          line_width: 2,
          show_level: level,
        })
      }

      if (widget && el.key) dynamic[el.key] = widget
    }

    // Re-derive the scene and push only what changed. Rebuilding widgets
    // every tick would flicker and leak.
    function refresh() {
      for (const el of buildScene(collect())) {
        const widget = el.key && dynamic[el.key]
        if (!widget) continue

        if (el.kind === 'image') {
          // A time slot with no glyph (one-digit hour) is collapsed rather
          // than hidden: VISIBLE is not verified on this runtime, but a
          // 1x1 image with an empty source reliably draws nothing.
          widget.setProperty(hmUI.prop.MORE, {
            x: el.x, y: el.y, w: el.w, h: el.h, src: el.src || '',
          })
        } else if (el.kind === 'text') {
          widget.setProperty(hmUI.prop.TEXT, el.text)
        } else if (el.kind === 'rect') {
          widget.setProperty(hmUI.prop.MORE, {
            x: el.x, y: el.y, w: el.w, h: el.h, color: el.color,
          })
        }
      }
    }

    refresh()

    let timer = null
    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => {
        if (getScene() === SCENE_WATCHFACE) {
          refresh()
          // Metrics move slowly; the minute tick handles the clock. Not
          // clearing this on pause drains the battery.
          timer = setInterval(refresh, 30000)
        }
      },
      pause_call: () => {
        if (timer !== null) {
          clearInterval(timer)
          timer = null
        }
      },
    })

    time.onPerMinute(refresh)

    // A new heart-rate measurement lands on the sensor's schedule, not on
    // our 30-second tick, so the face asks to be told. Registered once
    // alongside the minute tick, and guarded: the event is API level 2.1
    // and this face declares 2.0, so on older firmware the subscription
    // simply is not there and the poll above covers it. Deliberately NOT
    // onCurrentChange - that one starts a continuous measurement and would
    // keep the optical sensor running down the battery.
    if (heart && typeof heart.onLastChange === 'function') {
      try {
        heart.onLastChange(refresh)
      } catch (e) {
        // Firmware without the event; the poll keeps the value fresh.
      }
    }
  },

  onInit() {},
  onDestroy() {},
})
