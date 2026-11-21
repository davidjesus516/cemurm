import { describe, expect, it } from 'vitest'
import { shouldShowFeatureTooltip } from './featureHints.js'

describe('feature tooltip is gated by the version that introduced it', () => {
  it('shows the tooltip when the feature has never been seen', () => {
    expect(shouldShowFeatureTooltip('', '0.1.0')).toBe(true)
    expect(shouldShowFeatureTooltip(null, '0.1.0')).toBe(true)
  })

  it('hides the tooltip once seen on the introducing version', () => {
    expect(shouldShowFeatureTooltip('0.1.0', '0.1.0')).toBe(false)
  })

  it('shows it again after the app updates to a newer version', () => {
    expect(shouldShowFeatureTooltip('0.1.0', '0.2.0')).toBe(true)
  })

  it('treats a legacy boolean flag as unseen so the version gate can take over', () => {
    expect(shouldShowFeatureTooltip('true', '0.1.0')).toBe(true)
  })
})
