import { canViewAccount, hasAccountFunction, hasFunction } from '@/domain/permissions'
import {
  ADMIN_ID,
  type Category,
  type Conversation,
  type DemoState,
  type FunctionId,
  type ListeningAlert,
  type Network,
  type Post,
  type Sentiment,
  type SocialAccount,
  type User,
} from '@/domain/types'
import { clearBlobs } from './blobs'
import { db, persist, resetDemo as reset } from './db'

// Mock API. Each function stands in for a future REST endpoint: it resolves the actor,
// enforces permissions at the action boundary, mutates the browser store and returns
// plain data. No network, social platform or AI model is ever called.

export { ApiError } from './core'
import { actorName, actorOf, ApiError, audit, ctx, nowISO, requireAdmin, uid, wait } from './core'

// ---------- Session ----------

export interface SessionInfo {
  actorId: string
  name: string
  isAdmin: boolean
  role: string
  department: string | null
  functions: Record<FunctionId, boolean>
  visibleAccountIds: string[]
  emergency: DemoState['emergency']
  seededAt: string
}

const ALL_FUNCTIONS: FunctionId[] = ['content.view', 'content.create', 'content.approve', 'content.publish', 'inbox.respond', 'reports.view', 'ads.create', 'ads.manage', 'ads.accounts.add', 'channels.manage', 'assets.manage', 'assets.delete']

export function getSession(actorId: string): Promise<SessionInfo> {
  const s = db()
  const actor = actorOf(s, actorId)
  const c = ctx(s)
  return wait({
    actorId,
    name: actorName(s, actorId),
    isAdmin: actor.isAdmin,
    role: actorId === ADMIN_ID ? 'Demo administrator' : (actor.user?.role ?? 'Unknown'),
    department: actor.user?.department ?? null,
    functions: Object.fromEntries(ALL_FUNCTIONS.map((f) => [f, hasFunction(actor, f, c)])) as Record<FunctionId, boolean>,
    visibleAccountIds: s.accounts.filter((a) => canViewAccount(actor, a.id, c)).map((a) => a.id),
    emergency: s.emergency,
    seededAt: s.seededAt,
  })
}

export function listUsers(): Promise<Pick<User, 'id' | 'name' | 'role' | 'department' | 'status'>[]> {
  return wait(db().users.map(({ id, name, role, department, status }) => ({ id, name, role, department, status })))
}

export function listAccounts(actorId: string): Promise<SocialAccount[]> {
  const s = db()
  const actor = actorOf(s, actorId)
  return wait(s.accounts.filter((a) => canViewAccount(actor, a.id, ctx(s))))
}

export async function resetDemo(): Promise<void> {
  reset()
  await clearBlobs().catch(() => undefined)
  return wait(undefined)
}

// ---------- Emergency pause ----------

export function setEmergencyPause(actorId: string, paused: boolean, reason: string) {
  const s = db()
  requireAdmin(s, actorId)
  if (!reason.trim()) throw new ApiError('A reason is required.')
  s.emergency = { paused, reason: reason.trim(), changedAt: nowISO(), changedBy: actorName(s, actorId) }
  audit(s, actorId, paused ? 'Emergency pause activated' : 'Publishing resumed', reason.trim())
  s.feed.unshift({ id: uid('feed'), at: nowISO(), kind: paused ? 'blocked' : 'healthy', title: paused ? 'Emergency pause activated' : 'Publishing resumed', detail: reason.trim() })
  persist()
  return wait(s.emergency)
}

/** Publishes the next due scheduled post in the demo queue. Never calls a platform. */
export function processNextPublication(actorId: string): Promise<string> {
  const s = db()
  const actor = actorOf(s, actorId)
  if (s.emergency.paused) throw new ApiError('Emergency pause is active. No job was processed.')
  const next = s.posts
    .filter((p) => p.status === 'Scheduled' && hasAccountFunction(actor, 'content.publish', p.accountId, ctx(s)))
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))[0]
  if (!next) throw new ApiError('No scheduled demo posts you can publish.')
  const account = s.accounts.find((a) => a.id === next.accountId)!
  if (account.connection.status === 'Expired') {
    next.status = 'Failed'
    next.failureReason = 'Connection expired. Reauthorize the channel.'
    next.publishedAt = nowISO()
    next.history.push({ id: uid('ev'), at: nowISO(), actor: 'Demo queue', action: 'Failed', note: next.failureReason })
    audit(s, actorId, 'Demo publication blocked', `${next.title} on ${account.name}: connection expired`)
    persist()
    return wait(`Blocked: ${account.name} connection has expired.`)
  }
  next.status = 'Published'
  next.publishedAt = nowISO()
  next.metrics = { impressions: 0, engagements: 0, trend: 0, observedAt: nowISO() }
  next.history.push({ id: uid('ev'), at: nowISO(), actor: 'Demo queue', action: 'Published', note: 'Simulated. Nothing was sent to a platform.' })
  audit(s, actorId, 'Demo publication processed', `${next.title} on ${account.name}. Nothing sent externally.`)
  persist()
  return wait(`Marked "${next.title}" as published in the demo. Nothing was sent.`)
}

