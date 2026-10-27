// Copies governance changes into the demo store's activity log, once each, as the administrator.
import { db, persist } from '../../web/src/mock/db.ts'
import type { GovernanceStore } from './governance.ts'

export function syncGovernanceLog(governance: GovernanceStore) {
  const s = db()
  const seen = new Set(s.audit.map((a) => a.id))
  const fresh = governance.log.filter((e) => !seen.has(e.id))
  if (!fresh.length) return 0
  for (const e of fresh) s.audit.unshift({ id: e.id, at: e.at, actor: 'Administrator (agent access)', action: e.action, detail: e.detail })
  s.audit.sort((a, b) => b.at.localeCompare(a.at))
  persist()
  return fresh.length
}
