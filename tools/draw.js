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

// `angle` (radians, clockwise on screen) tilts the ellipse about its centre.
// Membership is tested by rotating the sample point back into the ellipse's
// own frame rather than rotating the ellipse - same result, no resampling.
function fillEllipse(canvas, cx, cy, rx, ry, color, alpha, angle = 0) {
  const { r: cr, g: cg, b: cb, a: ca } = toRGBA(color, alpha)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  // Half-extents of the rotated ellipse's axis-aligned bounding box.
  const exX = Math.hypot(rx * cos, ry * sin)
  const exY = Math.hypot(rx * sin, ry * cos)
  const x0 = Math.max(0, Math.floor(cx - exX))
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + exX))
  const y0 = Math.max(0, Math.floor(cy - exY))
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + exY))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const nx = (dx * cos + dy * sin) / rx
      const ny = (-dx * sin + dy * cos) / ry
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

// A closed outline whose edges may curve. Each point is {x, y} plus an
// optional {cx, cy} control handle describing the quadratic curve ARRIVING
// at that point from the previous one; a point with no handle is joined by
// a straight line. The path always closes, so the first point's handle (if
// any) shapes the final segment back from the last point.
//
// Curves are flattened into a dense polygon and handed to fillPoly, so
// curved and straight outlines rasterise through exactly one code path.
function samplePath(points) {
  const out = []
  for (let i = 0; i < points.length; i++) {
    const from = points[(i - 1 + points.length) % points.length]
    const to = points[i]
    if (to.cx === undefined || to.cy === undefined) {
      out.push([to.x, to.y])
      continue
    }
    // Step count from the control-polygon length: long curves get more
    // segments, short ones don't waste them.
    const span =
      Math.hypot(to.cx - from.x, to.cy - from.y) + Math.hypot(to.x - to.cx, to.y - to.cy)
    const steps = Math.max(8, Math.min(64, Math.ceil(span / 2)))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const mt = 1 - t
      out.push([
        mt * mt * from.x + 2 * mt * t * to.cx + t * t * to.x,
        mt * mt * from.y + 2 * mt * t * to.cy + t * t * to.y,
      ])
    }
  }
  return out
}

function fillPath(canvas, points, color, alpha) {
  fillPoly(canvas, samplePath(points), color, alpha)
}

// An arc is a ring band: filled between rInner and rOuter, swept CLOCKWISE
// from startDeg to endDeg. Angles are degrees clockwise from 12 o'clock -
// the same convention layout.polar() uses, so the generator and the layout
// table speak one coordinate language.
//
// `roundCaps` adds a disc at each end, centred on the band's midline. The
// design's gauges have rounded ends; the decorative ticks do not.
function fillArc(canvas, cx, cy, rInner, rOuter, startDeg, endDeg, color, alpha, roundCaps) {
  const { r, g, b, a } = toRGBA(color, alpha)
  const span = ((endDeg - startDeg) % 360 + 360) % 360
  if (span === 0) return
  const x0 = Math.max(0, Math.floor(cx - rOuter))
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + rOuter))
  const y0 = Math.max(0, Math.floor(cy - rOuter))
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + rOuter))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const dist = Math.hypot(dx, dy)
      if (dist < rInner || dist > rOuter) continue
      // atan2 measures from 3 o'clock counter-clockwise-positive-down here;
      // +90 rotates the origin to 12 o'clock.
      const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360
      const offset = ((deg - startDeg) % 360 + 360) % 360
      if (offset <= span) canvas.set(x, y, r, g, b, a)
    }
  }
  if (!roundCaps) return
  const mid = (rInner + rOuter) / 2
  const capR = (rOuter - rInner) / 2
  for (const deg of [startDeg, endDeg]) {
    const rad = ((deg - 90) * Math.PI) / 180
    fillCircle(canvas, cx + mid * Math.cos(rad), cy + mid * Math.sin(rad), capR, color, alpha)
  }
}

