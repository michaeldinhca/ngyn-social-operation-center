import { campaignDays, committedCents, guardCheck, LAUNCH_BLOCKED, NEXT_CAMPAIGN_STATUS, totalBudgetCents, type GuardCheck } from '@/domain/ads'
import { canViewAccount, canViewAdAccount, hasAdAccountFunction, hasFunction } from '@/domain/permissions'
import { AD_NETWORKS, OBJECTIVES, type AdAccount, type AdCampaign, type AdNetwork, type DemoState } from '@/domain/types'
import { actorName, actorOf, ApiError, audit, ctx, nowISO, uid, wait } from './core'
import { db, persist } from './db'

// Advertising. Rules enforced here:
// - Function AND ad account: ads.create drafts, ads.manage approves, ads.accounts.add manages mock ad accounts.
// - Campaigns stop at "Approved". There is no path to spend; a launch request is blocked and audited.
// - Budgets are simulated planning numbers against a simulated account limit.

export type CampaignAction = 'edit' | 'submit' | 'approve' | 'return' | 'launch' | 'delete'

export interface CampaignRow extends AdCampaign {
  account: AdAccount
  createdByName: string
  postTitle: string | null
  /** The actor wrote this campaign. Separation of duties: they cannot approve or return it while it is in review. */
  isOwn: boolean
  days: number
  totalCents: number
  guard: GuardCheck
  actions: CampaignAction[]
}

function requireAds(s: DemoState, actorId: string) {
  const a = actorOf(s, actorId)
  const c = ctx(s)
  if (!(hasFunction(a, 'ads.create', c) || hasFunction(a, 'ads.manage', c) || hasFunction(a, 'ads.accounts.add', c))) throw new ApiError('Advertising needs an advertising permission.')
  return a
}

function toRow(s: DemoState, actorId: string, c: AdCampaign): CampaignRow {
  const a = actorOf(s, actorId)
  const x = ctx(s)
  const account = s.adAccounts.find((ad) => ad.id === c.adAccountId)!
  const create = hasAdAccountFunction(a, 'ads.create', c.adAccountId, x)
  const manage = hasAdAccountFunction(a, 'ads.manage', c.adAccountId, x)
  const isOwn = !!a.user && c.createdBy === a.user.id
  const actions: CampaignAction[] = []
  if (c.status === 'Draft' && create) actions.push('edit', 'submit', 'delete')
  if (c.status === 'In review' && manage && !isOwn) actions.push('approve', 'return')
  if (c.status === 'Approved' && manage) actions.push('return', 'launch')
  return {
    ...c,
    account,
    createdByName: s.users.find((u) => u.id === c.createdBy)?.name ?? 'Unknown',
    postTitle: s.posts.find((p) => p.id === c.postId)?.title ?? null,
    isOwn,
    days: campaignDays(c.startDay, c.endDay),
    totalCents: totalBudgetCents(c),
    guard: guardCheck(c, s.campaigns, account.limitCents),
    actions,
  }
}

export interface AccountRow extends AdAccount {
  groupName: string | null
  committedCents: number
  campaigns: number
  access: { name: string; via: string }[]
}

export interface AdsOverview {
  campaigns: CampaignRow[]
  accounts: AccountRow[]
  canCreate: boolean
  canManageAccounts: boolean
  groups: { id: string; name: string }[]
}

