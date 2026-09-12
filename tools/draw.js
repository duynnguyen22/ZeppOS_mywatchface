// Tiny pixel-drawing helper for generating icon PNGs deterministically,
// with no image library. Shapes are rasterised with plain membership
// tests - smooth edges come from supersampling (render at N x the target
// size, then box-downsample), not from per-shape anti-aliasing.

// Accepts either a packed 0xRRGGBB integer or an {r,g,b,a} object and
// normalises to {r,g,b,a}. `alpha` (0-255) overrides a missing/omitted a.
function toRGBA(color, alpha) {
  if (typeof color === 'number') {
    return {
      r: (color >> 16) & 0xff,
      g: (color >> 8) & 0xff,
      b: color & 0xff,
      a: alpha === undefined ? 255 : alpha,
    }
  }
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: color.a === undefined ? (alpha === undefined ? 255 : alpha) : color.a,
  }
}

class Canvas {
  constructor(width, height) {
    this.width = width
    this.height = height
    // Plain (non-premultiplied) RGBA kept as floats for compositing
    // precision; read out via toBuffer().
    this.data = new Float64Array(width * height * 4)
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  // Alpha-composite a source colour "over" the existing pixel (source-over).
  set(x, y, r, g, b, a) {
    x = Math.floor(x)
    y = Math.floor(y)
    if (!this.inBounds(x, y) || a <= 0) return
    const i = (y * this.width + x) * 4
    const srcA = a / 255
    if (srcA >= 1) {
      this.data[i] = r
      this.data[i + 1] = g
      this.data[i + 2] = b
      this.data[i + 3] = 255
      return
    }
    const dstA = this.data[i + 3] / 255
    const outA = srcA + dstA * (1 - srcA)
    if (outA <= 0) {
      this.data[i] = 0
      this.data[i + 1] = 0
      this.data[i + 2] = 0
      this.data[i + 3] = 0
      return
    }
    this.data[i] = (r * srcA + this.data[i] * dstA * (1 - srcA)) / outA
    this.data[i + 1] = (g * srcA + this.data[i + 1] * dstA * (1 - srcA)) / outA
    this.data[i + 2] = (b * srcA + this.data[i + 2] * dstA * (1 - srcA)) / outA
    this.data[i + 3] = outA * 255
  }

  getPixel(x, y) {
    const i = (y * this.width + x) * 4
    return {
      r: Math.round(this.data[i]),
      g: Math.round(this.data[i + 1]),
      b: Math.round(this.data[i + 2]),
      a: Math.round(this.data[i + 3]),
    }
  }

  toBuffer() {
    const buf = Buffer.alloc(this.width * this.height * 4)
    for (let i = 0; i < this.data.length; i++) {
      buf[i] = Math.max(0, Math.min(255, Math.round(this.data[i])))
    }
    return buf
  }
}

function fillCircle(canvas, cx, cy, r, color, alpha) {
  const { r: cr, g: cg, b: cb, a: ca } = toRGBA(color, alpha)
  const x0 = Math.max(0, Math.floor(cx - r))
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + r))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) {
        canvas.set(x, y, cr, cg, cb, ca)
      }
    }
  }
}

function fillEllipse(canvas, cx, cy, rx, ry, color, alpha) {
  const { r: cr, g: cg, b: cb, a: ca } = toRGBA(color, alpha)
  const x0 = Math.max(0, Math.floor(cx - rx))
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + rx))
  const y0 = Math.max(0, Math.floor(cy - ry))
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + ry))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry
      if (nx * nx + ny * ny <= 1) {
        canvas.set(x, y, cr, cg, cb, ca)
      }
    }
  }
}

// A thick line with round caps - the building block for limbs and strokes.
function fillCapsule(canvas, x1, y1, x2, y2, thickness, color, alpha) {
  const { r, g, b, a } = toRGBA(color, alpha)
  const rad = thickness / 2
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - rad))
  const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(x1, x2) + rad))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - rad))
  const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(y1, y2) + rad))
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
      t = Math.max(0, Math.min(1, t))
      const nx = x1 + t * dx
      const ny = y1 + t * dy
      if (Math.hypot(px - nx, py - ny) <= rad) {
        canvas.set(x, y, r, g, b, a)
      }
    }
  }
}

function pointInPolygon(px, py, points) {
  // Even-odd rule.
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    const crosses =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function fillPoly(canvas, points, color, alpha) {
  const { r, g, b, a } = toRGBA(color, alpha)
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.max(0, Math.floor(Math.min(...xs)))
  const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(...xs)))
  const minY = Math.max(0, Math.floor(Math.min(...ys)))
  const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...ys)))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) {
        canvas.set(x, y, r, g, b, a)
      }
    }
  }
}

// Box-downsample a canvas by an integer factor, premultiplying by alpha
// before averaging so edge pixels next to fully-transparent ones don't
// pick up leftover colour from the "outside".
function downsample(canvas, factor) {
  if (canvas.width % factor !== 0 || canvas.height % factor !== 0) {
    throw new Error('canvas dimensions must be divisible by the downsample factor')
  }
  const outW = canvas.width / factor
  const outH = canvas.height / factor
  const out = new Canvas(outW, outH)
  const area = factor * factor
  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      let rSum = 0
      let gSum = 0
      let bSum = 0
      let aSum = 0
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const sx = ox * factor + dx
          const sy = oy * factor + dy
          const i = (sy * canvas.width + sx) * 4
          const a = canvas.data[i + 3] / 255
          rSum += canvas.data[i] * a
          gSum += canvas.data[i + 1] * a
          bSum += canvas.data[i + 2] * a
          aSum += a
        }
      }
      const outA = aSum / area
      const oi = (oy * outW + ox) * 4
      if (aSum > 0) {
        out.data[oi] = rSum / aSum
        out.data[oi + 1] = gSum / aSum
        out.data[oi + 2] = bSum / aSum
      }
      out.data[oi + 3] = outA * 255
    }
  }
  return out
}

// Render at `width*scale` x `height*scale` via `draw(canvas, scale)`, then
// box-downsample back to width x height. This is the one knob that matters
// for quality: without it, circle and capsule edges look jagged at icon
// sizes as small as 44px.
function renderSupersampled(width, height, scale, draw) {
  const big = new Canvas(width * scale, height * scale)
  draw(big, scale)
  return downsample(big, scale)
}

module.exports = {
  Canvas,
  toRGBA,
  fillCircle,
  fillEllipse,
  fillCapsule,
  fillPoly,
  pointInPolygon,
  downsample,
  renderSupersampled,
}
