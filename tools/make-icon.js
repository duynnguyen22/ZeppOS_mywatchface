const fs = require('node:fs')
const path = require('node:path')
const { encodePNG } = require('./png.js')
const { COLOR } = require('../watchface/tokens.js')

const W = 192
const H = 192
const CX = 96
const CY = 96
const R = 58

function unpack(color) {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
}

const [bgR, bgG, bgB] = unpack(COLOR.BG_DEEP)
const [fgR, fgG, fgB] = unpack(COLOR.MINT)

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
    if (Math.hypot(x - CX, y - CY) <= R) {
      set(x, y, fgR, fgG, fgB)
    } else {
      set(x, y, bgR, bgG, bgB)
    }
  }
}

const outDir = path.join(__dirname, '..', 'assets', 'active-2-round', 'images')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'icon.png')
fs.writeFileSync(outPath, encodePNG(W, H, pixels))
console.log(`wrote ${outPath}`)
