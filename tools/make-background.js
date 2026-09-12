const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')

const W = 466
const H = 466
const CX = 233
const CY = 233
const R = 233
const HORIZON = 300

function lerp(a, b, t) {
  return a + (b - a) * t
}

function ridge(x, seed, amplitude, base) {
  return (
    base -
    amplitude *
      (0.6 * Math.sin(x * 0.013 + seed) +
        0.3 * Math.sin(x * 0.031 + seed * 2.1) +
        0.1 * Math.sin(x * 0.071 + seed * 3.7))
  )
}

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
    if (Math.hypot(x - CX, y - CY) > R) {
      set(x, y, 0, 0, 0)
      continue
    }

    let r, g, b

    if (y < HORIZON) {
      const t = y / HORIZON
      r = lerp(0x02, 0x0a, t)
      g = lerp(0x18, 0x30, t)
      b = lerp(0x1c, 0x38, t)

      // Sun disc.
      const sun = Math.hypot(x - 352, y - 236)
      if (sun < 30) {
        const glow = 1 - sun / 30
        r = lerp(r, 0xf0, glow)
        g = lerp(g, 0xc9, glow)
        b = lerp(b, 0x87, glow)
      }

      // Mountain ridges, far to near.
      const ridges = [
        { y: ridge(x, 1.0, 26, 252), c: [0x0b, 0x2a, 0x30] },
        { y: ridge(x, 2.4, 34, 272), c: [0x07, 0x1f, 0x25] },
        { y: ridge(x, 4.1, 22, 292), c: [0x04, 0x14, 0x19] },
      ]
      for (const item of ridges) {
        if (y > item.y) {
          r = item.c[0]
          g = item.c[1]
          b = item.c[2]
        }
      }
    } else {
      // Water: darker, with a mirrored sun streak.
      const t = (y - HORIZON) / (H - HORIZON)
      r = lerp(0x05, 0x02, t)
      g = lerp(0x1a, 0x0c, t)
      b = lerp(0x20, 0x10, t)

      const streak = Math.abs(x - 352)
      if (streak < 26) {
        const glow = (1 - streak / 26) * (1 - t) * 0.5
        r = lerp(r, 0xf0, glow)
        g = lerp(g, 0xc9, glow)
        b = lerp(b, 0x87, glow)
      }
    }

    set(x, y, Math.round(r), Math.round(g), Math.round(b))
  }
}

const outDir = path.join(__dirname, '..', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'bg.png')
fs.writeFileSync(outPath, encodePNG(W, H, pixels))
console.log(`wrote ${outPath}`)
