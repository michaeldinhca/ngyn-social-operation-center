import { compileBrief, draftVoice, isCompletePackage, masterChanged, packageProblems, validHttpsUrl, validPalette, type CompiledBrief } from '@/domain/brand'
import { connectionStatus } from '@/domain/connection'
import { canViewAccount, GROUP_ROLE_FUNCTIONS, hasFunction } from '@/domain/permissions'
import {
  NETWORKS,
  type AdAccount,
  type AssetGroup,
  type BrandVoice,
  type DemoState,
  type GroupRole,
  type GuidelineSet,
  type MasterDirection,
  type Network,
  type SocialAccount,
} from '@/domain/types'
import { compactMark } from './brand-seed'
import { actorName, actorOf, ApiError, audit, ctx, nowISO, uid, wait } from './core'
import { db, persist } from './db'

// Social Channels and Asset Groups. Rules enforced here:
// - Channels are created independently, unlinked, and grant nobody access.
// - Linking a channel to a group grants nobody access; group roles cover only explicitly selected channels.
// - A group can be edited only with assets.manage AND access to every channel linked to it.
// - Deleting needs assets.delete; it unlinks channels, ends group-scoped roles and archives the group.

const DAY = 864e5

function syncConnections(s: DemoState) {
  s.accounts.forEach((a) => (a.connection.status = connectionStatus(a)))
}

function requireFn(s: DemoState, actorId: string, fn: 'channels.manage' | 'assets.manage' | 'assets.delete', message: string) {
  if (!hasFunction(actorOf(s, actorId), fn, ctx(s))) throw new ApiError(message)
}

// ---------- Platform capabilities (from Zernio docs; unverified, see docs/PLATFORM_CAPABILITY_MATRIX.md) ----------

export type CapabilityLevel = 'Listed' | 'Partial' | 'Not available' | 'Unknown'
export interface Capability {
  label: string
  level: CapabilityLevel
  note?: string
}

export const CAPABILITIES: Record<Network, Capability[]> = {
  Facebook: [
    { label: 'Publish text, images, video, reels', level: 'Listed' },
    { label: 'ALT text on images', level: 'Unknown' },
    { label: 'Read and reply to comments', level: 'Listed' },
    { label: 'Read and send DMs', level: 'Listed' },
    { label: 'Post analytics', level: 'Listed' },
    { label: 'Comment and message webhooks', level: 'Listed' },
  ],
  Instagram: [
    { label: 'Publish feed, stories, reels, carousels', level: 'Listed' },
    { label: 'ALT text on images', level: 'Unknown' },
    { label: 'Read and reply to comments', level: 'Listed' },
    { label: 'Read and send DMs', level: 'Listed' },
    { label: 'Post and account analytics', level: 'Listed' },
    { label: 'Comment and message webhooks', level: 'Listed' },
  ],
  Bluesky: [
    { label: 'Publish text, images, video', level: 'Partial', note: 'Provider marks Bluesky publishing as limited' },
    { label: 'ALT text on images', level: 'Unknown' },
    { label: 'Read comments', level: 'Listed' },
    { label: 'Read and send DMs', level: 'Partial', note: 'No DM attachments' },
    { label: 'Post analytics', level: 'Listed' },
    { label: 'Message lifecycle webhooks', level: 'Not available' },
  ],
  LinkedIn: [
    { label: 'Publish text, images, video, documents', level: 'Listed' },
    { label: 'ALT text on images', level: 'Unknown' },
    { label: 'Reply to comments', level: 'Partial', note: 'Public replies only' },
    { label: 'Read and send DMs', level: 'Not available' },
    { label: 'Post analytics', level: 'Partial', note: 'Some metrics differ for organization pages' },
    { label: 'Comment webhooks', level: 'Listed' },
  ],
  YouTube: [
    { label: 'Publish videos and Shorts', level: 'Listed' },
    { label: 'Text or image posts', level: 'Not available' },
    { label: 'Reply to comments', level: 'Partial', note: 'Public replies only' },
    { label: 'Direct messages', level: 'Not available', note: 'YouTube has no DMs' },
    { label: 'Video analytics and demographics', level: 'Listed' },
    { label: 'Comment webhooks', level: 'Listed' },
  ],
  X: [
    { label: 'Publish text, images, video, threads', level: 'Listed', note: 'X API costs pass through' },
    { label: 'ALT text on images', level: 'Unknown' },
    { label: 'Read comments', level: 'Partial', note: 'Needs provider comment polling enabled' },
    { label: 'Read and send DMs', level: 'Partial', note: 'Needs extra scopes' },
    { label: 'Post analytics', level: 'Listed' },
    { label: 'Message lifecycle webhooks', level: 'Not available' },
  ],
}