// ---------- SOC ----------

export interface DayPoint {
  date: string
  label: string
  impressions: number
  engagements: number
  sentiment: number | null
  sentimentSamples: number
}

export interface SocOverview {
  emergency: DemoState['emergency']
  recent: (Post & { account: SocialAccount })[]
  next: (Post & { account: SocialAccount })[]
  trending: (Post & { account: SocialAccount })[]
  days: DayPoint[]
  totals: { impressions: number; engagements: number; sentiment: number | null; scored: number; healthy: number; attempts: number }
  negative: (Conversation & { account: SocialAccount; ownerName: string | null })[]
  negativeTotal: number
  canReadMessages: boolean
  keywords: [string, number][]
  feed: DemoState['feed']
}

const STOP = new Set('the and for this that with from have your our are can you was how what when will does new again thank thanks here there about sample fictional post demo during through along their them they has been its were not which into just now still more than also very after before where who why get got one two three been being over under while really today every keep keeps'.split(' '))

function dayKey(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Halifax' })
}

export function socOverview(actorId: string, network: Network | 'All', kind: 'All' | 'Comment' | 'Message'): Promise<SocOverview> {
  const s = db()
  const actor = actorOf(s, actorId)
  const c = ctx(s)
  const byId = new Map(s.accounts.map((a) => [a.id, a]))
  const inScope = (accountId: string) => canViewAccount(actor, accountId, c) && (network === 'All' || byId.get(accountId)?.network === network)
  const posts = s.posts.filter((p) => inScope(p.accountId)).map((p) => ({ ...p, account: byId.get(p.accountId)! }))
  const canRead = (accountId: string) => hasAccountFunction(actor, 'inbox.respond', accountId, c)
  const conversations = s.conversations.filter((x) => inScope(x.accountId) && canRead(x.accountId))

  const recent = posts
    .filter((p) => p.status === 'Published' || p.status === 'Failed')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, 5)
  const next = posts.filter((p) => p.status === 'Scheduled').sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? '')).slice(0, 5)
  const published = posts.filter((p) => p.status === 'Published' && p.metrics)
  const trending = [...published].sort((a, b) => b.metrics!.engagements - a.metrics!.engagements).slice(0, 5)

  // Synthetic daily distribution: each post's sample totals are spread across the days since it aired.
  const today = new Date()
  const days: DayPoint[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return { date: dayKey(d), label: d.toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'America/Halifax' }), impressions: 0, engagements: 0, sentiment: null, sentimentSamples: 0 }
  })
  const index = new Map(days.map((d, i) => [d.date, i]))
  for (const p of published) {
    const start = index.get(dayKey(new Date(p.publishedAt!))) ?? 0
    const span = days.length - start
    const weights = Array.from({ length: span }, (_, k) => Math.pow(0.55, k))
    const sum = weights.reduce((a, b) => a + b, 0)
    weights.forEach((w, k) => {
      days[start + k].impressions += Math.round((p.metrics!.impressions * w) / sum)
      days[start + k].engagements += Math.round((p.metrics!.engagements * w) / sum)
    })
  }
  const sentimentByDay = new Map<number, number[]>()
  for (const x of conversations) {
    const i = index.get(dayKey(new Date(x.createdAt)))
    if (i === undefined || x.ai.score === null) continue
    sentimentByDay.set(i, [...(sentimentByDay.get(i) ?? []), x.ai.score])
  }
  sentimentByDay.forEach((values, i) => {
    days[i].sentiment = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    days[i].sentimentSamples = values.length
  })

  const scored = conversations.filter((x) => x.ai.score !== null)
  const negativeAll = conversations
    .filter((x) => x.ai.score !== null && x.ai.score <= -50 && x.status === 'Open' && (kind === 'All' || x.kind === kind))
    .sort((a, b) => a.ai.score! - b.ai.score!)

  const counts = new Map<string, number>()
  for (const text of [...conversations.map((x) => x.thread[0].text), ...posts.map((p) => p.text)]) {
    for (const w of new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? [])) {
      if (!STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }
  const keywords = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 22)

  return wait({
    emergency: s.emergency,
    recent,
    next,
    trending,
    days,
    totals: {
      impressions: days.reduce((a, d) => a + d.impressions, 0),
      engagements: days.reduce((a, d) => a + d.engagements, 0),
      sentiment: scored.length ? Math.round(scored.reduce((a, x) => a + x.ai.score!, 0) / scored.length) : null,
      scored: scored.length,
      healthy: recent.filter((p) => p.status === 'Published').length,
      attempts: recent.length,
    },
    negative: negativeAll.slice(0, 5).map((x) => ({ ...x, account: byId.get(x.accountId)!, ownerName: s.users.find((u) => u.id === x.ownerId)?.name ?? null })),
    negativeTotal: negativeAll.length,
    canReadMessages: hasFunction(actor, 'inbox.respond', c),
    keywords,
    feed: actor.isAdmin ? s.feed.slice(0, 6) : [],
  })
}

