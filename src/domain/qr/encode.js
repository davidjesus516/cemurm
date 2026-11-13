// QR Code encoder — byte mode, EC level L, versions 1–5, no dependencies.
//
// Requirement source: features/export-and-sharing.feature:73-80 (a QR code
// that encodes a public setlist link) and :93-101 (a proximity code displayed
// as a QR). This module produces the symbol only; the routes those scenarios
// open are the T3 audience view.
//
// Why hand-rolled: the repo adds no dependency for a single surface, and a QR
// symbol for a URL is a bounded, spec-defined job. The scope is the smallest
// that covers a setlist link:
//   · byte mode — a URL is mixed case, so numeric/alphanumeric modes do not apply;
//   · EC level L, one Reed–Solomon block — versions 1–5 at level L are all a
//     single block, so there is no interleaving to get wrong;
//   · versions 1–5 (21–37 modules), which holds 105 bytes. A longer value
//     throws instead of truncating: a symbol that silently drops characters is
//     worse than no symbol.
// Levels M/Q/H and multi-block interleaving are the next step if a longer
// payload is ever needed.
//
// ISO/IEC 18004 pieces used below: the version/EC table (Table 9), Reed–Solomon
// over GF(256) with 0x11d, the 15-bit BCH format information (generator 0x537,
// mask 0x5412), the eight data masks and the four penalty rules.

/** EC level indicator for the format information: L = 01. */
export const EC_LEVEL_L = 1

/** Version table for level L: one block per version. */
const SPECS = [
  { version: 1, total: 26, ec: 7, data: 19 },
  { version: 2, total: 44, ec: 10, data: 34 },
  { version: 3, total: 70, ec: 15, data: 55 },
  { version: 4, total: 100, ec: 20, data: 80 },
  { version: 5, total: 134, ec: 26, data: 108 },
]

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

function initGaloisField() {
  let value = 1
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = value
    GF_LOG[value] = i
    value <<= 1
    if (value & 0x100) value ^= 0x11d
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255]
}
initGaloisField()

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function gfMul(a, b) {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

/**
 * Generator polynomial of degree `ecLength`, coefficients highest degree
 * first. Its roots are α^0 … α^(ecLength-1).
 * @param {number} ecLength
 * @returns {number[]}
 */
function generator(ecLength) {
  let poly = [1]
  for (let i = 0; i < ecLength; i += 1) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i])
    }
    poly = next
  }
  return poly
}

/**
 * The `ecLength` error-correction codewords for one block.
 * @param {number[] | Uint8Array} data
 * @param {number} ecLength
 * @returns {Uint8Array}
 */
function reedSolomon(data, ecLength) {
  const divisor = generator(ecLength)
  const remainder = new Uint8Array(data.length + ecLength)
  remainder.set(data)
  for (let i = 0; i < data.length; i += 1) {
    const factor = remainder[i]
    if (factor === 0) continue
    for (let j = 0; j < divisor.length; j += 1) {
      remainder[i + j] ^= gfMul(divisor[j], factor)
    }
  }
  return remainder.slice(data.length)
}

/**
 * @param {number} byteLength
 * @returns {{ version: number, total: number, ec: number, data: number }}
 */
function specFor(byteLength) {
  for (const spec of SPECS) {
    // 4 bits of mode + 8 bits of length take 12 bits of the data capacity, so
    // n payload bytes need n + 2 whole codewords.
    if (byteLength + 2 <= spec.data) return spec
  }
  const max = SPECS[SPECS.length - 1].data - 2
  throw new Error(
    `QR code needs ${byteLength} bytes; this encoder holds ${max}. Use a shorter link.`,
  )
}

/**
 * Mode, length, payload, terminator and pad codewords.
 * @param {Uint8Array} bytes
 * @param {number} capacity data codewords available
 * @returns {number[]}
 */
function dataCodewords(bytes, capacity) {
  const bits = []
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, 8)
  for (const byte of bytes) push(byte, 8)

  const terminator = Math.min(4, capacity * 8 - bits.length)
  for (let i = 0; i < terminator; i += 1) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const codewords = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j]
    codewords.push(byte)
  }
  for (let pad = 0; codewords.length < capacity; pad += 1) {
    codewords.push(pad % 2 === 0 ? 0xec : 0x11)
  }
  return codewords
}

/** @param {number} size */
function blank(size) {
  return Array.from({ length: size }, () => new Array(size).fill(false))
}

/** @param {boolean[][]} modules @param {boolean[][]} reserved @param {number} size */
function drawFinder(modules, reserved, size, row, col) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const y = row + r
      const x = col + c
      if (y < 0 || y >= size || x < 0 || x >= size) continue
      reserved[y][x] = true
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6
      const ring = r === 0 || r === 6 || c === 0 || c === 6
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4
      modules[y][x] = inside && (ring || core)
    }
  }
}

/** @param {boolean[][]} modules @param {boolean[][]} reserved @param {number} size */
function drawTiming(modules, reserved, size) {
  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0
    modules[6][i] = dark
    reserved[6][i] = true
    modules[i][6] = dark
    reserved[i][6] = true
  }
}

/** Alignment centres: 6 and the mirrored 6 at the far edge (versions 2–5). */
function alignmentCenters(version, size) {
  return version === 1 ? [] : [6, size - 7]
}

/** @param {boolean[][]} modules @param {boolean[][]} reserved */
function drawAlignment(modules, reserved, row, col) {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      reserved[row + r][col + c] = true
      modules[row + r][col + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1
    }
  }
}

