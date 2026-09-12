// Generates the time's glyph set: 0-9 and the colon, in the squared,
// heavily-rounded style of reference.png. Zepp text widgets can only use
// the system font, so the hero element of this face is drawn as artwork
// and placed as images.
//
// Metrics are measured, not invented (see docs): cap height 79, stroke
// 11.5, standard advance width 77 - except "0" which is wider at 89 and
// "1" which is a bare stem at 23.
//
// Each glyph is built from rounded-rect rings: fill the outer shape, punch
// the counter out of the middle, then cut away whatever the digit leaves
// open. That is why draw.js needs a real erase.

const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')
const {
  Canvas, renderSupersampled, fillRoundRect, eraseRoundRect, fillCircle,
  fillPoly, boxBlur, compositeOver,
} = require('./draw.js')
const { COLOR } = require('../app/watchface/tokens.js')

const H = 79 // cap height
const S = 11.5 // stroke weight
const R = 26 // outer corner radius
const RI = 13 // counter corner radius
const SCALE = 4 // supersampling factor
// Deliberately restrained. The guideline's test is that the face still
// looks premium with the glow removed entirely, so this is a hint of
// bloom, not a neon halo.
const GLOW_RADIUS = 4
const GLOW_STRENGTH = 0.16

// Per-glyph advance widths.
const WIDTH = {
  '0': 89, '1': 23, '2': 77, '3': 77, '4': 77,
  '5': 77, '6': 77, '7': 77, '8': 77, '9': 77,
  ':': 9,
}

// Shared skeleton. A bowl is 45 tall, so the top bowl (0..45) and the
// bottom bowl (34..79) overlap by exactly one stroke - that shared band is
// the waist of an 8 or a 3.
const W = 77 // standard advance
const HB = 45 // bowl height
const BOT = H - HB // top of the lower bowl

// Each entry draws into a pen whose coordinates are the glyph's own box.
// `ring` is a closed rounded-rect outline; `bar` a square-cornered slab;
// `cut` erases; `stroke` is a thick straight line with flat ends.
const GLYPH = {
  '0': (p, w) => {
    p.ring(0, 0, w, H, R)
  },
  '1': (p, w) => {
    p.bar(w - S, 0, S, H)
    // A polygon here collapses: measured perpendicular to a steep diagonal
    // its thickness is a fraction of its vertical extent. stroke() sets the
    // weight perpendicular to the run, which is what the flag needs.
    p.stroke(w - S / 2, S * 0.45, 0.5, S * 2.1, S * 0.92)
  },
  '2': (p) => {
    p.ring(0, 0, W, HB, R)
    p.cutR(-2 * S, S * 0.75, 3 * S, HB, S * 0.9) // scoop the left flank away
    p.cut(0, HB - S, W - S, S) // drop the bowl's floor, keep the right stem
    p.stroke(W - S / 2, HB - S * 1.2, S / 2 + 2, H - S, S)
    p.bar(0, H - S, W, S)
  },
  '3': (p) => {
    p.ring(0, 0, W, HB, R)
    p.ring(0, BOT, W, HB, R)
    // One scoop through both bowls: a 3 is open down its whole left side
    // apart from the top and bottom shoulders.
    p.cutR(-2 * S, S * 0.75, 3 * S, H - 2 * S * 0.75, S * 0.9)
  },
  '4': (p) => {
    p.bar(W - S * 2.3, 0, S, H)
    p.bar(0, HB - S, W, S)
    p.poly([[W - S * 2.3, 0], [W - S * 2.3, S * 1.1], [S * 1.2, HB - S], [0, HB - S]])
  },
  '5': (p) => {
    p.ring(0, BOT, W, HB, R)
    p.cutR(-2 * S, BOT + S * 0.75, 3 * S, HB, S * 0.9) // open the lower left
    p.bar(0, 0, W, S) // top bar
    p.bar(0, 0, S, HB - S * 0.5) // upper-left flank
  },
  '6': (p) => {
    p.ring(0, BOT, W, HB, R)
    p.bar(0, R, S, BOT) // left flank rising to the top curve
    p.arcCorner(0, 0, W, HB, R, 'tl') // the top bar and its left curve
  },
  '7': (p) => {
    p.bar(0, 0, W, S)
    p.poly([[W - S, S], [W, S], [S * 1.5, H], [0, H]])
  },
  '8': (p) => {
    p.ring(0, 0, W, HB, R)
    p.ring(0, BOT, W, HB, R)
  },
  '9': (p) => {
    p.ring(0, 0, W, HB, R)
    p.bar(W - S, HB - S, S, H - HB) // right flank falling to the base
    p.arcCorner(0, BOT, W, HB, R, 'br') // the base and its right curve
  },
  ':': (p, w) => {
    p.bar(0, H * 0.31, w, w)
    p.bar(0, H * 0.65, w, w)
  },
}

// A vertical gradient between two packed colours, sampled at `t` in 0..1.
function ramp(top, bottom, t) {
  const mix = (a, b) => Math.round(a + (b - a) * t)
  return {
    r: mix((top >> 16) & 255, (bottom >> 16) & 255),
    g: mix((top >> 8) & 255, (bottom >> 8) & 255),
    b: mix(top & 255, bottom & 255),
    a: 255,
  }
}

