import { describe, expect, it } from 'vitest'
import { canViewAccount, canViewAdAccount, hasAccountFunction, hasAdAccountFunction, hasFunction, type AccessContext } from './permissions'
import type { AdAccount, AssetGroup, SocialAccount, User } from './types'

const account = (id: string, group: string | null): SocialAccount => ({
  id,
  name: id,
  handle: '@' + id,
  network: 'Facebook',
  department: 'Communications',
  assetGroupId: group,
  connection: { status: 'Healthy', expiresAt: '', lastSync: '' },
})

const user = (over: Partial<User> = {}): User => ({
  id: 'u1',
  name: 'Test',
  email: 't@example.test',
  department: 'Communications',
  role: 'Editor',
  status: 'Active',
  functions: [],
  channels: [],
  adAccounts: [],
  ...over,
})

const ctx = (groups: AssetGroup[] = []): AccessContext => ({
  accounts: [account('a1', 'g1'), account('a2', 'g1'), account('b1', 'g2')],
  groups,
})

const group = (id: string, assignments: AssetGroup['assignments']): AssetGroup => ({ id, name: id, color: '#000', description: '', assignments, brand: {} as AssetGroup['brand'], createdAt: '' })

describe('permissions', () => {
  it('requires both the function and the account assignment', () => {
    const u = user({ functions: ['content.create'], channels: ['a1'] })
    expect(hasAccountFunction({ isAdmin: false, user: u }, 'content.create', 'a1', ctx())).toBe(true)
    expect(hasAccountFunction({ isAdmin: false, user: u }, 'content.create', 'a2', ctx())).toBe(false)
    expect(hasAccountFunction({ isAdmin: false, user: u }, 'content.publish', 'a1', ctx())).toBe(false)
  })

  it('a function grant alone reveals no channel', () => {
    const u = user({ functions: ['inbox.respond'] })
    expect(canViewAccount({ isAdmin: false, user: u }, 'a1', ctx())).toBe(false)
  })

  it('group roles apply only to explicitly selected channels of that group', () => {
    const g = [group('g1', [{ userId: 'u1', role: 'creator', channelIds: ['a1'], adAccountIds: [] }])]
    const actor = { isAdmin: false, user: user() }
    expect(hasAccountFunction(actor, 'content.create', 'a1', ctx(g))).toBe(true)
    expect(hasAccountFunction(actor, 'content.create', 'a2', ctx(g))).toBe(false)
    expect(hasAccountFunction(actor, 'content.approve', 'a1', ctx(g))).toBe(false)
  })

  it('an approver in group B does not gain approval in group A', () => {
    const g = [
      group('g1', [{ userId: 'u1', role: 'creator', channelIds: ['a1'], adAccountIds: [] }]),
      group('g2', [{ userId: 'u1', role: 'approver', channelIds: ['b1'], adAccountIds: [] }]),
    ]
    const actor = { isAdmin: false, user: user() }
    expect(hasAccountFunction(actor, 'content.approve', 'b1', ctx(g))).toBe(true)
    expect(hasAccountFunction(actor, 'content.approve', 'a1', ctx(g))).toBe(false)
  })

  it('a group role stops applying once the channel is unlinked from that group', () => {
    const g = [group('g1', [{ userId: 'u1', role: 'creator', channelIds: ['a1'], adAccountIds: [] }])]
    const c = ctx(g)
    c.accounts[0] = account('a1', null)
    expect(hasAccountFunction({ isAdmin: false, user: user() }, 'content.create', 'a1', c)).toBe(false)
  })

  it('ad-manager roles grant no channel scope', () => {
    const g = [group('g1', [{ userId: 'u1', role: 'ads', channelIds: ['a1'], adAccountIds: [] }])]
    expect(canViewAccount({ isAdmin: false, user: user() }, 'a1', ctx(g))).toBe(false)
  })

  it('suspended users have no access', () => {
    const u = user({ status: 'Suspended', functions: ['content.create'], channels: ['a1'] })
    expect(hasFunction({ isAdmin: false, user: u }, 'content.create', ctx())).toBe(false)
  })

  describe('ad accounts', () => {
    const ad = (id: string, group: string | null): AdAccount => ({ id, name: id, network: 'Meta', assetGroupId: group, limitCents: 100000, createdAt: '' })
    const adCtx = (groups: AssetGroup[] = []): AccessContext => ({ ...ctx(groups), adAccounts: [ad('ad1', 'g1'), ad('ad2', 'g1'), ad('ad3', 'g2')] })

    it('needs the function and an explicit ad account assignment', () => {
      const u = user({ functions: ['ads.create'], adAccounts: ['ad1'] })
      const actor = { isAdmin: false, user: u }
      expect(hasAdAccountFunction(actor, 'ads.create', 'ad1', adCtx())).toBe(true)
      expect(hasAdAccountFunction(actor, 'ads.create', 'ad2', adCtx())).toBe(false)
      expect(hasAdAccountFunction(actor, 'ads.manage', 'ad1', adCtx())).toBe(false)
    })

    it('a function grant alone reveals no ad account', () => {
      expect(canViewAdAccount({ isAdmin: false, user: user({ functions: ['ads.create', 'ads.manage'] }) }, 'ad1', adCtx())).toBe(false)
    })

    it('a group ad-manager role covers only the selected ad accounts of that group', () => {
      const g = [group('g1', [{ userId: 'u1', role: 'ads', channelIds: [], adAccountIds: ['ad1'] }])]
      const actor = { isAdmin: false, user: user() }
      expect(hasAdAccountFunction(actor, 'ads.manage', 'ad1', adCtx(g))).toBe(true)
      expect(hasAdAccountFunction(actor, 'ads.manage', 'ad2', adCtx(g))).toBe(false)
      expect(hasAdAccountFunction(actor, 'ads.manage', 'ad3', adCtx(g))).toBe(false)
    })

    it('unlinking the ad account from the group ends the group role on it', () => {
      const g = [group('g1', [{ userId: 'u1', role: 'ads', channelIds: [], adAccountIds: ['ad1'] }])]
      const c = adCtx(g)
      c.adAccounts![0] = ad('ad1', null)
      expect(canViewAdAccount({ isAdmin: false, user: user() }, 'ad1', c)).toBe(false)
    })

    it('a content creator role grants nothing on ad accounts', () => {
      const g = [group('g1', [{ userId: 'u1', role: 'creator', channelIds: ['a1'], adAccountIds: ['ad1'] }])]
      expect(canViewAdAccount({ isAdmin: false, user: user() }, 'ad1', adCtx(g))).toBe(false)
    })
  })
})
