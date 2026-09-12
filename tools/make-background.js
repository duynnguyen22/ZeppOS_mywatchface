// Generates the 466x466 landscape backdrop. Deterministic and
// dependency-free - only node:zlib via ./png.js.
//
// The composition is driven by WHAT IS ACTUALLY VISIBLE. The stat cards are
// opaque and cover y 234..322, and the activity pill covers y 343..402, so
// the lower half of the face is almost entirely hidden. An earlier version
// put the horizon at y=300 with a mirrored-sun streak below it; both sat
// behind the cards and showed only as a pale smear leaking around their
// edges. The horizon now sits just above the cards, and there is no water
// reflection, because there is no visible water to reflect in.

const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')

const W = 466
const H = 466
const CX = 233
const CY = 233
const R = 233

// Just above the top edge of the stat cards (y = 234).
const HORIZON = 232

// Sun sits low and to the right, settling into the ridge line the way it
// does in the reference, rather than floating at the same height as the
// time where it competes with the digits for attention. Kept clear of the
// stat cards (which start at y = 234).
const SUN = { x: 372, y: 195, r: 19, halo: 34 }

function lerp(a, b, t) {
  return a + (b - a) * t
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// Deterministic layered silhouette. Three sine terms give a ridge that
// reads as terrain rather than a single wave.
function ridge(x, seed, amplitude, base) {
  return (
    base -
    amplitude *
      (0.6 * Math.sin(x * 0.013 + seed) +
        0.3 * Math.sin(x * 0.031 + seed * 2.1) +
        0.1 * Math.sin(x * 0.071 + seed * 3.7))
  )
}

// Far ridges are LIGHTER than near ones. That is atmospheric perspective,
// and it is what makes the layers separate instead of merging into one dark
// mass - the previous version darkened them front-to-back, which flattened
// the whole scene.
const RIDGES = [
  { seed: 1.0, amplitude: 20, base: 196, color: [0x14, 0x3c, 0x44] },
  { seed: 2.4, amplitude: 26, base: 213, color: [0x0c, 0x2b, 0x33] },
  { seed: 4.1, amplitude: 16, base: 230, color: [0x05, 0x18, 0x1e] },
]

const pixels = Buffer.alloc(W * H * 4)

function set(x, y, r, g, b) {
  const i = (y * W + x) * 4
  pixels[i] = r
  pixels[i + 1] = g
  pixels[i + 2] = b
  pixels[i + 3] = 255
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // Outside the circular face - the bezel masks this anyway.
    if (Math.hypot(x - CX, y - CY) > R) {
      set(x, y, 0, 0, 0)
      continue
    }

    let r, g, b

    if (y < HORIZON) {
      // Sky: deep at the crown, lifting toward the horizon.
      const t = clamp01(y / HORIZON)
      r = lerp(0x02, 0x0e, t)
      g = lerp(0x14, 0x3e, t)
      b = lerp(0x1a, 0x49, t)

      // Sun: a crisp disc with a tight halo, rather than a wide soft bloom.
      const d = Math.hypot(x - SUN.x, y - SUN.y)
      if (d < SUN.halo) {
        const halo = Math.pow(clamp01(1 - (d - SUN.r) / (SUN.halo - SUN.r)), 2) * 0.34
        r = lerp(r, 0xf2, halo)
        g = lerp(g, 0xd0, halo)
        b = lerp(b, 0x89, halo)
      }
      if (d < SUN.r) {
        // Solid core, with only the outermost pixel softened so the edge
        // reads as a disc and not as a gradient.
        const edge = clamp01((SUN.r - d) / 2)
        r = lerp(r, 0xf7, edge)
        g = lerp(g, 0xdd, edge)
        b = lerp(b, 0xa4, edge)
      }

      // Ridges, far to near. Drawn after the sun so the nearer ranges
      // occlude it, the way the reference has the sun settling behind them.
      for (const item of RIDGES) {
        if (y > ridge(x, item.seed, item.amplitude, item.base)) {
          r = item.color[0]
          g = item.color[1]
          b = item.color[2]
        }
      }
    } else {
      // Below the horizon is almost entirely covered by the stat cards and
      // the pill. Keep it a quiet dark gradient - anything bright here only
      // leaks around the cards' rounded corners.
      const t = clamp01((y - HORIZON) / (H - HORIZON))
      r = lerp(0x05, 0x01, t)
      g = lerp(0x16, 0x07, t)
      b = lerp(0x1c, 0x0b, t)
    }

    set(x, y, Math.round(r), Math.round(g), Math.round(b))
  }
}

const outDir = path.join(__dirname, '..', 'app', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'bg.png')
fs.writeFileSync(outPath, encodePNG(W, H, pixels))
console.log(`wrote ${outPath}`)