export function adsOverview(actorId: string): Promise<AdsOverview> {
  const s = db()
  const a = requireAds(s, actorId)
  const c = ctx(s)
  const visibleAds = s.adAccounts.filter((ad) => canViewAdAccount(a, ad.id, c))
  const ids = new Set(visibleAds.map((x) => x.id))
  const accounts: AccountRow[] = visibleAds.map((ad) => {
    const access: AccountRow['access'] = []
    for (const u of s.users) {
      if (u.status !== 'Active') continue
      if (u.adAccounts.includes(ad.id)) access.push({ name: u.name, via: 'Direct assignment' })
      const g = s.groups.find((x) => x.id === ad.assetGroupId)
      g?.assignments.filter((r) => r.userId === u.id && r.role === 'ads' && r.adAccountIds.includes(ad.id)).forEach(() => access.push({ name: u.name, via: `Group ad manager in ${g.name}` }))
    }
    return { ...ad, groupName: s.groups.find((g) => g.id === ad.assetGroupId)?.name ?? null, committedCents: committedCents(s.campaigns, ad.id), campaigns: s.campaigns.filter((x) => x.adAccountId === ad.id).length, access }
  })
  return wait({
    campaigns: s.campaigns.filter((x) => ids.has(x.adAccountId)).map((x) => toRow(s, actorId, x)).sort((p, q) => q.createdAt.localeCompare(p.createdAt)),
    accounts,
    canCreate: visibleAds.some((ad) => hasAdAccountFunction(a, 'ads.create', ad.id, c)),
    canManageAccounts: hasFunction(a, 'ads.accounts.add', c),
    groups: s.groups.map((g) => ({ id: g.id, name: g.name })),
  })
}

export function getCampaign(actorId: string, id: string): Promise<{ campaign: CampaignRow; adAccounts: AdAccount[]; posts: { id: string; title: string; network: string }[] }> {
  const s = db()
  const a = requireAds(s, actorId)
  const camp = s.campaigns.find((x) => x.id === id)
  if (!camp || !canViewAdAccount(a, camp.adAccountId, ctx(s))) throw new ApiError('Campaign not found or not in your ad account scope.')
  return wait({ campaign: toRow(s, actorId, camp), adAccounts: usable(s, actorId), posts: linkablePosts(s, actorId) })
}

function usable(s: DemoState, actorId: string) {
  const a = actorOf(s, actorId)
  return s.adAccounts.filter((ad) => hasAdAccountFunction(a, 'ads.create', ad.id, ctx(s)))
}

function linkablePosts(s: DemoState, actorId: string) {
  const a = actorOf(s, actorId)
  return s.posts
    .filter((p) => ['Approved', 'Scheduled', 'Published'].includes(p.status) && canViewAccount(a, p.accountId, ctx(s)))
    .slice(0, 40)
    .map((p) => ({ id: p.id, title: p.title, network: s.accounts.find((x) => x.id === p.accountId)!.network }))
}

/** Ad accounts the actor may draft on, and posts an ad can be based on. For the new-campaign form. */
export function campaignFormContext(actorId: string): Promise<{ adAccounts: AdAccount[]; posts: { id: string; title: string; network: string }[] }> {
  const s = db()
  requireAds(s, actorId)
  return wait({ adAccounts: usable(s, actorId), posts: linkablePosts(s, actorId) })
}

export interface CampaignInput {
  name: string
  adAccountId: string
  objective: AdCampaign['objective']
  headline: string
  body: string
  postId: string | null
  audience: AdCampaign['audience']
  startDay: string
  endDay: string
  dailyBudgetCents: number
}

function applyInput(s: DemoState, actorId: string, c: AdCampaign, input: CampaignInput) {
  const a = actorOf(s, actorId)
  if (!hasAdAccountFunction(a, 'ads.create', input.adAccountId, ctx(s))) throw new ApiError('Drafting needs the advertising creation function on that ad account.')
  if (!OBJECTIVES.includes(input.objective)) throw new ApiError('Choose an objective.')
  if (!input.name.trim()) throw new ApiError('Name the campaign.')
  if (input.postId && !linkablePosts(s, actorId).some((p) => p.id === input.postId)) throw new ApiError('Choose a post you can access that is approved, scheduled or published.')
  Object.assign(c, {
    name: input.name.trim(),
    adAccountId: input.adAccountId,
    objective: input.objective,
    headline: input.headline.trim(),
    body: input.body.trim(),
    postId: input.postId,
    audience: { ...input.audience, area: input.audience.area.trim(), interests: input.audience.interests.map((i) => i.trim()).filter(Boolean) },
    startDay: input.startDay,
    endDay: input.endDay,
    dailyBudgetCents: Math.round(input.dailyBudgetCents),
  })
}

