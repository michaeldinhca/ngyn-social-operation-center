import { describe, expect, it } from 'vitest'
import { FUNCTION_CATALOG, inertFunctions, isAdminUser, ROLE_FUNCTIONS, validEmail } from './roles'

describe('roles and functions', () => {
  it('every role function exists in the catalog', () => {
    const ids = new Set(FUNCTION_CATALOG.map((f) => f.id))
    for (const fns of Object.values(ROLE_FUNCTIONS)) fns.forEach((f) => expect(ids.has(f)).toBe(true))
  })

  it('a viewer starts with no functions, an administrator with all', () => {
    expect(ROLE_FUNCTIONS.Viewer).toEqual([])
    expect(ROLE_FUNCTIONS.Administrator.length).toBe(FUNCTION_CATALOG.length)
  })

  it('flags channel-scoped functions that have no channel to act on', () => {
    expect(inertFunctions(['content.create', 'reports.view'], 0, 0).map((f) => f.id)).toEqual(['content.create'])
    expect(inertFunctions(['content.create'], 2, 0)).toEqual([])
    expect(inertFunctions(['ads.manage'], 3, 0).map((f) => f.id)).toEqual(['ads.manage'])
  })

  it('validates login emails', () => {
    expect(validEmail('maya.chen@harbourview.example')).toBe(true)
    expect(validEmail('no-at-sign')).toBe(false)
    expect(validEmail('a@b')).toBe(false)
  })

  it('administrator power comes from the function, not the role label', () => {
    expect(isAdminUser({ status: 'Active', functions: ['admin.full'] })).toBe(true)
    expect(isAdminUser({ status: 'Active', functions: ['content.create'] })).toBe(false)
    expect(isAdminUser({ status: 'Suspended', functions: ['admin.full'] })).toBe(false)
    expect(isAdminUser({ status: 'Invited', functions: ['admin.full'] })).toBe(false)
    expect(isAdminUser(null)).toBe(false)
    expect(ROLE_FUNCTIONS.Administrator).toContain('admin.full')
    expect(ROLE_FUNCTIONS.Approver).not.toContain('admin.full')
  })
})