/** Simulated activity: changes real demo records so the SOC visibly moves. Admin only. */
export function nextDemoUpdate(actorId: string): Promise<string> {
  const s = db()
  requireAdmin(s, actorId)
  const step = s.updateIndex++ % 4
  const account = s.accounts[s.updateIndex % s.accounts.length]
  let title = ''
  let detail = ''
  let kind: DemoState['feed'][number]['kind'] = 'healthy'
  if (step === 0) {
    const created = nowISO()
    s.conversations.unshift({
      id: `CONV-${3000 + s.updateIndex}`,
      accountId: account.id,
      kind: account.network === 'YouTube' || s.updateIndex % 2 ? 'Comment' : 'Message',
      postId: null,
      author: 'new_follower (fictional)',
      thread: [{ id: uid('m'), from: 'resident', author: 'new_follower (fictional)', text: 'The service update was unclear and I missed my bus. Where is the accessible boarding stop?', at: created }],
      createdAt: created,
      status: 'Open',
      ownerId: null,
      category: 'Transit',
      sentiment: 'Negative',
      ai: { score: -88, confidence: 0.86, category: 'Transit', source: 'Simulated classifier, not a live model' },
      notes: [],
      replyDraft: '',
      resolvedBy: null,
    })
    kind = 'conversation'
    title = 'New negative conversation'
    detail = `${account.network} · ${account.name} · simulated score -88`
  } else if (step === 1) {
    const post = s.posts.find((p) => p.status === 'Published' && p.metrics)
    if (post?.metrics) {
      post.metrics.engagements += 120
      post.metrics.impressions += 1850
      post.metrics.trend += 12
      post.metrics.observedAt = nowISO()
      kind = 'engagement'
      title = 'Engagement rising'
      detail = `${post.title}: +120 engagement, +1,850 impressions (sample)`
    }
  } else if (step === 2) {
    const post = s.posts.filter((p) => p.status === 'Scheduled').sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))[0]
    if (post && s.emergency.paused) {
      kind = 'blocked'
      title = 'Scheduled publication held'
      detail = `${post.title} stays scheduled: emergency pause is active.`
    } else if (post) {
      post.status = 'Failed'
      post.publishedAt = nowISO()
      post.failureReason = 'Mock provider delivery failure'
      post.history.push({ id: uid('ev'), at: nowISO(), actor: 'Demo queue', action: 'Failed', note: post.failureReason })
      kind = 'failure'
      title = 'Mock publication failed'
      detail = `${post.title}: no platform was called.`
    }
  } else {
    const post = s.posts.find((p) => p.status === 'Published' && p.metrics)
    if (post?.metrics) {
      post.metrics.observedAt = nowISO()
      title = 'Delivery check healthy'
      detail = `${post.title}: simulated check completed.`
    }
  }
  if (title) {
    s.feed.unshift({ id: uid('feed'), at: nowISO(), kind, title, detail })
    s.feed = s.feed.slice(0, 30)
  }
  persist()
  return wait(title || 'Nothing to update')
}

// ---------- Inbox ----------

