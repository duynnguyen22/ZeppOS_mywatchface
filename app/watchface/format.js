// Display string formatting. Pure - no Zepp API - so it is unit testable.

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

// Shown when a sensor has no reading. Never substitute a plausible-looking
// number: a dash is honest, a guess is not.
const NO_VALUE = '--'

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

// "SAT · 12" - weekday and day of month, nothing else. `week` is 1-7
// starting Monday, matching the platform's Time.getDay().
function formatDate(week, day) {
  const name = WEEKDAYS[week - 1]
  if (!name) return NO_VALUE
  return `${name} · ${day}`
}

// Thousands-separated, because "8,421" is the reference and a bare 8421
// reads slower at a glance.
function formatSteps(steps) {
  if (!Number.isFinite(steps)) return NO_VALUE
  return String(Math.max(0, Math.round(steps))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatBattery(percent) {
  if (!Number.isFinite(percent)) return `${NO_VALUE}%`
  return `${Math.max(0, Math.min(100, Math.round(percent)))}%`
}

// Any plain whole-number readout: calories, heart rate in bpm.
function formatMetric(value) {
  if (!Number.isFinite(value)) return NO_VALUE
  return String(Math.max(0, Math.round(value)))
}

module.exports = {
  WEEKDAYS, NO_VALUE, pad2, formatHour, formatMinute, formatDate,
  formatSteps, formatBattery, formatMetric,
}
