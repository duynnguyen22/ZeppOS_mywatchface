import * as tokens from './tokens.js'
import * as layout from './layout.js'
import * as fmt from './format.js'

const { COLOR, TYPE } = tokens
const { RECT } = layout
const { formatHour, formatMinute, meridiem, formatDate } = fmt

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
      hourText.setProperty(hmUI.prop.TEXT, formatHour(hour, is12h) + ':')
      minuteText.setProperty(hmUI.prop.TEXT, formatMinute(minute))
      meridiemText.setProperty(hmUI.prop.TEXT, is12h ? meridiem(hour) : '')
      dateText.setProperty(hmUI.prop.TEXT, formatDate(week, month, day))
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