// Separable box blur, premultiplied so transparent pixels contribute no
// colour. Used to build the bloom around the bright elements: blur a copy
// of a shape, composite it under the crisp original.
function boxBlur(canvas, radius) {
  if (radius <= 0) return canvas
  const { width: w, height: h } = canvas
  const pass = (src) => {
    const out = new Float64Array(src.length)
    // Horizontal.
    const tmp = new Float64Array(src.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rs = 0, gs = 0, bs = 0, as = 0, n = 0
        for (let k = -radius; k <= radius; k++) {
          const sx = x + k
          if (sx < 0 || sx >= w) continue
          const i = (y * w + sx) * 4
          const al = src[i + 3] / 255
          rs += src[i] * al; gs += src[i + 1] * al; bs += src[i + 2] * al; as += al
          n++
        }
        const o = (y * w + x) * 4
        tmp[o] = rs / n; tmp[o + 1] = gs / n; tmp[o + 2] = bs / n; tmp[o + 3] = as / n
      }
    }
    // Vertical, over the premultiplied intermediate.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rs = 0, gs = 0, bs = 0, as = 0, n = 0
        for (let k = -radius; k <= radius; k++) {
          const sy = y + k
          if (sy < 0 || sy >= h) continue
          const i = (sy * w + x) * 4
          rs += tmp[i]; gs += tmp[i + 1]; bs += tmp[i + 2]; as += tmp[i + 3]
          n++
        }
        const o = (y * w + x) * 4
        out[o] = rs / n; out[o + 1] = gs / n; out[o + 2] = bs / n; out[o + 3] = as / n
      }
    }
    return out
  }
  const blurred = pass(canvas.data)
  const result = new Canvas(w, h)
  for (let i = 0; i < blurred.length; i += 4) {
    const al = blurred[i + 3]
    // Un-premultiply back to plain RGBA.
    if (al > 0) {
      result.data[i] = blurred[i] / al
      result.data[i + 1] = blurred[i + 1] / al
      result.data[i + 2] = blurred[i + 2] / al
    }
    result.data[i + 3] = al * 255
  }
  return result
}

// Lay `src` over `dst`, scaling the source alpha by `strength` (0..1).
function compositeOver(dst, src, strength = 1) {
  for (let y = 0; y < dst.height; y++) {
    for (let x = 0; x < dst.width; x++) {
      const i = (y * src.width + x) * 4
      const a = src.data[i + 3] * strength
      if (a <= 0) continue
      dst.set(x, y, src.data[i], src.data[i + 1], src.data[i + 2], a)
    }
  }
}

// A rectangle with rounded corners. `r` is clamped so it can never exceed
// half the shorter side, which keeps a "pill" from inverting.
function fillRoundRect(canvas, x, y, w, h, r, color, alpha) {
  const { r: cr, g: cg, b: cb, a: ca } = toRGBA(color, alpha)
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  const x0 = Math.max(0, Math.floor(x))
  const x1 = Math.min(canvas.width - 1, Math.ceil(x + w))
  const y0 = Math.max(0, Math.floor(y))
  const y1 = Math.min(canvas.height - 1, Math.ceil(y + h))
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      if (insideRoundRect(px + 0.5, py + 0.5, x, y, w, h, rad)) {
        canvas.set(px, py, cr, cg, cb, ca)
      }
    }
  }
}

function insideRoundRect(px, py, x, y, w, h, rad) {
  if (px < x || py < y || px > x + w || py > y + h) return false
  // Clamp the point into the inner rectangle; outside a corner box the
  // clamped point IS the point, so the distance test only bites in corners.
  const cx = Math.min(Math.max(px, x + rad), x + w - rad)
  const cy = Math.min(Math.max(py, y + rad), y + h - rad)
  return Math.hypot(px - cx, py - cy) <= rad
}

// Punch a rounded-rect hole straight back to fully transparent. The digit
// counters need this: source-over can only add, so a "hole" drawn in the
// background colour would still be opaque and would show as a black patch
// wherever the glyph is composited onto something else.
function eraseRoundRect(canvas, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  const x0 = Math.max(0, Math.floor(x))
  const x1 = Math.min(canvas.width - 1, Math.ceil(x + w))
  const y0 = Math.max(0, Math.floor(y))
  const y1 = Math.min(canvas.height - 1, Math.ceil(y + h))
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      if (!insideRoundRect(px + 0.5, py + 0.5, x, y, w, h, rad)) continue
      const i = (py * canvas.width + px) * 4
      canvas.data[i] = 0
      canvas.data[i + 1] = 0
      canvas.data[i + 2] = 0
      canvas.data[i + 3] = 0
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
  samplePath,
  fillPath,
  fillArc,
  boxBlur,
  compositeOver,
  fillRoundRect,
  eraseRoundRect,
  insideRoundRect,
  pointInPolygon,
  downsample,
  renderSupersampled,
}
