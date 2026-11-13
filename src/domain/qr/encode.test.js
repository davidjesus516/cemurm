// QR encoder — verified by reading the symbol back.
//
// The checks below do not import the encoder's internals beyond the public
// `encodeQr` / `formatInfoBits`: the reader rebuilds the function-module map,
// takes the mask from the format information, unmasks the data region and
// parses the payload. So placement, masking and format information have to
// agree with each other for a test to pass.
//
// What this cannot prove: that a camera reads the symbol. No scanner runs in
// this environment, so scanning is the one check left to a device.

import { describe, expect, it } from 'vitest'

import { encodeQr, formatInfoBits } from './encode.js'

const SETLIST_LINK = 'https://app.cemurm.app/setlists/2f1c8a44-7b0e-4c31-9f6d-58e2a1b7c904'

/** Reserved map, rebuilt from the spec rather than imported. */
function reservedMap(version, size) {
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false))

  for (const [row, col] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const y = row + r
        const x = col + c
        if (y >= 0 && y < size && x >= 0 && x < size) reserved[y][x] = true
      }
    }
  }

  for (let i = 8; i < size - 8; i += 1) {
    reserved[6][i] = true
    reserved[i][6] = true
  }

  if (version > 1) {
    for (const row of [6, size - 7]) {
      for (const col of [6, size - 7]) {
        const overlapsFinder =
          (row === 6 && col === 6)
          || (row === 6 && col === size - 7)
          || (row === size - 7 && col === 6)
        if (overlapsFinder) continue
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) reserved[row + r][col + c] = true
        }
      }
    }
  }

  for (let i = 0; i <= 8; i += 1) {
    reserved[8][i] = true
    reserved[i][8] = true
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true
    reserved[size - 1 - i][8] = true
  }
  return reserved
}

function maskAt(mask, row, col) {
  const patterns = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ]
  return patterns[mask](row, col)
}

/** The 15 format bits, from the first copy (top-left). */
function readFormat(modules) {
  const bit = (row, col) => (modules[row][col] ? 1 : 0)
  const positions = []
  for (let i = 0; i <= 5; i += 1) positions.push([8, i])
  positions.push([8, 7], [8, 8], [7, 8])
  for (let i = 9; i < 15; i += 1) positions.push([14 - i, 8])

  let bits = 0
  positions.forEach(([row, col], index) => {
    bits |= bit(row, col) << index
  })
  const value = bits ^ 0x5412
  return { ec: (value >> 13) & 0b11, mask: (value >> 10) & 0b111, bits }
}

/** The second copy of the format bits, read bottom-left to top-right. */
function readFormatCopy(modules, size) {
  const positions = []
  for (let i = 0; i < 8; i += 1) positions.push([size - 1 - i, 8])
  for (let i = 8; i < 15; i += 1) positions.push([8, size - 15 + i])

  let bits = 0
  positions.forEach(([row, col], index) => {
    bits |= (modules[row][col] ? 1 : 0) << index
  })
  return bits
}

function dataBits(modules, reserved, size, mask) {
  const bits = []
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const col = right - j
        const upward = ((right + 1) & 2) === 0
        const row = upward ? size - 1 - vert : vert
        if (reserved[row][col]) continue
        const dark = modules[row][col] !== maskAt(mask, row, col)
        bits.push(dark ? 1 : 0)
      }
    }
  }
  return bits
}

function readCodewords(modules, version, size, mask) {
  const reserved = reservedMap(version, size)
  const bits = dataBits(modules, reserved, size, mask)
  const codewords = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j]
    codewords.push(byte)
  }
  return codewords
}

/** Independent Reed–Solomon: parity expected for the data codewords. */
function expectedParity(data, ecLength) {
  const exp = new Uint8Array(512)
  const log = new Uint8Array(256)
  let value = 1
  for (let i = 0; i < 255; i += 1) {
    exp[i] = value
    log[value] = i
    value <<= 1
    if (value & 0x100) value ^= 0x11d
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255]
  const mul = (a, b) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]])

  let divisor = [1]
  for (let i = 0; i < ecLength; i += 1) {
    const next = new Array(divisor.length + 1).fill(0)
    divisor.forEach((coefficient, j) => {
      next[j] ^= coefficient
      next[j + 1] ^= mul(coefficient, exp[i])
    })
    divisor = next
  }

  const remainder = new Uint8Array(data.length + ecLength)
  remainder.set(data)
  for (let i = 0; i < data.length; i += 1) {
    const factor = remainder[i]
    if (!factor) continue
    divisor.forEach((coefficient, j) => {
      remainder[i + j] ^= mul(coefficient, factor)
    })
  }
  return Array.from(remainder.slice(data.length))
}