// ---------- Channels ----------

export interface ChannelRow extends SocialAccount {
  groupName: string | null
  accessCount: number
}

function accessCount(s: DemoState, accountId: string) {
  return s.users.filter((u) => canViewAccount({ isAdmin: false, user: u }, accountId, ctx(s))).length
}

export function listChannels(actorId: string): Promise<ChannelRow[]> {
  const s = db()
  syncConnections(s)
  requireFn(s, actorId, 'channels.manage', 'Managing social connections needs the "Manage social connections" function.')
  const actor = actorOf(s, actorId)
  return wait(
    s.accounts
      .filter((a) => canViewAccount(actor, a.id, ctx(s)))
      .map((a) => ({ ...a, groupName: s.groups.find((g) => g.id === a.assetGroupId)?.name ?? null, accessCount: accessCount(s, a.id) })),
  )
}

export interface AccessEntry {
  userId: string
  name: string
  role: string
  via: string
  functions: string[]
}

export interface ChannelDetail {
  account: SocialAccount
  groupName: string | null
  access: AccessEntry[]
  capabilities: Capability[]
}

export function getChannel(actorId: string, id: string): Promise<ChannelDetail> {
  const s = db()
  syncConnections(s)
  requireFn(s, actorId, 'channels.manage', 'Managing social connections needs the "Manage social connections" function.')
  const account = s.accounts.find((a) => a.id === id)
  if (!account || !canViewAccount(actorOf(s, actorId), id, ctx(s))) throw new ApiError('Channel not found or not in your account scope.')
  const access: AccessEntry[] = []
  for (const u of s.users) {
    if (u.status !== 'Active') continue
    if (u.channels.includes(id)) access.push({ userId: u.id, name: u.name, role: u.role, via: 'Direct assignment', functions: u.functions.filter((f) => !f.startsWith('ads.') && !f.startsWith('assets.') && !f.startsWith('channels.')) })
    const g = s.groups.find((x) => x.id === account.assetGroupId)
    g?.assignments
      .filter((a) => a.userId === u.id && a.role !== 'ads' && a.channelIds.includes(id))
      .forEach((a) => access.push({ userId: u.id, name: u.name, role: u.role, via: `Group role: ${a.role === 'creator' ? 'content creator' : 'content approver'} in ${g.name}`, functions: GROUP_ROLE_FUNCTIONS[a.role] }))
  }
  return wait({ account, groupName: s.groups.find((g) => g.id === account.assetGroupId)?.name ?? null, access, capabilities: CAPABILITIES[account.network] })
}

export function createChannel(actorId: string, input: { network: Network; name: string; handle: string; expiresOn: string }) {
  const s = db()
  requireFn(s, actorId, 'channels.manage', 'Adding channels needs the "Manage social connections" function.')
  const name = input.name.trim()
  if (!NETWORKS.includes(input.network)) throw new ApiError('Choose a supported network.')
  if (!name) throw new ApiError('Enter the account display name.')
  if (s.accounts.some((a) => a.network === input.network && a.name.toLowerCase() === name.toLowerCase())) throw new ApiError(`A ${input.network} channel with this name already exists.`)
  const expires = new Date(input.expiresOn + 'T23:59:59Z')
  if (Number.isNaN(expires.getTime())) throw new ApiError('Choose a simulated token expiry date.')
  const actor = actorOf(s, actorId)
  const account: SocialAccount = {
    id: uid('social'),
    name,
    handle: input.handle.trim() || name,
    network: input.network,
    department: actor.user?.department ?? 'Communications',
    assetGroupId: null,
    connection: { status: 'Healthy', expiresAt: expires.toISOString(), lastSync: nowISO() },
  }
  account.connection.status = connectionStatus(account)
  s.accounts.push(account)
  audit(s, actorId, 'Independent channel created (mock)', `${input.network} · ${name}. Unlinked; no user access granted; no provider called.`)
  persist()
  return wait({ id: account.id, visibleToCreator: actor.isAdmin })
}