export function saveCampaign(actorId: string, id: string | null, input: CampaignInput) {
  const s = db()
  requireAds(s, actorId)
  let c: AdCampaign
  if (id) {
    c = s.campaigns.find((x) => x.id === id)!
    if (!c) throw new ApiError('Campaign not found.')
    if (!toRow(s, actorId, c).actions.includes('edit')) throw new ApiError('Only drafts can be edited, by someone with the advertising creation function on that ad account.')
    applyInput(s, actorId, c, input)
    c.history.push({ id: uid('ce'), at: nowISO(), actor: actorName(s, actorId), action: 'Edited' })
    audit(s, actorId, 'Campaign draft saved', `${c.name} (${c.id}). Simulated budget only.`)
  } else {
    c = { id: uid('camp'), spentCents: 0, status: 'Draft', reviewNote: null, history: [], createdBy: actorOf(s, actorId).user?.id ?? 'user-0', createdAt: nowISO(), name: '', adAccountId: '', objective: 'Awareness', headline: '', body: '', postId: null, audience: { area: '', ageMin: 18, ageMax: 65, language: 'English', interests: [] }, startDay: '', endDay: '', dailyBudgetCents: 0 }
    applyInput(s, actorId, c, input)
    c.history.push({ id: uid('ce'), at: nowISO(), actor: actorName(s, actorId), action: 'Created' })
    s.campaigns.unshift(c)
    audit(s, actorId, 'Campaign draft created', `${c.name} (${c.id}). No spend is possible.`)
  }
  persist()
  return wait(c.id)
}

export function transitionCampaign(actorId: string, id: string, action: 'submit' | 'approve' | 'return', note?: string) {
  const s = db()
  requireAds(s, actorId)
  const c = s.campaigns.find((x) => x.id === id)
  if (!c || !canViewAdAccount(actorOf(s, actorId), c.adAccountId, ctx(s))) throw new ApiError('Campaign not found or not in your ad account scope.')
  const row = toRow(s, actorId, c)
  if ((action === 'approve' || (action === 'return' && c.status === 'In review')) && row.isOwn && hasAdAccountFunction(actorOf(s, actorId), 'ads.manage', c.adAccountId, ctx(s))) {
    throw new ApiError('You wrote this campaign, so another ad manager has to review it.')
  }
  if (!row.actions.includes(action)) throw new ApiError(`You can't ${action} this ${c.status.toLowerCase()} campaign.`)
  const next = NEXT_CAMPAIGN_STATUS[action][c.status]!
  if (action === 'submit') {
    if (!row.guard.ok) throw new ApiError(`Not ready for review: ${row.guard.problems.join(' ')}`)
    c.reviewNote = null
  }
  if (action === 'approve') {
    // Re-check at approval: the limit may have changed since submission.
    const g = guardCheck(c, s.campaigns, row.account.limitCents)
    if (!g.ok) throw new ApiError(`Can't approve: ${g.problems.join(' ')}`)
  }
  if (action === 'return') {
    if (!note?.trim()) throw new ApiError('Add a note so the author knows what to change.')
    c.reviewNote = note.trim()
  }
  c.status = next
  const label = { submit: 'Submitted', approve: 'Approved', return: 'Returned' } as const
  c.history.push({ id: uid('ce'), at: nowISO(), actor: actorName(s, actorId), action: label[action], note: action === 'return' ? note!.trim() : undefined })
  audit(s, actorId, `Campaign ${action}`, `${c.name} (${c.id}) → ${next}. Approval does not authorize spend.`)
  persist()
  return wait(next)
}

export function deleteCampaign(actorId: string, id: string) {
  const s = db()
  requireAds(s, actorId)
  const c = s.campaigns.find((x) => x.id === id)
  if (!c) throw new ApiError('Campaign not found.')
  if (!toRow(s, actorId, c).actions.includes('delete')) throw new ApiError('Only drafts can be deleted, by someone with the advertising creation function on that ad account.')
  s.campaigns = s.campaigns.filter((x) => x.id !== id)
  audit(s, actorId, 'Campaign draft deleted', `${c.name} (${c.id})`)
  persist()
  return wait(true)
}

