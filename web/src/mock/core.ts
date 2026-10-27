import type { AccessContext, Actor } from '@/domain/permissions'
import { isAdminUser } from '@/domain/roles'
import { ADMIN_ID, type DemoState } from '@/domain/types'

// Shared helpers for the mock API modules.

export class ApiError extends Error {}

export const LATENCY = 90
// Responses are deep copies, like JSON from a server, so screens never hold live store objects.
export const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value === undefined ? value : structuredClone(value)), LATENCY))
export const nowISO = () => new Date().toISOString()
export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`

export function ctx(s: DemoState): AccessContext {
  return { groups: s.groups, accounts: s.accounts, adAccounts: s.adAccounts }
}

export function actorOf(s: DemoState, actorId: string): Actor {
  if (actorId === ADMIN_ID) return { isAdmin: true, user: null }
  const user = s.users.find((u) => u.id === actorId) ?? null
  return { isAdmin: isAdminUser(user), user }
}

export function actorName(s: DemoState, actorId: string) {
  return actorId === ADMIN_ID ? 'Demo administrator' : (s.users.find((u) => u.id === actorId)?.name ?? 'Unknown user')
}

// The MCP server sets this so work done through an agent is logged as "ChatGPT for <person>".
// The browser mockup never sets it.
let auditLabel: ((name: string) => string) | null = null
export function setAuditLabel(fn: ((name: string) => string) | null) {
  auditLabel = fn
}

export function audit(s: DemoState, actorId: string, action: string, detail: string) {
  const name = actorName(s, actorId)
  s.audit.unshift({ id: uid('audit'), at: nowISO(), actor: auditLabel ? auditLabel(name) : name, action, detail })
}

export function requireAdmin(s: DemoState, actorId: string) {
  if (!actorOf(s, actorId).isAdmin) throw new ApiError('Only an administrator can do this.')
}

