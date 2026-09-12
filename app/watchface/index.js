import * as hmUI from '@zos/ui'
import { getScene, SCENE_AOD, SCENE_WATCHFACE } from '@zos/app'
import {
  Time,
  Battery,
  Step,
  HeartRate,
  Calorie,
  Distance,
  Weather,
  TIME_HOUR_FORMAT_12,
} from '@zos/sensor'

import * as tokens from './tokens.js'
import * as layout from './layout.js'
import * as fmt from './format.js'

const { COLOR, TYPE } = tokens
const { RECT, statCard, CARD_INSET, CHART } = layout
const {
  formatHour, formatMinute, meridiem, formatDate,
  formatSteps, formatBattery, formatTemp, formatHiLo,
  formatHeart, formatCalories, formatDistance,
} = fmt

const IMG = 'images/'

WatchFace({
  build() {
    const isAod = getScene() === SCENE_AOD
    const time = new Time()
    const is12h = time.getHourFormat() === TIME_HOUR_FORMAT_12

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
      const hour = time.getHours()
      const minute = time.getMinutes()
      const week = time.getDay()
      const month = time.getMonth()
      const day = time.getDate()
      // The colon rides with the hour so the pair stays optically centred.
      hourText.setProperty(hmUI.prop.TEXT, formatHour(hour, is12h) + ':')
      minuteText.setProperty(hmUI.prop.TEXT, formatMinute(minute))
      meridiemText.setProperty(hmUI.prop.TEXT, is12h ? meridiem(hour) : '')
      dateText.setProperty(hmUI.prop.TEXT, formatDate(week, month, day))
    }

    updateTime()

    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => {
        time.onPerMinute(updateTime)
        updateTime()
      },
      pause_call: () => {
        time.offPerMinute(updateTime)
      },
    })

    this.buildComplications(isAod)
  },

  buildComplications(isAod) {
    // Everything here is normal-screen only; AOD stays minimal for battery.
    if (isAod) return

    const normal = hmUI.show_level.ONLY_NORMAL

    const batterySensor = new Battery()
    const stepSensor = new Step()
    const heartSensor = new HeartRate()
    const calorieSensor = new Calorie()
    const weatherSensor = new Weather()
    const distanceSensor = new Distance()

    // Weather icon: a simple sun disc, drawn the same way as the stat-card
    // accent icons and the pill icon (a FILL_RECT with radius = half the
    // side, which renders as a circle). No sun-behind-cloud composite.
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: RECT.WEATHER_ICON.x, y: RECT.WEATHER_ICON.y,
      w: RECT.WEATHER_ICON.w, h: RECT.WEATHER_ICON.h,
      radius: RECT.WEATHER_ICON.w / 2, color: COLOR.AMBER, show_level: normal,
    })

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
      text: 'Today', show_level: normal,
    })
    const pillDetail = hmUI.createWidget(hmUI.widget.TEXT, {
      x: RECT.PILL.x + 60, y: RECT.PILL.y + 32, w: 200, h: 22,
      color: COLOR.MUTED, text_size: TYPE.PILL_DETAIL,
      align_h: hmUI.align.LEFT, align_v: hmUI.align.CENTER_V,
      text: '', show_level: normal,
    })

    const safeCurrent = (sensor) => {
      try {
        return sensor.getCurrent()
      } catch (e) {
        return null
      }
    }

    const updateData = () => {
      const battery = safeCurrent(batterySensor)
      batteryText.setProperty(hmUI.prop.TEXT, formatBattery(battery))
      batteryFill.setProperty(hmUI.prop.MORE, {
        w: Math.max(1, Math.round(((RECT.BATTERY_ICON.w - 10) * Math.max(0, Math.min(100, battery || 0))) / 100)),
      })

      let forecast = null
      try {
        forecast = weatherSensor.getForecast()
      } catch (e) {
        forecast = null
      }
      const today =
        forecast &&
        forecast.forecastData &&
        forecast.forecastData.data &&
        forecast.forecastData.data[0]

      // Verified on-device: today's forecast entry is only
      // Weather.getForecast() is the only weather API, and in the simulator
      // today's entry is { high, low, index } with no current-temperature
      // field. Real firmware may expose one under a different name, so try
      // the plausible spellings before giving up; formatTemp renders '--°'
      // when none is present rather than printing "undefined".
      const currentTemp = today
        ? (today.current !== undefined ? today.current
          : today.temp !== undefined ? today.temp
          : today.temperature)
        : undefined
      tempText.setProperty(hmUI.prop.TEXT, formatTemp(currentTemp))
      if (today) {
        hiloText.setProperty(
          hmUI.prop.TEXT,
          formatHiLo(today.high, today.low)
        )
      }

      cards[0].setProperty(hmUI.prop.TEXT, formatSteps(safeCurrent(stepSensor)))
      cards[1].setProperty(hmUI.prop.TEXT, formatHeart(safeCurrent(heartSensor)))
      cards[2].setProperty(hmUI.prop.TEXT, formatCalories(safeCurrent(calorieSensor)))

      // Unit assumption: DISTANCE.getCurrent() is assumed to be metres,
      // hence the /1000 below. This is unverified without real hardware -
      // if the on-device reading is off by 1000x, this is the line to
      // change.
      const distanceMeters = safeCurrent(distanceSensor)
      pillDetail.setProperty(
        hmUI.prop.TEXT,
        distanceMeters === null || distanceMeters === undefined
          ? '--'
          : formatDistance(distanceMeters / 1000)
      )
    }

    updateData()

    let dataTimer = null
    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => {
        if (getScene() === SCENE_WATCHFACE) {
          dataTimer = setInterval(updateData, 10000)
          updateData()
        }
      },
      pause_call: () => {
        // Not stopping this drains the battery.
        if (dataTimer !== null) {
          clearInterval(dataTimer)
          dataTimer = null
        }
      },
    })
  },

  onInit() {},
  onDestroy() {},
})
