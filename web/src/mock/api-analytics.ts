import { AVAILABILITY, customGranularity, daysBetween, makeBuckets, METRICS, percentChange, RANGES, readBucket, UNAVAILABLE_REASON, validateCustom, type Bucket, type MetricKey, type RangeId } from '@/domain/analytics'
import { canViewAccount, hasAccountFunction, hasFunction } from '@/domain/permissions'
import type { Department, Network } from '@/domain/types'
import { addDays } from '@/lib/calendar'
import { dayKeyHalifax, halifaxToISO } from '@/lib/time'
import { actorOf, ApiError, audit, ctx, wait } from './core'
import { db, persist } from './db'

// Analytics and reports. Scoped to the channels the actor can see. All numbers come from a synthetic,
// deterministic generator: nothing here is a platform metric, and the UI says so everywhere.

export const SOURCE_NOTE = 'Synthetic sample data from a demo generator. No platform analytics are connected. Not for reporting.'

export interface Point {
  label: string
  start: string
  end: string
  impressions: number | null
  reach: number | null
  engagements: number | null
  followers: number | null
  sentiment: number | null
  sentimentSamples: number
}

export interface Total {
  value: number | null
  previous: number | null
  change: number | null
  /** Selected accounts that report this metric, out of all selected accounts. */
  reporting: number
  of: number
}

export interface AccountReport {
  id: string
  name: string
  network: Network
  department: Department
  impressions: number | null
  reach: number | null
  engagements: number | null
  followers: number | null
  engagementRate: number | null
  sentiment: number | null
}

export interface DepartmentReport {
  department: Department
  accounts: number
  impressions: number | null
  engagements: number | null
  followers: number | null
  engagementRate: number | null
  sentiment: number | null
}

export interface AnalyticsReport {
  range: RangeId
  rangeLabel: string
  granularity: string
  window: { startDay: string; endDay: string }
  refreshedAt: string
  source: string
  filters: { network: Network | 'All'; department: Department | 'All' }
  options: { networks: Network[]; departments: Department[] }
  accountCount: number
  points: Point[]
  totals: Record<MetricKey, Total> & { engagementRate: { value: number | null; previous: number | null; change: number | null }; sentiment: { value: number | null; samples: number } }
  unavailable: string[]
  accounts: AccountReport[]
  departments: DepartmentReport[]
  canReadSentiment: boolean
}

export interface AnalyticsQuery {
  range: RangeId
  network: Network | 'All'
  department: Department | 'All'
  /** Required when range is 'custom': Halifax day keys. */
  from?: string
  to?: string
}

const halifaxHour = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Halifax', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))

function whole(buckets: Bucket[]) {
  return { startDay: buckets[0].startDay, endDay: buckets[buckets.length - 1].endDay }
}