function loadChannel(s: DemoState, actorId: string, id: string) {
  requireFn(s, actorId, 'channels.manage', 'Managing connections needs the "Manage social connections" function.')
  const a = s.accounts.find((x) => x.id === id)
  if (!a || !canViewAccount(actorOf(s, actorId), id, ctx(s))) throw new ApiError('Channel not found or not in your account scope.')
  return a
}

export function setTokenExpiry(actorId: string, id: string, date: string) {
  const s = db()
  const a = loadChannel(s, actorId, id)
  const d = new Date(date + 'T23:59:59Z')
  if (Number.isNaN(d.getTime())) throw new ApiError('Choose a date.')
  a.connection.expiresAt = d.toISOString()
  a.connection.status = connectionStatus(a)
  audit(s, actorId, 'Simulated token expiry changed', `${a.name} → ${date}`)
  persist()
  return wait(a.connection.status)
}

export function reauthorizeChannel(actorId: string, id: string) {
  const s = db()
  const a = loadChannel(s, actorId, id)
  a.connection = { status: 'Healthy', expiresAt: new Date(Date.now() + 60 * DAY).toISOString(), lastSync: nowISO() }
  audit(s, actorId, 'Mock reauthorization', `${a.name}: expiry extended 60 days. No real token obtained.`)
  persist()
  return wait(true)
}

// ---------- Asset Groups ----------

function canEdit(s: DemoState, actorId: string, g: AssetGroup) {
  const actor = actorOf(s, actorId)
  if (!hasFunction(actor, 'assets.manage', ctx(s))) return false
  return s.accounts.filter((a) => a.assetGroupId === g.id).every((a) => canViewAccount(actor, a.id, ctx(s)))
}

function canDelete(s: DemoState, actorId: string, g: AssetGroup) {
  const actor = actorOf(s, actorId)
  if (!hasFunction(actor, 'assets.delete', ctx(s))) return false
  return s.accounts.filter((a) => a.assetGroupId === g.id).every((a) => canViewAccount(actor, a.id, ctx(s)))
}

function loadGroup(s: DemoState, actorId: string, id: string, need: 'view' | 'edit' = 'view') {
  const g = s.groups.find((x) => x.id === id)
  if (!g) throw new ApiError('Asset Group not found.')
  const actor = actorOf(s, actorId)
  const inScope = s.accounts.filter((a) => a.assetGroupId === g.id).every((a) => canViewAccount(actor, a.id, ctx(s)))
  if (!inScope) throw new ApiError('This Asset Group links channels outside your account scope.')
  if (need === 'edit' && !canEdit(s, actorId, g)) throw new ApiError('Editing an Asset Group needs "Manage asset groups" and access to every linked channel.')
  return g
}

export interface GroupSummary {
  id: string
  name: string
  color: string
  channelCount: number
  reviewedSets: number
  totalSets: number
  people: number
}

export function listGroups(actorId: string): Promise<{ groups: GroupSummary[]; archived: number; canCreate: boolean }> {
  const s = db()
  const actor = actorOf(s, actorId)
  const c = ctx(s)
  if (!hasFunction(actor, 'assets.manage', c) && !hasFunction(actor, 'assets.delete', c)) throw new ApiError('Asset Groups need "Manage asset groups" or "Delete asset groups".')
  const groups = s.groups
    .filter((g) => s.accounts.filter((a) => a.assetGroupId === g.id).every((a) => canViewAccount(actor, a.id, c)))
    .map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      channelCount: s.accounts.filter((a) => a.assetGroupId === g.id).length,
      reviewedSets: g.brand.sets.filter((x) => x.reviewed).length,
      totalSets: g.brand.sets.length,
      people: new Set(g.assignments.map((a) => a.userId)).size,
    }))
  return wait({ groups, archived: s.archivedGroups.length, canCreate: hasFunction(actor, 'assets.manage', c) })
}

