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
  ICON: { dx: 10, dy: 8, w: 26, h: 26 },
  // VALUE.dx leaves clear separation from the icon (icon right edge sits
  // at dx 10 + w 26 = 36) instead of crowding it.
  VALUE: { dx: 44, dy: 8, w: 66, h: 26 },
  LABEL: { dx: 10, dy: 36, w: 98, h: 18 },
  CHART: { dx: 10, dy: 60, w: 98, h: 20 },
}

const CHART = { bars: 9, barW: 8, gap: 3 }

module.exports = {
  SCREEN, CENTER, RADIUS, polar, fitsOnFace,
  RECT, statCard, CARD, CARD_INSET, CHART,
}