export interface InboxFilters {
  network: Network | 'All'
  kind: 'All' | 'Comment' | 'Message'
  sentiment: Sentiment | 'All'
  category: Category | 'All'
  owner: string
  status: 'Open' | 'Resolved' | 'All'
  search: string
  /** Sentiment-first triage: most negative simulated score first, or newest first. */
  sort: 'negative' | 'newest'
}

const SENTIMENT_ORDER: Record<Sentiment, number> = { Negative: -75, Concerned: -40, Neutral: 0, Positive: 60 }

/** Staff-set sentiment wins over the simulated score; unscored items sort by their staff label. */
function sentimentRank(x: Conversation) {
  return x.sentiment === 'Negative' || x.sentiment === 'Concerned' ? Math.min(x.ai.score ?? SENTIMENT_ORDER[x.sentiment], SENTIMENT_ORDER[x.sentiment]) : SENTIMENT_ORDER[x.sentiment]
}

export type ConversationRow = Conversation & { account: SocialAccount; ownerName: string | null }

export function listConversations(actorId: string, f: InboxFilters): Promise<{ rows: ConversationRow[]; hasChannels: boolean }> {
  const s = db()
  const actor = actorOf(s, actorId)
  const c = ctx(s)
  if (!hasFunction(actor, 'inbox.respond', c)) throw new ApiError('Inbox permission is required.')
  const byId = new Map(s.accounts.map((a) => [a.id, a]))
  const q = f.search.trim().toLowerCase()
  const rows = s.conversations
    .filter((x) => hasAccountFunction(actor, 'inbox.respond', x.accountId, c))
    .filter((x) => f.network === 'All' || byId.get(x.accountId)?.network === f.network)
    .filter((x) => f.kind === 'All' || x.kind === f.kind)
    .filter((x) => f.sentiment === 'All' || x.sentiment === f.sentiment)
    .filter((x) => f.category === 'All' || x.category === f.category)
    .filter((x) => f.owner === 'All' || (f.owner === 'Unassigned' ? !x.ownerId : x.ownerId === f.owner))
    .filter((x) => f.status === 'All' || x.status === f.status)
    .filter((x) => !q || (x.id + ' ' + x.author + ' ' + x.thread.map((m) => m.text).join(' ')).toLowerCase().includes(q))
    .sort((a, b) => (f.sort === 'negative' ? sentimentRank(a) - sentimentRank(b) : 0) || b.createdAt.localeCompare(a.createdAt))
    .map((x) => ({ ...x, account: byId.get(x.accountId)!, ownerName: s.users.find((u) => u.id === x.ownerId)?.name ?? null }))
  const hasChannels = actor.isAdmin || s.accounts.some((a) => hasAccountFunction(actor, 'inbox.respond', a.id, c))
  return wait({ rows, hasChannels })
}

export interface ConversationDetail {
  conversation: ConversationRow
  post: Post | null
  eligibleOwners: { id: string; name: string; eligible: boolean }[]
}

function loadConversation(s: DemoState, actorId: string, id: string) {
  const actor = actorOf(s, actorId)
  const x = s.conversations.find((c) => c.id === id)
  if (!x || !hasAccountFunction(actor, 'inbox.respond', x.accountId, ctx(s))) throw new ApiError('Conversation not found or not in your account scope.')
  return x
}

export function getConversation(actorId: string, id: string): Promise<ConversationDetail> {
  const s = db()
  const x = loadConversation(s, actorId, id)
  const account = s.accounts.find((a) => a.id === x.accountId)!
  const c = ctx(s)
  const eligibleOwners = s.users
    .filter((u) => u.status === 'Active')
    .map((u) => ({ id: u.id, name: u.name, eligible: hasAccountFunction({ isAdmin: false, user: u }, 'inbox.respond', x.accountId, c) }))
    .filter((o) => o.eligible || o.id === x.ownerId)
  return wait({
    conversation: { ...x, account, ownerName: s.users.find((u) => u.id === x.ownerId)?.name ?? null },
    post: s.posts.find((p) => p.id === x.postId) ?? null,
    eligibleOwners,
  })
}