export interface GroupDetail {
  group: AssetGroup
  channels: SocialAccount[]
  /** Channels the actor could link: unlinked or in this group, inside their scope. Others shown for context. */
  linkable: (SocialAccount & { otherGroup: string | null })[]
  people: { userId: string; name: string; role: GroupRole; staffRole: string; channelIds: string[]; adAccountIds: string[] }[]
  /** Ad accounts linked to this group. Ad-manager roles can only cover these. */
  adAccounts: AdAccount[]
  staff: { id: string; name: string; role: string; department: string }[]
  canEdit: boolean
  canDelete: boolean
  actorName: string
}

export function getGroup(actorId: string, id: string): Promise<GroupDetail> {
  const s = db()
  syncConnections(s)
  const g = loadGroup(s, actorId, id)
  const actor = actorOf(s, actorId)
  return wait({
    group: g,
    channels: s.accounts.filter((a) => a.assetGroupId === g.id),
    linkable: s.accounts
      .filter((a) => canViewAccount(actor, a.id, ctx(s)))
      .map((a) => ({ ...a, otherGroup: a.assetGroupId && a.assetGroupId !== g.id ? (s.groups.find((x) => x.id === a.assetGroupId)?.name ?? null) : null })),
    people: g.assignments.map((a) => {
      const u = s.users.find((x) => x.id === a.userId)
      return { userId: a.userId, name: u?.name ?? 'Unknown', role: a.role, staffRole: u?.role ?? '', channelIds: a.channelIds, adAccountIds: a.adAccountIds }
    }),
    adAccounts: s.adAccounts.filter((x) => x.assetGroupId === g.id),
    staff: s.users.filter((u) => u.status === 'Active').map((u) => ({ id: u.id, name: u.name, role: u.role, department: u.department })),
    canEdit: canEdit(s, actorId, g),
    canDelete: canDelete(s, actorId, g),
    actorName: actorName(s, actorId),
  })
}

export function createGroup(actorId: string, input: { name: string; color: string; description: string }) {
  const s = db()
  requireFn(s, actorId, 'assets.manage', 'Creating groups needs "Manage asset groups".')
  const name = input.name.trim()
  if (!name) throw new ApiError('Enter a group name.')
  if (s.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) throw new ApiError('A group with this name already exists.')
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new ApiError('Choose a valid colour.')
  const now = nowISO()
  const who = actorName(s, actorId)
  const g: AssetGroup = {
    id: uid('asset'),
    name,
    color: input.color,
    description: input.description.trim(),
    assignments: [],
    createdAt: now,
    brand: {
      master: {
        name,
        logos: [{ id: 'logo-compact', name: 'Compact mark', image: compactMark('#151813', input.color) }],
        palette: [input.color, '#151813'],
        headingFont: 'Inter Bold',
        bodyFont: 'Inter Regular',
        voice: '',
        mood: '',
        tone: '',
        dos: ['Use verified service facts only.', 'Write ALT text for every image.'],
        donts: ['Never disclose resident personal information.', 'Never publish without human approval.'],
        updatedAt: now,
        updatedBy: who,
      },
      sets: [],
      voices: [],
    },
  }
  s.groups.push(g)
  audit(s, actorId, 'Asset Group created', `${name}. No channels linked, no people assigned.`)
  persist()
  return wait(g.id)
}

export function updateGroup(actorId: string, id: string, input: { name: string; color: string; description: string }) {
  const s = db()
  const g = loadGroup(s, actorId, id, 'edit')
  if (!input.name.trim()) throw new ApiError('Enter a group name.')
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new ApiError('Choose a valid colour.')
  Object.assign(g, { name: input.name.trim(), color: input.color, description: input.description.trim() })
  audit(s, actorId, 'Asset Group details saved', g.name)
  persist()
  return wait(true)
}

