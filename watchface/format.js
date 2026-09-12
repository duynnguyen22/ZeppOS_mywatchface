// Display string formatting. Pure - no Zepp API - so it is unit testable.

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatHour(hour, is12h) {
  if (is12h) return String(hour % 12 === 0 ? 12 : hour % 12)
  return pad2(hour)
}

function formatMinute(minute) {
  return pad2(minute)
}

function meridiem(hour) {
  return hour < 12 ? 'AM' : 'PM'
}

// `week` is 1-7 starting Monday, matching hmSensor TIME.
function formatDate(week, month, day) {
  return `${WEEKDAYS[week - 1]}, ${MONTHS[month - 1]} ${day}`
}

function formatSteps(steps) {
  const value = Number(steps) || 0
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatBattery(percent) {
  return `${Math.max(0, Math.min(100, Number(percent) || 0))}%`
}

function formatTemp(celsius) {
  if (celsius === null || celsius === undefined) return '--°'
  return `${celsius}°`
}

function formatHiLo(high, low) {
  return `H:${high}° L:${low}°`
}

function formatHeart(bpm) {
  return bpm ? String(bpm) : '--'
}

function formatCalories(kcal) {
  return String(Math.round(Number(kcal) || 0))
}

function formatDistance(km) {
  return `${(Number(km) || 0).toFixed(1)} km`
}

function formatDuration(minutes) {
  const total = Number(minutes) || 0
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)}h ${pad2(total % 60)}min`
}

module.exports = {
  pad2, formatHour, formatMinute, meridiem, formatDate,
  formatSteps, formatBattery, formatTemp, formatHiLo,
  formatHeart, formatCalories, formatDistance, formatDuration,
}