export function getAnalytics(actorId: string, q: AnalyticsQuery): Promise<AnalyticsReport> {
  const s = db()
  const actor = actorOf(s, actorId)
  const c = ctx(s)
  if (!hasFunction(actor, 'reports.view', c)) throw new ApiError('Analytics needs the "View reports" function.')
  const range = RANGES.find((r) => r.id === q.range)
  if (!range) throw new ApiError('Choose a reporting period.')

  const visible = s.accounts.filter((a) => canViewAccount(actor, a.id, c))
  const options = { networks: [...new Set(visible.map((a) => a.network))] as Network[], departments: [...new Set(visible.map((a) => a.department))].sort() as Department[] }
  const accounts = visible.filter((a) => (q.network === 'All' || a.network === q.network) && (q.department === 'All' || a.department === q.department))

  const today = dayKeyHalifax(new Date())
  if (q.range === 'custom') {
    const problem = validateCustom(q.from ?? '', q.to ?? '', today)
    if (problem) throw new ApiError(problem)
  }
  const custom = q.range === 'custom' ? { from: q.from!, to: q.to! } : undefined
  const buckets = makeBuckets(q.range, today, halifaxHour(), custom)
  const win = whole(buckets)
  const hourly = q.range === '24h'
  const windowDays = daysBetween(win.startDay, win.endDay).length
  const shift = hourly ? 1 : windowDays
  const prior = buckets.map((b) => ({ ...b, startDay: addDays(b.startDay, -shift), endDay: addDays(b.endDay, -shift) }))
  const priorWin = whole(prior)

  // Sentiment comes from conversation text, so it needs inbox access on that channel.
  const readable = new Set(accounts.filter((a) => hasAccountFunction(actor, 'inbox.respond', a.id, c)).map((a) => a.id))
  const convs = s.conversations.filter((x) => readable.has(x.accountId) && x.ai.score !== null)
  const dayOf = (iso: string) => dayKeyHalifax(iso)
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

  const points: Point[] = buckets.map((b) => {
    const r = readBucket(accounts, b)
    const samples = hourly ? [] : convs.filter((x) => dayOf(x.createdAt) >= b.startDay && dayOf(x.createdAt) <= b.endDay).map((x) => x.ai.score as number)
    return { label: b.label, start: b.startDay, end: b.endDay, impressions: r.impressions.value, reach: r.reach.value, engagements: r.engagements.value, followers: r.followers.value, sentiment: avg(samples), sentimentSamples: samples.length }
  })
  const priorPoints = prior.map((b) => readBucket(accounts, b))
  const sum = (xs: (number | null)[]) => (xs.every((x) => x === null) ? null : xs.reduce<number>((a, b) => a + (b ?? 0), 0))

  const totals = {} as AnalyticsReport['totals']
  for (const m of METRICS) {
    const value = sum(points.map((p) => p[m.key]))
    const previous = sum(priorPoints.map((p) => p[m.key].value))
    totals[m.key] = { value, previous, change: percentChange(value, previous), reporting: accounts.filter((a) => AVAILABILITY[a.network][m.key]).length, of: accounts.length }
  }

  // Engagement rate uses only accounts that report both impressions and engagements, so it is not distorted by missing data.
  const both = accounts.filter((a) => AVAILABILITY[a.network].impressions && AVAILABILITY[a.network].engagements)
  const rate = (rows: { id: string; network: Network }[], bucket: Bucket) => {
    const r = readBucket(rows, bucket)
    return r.impressions.value && r.engagements.value !== null ? r.engagements.value / r.impressions.value : null
  }
  const rateNow = both.length ? rate(both, { label: 'w', ...win }) : null
  const ratePrev = both.length ? rate(both, { label: 'w', ...priorWin }) : null
  const windowSamples = hourly ? convs.filter((x) => dayOf(x.createdAt) >= win.startDay) : convs.filter((x) => dayOf(x.createdAt) >= win.startDay && dayOf(x.createdAt) <= win.endDay)

  const accountReports: AccountReport[] = accounts.map((a) => {
    const r = readBucket([a], { label: 'w', ...win })
    const samples = convs.filter((x) => x.accountId === a.id && dayOf(x.createdAt) >= win.startDay && dayOf(x.createdAt) <= win.endDay).map((x) => x.ai.score as number)
    return { id: a.id, name: a.name, network: a.network, department: a.department, impressions: r.impressions.value, reach: r.reach.value, engagements: r.engagements.value, followers: r.followers.value, engagementRate: rate([a], { label: 'w', ...win }), sentiment: avg(samples) }
  })
  accountReports.sort((x, y) => (y.impressions ?? -1) - (x.impressions ?? -1) || (y.engagements ?? -1) - (x.engagements ?? -1))

  const depts = [...new Set(accounts.map((a) => a.department))].sort() as Department[]
  const departments: DepartmentReport[] = depts.map((d) => {
    const rows = accounts.filter((a) => a.department === d)
    const r = readBucket(rows, { label: 'w', ...win })
    const dBoth = rows.filter((a) => AVAILABILITY[a.network].impressions && AVAILABILITY[a.network].engagements)
    const samples = convs.filter((x) => rows.some((a) => a.id === x.accountId) && dayOf(x.createdAt) >= win.startDay && dayOf(x.createdAt) <= win.endDay).map((x) => x.ai.score as number)
    return { department: d, accounts: rows.length, impressions: r.impressions.value, engagements: r.engagements.value, followers: r.followers.value, engagementRate: dBoth.length ? rate(dBoth, { label: 'w', ...win }) : null, sentiment: avg(samples) }
  })

  const unavailable: string[] = []
  for (const m of METRICS) {
    const missing = accounts.filter((a) => !AVAILABILITY[a.network][m.key])
    if (missing.length) {
      const nets = [...new Set(missing.map((a) => a.network))]
      unavailable.push(`${m.label} is unavailable for ${nets.join(', ')} (${nets.map((n) => UNAVAILABLE_REASON[n][m.key]).join('; ')}). ${missing.length} of ${accounts.length} accounts are excluded from that total.`)
    }
  }

  return wait({
    range: q.range,
    rangeLabel: custom ? `Custom range, ${custom.from} to ${custom.to}` : range.label,
    granularity: custom ? customGranularity(custom.from, custom.to) : range.granularity,
    window: win,
    refreshedAt: halifaxToISO(`${today}T06:00`),
    source: SOURCE_NOTE,
    filters: { network: q.network, department: q.department },
    options,
    accountCount: accounts.length,
    points,
    totals: { ...totals, engagementRate: { value: rateNow, previous: ratePrev, change: percentChange(rateNow, ratePrev) }, sentiment: { value: avg(windowSamples.map((x) => x.ai.score as number)), samples: windowSamples.length } },
    unavailable,
    accounts: accountReports,
    departments,
    canReadSentiment: readable.size > 0,
  })
}

/** Records an export in the activity log. The file itself is built in the browser from the report on screen. */
export function recordExport(actorId: string, kind: 'CSV time series' | 'CSV account comparison' | 'PDF report', summary: string) {
  const s = db()
  if (!hasFunction(actorOf(s, actorId), 'reports.view', ctx(s))) throw new ApiError('Exporting needs the "View reports" function.')
  audit(s, actorId, 'Report exported (sample)', `${kind}: ${summary}. File is watermarked SAMPLE.`)
  persist()
  return wait(true)
}