// Render one glyph as an RGBA buffer: the shape in a vertical gradient,
// with its own blurred copy composited underneath as the bloom.
function renderGlyph(char, topColor, bottomColor) {
  const w = WIDTH[char]
  const draw = GLYPH[char]
  if (!draw) throw new Error(`no outline for glyph ${JSON.stringify(char)}`)

  const shape = renderSupersampled(w, H, SCALE, (big, s) => {
    const pen = {
      rr: (x, y, rw, rh, r) => fillRoundRect(big, x * s, y * s, rw * s, rh * s, r * s, 0xffffff),
      bar: (x, y, rw, rh) => fillRoundRect(big, x * s, y * s, rw * s, rh * s, 0, 0xffffff),
      cut: (x, y, rw, rh) => eraseRoundRect(big, x * s, y * s, rw * s, rh * s, 0),
      // A rounded erase. A square cut across a rounded ring leaves a
      // hanging sliver where the cut edge crosses the corner arc; rounding
      // the cut's own corner scoops that away cleanly instead.
      cutR: (x, y, rw, rh, r) => eraseRoundRect(big, x * s, y * s, rw * s, rh * s, r * s),
      poly: (pts) => fillPoly(big, pts.map(([x, y]) => [x * s, y * s]), 0xffffff),
      // A closed rounded-rect outline of stroke weight S.
      ring: (x, y, rw, rh, r) => {
        fillRoundRect(big, x * s, y * s, rw * s, rh * s, r * s, 0xffffff)
        eraseRoundRect(
          big, (x + S) * s, (y + S) * s, (rw - 2 * S) * s, (rh - 2 * S) * s,
          Math.max(r - S, 4) * s
        )
      },
      // A thick straight line with flat ends - the diagonal of a 2 or 7.
      stroke: (x1, y1, x2, y2, t) => {
        const dx = x2 - x1
        const dy = y2 - y1
        const len = Math.hypot(dx, dy) || 1
        const nx = (-dy / len) * (t / 2)
        const ny = (dx / len) * (t / 2)
        fillPoly(
          big,
          [
            [(x1 + nx) * s, (y1 + ny) * s],
            [(x2 + nx) * s, (y2 + ny) * s],
            [(x2 - nx) * s, (y2 - ny) * s],
            [(x1 - nx) * s, (y1 - ny) * s],
          ],
          0xffffff
        )
      },
      // One corner of a ring plus the two bars meeting at it: the top of a
      // 6, the base of a 9. `which` is 'tl' or 'br'.
      arcCorner: (x, y, rw, rh, r, which) => {
        const scratch = new Canvas(big.width, big.height)
        fillRoundRect(scratch, x * s, y * s, rw * s, rh * s, r * s, 0xffffff)
        eraseRoundRect(
          scratch, (x + S) * s, (y + S) * s, (rw - 2 * S) * s, (rh - 2 * S) * s,
          Math.max(r - S, 4) * s
        )
        // Keep only the half that contains the wanted corner.
        if (which === 'tl') {
          eraseRoundRect(scratch, x * s, (y + S) * s, rw * s, rh * s, 0)
          eraseRoundRect(scratch, (x + rw * 0.62) * s, y * s, rw * s, rh * s, 0)
        } else {
          eraseRoundRect(scratch, x * s, y * s, rw * s, (rh - S) * s, 0)
          eraseRoundRect(scratch, x * s, y * s, rw * 0.38 * s, rh * s, 0)
        }
        compositeOver(big, scratch, 1)
      },
    }
    draw(pen, w)
  })

  // Tint the mask with the vertical gradient.
  const tinted = new Canvas(w, H)
  for (let y = 0; y < H; y++) {
    const c = ramp(topColor, bottomColor, y / (H - 1))
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = shape.data[i + 3]
      if (a <= 0) continue
      tinted.data[i] = c.r
      tinted.data[i + 1] = c.g
      tinted.data[i + 2] = c.b
      tinted.data[i + 3] = a
    }
  }

  // Bloom: the same shape, blurred, laid underneath.
  const out = new Canvas(w, H)
  compositeOver(out, boxBlur(tinted, GLOW_RADIUS), GLOW_STRENGTH)
  compositeOver(out, tinted, 1)
  return { w, buffer: out.toBuffer() }
}

// Two tone only: a white hour and an accent minute, per the guideline's
// "the 10 can remain white while 28 uses the accent colour". Flat fills -
// the reference's subtle vertical gradient is a second colour by another
// name, and the palette rule says one accent.
const VARIANTS = [
  { suffix: 'w', top: COLOR.WHITE, bottom: COLOR.WHITE }, // hour
  { suffix: 'b', top: COLOR.ACCENT, bottom: COLOR.ACCENT }, // minute
]

const outDir = path.join(__dirname, '..', 'app', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })

let count = 0
for (const v of VARIANTS) {
  for (const char of Object.keys(GLYPH)) {
    const name = char === ':' ? 'colon' : char
    const { w, buffer } = renderGlyph(char, v.top, v.bottom)
    fs.writeFileSync(path.join(outDir, `d${v.suffix}-${name}.png`), encodePNG(w, H, buffer))
    count++
  }
}
console.log(`wrote ${count} glyph PNGs to ${outDir}`)
console.log('widths:', JSON.stringify(WIDTH))
