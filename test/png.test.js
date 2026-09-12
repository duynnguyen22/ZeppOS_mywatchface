const test = require('node:test')
const assert = require('node:assert')
const zlib = require('node:zlib')
const { encodePNG } = require('../tools/png.js')

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readChunks(png) {
  const chunks = []
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    chunks.push({ type, data })
    offset += 12 + length
  }
  return chunks
}

test('output starts with the PNG signature', () => {
  const png = encodePNG(2, 2, Buffer.alloc(2 * 2 * 4, 255))
  assert.ok(png.subarray(0, 8).equals(SIGNATURE))
})

test('chunks appear in the required order', () => {
  const png = encodePNG(4, 4, Buffer.alloc(4 * 4 * 4, 128))
  const types = readChunks(png).map((c) => c.type)
  assert.strictEqual(types[0], 'IHDR')
  assert.strictEqual(types[types.length - 1], 'IEND')
  assert.ok(types.includes('IDAT'))
})

test('IHDR records the dimensions and RGBA truecolour format', () => {
  const png = encodePNG(7, 5, Buffer.alloc(7 * 5 * 4, 0))
  const ihdr = readChunks(png).find((c) => c.type === 'IHDR')
  assert.strictEqual(ihdr.data.readUInt32BE(0), 7)
  assert.strictEqual(ihdr.data.readUInt32BE(4), 5)
  assert.strictEqual(ihdr.data[8], 8, 'bit depth must be 8')
  assert.strictEqual(ihdr.data[9], 6, 'colour type must be 6 (RGBA)')
})

test('pixel data round-trips through the encoder', () => {
  const width = 3
  const height = 2
  const pixels = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = i * 10
    pixels[i * 4 + 1] = i * 20
    pixels[i * 4 + 2] = i * 30
    pixels[i * 4 + 3] = 255
  }
  const png = encodePNG(width, height, pixels)
  const idat = readChunks(png).filter((c) => c.type === 'IDAT')
  const raw = zlib.inflateSync(Buffer.concat(idat.map((c) => c.data)))

  // Each scanline is prefixed with a filter byte.
  const stride = width * 4
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1)
    assert.strictEqual(raw[start], 0, 'filter byte must be 0 (None)')
    const line = raw.subarray(start + 1, start + 1 + stride)
    const expected = pixels.subarray(y * stride, (y + 1) * stride)
    assert.ok(line.equals(expected), `scanline ${y} mismatch`)
  }
})

test('CRC is valid for every chunk', () => {
  // Checked against Node's own zlib.crc32, not the encoder's copy, so this
  // is an independent verification. Node 22 provides it.
  assert.strictEqual(typeof zlib.crc32, 'function', 'needs Node >= 20.15')
  const png = encodePNG(4, 4, Buffer.alloc(4 * 4 * 4, 200))
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const stored = png.readUInt32BE(offset + 8 + length)
    const computed = zlib.crc32(png.subarray(offset + 4, offset + 8 + length))
    assert.strictEqual(computed >>> 0, stored >>> 0)
    offset += 12 + length
  }
})

test('rejects a pixel buffer of the wrong size', () => {
  assert.throws(() => encodePNG(4, 4, Buffer.alloc(10)))
})
