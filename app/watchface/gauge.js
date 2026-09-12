// Gauge maths. Everything that fills on this face - the battery arc, the
// step and calorie rings, the dashed heart-rate dial - reduces to a ratio
// in 0..1 and then to either a sprite frame or a count of lit dashes.
// Pure - no Zepp API - so it runs under bare Node in the test suite.

// A reading as a fraction of its target, clamped to 0..1. Sensors return
// null before their first sample and targets can arrive as junk, so both
// are folded into "empty" rather than allowed to produce NaN.
function ratio(value, target) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) return 0
  if (value <= 0) return 0
  return Math.min(1, value / target)
}

// Arc fills are pre-rendered sprites; this picks the nearest one. Frame 0
// is empty, frame `count - 1` is full.
function frameIndex(r, count) {
  const clamped = Math.max(0, Math.min(1, typeof r === 'number' && Number.isFinite(r) ? r : 0))
  return Math.round(clamped * (count - 1))
}

// The middle dial is discrete, so its ratio quantises to whole segments.
function litDashes(r, count) {
  const clamped = Math.max(0, Math.min(1, typeof r === 'number' && Number.isFinite(r) ? r : 0))
  return Math.round(clamped * count)
}

// Prefer a goal read from the watch's own settings, fall back to a
// constant. Anything not a usable positive number is not a goal.
function resolveTarget(sensorGoal, fallback) {
  if (typeof sensorGoal === 'number' && Number.isFinite(sensorGoal) && sensorGoal > 0) {
    return sensorGoal
  }
  return fallback
}

module.exports = { ratio, frameIndex, litDashes, resolveTarget }
