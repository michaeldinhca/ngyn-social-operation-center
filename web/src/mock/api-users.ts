import { canViewAccount, canViewAdAccount, hasAccountFunction, hasAdAccountFunction } from '@/domain/permissions'
import { FUNCTION_CATALOG, isAdminUser, ROLE_FUNCTIONS, STAFF_ROLES, validEmail } from '@/domain/roles'
import type { AuditEvent, Department, FunctionId, StaffRole, User } from '@/domain/types'
import { ApiError, audit, ctx, requireAdmin, uid, wait } from './core'
import { db, persist } from './db'

// Users & Access and the Activity Log. Administrator only. These are demo access checks in the browser,
// not server-enforced authorization or real authentication.
// Rules: functions and account assignments are separate; new people have no account access; a function
// grant alone never reveals a channel or ad account; the last active administrator can't be removed.

const DEPARTMENTS: Department[] = ['Communications', 'Public Works', 'Transit', 'Recreation', 'Customer Service', 'IT']

export interface StaffRow extends User {
  groupRoles: number
  effectiveChannels: number
  effectiveAdAccounts: number
}

function effective(s: ReturnType<typeof db>, u: User) {
  const actor = { isAdmin: false, user: u }
  const c = ctx(s)
  const channels = s.accounts.filter((a) => canViewAccount(actor, a.id, c))
  const ads = s.adAccounts.filter((a) => canViewAdAccount(actor, a.id, c))
  return { channels, ads }
}

export function listStaff(actorId: string): Promise<StaffRow[]> {
  const s = db()
  requireAdmin(s, actorId)
  return wait(
    s.users.map((u) => {
      const e = effective(s, u)
      return { ...u, groupRoles: s.groups.reduce((n, g) => n + g.assignments.filter((a) => a.userId === u.id).length, 0), effectiveChannels: e.channels.length, effectiveAdAccounts: e.ads.length }
    }),
  )
}

export interface StaffDetail {
  user: User
  isAdminRole: boolean
  channels: { id: string; name: string; network: string; groupName: string | null }[]
  adAccounts: { id: string; name: string; network: string }[]
  groupRoles: { groupId: string; groupName: string; role: string; channels: string[]; adAccounts: string[] }[]
  effective: {
    channels: { id: string; name: string; network: string; via: string[]; functions: FunctionId[] }[]
    adAccounts: { id: string; name: string; network: string; via: string[]; functions: FunctionId[] }[]
  }
  allChannels: { id: string; name: string; network: string; groupName: string | null }[]
  allAdAccounts: { id: string; name: string; network: string }[]
}

export function getStaff(actorId: string, id: string): Promise<StaffDetail> {
  const s = db()
  requireAdmin(s, actorId)
  const u = s.users.find((x) => x.id === id)
  if (!u) throw new ApiError('Person not found.')
  const c = ctx(s)
  const actor = { isAdmin: false, user: u }
  const groupName = (gid: string | null) => s.groups.find((g) => g.id === gid)?.name ?? null
  const roles = s.groups.flatMap((g) => g.assignments.filter((a) => a.userId === u.id).map((a) => ({ g, a })))
  const via = (accountId: string, ad = false) => {
    const out: string[] = []
    if (ad ? u.adAccounts.includes(accountId) : u.channels.includes(accountId)) out.push('Direct assignment')
    for (const { g, a } of roles) {
      const linked = ad ? s.adAccounts.find((x) => x.id === accountId)?.assetGroupId === g.id : s.accounts.find((x) => x.id === accountId)?.assetGroupId === g.id
      if (!linked) continue
      if (ad ? a.role === 'ads' && a.adAccountIds.includes(accountId) : a.role !== 'ads' && a.channelIds.includes(accountId)) out.push(`Group role: ${a.role === 'creator' ? 'content creator' : a.role === 'approver' ? 'content approver' : 'ad manager'} in ${g.name}`)
    }
    return out
  }
  const chanFns: FunctionId[] = ['content.create', 'content.approve', 'content.publish', 'inbox.respond']
  const adFns: FunctionId[] = ['ads.create', 'ads.manage']
  return wait({
    user: u,
    isAdminRole: isAdminUser(u),
    channels: s.accounts.filter((a) => u.channels.includes(a.id)).map((a) => ({ id: a.id, name: a.name, network: a.network, groupName: groupName(a.assetGroupId) })),
    adAccounts: s.adAccounts.filter((a) => u.adAccounts.includes(a.id)).map((a) => ({ id: a.id, name: a.name, network: a.network })),
    groupRoles: roles.map(({ g, a }) => ({
      groupId: g.id,
      groupName: g.name,
      role: a.role,
      channels: a.channelIds.map((cid) => s.accounts.find((x) => x.id === cid)?.name ?? cid),
      adAccounts: a.adAccountIds.map((cid) => s.adAccounts.find((x) => x.id === cid)?.name ?? cid),
    })),
    effective: {
      channels: s.accounts
        .filter((a) => canViewAccount(actor, a.id, c))
        .map((a) => ({ id: a.id, name: a.name, network: a.network, via: via(a.id), functions: chanFns.filter((f) => hasAccountFunction(actor, f, a.id, c)) })),
      adAccounts: s.adAccounts
        .filter((a) => canViewAdAccount(actor, a.id, c))
        .map((a) => ({ id: a.id, name: a.name, network: a.network, via: via(a.id, true), functions: adFns.filter((f) => hasAdAccountFunction(actor, f, a.id, c)) })),
    },
    allChannels: s.accounts.map((a) => ({ id: a.id, name: a.name, network: a.network, groupName: groupName(a.assetGroupId) })),
    allAdAccounts: s.adAccounts.map((a) => ({ id: a.id, name: a.name, network: a.network })),
  })
}

