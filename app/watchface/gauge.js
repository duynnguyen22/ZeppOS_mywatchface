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

// A reading's position within a band, clamped to 0..1. Heart rate has no
// meaningful zero - a living wearer never reads 0 bpm - so filling it from
// zero would park the dial around a third and leave it nearly motionless.
// Filling from `min` to `max` spends the dial's whole travel on the range
// real readings occupy. A band that is not a usable range reads empty
// rather than producing NaN or a division by zero.
function bandRatio(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  if (typeof min !== 'number' || !Number.isFinite(min)) return 0
  if (typeof max !== 'number' || !Number.isFinite(max)) return 0
  if (max <= min) return 0
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
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

module.exports = { ratio, bandRatio, frameIndex, litDashes, resolveTarget }
