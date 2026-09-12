// Design tokens. Pure data - no Zepp API - so this is unit testable.
//
// The palette is deliberately tiny: black, white, one cool grey, one
// accent. The implementation guideline is explicit that a second accent
// hue is a defect, not a feature, so there is no green/amber/coral here
// and nothing should add one.

const COLOR = {
  BG: 0x000000, // AMOLED black - unlit pixels
  WHITE: 0xffffff, // the time, and each metric's value
  SECONDARY: 0xa7afba, // labels, date, technical markings
  ACCENT: 0x35bfff, // the ONE accent: minute digits, arcs, icons
  CHROME: 0x252a30, // outer ring, ticks, unfilled gauge tracks
}

const TYPE = {
  TIME: 79, // height of a generated time glyph, not a font size
  DATE: 22,
  BATTERY_PCT: 26,
  METRIC_VALUE: 24,
  METRIC_UNIT: 18,
  LABEL: 13,
  TAGLINE: 13,
}

// Ring denominators. STEPS is only a fallback - the face prefers the goal
// set in the Zepp app where the runtime exposes it. Nothing reports a
// calorie goal, and stress is already a 0-100 index.
const GOAL = {
  STEPS: 10000,
  KCAL: 600,
  STRESS: 100,
}

// Shown when a sensor has no reading. Never substitute a different metric
// or a plausible-looking number: an empty dial is honest, a fake one is not.
const NO_VALUE = '--'

// Static decoration. Kept here so the words can change without touching
// layout or widget code.
const TAGLINE = {
  LEFT: ['JUST', 'A BIT', 'BETTER'],
  RIGHT: ['GOOD', 'THINGS', 'AHEAD'],
  BOTTOM: ['SMALL STEPS', 'BIG CHANGE'],
}

// Letter-spacing for the small caps, in px. The guideline calls for 2-4.
const TRACKING = 3

module.exports = { COLOR, TYPE, GOAL, NO_VALUE, TAGLINE, TRACKING }
