import { beforeEach, describe, expect, it } from 'vitest'
import { resetDemo, db } from './db'
import * as ads from './api-ads'
import * as content from './api-content'
import * as users from './api-users'
import { setEmergencyPause } from './api'

// Rules enforced by the mock API, called directly (the same functions the screens use).

beforeEach(() => {
  resetDemo()
})

/** The mock API throws synchronously; the screens wrap calls in async functions. Do the same here. */
const call = <T,>(fn: () => T | Promise<T>) => Promise.resolve().then(fn)

const inReview = () => db().posts.find((p) => p.status === 'In review' && p.accountId === 'social-15')!

describe('separation of duties', () => {
  it('an approver cannot approve or return a post they wrote', async () => {
    const post = inReview()
    post.createdBy = 'user-3' // Emma Roy, Recreation approver
    await expect(call(() => content.transitionPost('user-3', post.id, 'approve'))).rejects.toThrow(/another approver/)
    await expect(call(() => content.transitionPost('user-3', post.id, 'return', { note: 'x' }))).rejects.toThrow(/another approver/)
    expect(post.status).toBe('In review')
  })

  it('a different approver can approve it', async () => {
    const post = inReview()
    post.createdBy = 'user-21' // Lily Green, an editor
    const r = await content.transitionPost('user-3', post.id, 'approve')
    expect(r.status).toBe('Approved')
  })

  it('the post row marks the author so the screen can explain it', async () => {
    const post = inReview()
    post.createdBy = 'user-3'
    const d = await content.getPost('user-3', post.id)
    expect(d.post.isOwn).toBe(true)
    expect(d.post.actions).not.toContain('approve')
  })

  it('an ad manager cannot approve a campaign they wrote, but another can', async () => {
    const c = db().campaigns.find((x) => x.id === 'camp-2')! // in review on the Meta account
    c.createdBy = 'user-12' // Mason Clark, ad manager through a group role
    await expect(call(() => ads.transitionCampaign('user-12', c.id, 'approve'))).rejects.toThrow(/another ad manager/)
    c.createdBy = 'user-3'
    await expect(call(() => ads.transitionCampaign('user-12', c.id, 'approve'))).resolves.toBe('Approved')
  })

  it('seeded posts are written by editors, so approvers have posts to review', () => {
    const approvers = new Set(db().users.filter((u) => u.role === 'Approver').map((u) => u.id))
    expect(db().posts.some((p) => approvers.has(p.createdBy))).toBe(false)
  })
})

describe('administrator access is a function, not a role label', () => {
  it('the Administrator role label grants nothing without the function', async () => {
    const u = db().users.find((x) => x.id === 'user-1')! // Maya Chen, editor
    u.role = 'Administrator'
    await expect(call(() => setEmergencyPause('user-1', true, 'test'))).rejects.toThrow(/administrator/)
    u.functions.push('admin.full')
    await expect(call(() => setEmergencyPause('user-1', true, 'test'))).resolves.toMatchObject({ paused: true })
  })

  it('a suspended person with the function has no administrator power', async () => {
    const u = db().users.find((x) => x.id === 'user-1')!
    u.functions.push('admin.full')
    u.status = 'Suspended'
    await expect(call(() => setEmergencyPause('user-1', true, 'test'))).rejects.toThrow()
  })

  it('the last active administrator cannot lose the function or be suspended', async () => {
    const avery = db().users.find((x) => x.id === 'user-0')!
    const patch = { name: avery.name, email: avery.email, department: avery.department, role: avery.role, status: avery.status, functions: avery.functions, channels: [], adAccounts: [] }
    await expect(call(() => users.updateStaff('admin', 'user-0', { ...patch, status: 'Suspended' }))).rejects.toThrow(/last active administrator/)
    await expect(call(() => users.updateStaff('admin', 'user-0', { ...patch, functions: avery.functions.filter((f) => f !== 'admin.full') }))).rejects.toThrow(/last active administrator/)
  })

  it('once a second administrator exists the first can be demoted', async () => {
    const avery = db().users.find((x) => x.id === 'user-0')!
    db().users.find((x) => x.id === 'user-1')!.functions.push('admin.full')
    const patch = { name: avery.name, email: avery.email, department: avery.department, role: avery.role, status: avery.status, functions: avery.functions.filter((f) => f !== 'admin.full'), channels: [], adAccounts: [] }
    await expect(call(() => users.updateStaff('admin', 'user-0', patch))).resolves.toBeGreaterThan(0)
  })
})
