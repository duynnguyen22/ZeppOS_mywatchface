// The time is drawn as individual glyph images rather than a text widget,
// so the face does its own kerning. Widths are per-glyph because the "1"
// is far narrower than the other digits - 24px against 78px in the
// reference - and a fixed advance would leave a hole beside it.
// Pure - no Zepp API - so it runs under bare Node in the test suite.

function glyphWidth(char, widths) {
  const w = widths[char]
  if (typeof w !== 'number') {
    throw new Error(`no glyph width for ${JSON.stringify(char)}`)
  }
  return w
}

// Total width of a run: every glyph, plus one gap between each pair.
function runWidth(chars, widths, gap) {
  if (chars.length === 0) return 0
  let total = (chars.length - 1) * gap
  for (const char of chars) total += glyphWidth(char, widths)
  return total
}

// Place a run so its centre lands on `centreX`. Centring (rather than
// left-aligning) is what keeps a one-digit hour from shoving the whole
// clock sideways.
function centreRun(chars, widths, gap, centreX) {
  let x = centreX - runWidth(chars, widths, gap) / 2
  const placed = []
  for (const char of chars) {
    placed.push({ char, x })
    x += glyphWidth(char, widths) + gap
  }
  return placed
}

module.exports = { glyphWidth, runWidth, centreRun }