export function updateRouting(actorId: string, id: string, patch: { ownerId: string | null; sentiment: Sentiment; category: Category }) {
  const s = db()
  const x = loadConversation(s, actorId, id)
  if (patch.ownerId) {
    const owner = s.users.find((u) => u.id === patch.ownerId)
    if (!owner || !hasAccountFunction({ isAdmin: false, user: owner }, 'inbox.respond', x.accountId, ctx(s))) {
      throw new ApiError('That person needs inbox permission and access to this channel. Update Users & Access first.')
    }
  }
  const changes: string[] = []
  if (patch.ownerId !== x.ownerId) changes.push(`owner → ${s.users.find((u) => u.id === patch.ownerId)?.name ?? 'Unassigned'}`)
  if (patch.sentiment !== x.sentiment) changes.push(`sentiment → ${patch.sentiment} (staff override)`)
  if (patch.category !== x.category) changes.push(`category → ${patch.category}`)
  Object.assign(x, patch)
  if (changes.length) audit(s, actorId, 'Conversation routing saved', `${x.id}: ${changes.join(', ')}`)
  persist()
  return wait(changes.length)
}

export function addNote(actorId: string, id: string, text: string) {
  const s = db()
  const x = loadConversation(s, actorId, id)
  if (!text.trim()) throw new ApiError('Enter a note first.')
  x.notes.push({ id: uid('note'), author: actorName(s, actorId), text: text.trim(), at: nowISO() })
  audit(s, actorId, 'Internal note added', x.id)
  persist()
  return wait(true)
}

export function saveReplyDraft(actorId: string, id: string, text: string) {
  const s = db()
  const x = loadConversation(s, actorId, id)
  x.replyDraft = text
  audit(s, actorId, 'Reply draft saved', `${x.id}. Nothing sent.`)
  persist()
  return wait(true)
}

const SUGGESTIONS: Record<Category, string> = {
  Roads: 'Thank you for reporting this. We have shared the location with our Roads team, and a crew will assess it. You can track road work on the municipal service map.',
  Transit: 'Thanks for letting us know, and sorry for the trouble. We have passed your feedback to Transit operations, and a team member will follow up.',
  Recreation: 'Thanks for reaching out. Fee assistance is available for most recreation programs. Our Recreation team can help you apply.',
  Permits: 'Thanks for your patience. A permit coordinator will review your file and contact you with an update.',
  Waste: 'Sorry about the missed collection. We have flagged your address for follow-up. You can also submit a request through 311.',
  Emergency: 'Thank you for telling us. If anyone is in immediate danger, call 911. Crews have been notified and we will post updates here.',
  General: 'Thanks for your message. We are looking into this and will update you as soon as we can.',
}

export function suggestReply(actorId: string, id: string): Promise<{ text: string; confidence: number; basis: string }> {
  const s = db()
  const x = loadConversation(s, actorId, id)
  return wait({
    text: SUGGESTIONS[x.category],
    confidence: Math.round(x.ai.confidence * 100),
    basis: `Generic "${x.category}" template. It does not read this message, so check it answers what the resident asked. Not a live model and not verified advice.`,
  })
}

export function resolveConversation(actorId: string, id: string, reply: string) {
  const s = db()
  const x = loadConversation(s, actorId, id)
  if (!x.ownerId) throw new ApiError('Assign a response owner first.')
  const owner = s.users.find((u) => u.id === x.ownerId)
  if (!owner || !hasAccountFunction({ isAdmin: false, user: owner }, 'inbox.respond', x.accountId, ctx(s))) {
    throw new ApiError('The response owner needs inbox permission and access to this channel.')
  }
  if (!reply.trim()) throw new ApiError('Write a reply before review.')
  x.replyDraft = ''
  x.thread.push({ id: uid('m'), from: 'staff', author: `${owner.name} (reviewed, demo only)`, text: reply.trim(), at: nowISO() })
  x.status = 'Resolved'
  x.resolvedBy = owner.id
  audit(s, actorId, 'Conversation resolved after human review', `${x.id}. No external reply was sent.`)
  persist()
  return wait(true)
}

export function reopenConversation(actorId: string, id: string) {
  const s = db()
  const x = loadConversation(s, actorId, id)
  x.status = 'Open'
  x.resolvedBy = null
  audit(s, actorId, 'Conversation reopened', x.id)
  persist()
  return wait(true)
}

// ---------- Social listening ----------

export interface TopicSummary {
  id: string
  name: string
  keywords: string[]
  mentions7d: number
  negativeShare: number
  alertTriggered: boolean
}

export interface TopicDetail {
  topic: TopicSummary
  days: { date: string; label: string; count: number }[]
  sentiment: { negative: number; neutral: number; positive: number }
  sources: { source: string; network: string; count: number; coverage: 'Owned account' | 'Licensed provider required' }[]
  mentions: DemoState['mentions']
  alerts: ListeningAlert[]
}