export interface NewStaff {
  name: string
  email: string
  department: Department
  role: StaffRole
  /** Start with the usual functions for the role. Account access is never granted. */
  roleFunctions: boolean
  /** Record a simulated invitation. Nothing is sent. */
  invite: boolean
}

export function createStaff(actorId: string, input: NewStaff) {
  const s = db()
  requireAdmin(s, actorId)
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name) throw new ApiError('Enter the person’s name.')
  if (!validEmail(email)) throw new ApiError('Enter a valid login email.')
  if (s.users.some((u) => u.email.toLowerCase() === email)) throw new ApiError('Someone with this login email already exists.')
  if (!DEPARTMENTS.includes(input.department)) throw new ApiError('Choose a department.')
  if (!STAFF_ROLES.includes(input.role)) throw new ApiError('Choose a role.')
  const u: User = {
    id: uid('user'),
    name,
    email,
    department: input.department,
    role: input.role,
    status: input.invite ? 'Invited' : 'Active',
    functions: input.roleFunctions ? [...ROLE_FUNCTIONS[input.role]] : [],
    channels: [],
    adAccounts: [],
  }
  s.users.push(u)
  audit(s, actorId, 'Person created', `${name} (${email}), ${input.role}, ${input.department}. ${u.functions.length} function(s); no channel or ad account access.`)
  if (input.invite) audit(s, actorId, 'Invitation recorded (simulated)', `${name}. No email was sent.`)
  persist()
  return wait(u.id)
}

export interface StaffPatch {
  name: string
  email: string
  department: Department
  role: StaffRole
  status: User['status']
  functions: FunctionId[]
  channels: string[]
  adAccounts: string[]
}

export function updateStaff(actorId: string, id: string, patch: StaffPatch) {
  const s = db()
  requireAdmin(s, actorId)
  const u = s.users.find((x) => x.id === id)
  if (!u) throw new ApiError('Person not found.')
  const name = patch.name.trim()
  const email = patch.email.trim().toLowerCase()
  if (!name) throw new ApiError('Enter the person’s name.')
  if (!validEmail(email)) throw new ApiError('Enter a valid login email.')
  if (s.users.some((x) => x.id !== id && x.email.toLowerCase() === email)) throw new ApiError('Someone with this login email already exists.')
  const known = new Set(FUNCTION_CATALOG.map((f) => f.id))
  if (patch.functions.some((f) => !known.has(f))) throw new ApiError('Unknown function.')
  if (patch.channels.some((cid) => !s.accounts.some((a) => a.id === cid))) throw new ApiError('Unknown channel.')
  if (patch.adAccounts.some((cid) => !s.adAccounts.some((a) => a.id === cid))) throw new ApiError('Unknown ad account.')

  const wasAdmin = isAdminUser(u)
  const willBeAdmin = isAdminUser({ status: patch.status, functions: patch.functions })
  if (wasAdmin && !willBeAdmin && !s.users.some((x) => x.id !== id && isAdminUser(x))) {
    throw new ApiError('This is the last active administrator. Make someone else an active administrator first.')
  }

  const changes: string[] = []
  const diff = (label: string, a: string[], b: string[]) => {
    const add = b.filter((x) => !a.includes(x))
    const rem = a.filter((x) => !b.includes(x))
    if (add.length) changes.push(`${label} added: ${add.join(', ')}`)
    if (rem.length) changes.push(`${label} removed: ${rem.join(', ')}`)
  }
  const chanName = (ids: string[]) => ids.map((x) => s.accounts.find((a) => a.id === x)?.name ?? x)
  const adName = (ids: string[]) => ids.map((x) => s.adAccounts.find((a) => a.id === x)?.name ?? x)
  if (name !== u.name) changes.push(`name → ${name}`)
  if (email !== u.email) changes.push(`email → ${email}`)
  if (patch.department !== u.department) changes.push(`department → ${patch.department}`)
  if (patch.role !== u.role) changes.push(`role → ${patch.role}`)
  if (patch.status !== u.status) changes.push(`status → ${patch.status}`)
  diff('functions', u.functions, patch.functions)
  diff('channels', chanName(u.channels), chanName(patch.channels))
  diff('ad accounts', adName(u.adAccounts), adName(patch.adAccounts))

  Object.assign(u, { name, email, department: patch.department, role: patch.role, status: patch.status, functions: patch.functions, channels: patch.channels, adAccounts: patch.adAccounts })
  if (changes.length) audit(s, actorId, 'Permission changed', `${u.name}: ${changes.join('; ')}`)
  persist()
  return wait(changes.length)
}

