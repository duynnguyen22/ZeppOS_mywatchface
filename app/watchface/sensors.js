// Sensor reading policy. Pure - it takes a duck-typed sensor object and
// never imports @zos - so the rules below are unit testable under bare
// Node, which is the only place they can be checked before a device
// install. Requires nothing, so it survives zeus treating it as its own
// bundle entry (see the note at the top of scene.js).

// The methods are called defensively: an unsupported call throws on this
// platform, and an uncaught throw inside build() is swallowed by the
// toolchain, leaving a black face rather than an error.
function callNumber(sensor, method) {
  if (!sensor || typeof sensor[method] !== 'function') return null
  try {
    const value = sensor[method]()
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  } catch (e) {
    return null
  }
}

// Heart rate, or null when the sensor has nothing to report.
//
// getLast() and NOT getCurrent(): the platform documents getCurrent() as
// "needs to be used in the onCurrentChange callback function" - it reports
// a continuous measurement in progress, which a watch face never starts,
// so on real hardware it reads 0 all day. getLast() is the most recent
// single or background-monitoring measurement, which is what a face wants.
// The simulator does not model the difference and answers both from its
// sensor panel, which is how a getCurrent() face passed development.
//
// getCurrent() is still worth a look as a fallback: on the watch a
// non-zero value there means a measurement genuinely is running, and it
// keeps the simulator - which populates only getCurrent() - usable.
//
// A reading of 0 is treated as no reading. A living wearer never reads
// 0 bpm, so that value only ever means "the sensor has nothing", and the
// face shows '--' with an empty dial rather than a fake zero.
function readHeartRate(sensor) {
  const last = callNumber(sensor, 'getLast')
  if (last !== null && last > 0) return last

  const current = callNumber(sensor, 'getCurrent')
  if (current !== null && current > 0) return current

  return null
}

module.exports = { callNumber, readHeartRate }