/** Link the chosen channels; unlink this group's channels that were not chosen. Unlinking strips them from group roles. */
export function setGroupChannels(actorId: string, id: string, channelIds: string[]) {
  const s = db()
  const g = loadGroup(s, actorId, id, 'edit')
  const actor = actorOf(s, actorId)
  let linked = 0
  let unlinked = 0
  for (const a of s.accounts) {
    if (!canViewAccount(actor, a.id, ctx(s))) continue
    const chosen = channelIds.includes(a.id)
    if (chosen && a.assetGroupId === null) {
      a.assetGroupId = g.id
      linked++
    } else if (chosen && a.assetGroupId !== g.id) {
      throw new ApiError(`${a.name} belongs to another group. Unlink it there first.`)
    } else if (!chosen && a.assetGroupId === g.id) {
      a.assetGroupId = null
      g.assignments.forEach((x) => (x.channelIds = x.channelIds.filter((c) => c !== a.id)))
      unlinked++
    }
  }
  audit(s, actorId, 'Asset Group channel links updated', `${g.name}: ${linked} linked, ${unlinked} unlinked. No one gained access.`)
  persist()
  return wait({ linked, unlinked })
}

export function deleteGroup(actorId: string, id: string, confirm: string) {
  const s = db()
  const g = loadGroup(s, actorId, id)
  if (!canDelete(s, actorId, g)) throw new ApiError('Deleting needs "Delete asset groups" and access to every linked channel.')
  if (confirm !== 'DELETE') throw new ApiError('Type DELETE to confirm.')
  const unlinked = s.accounts.filter((a) => a.assetGroupId === g.id)
  unlinked.forEach((a) => (a.assetGroupId = null))
  const unlinkedAds = s.adAccounts.filter((a) => a.assetGroupId === g.id)
  unlinkedAds.forEach((a) => (a.assetGroupId = null))
  s.archivedGroups.push({ ...structuredClone(g), archivedAt: nowISO(), archivedBy: actorName(s, actorId), unlinkedChannelIds: unlinked.map((a) => a.id) })
  s.groups = s.groups.filter((x) => x.id !== g.id)
  audit(s, actorId, 'Asset Group deleted (archived)', `${g.name}: ${unlinked.length} channels unlinked and kept. ${unlinkedAds.length} ad account(s) unlinked and kept. Group roles ended; direct grants unchanged.`)
  persist()
  return wait(unlinked.length)
}

export function assignGroupRole(actorId: string, groupId: string, role: GroupRole, userIds: string[], channelIds: string[], adAccountIds: string[] = []) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  if (!userIds.length) throw new ApiError('Select at least one person.')
  const linked = new Set(s.accounts.filter((a) => a.assetGroupId === g.id).map((a) => a.id))
  const linkedAds = new Set(s.adAccounts.filter((a) => a.assetGroupId === g.id).map((a) => a.id))
  if (role === 'ads') {
    if (!adAccountIds.length) throw new ApiError('Select the ad accounts this role covers. Nothing is selected by default.')
    if (adAccountIds.some((x) => !linkedAds.has(x))) throw new ApiError('Only ad accounts linked to this group can be selected.')
  } else {
    if (!channelIds.length) throw new ApiError('Select the channels this role covers. Nothing is selected by default.')
    if (channelIds.some((c) => !linked.has(c))) throw new ApiError('Only channels linked to this group can be selected.')
  }
  for (const userId of userIds) {
    if (!s.users.some((u) => u.id === userId && u.status === 'Active')) throw new ApiError('Only active staff can be assigned.')
    const prior = g.assignments.find((a) => a.userId === userId && a.role === role)
    if (prior) {
      if (role === 'ads') prior.adAccountIds = [...new Set([...prior.adAccountIds, ...adAccountIds])]
      else prior.channelIds = [...new Set([...prior.channelIds, ...channelIds])]
    } else g.assignments.push({ userId, role, channelIds: role === 'ads' ? [] : [...channelIds], adAccountIds: role === 'ads' ? [...adAccountIds] : [] })
  }
  audit(s, actorId, 'Group role assigned', `${g.name}: ${role} for ${userIds.length} person(s), ${role === 'ads' ? `${adAccountIds.length} ad account(s)` : `${channelIds.length} channel(s)`}.`)
  persist()
  return wait(true)
}

