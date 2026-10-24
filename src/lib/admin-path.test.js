import { describe, expect, it } from 'vitest'
import { toAdminPath } from './admin-path'

describe('toAdminPath', () => {
  it('prefixes internal template paths with the admin base', () => {
    expect(toAdminPath('/')).toBe('/dashboard')
    expect(toAdminPath('/apps/notes')).toBe('/dashboard/apps/notes')
    expect(toAdminPath('pages/tables')).toBe('/dashboard/pages/tables')
  })

  it('leaves admin, external and anchor paths untouched', () => {
    expect(toAdminPath('/dashboard')).toBe('/dashboard')
    expect(toAdminPath('/dashboard/apps/blog/post')).toBe('/dashboard/apps/blog/post')
    expect(toAdminPath('https://example.com/docs')).toBe('https://example.com/docs')
    expect(toAdminPath('mailto:demo@cemurm.app')).toBe('mailto:demo@cemurm.app')
    expect(toAdminPath('#')).toBe('#')
    expect(toAdminPath(undefined)).toBe('#')
  })
})