const DATA_CODEWORDS = { 1: 19, 2: 34, 3: 55, 4: 80, 5: 108 }
const TOTAL_CODEWORDS = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134 }

function decode(symbol) {
  const { version, size, mask, modules } = symbol
  const format = readFormat(modules, size)
  const codewords = readCodewords(modules, version, size, format.mask)
  const data = codewords.slice(0, DATA_CODEWORDS[version])

  const bits = []
  for (const byte of data) {
    for (let i = 7; i >= 0; i -= 1) bits.push((byte >> i) & 1)
  }
  const number = (from, length) => {
    let result = 0
    for (let i = 0; i < length; i += 1) result = (result << 1) | bits[from + i]
    return result
  }

  const mode = number(0, 4)
  const length = number(4, 8)
  const bytes = []
  for (let i = 0; i < length; i += 1) bytes.push(number(12 + i * 8, 8))

  return {
    mode,
    text: new TextDecoder().decode(new Uint8Array(bytes)),
    mask: format.mask,
    formatBits: format.bits,
    declaredMask: mask,
    data,
    parity: codewords.slice(DATA_CODEWORDS[version]),
    totalCodewords: codewords.length,
  }
}

describe('encodeQr', () => {
  it('encodes a setlist link so it reads back byte for byte', () => {
    const symbol = encodeQr(SETLIST_LINK)
    const decoded = decode(symbol)

    expect(decoded.mode).toBe(0b0100)
    expect(decoded.text).toBe(SETLIST_LINK)
  })

  it('picks the smallest version that fits, and grows only when it must', () => {
    const link = 'https://app.cemurm.app/setlists/2f1c8a44'
    expect(encodeQr(link).size).toBe(17 + encodeQr(link).version * 4)

    // 78 payload bytes is version 4's exact ceiling; one more byte steps to 5.
    const atCeiling = `https://a.test/${'x'.repeat(78 - 'https://a.test/'.length)}`
    const overCeiling = `${atCeiling}x`
    expect(new TextEncoder().encode(atCeiling).length).toBe(78)
    expect(encodeQr(atCeiling).version).toBe(4)
    expect(encodeQr(overCeiling).version).toBe(5)
  })

  it('refuses a value it cannot hold instead of truncating it', () => {
    expect(() => encodeQr(`https://a.test/${'x'.repeat(120)}`)).toThrow(/106|bytes/)
    expect(() => encodeQr('')).toThrow(/value/i)
  })

  it('draws the three finders, the timing lines and the dark module', () => {
    const { size, modules } = encodeQr(SETLIST_LINK)

    for (const [row, col] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
      expect(modules[row][col]).toBe(true) // corner of the outer ring
      expect(modules[row + 1][col + 1]).toBe(false) // separator
      expect(modules[row + 3][col + 3]).toBe(true) // 3x3 core
    }
    for (let i = 8; i < size - 8; i += 1) {
      expect(modules[6][i]).toBe(i % 2 === 0)
      expect(modules[i][6]).toBe(i % 2 === 0)
    }
    expect(modules[size - 8][8]).toBe(true)
  })

  it('writes both format-information copies identically, with level L', () => {
    const symbol = encodeQr(SETLIST_LINK)
    const format = readFormat(symbol.modules)

    expect(readFormatCopy(symbol.modules, symbol.size)).toBe(format.bits)
    expect(format.ec).toBe(0b01)
    expect(format.mask).toBe(symbol.mask)
    expect(format.bits).toBe(formatInfoBits(symbol.mask))
  })

  it('matches the published level-L format strings for all eight masks', () => {
    // ISO/IEC 18004 Annex C, level L: the anchor that does not depend on this
    // encoder being self-consistent.
    const published = [
      '111011111000100',
      '111001011110011',
      '111110110101010',
      '111100010011101',
      '110011000101111',
      '110001100011000',
      '110110001000001',
      '110100101110110',
    ]

    expect(published.map((_, mask) => formatInfoBits(mask).toString(2).padStart(15, '0')))
      .toEqual(published)
  })

  it('carries Reed–Solomon parity for its data block, per version table', () => {
    const symbol = encodeQr(SETLIST_LINK)
    const decoded = decode(symbol)

    expect(decoded.totalCodewords).toBe(TOTAL_CODEWORDS[symbol.version])
    expect(decoded.parity).toEqual(
      expectedParity(decoded.data, decoded.parity.length),
    )
  })
})
