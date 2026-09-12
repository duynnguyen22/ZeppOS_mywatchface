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