/** The no-spend guard. A launch request is recorded and always refused. */
export function requestLaunch(actorId: string, id: string) {
  const s = db()
  requireAds(s, actorId)
  const c = s.campaigns.find((x) => x.id === id)
  if (!c || !toRow(s, actorId, c).actions.includes('launch')) throw new ApiError('Only an approved campaign can request a launch, by someone with the advertising management function on that ad account.')
  c.history.push({ id: uid('ce'), at: nowISO(), actor: actorName(s, actorId), action: 'Launch blocked', note: 'No-spend guard' })
  audit(s, actorId, 'Launch blocked by no-spend guard', `${c.name} (${c.id}). Spent: $0.00. No ad platform was contacted.`)
  persist()
  return wait({ blocked: true as const, message: LAUNCH_BLOCKED })
}

// ---------- Ad accounts ----------

function requireAccountManager(s: DemoState, actorId: string) {
  if (!hasFunction(actorOf(s, actorId), 'ads.accounts.add', ctx(s))) throw new ApiError('Managing ad accounts needs the "Add ad accounts" function.')
}

export function createAdAccount(actorId: string, input: { name: string; network: AdNetwork; limitDollars: number }) {
  const s = db()
  requireAccountManager(s, actorId)
  const name = input.name.trim()
  if (!name) throw new ApiError('Name the ad account.')
  if (!AD_NETWORKS.includes(input.network)) throw new ApiError('Choose an ad network.')
  if (!(input.limitDollars >= 100 && input.limitDollars <= 100000)) throw new ApiError('Choose a simulated limit between $100 and $100,000.')
  if (s.adAccounts.some((x) => x.network === input.network && x.name.toLowerCase() === name.toLowerCase())) throw new ApiError('An ad account with this name and network already exists.')
  const ad: AdAccount = { id: uid('ad'), name, network: input.network, assetGroupId: null, limitCents: Math.round(input.limitDollars * 100), createdAt: nowISO() }
  s.adAccounts.push(ad)
  audit(s, actorId, 'Ad account added (mock)', `${name} (${input.network}). Unlinked; no user access granted; no payment method; no platform called.`)
  persist()
  return wait(ad.id)
}

export function setAdAccountLimit(actorId: string, id: string, limitDollars: number) {
  const s = db()
  requireAccountManager(s, actorId)
  const ad = s.adAccounts.find((x) => x.id === id)
  if (!ad || !canViewAdAccount(actorOf(s, actorId), id, ctx(s))) throw new ApiError('Ad account not found or not in your scope.')
  if (!(limitDollars >= 100 && limitDollars <= 100000)) throw new ApiError('Choose a simulated limit between $100 and $100,000.')
  ad.limitCents = Math.round(limitDollars * 100)
  audit(s, actorId, 'Ad account simulated limit changed', `${ad.name}: $${limitDollars}`)
  persist()
  return wait(true)
}

/** Link or unlink an ad account to an Asset Group. Linking grants nobody access; unlinking ends group roles on it. */
export function setAdAccountGroup(actorId: string, id: string, groupId: string | null) {
  const s = db()
  requireAccountManager(s, actorId)
  const ad = s.adAccounts.find((x) => x.id === id)
  if (!ad || !canViewAdAccount(actorOf(s, actorId), id, ctx(s))) throw new ApiError('Ad account not found or not in your scope.')
  if (groupId && !s.groups.some((g) => g.id === groupId)) throw new ApiError('Asset Group not found.')
  if (groupId === ad.assetGroupId) return wait(true)
  const prev = s.groups.find((g) => g.id === ad.assetGroupId)
  prev?.assignments.forEach((r) => (r.adAccountIds = r.adAccountIds.filter((x) => x !== id)))
  ad.assetGroupId = groupId
  audit(s, actorId, 'Ad account group link changed', `${ad.name} → ${s.groups.find((g) => g.id === groupId)?.name ?? 'Unlinked'}. No one gained access.`)
  persist()
  return wait(true)
}