/** Cells the two format-information copies occupy (plus the dark module). */
function reserveFormat(reserved, size) {
  for (let i = 0; i <= 8; i += 1) {
    reserved[8][i] = true
    reserved[i][8] = true
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true
    reserved[size - 1 - i][8] = true
  }
}

/**
 * The 15-bit format information for level L and one mask.
 * 5 data bits (EC level + mask), BCH(15, 5) remainder, XOR 0x5412.
 * @param {number} mask
 * @returns {number}
 */
export function formatInfoBits(mask) {
  const data = (EC_LEVEL_L << 3) | mask
  let remainder = data
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >> 9) & 1) * 0x537)
  }
  return ((data << 10) | remainder) ^ 0x5412
}

/** @param {boolean[][]} modules @param {number} size @param {number} mask */
function drawFormat(modules, size, mask) {
  const bits = formatInfoBits(mask)
  const bit = (index) => ((bits >> index) & 1) === 1

  for (let i = 0; i <= 5; i += 1) modules[8][i] = bit(i)
  modules[8][7] = bit(6)
  modules[8][8] = bit(7)
  modules[7][8] = bit(8)
  for (let i = 9; i < 15; i += 1) modules[14 - i][8] = bit(i)

  for (let i = 0; i < 8; i += 1) modules[size - 1 - i][8] = bit(i)
  for (let i = 8; i < 15; i += 1) modules[8][size - 15 + i] = bit(i)

  modules[size - 8][8] = true
}

/** Zigzag placement: two columns at a time, right to left, skipping column 6. */
function placeData(modules, reserved, size, codewords) {
  let bit = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const col = right - j
        const upward = ((right + 1) & 2) === 0
        const row = upward ? size - 1 - vert : vert
        if (reserved[row][col]) continue
        if (bit < codewords.length * 8) {
          modules[row][col] = ((codewords[bit >> 3] >> (7 - (bit & 7))) & 1) === 1
          bit += 1
        }
      }
    }
  }
}

/** @param {number} mask @param {number} row @param {number} col */
function maskBit(mask, row, col) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0
    case 1: return row % 2 === 0
    case 2: return col % 3 === 0
    case 3: return (row + col) % 3 === 0
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0
  }
}

/** The four penalty rules, summed. */
function penalty(modules, size) {
  const lines = []
  for (let r = 0; r < size; r += 1) lines.push(modules[r])
  for (let c = 0; c < size; c += 1) lines.push(modules.map((row) => row[c]))

  let score = 0

  for (const line of lines) {
    let run = 1
    for (let i = 1; i < line.length; i += 1) {
      if (line[i] === line[i - 1]) {
        run += 1
        if (run === 5) score += 3
        else if (run > 5) score += 1
      } else {
        run = 1
      }
    }
  }

  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const value = modules[r][c]
      if (
        value === modules[r][c + 1]
        && value === modules[r + 1][c]
        && value === modules[r + 1][c + 1]
      ) {
        score += 3
      }
    }
  }

  const finderA = [true, false, true, true, true, false, true, false, false, false, false]
  const finderB = [false, false, false, false, true, false, true, true, true, false, true]
  for (const line of lines) {
    for (let i = 0; i + 11 <= line.length; i += 1) {
      let matchA = true
      let matchB = true
      for (let j = 0; j < 11; j += 1) {
        if (line[i + j] !== finderA[j]) matchA = false
        if (line[i + j] !== finderB[j]) matchB = false
      }
      if (matchA) score += 40
      if (matchB) score += 40
    }
  }

  let dark = 0
  for (const row of modules) for (const value of row) if (value) dark += 1
  const total = size * size
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10
  return score
}

/**
 * @typedef {{
 *   version: number,
 *   size: number,
 *   mask: number,
 *   modules: boolean[][],
 * }} QrMatrix
 */

/**
 * Encode text as a QR symbol. The matrix carries no quiet zone — the renderer
 * adds one, because the border is a display concern.
 * @param {string} text
 * @returns {QrMatrix}
 */
export function encodeQr(text) {
  const value = String(text ?? '')
  if (!value) throw new Error('QR code needs a value.')

  const bytes = new TextEncoder().encode(value)
  const spec = specFor(bytes.length)
  const size = 17 + spec.version * 4

  const data = dataCodewords(bytes, spec.data)
  const codewords = data.concat(Array.from(reedSolomon(data, spec.ec)))

  const modules = blank(size)
  const reserved = blank(size)
  drawFinder(modules, reserved, size, 0, 0)
  drawFinder(modules, reserved, size, 0, size - 7)
  drawFinder(modules, reserved, size, size - 7, 0)
  drawTiming(modules, reserved, size)

  const centers = alignmentCenters(spec.version, size)
  for (const row of centers) {
    for (const col of centers) {
      const overlapsFinder =
        (row === 6 && col === 6)
        || (row === 6 && col === size - 7)
        || (row === size - 7 && col === 6)
      if (!overlapsFinder) drawAlignment(modules, reserved, row, col)
    }
  }

  reserveFormat(reserved, size)
  placeData(modules, reserved, size, codewords)

  let best = null
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = modules.map((row) => row.slice())
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (!reserved[r][c] && maskBit(mask, r, c)) candidate[r][c] = !candidate[r][c]
      }
    }
    drawFormat(candidate, size, mask)
    const score = penalty(candidate, size)
    if (!best || score < best.score) best = { mask, score, modules: candidate }
  }

  return { version: spec.version, size, mask: best.mask, modules: best.modules }
}
