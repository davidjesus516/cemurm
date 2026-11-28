import { describe, expect, it } from 'vitest'

import { formatBytes } from './formatBytes.js'

describe('formatBytes', () => {
  it('renders zero and bytes without decimals', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
  })

  it('renders kilobytes, megabytes and gigabytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024 * 2.25)).toBe('2.3 MB')
    expect(formatBytes(1024 ** 3 * 1.5)).toBe('1.5 GB')
  })

  it('stops at gigabytes rather than inventing a unit', () => {
    expect(formatBytes(1024 ** 4 * 3)).toBe('3072.0 GB')
  })

  it('never renders a negative or non-finite size as a number', () => {
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B')
    expect(formatBytes(undefined)).toBe('0 B')
  })
})
