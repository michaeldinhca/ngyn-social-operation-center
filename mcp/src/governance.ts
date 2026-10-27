// What an administrator allows agents to do (ADR 0005). Kept in .data/governance.json.
// - Agent access per person: none (default), read, or draft. A new person grants nothing.
// - Resident content: off by default. Turning it on records the municipality's written approval.
// - Revoking signs a person's agents out: tokens issued before that moment stop working.
//
// The admin command writes this file; the running server re-reads it when it changes, so neither
// holds a stale copy. Each change carries a log line that the server copies into the activity log.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type AgentLevel = 'none' | 'read' | 'draft'

export const SCOPES = { read: 'soc.read', draft: 'soc.draft' } as const

export interface Governance {
  agentAccess: Record<string, { level: Exclude<AgentLevel, 'none'>; grantedBy: string; at: string }>
  residentContent: { allowed: false } | { allowed: true; approvedBy: string; approvalRef: string; provider: string; recordedBy: string; at: string }
  /** Tokens for this person issued before this time are invalid. */
  revokedBefore: Record<string, string>
  log: { id: string; at: string; action: string; detail: string }[]
}

const empty = (): Governance => ({ agentAccess: {}, residentContent: { allowed: false }, revokedBefore: {}, log: [] })

export class GovernanceStore {
  private g: Governance = empty()
  private mtime = -1

  constructor(private readonly file: string | null, private readonly now: () => Date = () => new Date()) {
    this.reload()
  }

  private reload() {
    if (!this.file || !existsSync(this.file)) return
    const m = statSync(this.file).mtimeMs
    if (m === this.mtime) return
    this.g = { ...empty(), ...JSON.parse(readFileSync(this.file, 'utf8')) }
    this.mtime = m
  }

  private get state() {
    this.reload()
    return this.g
  }

  private change(action: string, detail: string, mutate: (g: Governance) => void) {
    const g = this.state
    mutate(g)
    const at = this.now().toISOString()
    g.log.push({ id: `gov-${g.log.length + 1}-${Date.parse(at)}`, at, action, detail })
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(this.file, JSON.stringify(g, null, 2))
      this.mtime = statSync(this.file).mtimeMs
    }
  }

  get snapshot(): Governance {
    return structuredClone(this.state)
  }

  level(userId: string): AgentLevel {
    return this.state.agentAccess[userId]?.level ?? 'none'
  }

  /** Scopes this person's agent may hold: what was asked for, cut down to what the administrator allows. */
  allowedScopes(userId: string, requested: string[]): string[] {
    const level = this.level(userId)
    const allowed = level === 'draft' ? [SCOPES.read, SCOPES.draft] : level === 'read' ? [SCOPES.read] : []
    const want = requested.length ? requested : allowed
    return allowed.filter((s) => want.includes(s))
  }

  /** False when the person's agents were signed out after this token was issued. */
  issuedAfterRevoke(userId: string, issuedAt: number) {
    const cut = this.state.revokedBefore[userId]
    return !cut || issuedAt > Date.parse(cut)
  }

  get residentContentAllowed() {
    return this.state.residentContent.allowed
  }

  setLevel(user: { id: string; name: string }, level: AgentLevel, by: string) {
    if (!by.trim()) throw new Error('Say who is making this change (--by "Name").')
    const what = level === 'none' ? 'no agent access' : level === 'read' ? 'read only' : 'read and drafts'
    this.change('Agent access changed', `${user.name}: ${what} (set by ${by.trim()})`, (g) => {
      if (level === 'none') {
        delete g.agentAccess[user.id]
        g.revokedBefore[user.id] = this.now().toISOString()
      } else g.agentAccess[user.id] = { level, grantedBy: by.trim(), at: this.now().toISOString() }
    })
  }

  signOut(user: { id: string; name: string }, by: string) {
    if (!by.trim()) throw new Error('Say who is making this change (--by "Name").')
    this.change('Agents signed out', `${user.name}: every connected agent signed out (by ${by.trim()})`, (g) => {
      g.revokedBefore[user.id] = this.now().toISOString()
    })
  }

  allowResidentContent(input: { approvedBy: string; approvalRef: string; provider: string; recordedBy: string }) {
    for (const [k, v] of Object.entries(input)) if (!v?.trim()) throw new Error(`Missing ${k}. Record the municipality's written approval in full.`)
    this.change('Agents may read resident content', `Approved by ${input.approvedBy} (${input.approvalRef}) for ${input.provider}; recorded by ${input.recordedBy}`, (g) => {
      g.residentContent = { allowed: true, ...input, at: this.now().toISOString() }
    })
  }

  denyResidentContent(by: string) {
    if (!by.trim()) throw new Error('Say who is making this change (--by "Name").')
    this.change('Agents may not read resident content', `Turned off by ${by.trim()}`, (g) => {
      g.residentContent = { allowed: false }
    })
  }

  get log() {
    return this.state.log
  }
}
