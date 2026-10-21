import type { AssetGroup, FunctionId, GroupRole, SocialAccount, User } from './types'

// Access rules (see docs/handoff/CLAUDE_HANDOFF.md, "Domain and access rules"):
// - Function permissions and account assignments are separate; both are required.
// - Group roles grant their functions only on the channels explicitly selected in that
//   group, and only while the channel is still linked to that group.
// - Removing a group role never revokes a direct grant.

export const GROUP_ROLE_FUNCTIONS: Record<GroupRole, FunctionId[]> = {
  creator: ['content.create'],
  approver: ['content.approve'],
  ads: ['ads.create', 'ads.manage'],
}

export interface AccessContext {
  groups: AssetGroup[]
  accounts: SocialAccount[]
}

export interface Actor {
  isAdmin: boolean
  user: User | null
}

function groupAssignments(user: User, ctx: AccessContext) {
  return ctx.groups.flatMap((g) => g.assignments.filter((a) => a.userId === user.id).map((a) => ({ ...a, groupId: g.id })))
}

/** True when the actor holds the function anywhere (directly or through any group role). Used for navigation. */
export function hasFunction(actor: Actor, fn: FunctionId, ctx: AccessContext): boolean {
  if (actor.isAdmin) return true
  const user = actor.user
  if (!user || user.status !== 'Active') return false
  if (user.functions.includes(fn)) return true
  return groupAssignments(user, ctx).some((a) => GROUP_ROLE_FUNCTIONS[a.role].includes(fn))
}

/** Function AND account: the check every action on a channel must pass. */
export function hasAccountFunction(actor: Actor, fn: FunctionId, accountId: string, ctx: AccessContext): boolean {
  if (actor.isAdmin) return true
  const user = actor.user
  if (!user || user.status !== 'Active') return false
  if (user.functions.includes(fn) && user.channels.includes(accountId)) return true
  const account = ctx.accounts.find((c) => c.id === accountId)
  if (!account) return false
  return groupAssignments(user, ctx).some(
    (a) =>
      a.role !== 'ads' &&
      a.groupId === account.assetGroupId &&
      a.channelIds.includes(accountId) &&
      GROUP_ROLE_FUNCTIONS[a.role].includes(fn),
  )
}

/** Whether the actor may see a channel's records at all (direct assignment or any group role on it). */
export function canViewAccount(actor: Actor, accountId: string, ctx: AccessContext): boolean {
  if (actor.isAdmin) return true
  const user = actor.user
  if (!user || user.status !== 'Active') return false
  if (user.channels.includes(accountId)) return true
  const account = ctx.accounts.find((c) => c.id === accountId)
  if (!account) return false
  return groupAssignments(user, ctx).some(
    (a) => a.role !== 'ads' && a.groupId === account.assetGroupId && a.channelIds.includes(accountId),
  )
}

export function visibleAccounts(actor: Actor, ctx: AccessContext): SocialAccount[] {
  return ctx.accounts.filter((c) => canViewAccount(actor, c.id, ctx))
}