export function updateGroupRole(actorId: string, groupId: string, userId: string, role: GroupRole, channelIds: string[], adAccountIds: string[] = []) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  const a = g.assignments.find((x) => x.userId === userId && x.role === role)
  if (!a) throw new ApiError('Assignment not found.')
  if (role === 'ads') {
    const linkedAds = new Set(s.adAccounts.filter((x) => x.assetGroupId === g.id).map((x) => x.id))
    if (adAccountIds.some((x) => !linkedAds.has(x))) throw new ApiError('Only ad accounts linked to this group can be selected.')
    if (!adAccountIds.length) throw new ApiError('Keep at least one ad account, or remove the role.')
    a.adAccountIds = adAccountIds
    audit(s, actorId, 'Group role ad accounts changed', `${g.name}: ads, ${adAccountIds.length} ad account(s).`)
  } else {
    const linked = new Set(s.accounts.filter((x) => x.assetGroupId === g.id).map((x) => x.id))
    if (channelIds.some((c) => !linked.has(c))) throw new ApiError('Only channels linked to this group can be selected.')
    if (!channelIds.length) throw new ApiError('Keep at least one channel, or remove the role.')
    a.channelIds = channelIds
    audit(s, actorId, 'Group role channels changed', `${g.name}: ${role}, ${channelIds.length} channel(s).`)
  }
  persist()
  return wait(true)
}

export function removeGroupRole(actorId: string, groupId: string, userId: string, role: GroupRole) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  g.assignments = g.assignments.filter((a) => !(a.userId === userId && a.role === role))
  audit(s, actorId, 'Group role removed', `${g.name}: ${role}. Direct grants unchanged.`)
  persist()
  return wait(true)
}

// ---------- Brand direction ----------

export function saveMaster(actorId: string, groupId: string, master: MasterDirection) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  if (!master.name.trim()) throw new ApiError('Enter the brand name.')
  if (!master.logos.length) throw new ApiError('Keep at least one logo version.')
  if (master.logos.length > 8) throw new ApiError('Use up to 8 logo versions in this demo.')
  if (master.logos.some((l) => !l.name.trim())) throw new ApiError('Name every logo version.')
  if (!validPalette(master.palette)) throw new ApiError('Use two or three valid six-digit hex colours.')
  const next: MasterDirection = { ...master, dos: master.dos.map((x) => x.trim()).filter(Boolean), donts: master.donts.map((x) => x.trim()).filter(Boolean), updatedAt: nowISO(), updatedBy: actorName(s, actorId) }
  if (!next.dos.length || !next.donts.length) throw new ApiError('Keep at least one DO and one DON’T rule.')
  const changed = masterChanged(g.brand.master, next)
  g.brand.master = next
  let invalidated = 0
  if (changed) {
    for (const x of [...g.brand.sets, ...g.brand.voices]) {
      if (x.reviewed) invalidated++
      x.reviewed = null
    }
  }
  audit(s, actorId, 'Master direction saved', `${g.name}${changed ? `: ${invalidated} reviewed item(s) need review again` : ': no rule changes'}`)
  persist()
  return wait({ changed, invalidated })
}

export function addGuidelineSet(actorId: string, groupId: string) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  const set: GuidelineSet = { id: uid('set'), name: `New guideline ${g.brand.sets.length + 1}`, purpose: '', voice: '', voiceId: null, dos: [], donts: [], visuals: [], reviewed: null }
  g.brand.sets.push(set)
  audit(s, actorId, 'Guideline set added', g.name)
  persist()
  return wait(set.id)
}

/** Saving with attest=true marks the set reviewed; any save without it clears the review. */
export function saveGuidelineSet(actorId: string, groupId: string, set: GuidelineSet, attest: boolean) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  const i = g.brand.sets.findIndex((x) => x.id === set.id)
  if (i < 0) throw new ApiError('Guideline set not found.')
  const clean: GuidelineSet = { ...set, name: set.name.trim(), purpose: set.purpose.trim(), dos: set.dos.map((x) => x.trim()).filter(Boolean), donts: set.donts.map((x) => x.trim()).filter(Boolean) }
  if (attest && !isCompletePackage(clean)) throw new ApiError(`Not ready for review: ${packageProblems(clean).join(' ')}`)
  clean.reviewed = attest ? { by: actorName(s, actorId), at: nowISO() } : null
  g.brand.sets[i] = clean
  audit(s, actorId, attest ? 'Guideline set reviewed' : 'Guideline set saved (needs review)', `${g.name} · ${clean.name}`)
  persist()
  return wait(attest)
}