/** Simulated invitation: records the intent and nothing else. No email, no token. */
export function recordInvitation(actorId: string, id: string) {
  const s = db()
  requireAdmin(s, actorId)
  const u = s.users.find((x) => x.id === id)
  if (!u) throw new ApiError('Person not found.')
  if (u.status === 'Active') throw new ApiError('This person is already active.')
  if (u.status === 'Suspended') throw new ApiError('Reactivate a suspended person before inviting them.')
  audit(s, actorId, 'Invitation recorded (simulated)', `${u.name} (${u.email}). No email was sent.`)
  persist()
  return wait(true)
}

export function acceptInvitation(actorId: string, id: string) {
  const s = db()
  requireAdmin(s, actorId)
  const u = s.users.find((x) => x.id === id)
  if (!u || u.status !== 'Invited') throw new ApiError('Only an invited person can be marked as accepted.')
  u.status = 'Active'
  audit(s, actorId, 'Invitation marked accepted (demo)', `${u.name}. In production the person accepts it themselves.`)
  persist()
  return wait(true)
}

// ---------- Activity log ----------

export const AUDIT_CATEGORIES = ['Access', 'Content', 'Engagement', 'Channels and groups', 'Media', 'Advertising', 'Emergency', 'Reports', 'System'] as const
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

export function categorize(action: string): AuditCategory {
  const a = action.toLowerCase()
  if (/emergency|resumed|pause/.test(a)) return 'Emergency'
  if (/campaign|ad account|launch|advert/.test(a)) return 'Advertising'
  if (/permission|person|invitation|group role/.test(a)) return 'Access'
  if (/media|folder/.test(a)) return 'Media'
  if (/report|listening/.test(a)) return 'Reports'
  if (/conversation|note|reply|routing/.test(a)) return 'Engagement'
  if (/channel|asset group|guideline|master|brand|reconnect|token/.test(a)) return 'Channels and groups'
  if (/post|draft|submitted|publication/.test(a)) return 'Content'
  return 'System'
}

export interface AuditFilters {
  q: string
  actor: string
  category: AuditCategory | 'All'
  from: string
  to: string
  page: number
}

export interface AuditPage {
  rows: (AuditEvent & { category: AuditCategory })[]
  total: number
  page: number
  pages: number
  pageSize: number
  actors: string[]
}

const PAGE_SIZE = 25

export function listAudit(actorId: string, f: AuditFilters): Promise<AuditPage> {
  const s = db()
  requireAdmin(s, actorId)
  const q = f.q.trim().toLowerCase()
  const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : null
  const to = f.to ? new Date(f.to + 'T23:59:59').getTime() : null
  const all = [...s.audit].sort((a, b) => b.at.localeCompare(a.at)).map((e) => ({ ...e, category: categorize(e.action) }))
  const rows = all
    .filter((e) => f.actor === 'All' || e.actor === f.actor)
    .filter((e) => f.category === 'All' || e.category === f.category)
    .filter((e) => (from === null || new Date(e.at).getTime() >= from) && (to === null || new Date(e.at).getTime() <= to))
    .filter((e) => !q || (e.action + ' ' + e.detail + ' ' + e.actor).toLowerCase().includes(q))
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, f.page), pages)
  return wait({ rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: rows.length, page, pages, pageSize: PAGE_SIZE, actors: [...new Set(all.map((e) => e.actor))].sort() })
}