function requireReports(s: DemoState, actorId: string) {
  if (!hasFunction(actorOf(s, actorId), 'reports.view', ctx(s))) throw new ApiError('Reports permission is required for Social Listening.')
}

function topicSummary(s: DemoState, topicId: string): TopicSummary {
  const t = s.topics.find((x) => x.id === topicId)!
  const since = Date.now() - 7 * 864e5
  const ms = s.mentions.filter((m) => m.topicId === topicId && new Date(m.at).getTime() >= since)
  const neg = ms.filter((m) => m.sentiment <= -25).length
  return {
    id: t.id,
    name: t.name,
    keywords: t.keywords,
    mentions7d: ms.length,
    negativeShare: ms.length ? Math.round((neg / ms.length) * 100) : 0,
    alertTriggered: s.alerts.some((a) => a.topicId === t.id && a.enabled && a.triggeredAt),
  }
}

export function listTopics(actorId: string): Promise<TopicSummary[]> {
  const s = db()
  requireReports(s, actorId)
  return wait(s.topics.map((t) => topicSummary(s, t.id)))
}

export function getTopic(actorId: string, topicId: string, source: string): Promise<TopicDetail> {
  const s = db()
  requireReports(s, actorId)
  if (!s.topics.some((t) => t.id === topicId)) throw new ApiError('Topic not found.')
  const all = s.mentions.filter((m) => m.topicId === topicId)
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const key = dayKey(d)
    return { date: key, label: d.toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'America/Halifax' }), count: all.filter((m) => dayKey(new Date(m.at)) === key).length }
  })
  const bucket = (m: { sentiment: number }) => (m.sentiment <= -25 ? 'negative' : m.sentiment >= 25 ? 'positive' : 'neutral')
  const sentiment = { negative: 0, neutral: 0, positive: 0 }
  all.forEach((m) => sentiment[bucket(m)]++)
  const sourceMap = new Map<string, { source: string; network: string; count: number; coverage: 'Owned account' | 'Licensed provider required' }>()
  for (const m of all) {
    const key = `${m.source}|${m.network}`
    const row = sourceMap.get(key) ?? { source: m.source, network: m.network, count: 0, coverage: m.source === 'Owned comment' ? 'Owned account' : 'Licensed provider required' }
    row.count++
    sourceMap.set(key, row)
  }
  return wait({
    topic: topicSummary(s, topicId),
    days,
    sentiment,
    sources: [...sourceMap.values()].sort((a, b) => b.count - a.count),
    mentions: all.filter((m) => source === 'All' || m.source === source),
    alerts: s.alerts.filter((a) => a.topicId === topicId),
  })
}

export function createTopic(actorId: string, name: string, keywords: string[]) {
  const s = db()
  requireReports(s, actorId)
  if (!name.trim() || !keywords.length) throw new ApiError('Add a topic name and at least one keyword.')
  const topic = { id: uid('topic'), name: name.trim(), keywords, createdBy: actorId, createdAt: nowISO() }
  s.topics.push(topic)
  audit(s, actorId, 'Listening topic created', `${topic.name}: ${keywords.join(', ')}. Sample mentions only.`)
  persist()
  return wait(topic.id)
}

export function saveAlert(actorId: string, topicId: string, kind: ListeningAlert['kind'], threshold: number) {
  const s = db()
  requireReports(s, actorId)
  if (!(threshold > 0)) throw new ApiError('Threshold must be greater than zero.')
  const summary = topicSummary(s, topicId)
  const perDay = summary.mentions7d / 7
  const triggered = kind === 'volume' ? perDay >= threshold : summary.negativeShare >= threshold
  s.alerts.push({ id: uid('alert'), topicId, kind, threshold, enabled: true, createdBy: actorId, triggeredAt: triggered ? nowISO() : null })
  audit(s, actorId, 'Listening alert saved', `${summary.name}: ${kind === 'volume' ? `${threshold}+ mentions per day` : `${threshold}%+ negative`}`)
  persist()
  return wait(triggered)
}

export function toggleAlert(actorId: string, alertId: string, enabled: boolean) {
  const s = db()
  requireReports(s, actorId)
  const a = s.alerts.find((x) => x.id === alertId)
  if (!a) throw new ApiError('Alert not found.')
  a.enabled = enabled
  audit(s, actorId, enabled ? 'Listening alert enabled' : 'Listening alert muted', a.id)
  persist()
  return wait(true)
}