export function deleteGuidelineSet(actorId: string, groupId: string, setId: string) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  g.brand.sets = g.brand.sets.filter((x) => x.id !== setId)
  audit(s, actorId, 'Guideline set removed', g.name)
  persist()
  return wait(true)
}

export function briefPreview(actorId: string, groupId: string, setId: string): Promise<{ brief: CompiledBrief; exportable: boolean; reason: string | null }> {
  const s = db()
  const g = loadGroup(s, actorId, groupId)
  const set = g.brand.sets.find((x) => x.id === setId)
  if (!set) throw new ApiError('Guideline set not found.')
  const voice = g.brand.voices.find((v) => v.id === set.voiceId) ?? null
  const reason = !isCompletePackage(set) ? packageProblems(set).join(' ') : !set.reviewed ? 'Mark the set reviewed against the master rules first.' : null
  return wait({ brief: compileBrief(g.brand.master, set, voice), exportable: !reason, reason })
}

// ---------- Brand voices ----------

export function draftBrandVoice(actorId: string, groupId: string, input: { name: string; method: 'website' | 'description'; source: string; context: string }) {
  const s = db()
  loadGroup(s, actorId, groupId, 'edit')
  if (!input.name.trim()) throw new ApiError('Name the Brand Voice.')
  if (!input.source.trim()) throw new ApiError(input.method === 'website' ? 'Enter a website URL.' : 'Describe your brand.')
  if (input.method === 'website' && !validHttpsUrl(input.source.trim())) throw new ApiError('Enter a valid HTTPS website URL.')
  if (input.context.length > 500) throw new ApiError('Keep additional context to 500 characters.')
  const draft: BrandVoice = { id: uid('voice'), name: input.name.trim(), method: input.method, source: input.source.trim(), context: input.context.trim(), ...draftVoice(input.method, input.source, input.context), reviewed: null, createdAt: nowISO() }
  return wait(draft)
}

export function saveBrandVoice(actorId: string, groupId: string, voice: BrandVoice, attest: boolean) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  if (['name', 'voice', 'mood', 'tone', 'audience'].some((k) => !String(voice[k as keyof BrandVoice] ?? '').trim())) throw new ApiError('Fill in name, voice, mood, tone and audience.')
  const saved = { ...voice, reviewed: attest ? { by: actorName(s, actorId), at: nowISO() } : null }
  const i = g.brand.voices.findIndex((v) => v.id === voice.id)
  if (i >= 0) g.brand.voices[i] = saved
  else g.brand.voices.push(saved)
  // A voice change means every set using it needs review again.
  g.brand.sets.filter((x) => x.voiceId === voice.id).forEach((x) => (x.reviewed = null))
  audit(s, actorId, 'Brand Voice saved', `${g.name} · ${saved.name} · ${attest ? 'reviewed' : 'draft'}. No website fetched, no AI call.`)
  persist()
  return wait(true)
}

export function applyBrandVoice(actorId: string, groupId: string, voiceId: string, setId: string) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  const v = g.brand.voices.find((x) => x.id === voiceId)
  const set = g.brand.sets.find((x) => x.id === setId)
  if (!v || !set) throw new ApiError('Voice or guideline set not found.')
  if (!v.reviewed) throw new ApiError('Review the Brand Voice before applying it.')
  set.voiceId = v.id
  set.voice = `${v.voice} Mood: ${v.mood}. Tone: ${v.tone}. Audience: ${v.audience}.`
  set.reviewed = null
  audit(s, actorId, 'Brand Voice applied to guideline', `${v.name} → ${set.name}. Visuals kept; set needs review.`)
  persist()
  return wait(true)
}

export function deleteBrandVoice(actorId: string, groupId: string, voiceId: string) {
  const s = db()
  const g = loadGroup(s, actorId, groupId, 'edit')
  g.brand.voices = g.brand.voices.filter((v) => v.id !== voiceId)
  g.brand.sets.filter((x) => x.voiceId === voiceId).forEach((x) => {
    x.voiceId = null
    x.reviewed = null
  })
  audit(s, actorId, 'Brand Voice removed', g.name)
  persist()
  return wait(true)
}
