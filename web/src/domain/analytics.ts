import { addDays, addMonths, weekStart } from '@/lib/calendar'
import type { Network } from './types'

// Synthetic analytics generator for the mockup (brief F10/F11). Everything here is invented and
// deterministic: the same account and day always give the same numbers. Nothing is a platform metric,
// and a metric a network cannot provide is `null` (Unavailable), never zero or a guess.

export type MetricKey = 'impressions' | 'reach' | 'engagements' | 'followers'
export const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'reach', label: 'Reach' },
  { key: 'engagements', label: 'Engagements' },
  { key: 'followers', label: 'Followers gained' },
]

/** Demo assumption from the provider's public docs, not verified. See docs/PLATFORM_CAPABILITY_MATRIX.md. */
export const AVAILABILITY: Record<Network, Record<MetricKey, boolean>> = {
  Facebook: { impressions: true, reach: true, engagements: true, followers: true },
  Instagram: { impressions: true, reach: true, engagements: true, followers: true },
  Bluesky: { impressions: false, reach: false, engagements: true, followers: true },
  LinkedIn: { impressions: true, reach: false, engagements: true, followers: true },
  YouTube: { impressions: true, reach: false, engagements: true, followers: true },
  X: { impressions: true, reach: false, engagements: true, followers: true },
}

export const UNAVAILABLE_REASON: Record<Network, Partial<Record<MetricKey, string>>> = {
  Facebook: {},
  Instagram: {},
  Bluesky: { impressions: 'Bluesky does not expose impressions', reach: 'Bluesky does not expose reach' },
  LinkedIn: { reach: 'LinkedIn organization analytics do not include reach' },
  YouTube: { reach: 'YouTube reports views, not reach' },
  X: { reach: 'X does not provide reach' },
}

function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function unit(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const BASE: Record<Network, number> = { Facebook: 3200, Instagram: 2600, Bluesky: 700, LinkedIn: 900, YouTube: 1500, X: 2100 }
const ENGAGEMENT_RATE: Record<Network, [number, number]> = { Facebook: [0.018, 0.04], Instagram: [0.03, 0.06], Bluesky: [0.04, 0.08], LinkedIn: [0.02, 0.045], YouTube: [0.025, 0.05], X: [0.012, 0.03] }
const WEEKDAY = [0.8, 1.05, 1.1, 1.1, 1.05, 0.95, 0.75] // Sunday first

const dayNumber = (dayKey: string) => {
  const [y, m, d] = dayKey.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2023, 0, 1)) / 864e5)
}

export function dayMetrics(accountId: string, network: Network, dayKey: string): Record<MetricKey, number | null> {
  const n = dayNumber(dayKey)
  const dow = new Date(Date.UTC(...(dayKey.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))) as [number, number, number]))).getUTCDay()
  const acct = hash32(accountId)
  const scale = 0.6 + unit(acct) * 1.0
  const trend = 1 + n * 0.0004
  const wave = 1 + 0.12 * Math.sin(n / 29 + (acct % 7))
  const noise = 0.8 + unit(acct ^ Math.imul(n, 2654435761)) * 0.4
  const impressions = BASE[network] * scale * WEEKDAY[dow] * trend * wave * noise
  const [lo, hi] = ENGAGEMENT_RATE[network]
  const rate = lo + (hi - lo) * unit(acct ^ 0x9e3779b1)
  const reach = impressions * (0.55 + 0.15 * unit(acct ^ 0x85ebca6b))
  const engagements = (AVAILABILITY[network].impressions ? impressions : BASE[network] * scale * 1.6 * WEEKDAY[dow] * trend * wave * noise) * rate
  const followers = BASE[network] / 500 * scale * (unit(acct ^ Math.imul(n, 40503)) * 2 - 0.35) * WEEKDAY[dow]
  const a = AVAILABILITY[network]
  return {
    impressions: a.impressions ? Math.round(impressions) : null,
    reach: a.reach ? Math.round(reach) : null,
    engagements: a.engagements ? Math.round(engagements) : null,
    followers: a.followers ? Math.round(followers) : null,
  }
}

/** Share of a day's activity in each Halifax hour. Sums to 1. */
export function hourWeight(hour: number): number {
  const raw = Array.from({ length: 24 }, (_, h) => 0.25 + Math.exp(-Math.pow((h - 12.5) / 4.5, 2)) + 0.5 * Math.exp(-Math.pow((h - 19) / 2.5, 2)))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw[hour] / sum
}

export type RangeId = '24h' | '7d' | '30d' | '12w' | '12m' | '4q' | '3y' | 'custom'
export type Granularity = 'Hourly' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual' | 'Auto'

export const RANGES: { id: RangeId; label: string; granularity: Granularity }[] = [
  { id: '24h', label: 'Last 24 hours', granularity: 'Hourly' },
  { id: '7d', label: 'Last 7 days', granularity: 'Daily' },
  { id: '30d', label: 'Last 30 days', granularity: 'Daily' },
  { id: '12w', label: 'Last 12 weeks', granularity: 'Weekly' },
  { id: '12m', label: 'Last 12 months', granularity: 'Monthly' },
  { id: '4q', label: 'Last 4 quarters', granularity: 'Quarterly' },
  { id: '3y', label: 'Last 3 years', granularity: 'Annual' },
  { id: 'custom', label: 'Custom range', granularity: 'Auto' },
]

export interface Bucket {
  label: string
  startDay: string
  endDay: string
  /** Set for hourly buckets: the Halifax hour of day. */
  hour?: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDay = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${Number(k.slice(8))}`

function lastDayOfMonth(k: string) {
  return addDays(addMonths(k.slice(0, 7) + '-01', 1), -1)
}

export const DATA_STARTS = '2023-01-01'
const MAX_CUSTOM_DAYS = 1096

export interface CustomRange {
  from: string
  to: string
}

/** Why a custom range can't be used, or null when it can. */
export function validateCustom(from: string, to: string, today: string): string | null {
  const day = /^\d{4}-\d{2}-\d{2}$/
  if (!day.test(from) || !day.test(to)) return 'Choose a start and end day.'
  if (from > to) return 'The start day must be on or before the end day.'
  if (to > today) return 'The end day can be today at the latest.'
  if (from < DATA_STARTS) return `Sample data starts on ${DATA_STARTS}.`
  if (daysBetween(from, to).length > MAX_CUSTOM_DAYS) return 'A custom range can cover at most 3 years.'
  return null
}

/** Custom ranges pick their own granularity so a chart stays readable. */
export function customGranularity(from: string, to: string): Granularity {
  const n = daysBetween(from, to).length
  return n <= 31 ? 'Daily' : n <= 182 ? 'Weekly' : 'Monthly'
}

function customBuckets(from: string, to: string): Bucket[] {
  const g = customGranularity(from, to)
  if (g === 'Daily') return daysBetween(from, to).map((k) => ({ label: shortDay(k), startDay: k, endDay: k }))
  const out: Bucket[] = []
  if (g === 'Weekly') {
    for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) {
      const start = ws < from ? from : ws
      const end = addDays(ws, 6) > to ? to : addDays(ws, 6)
      out.push({ label: shortDay(start), startDay: start, endDay: end })
    }
    return out
  }
  for (let ms = from.slice(0, 7) + '-01'; ms <= to; ms = addMonths(ms, 1)) {
    const start = ms < from ? from : ms
    const last = lastDayOfMonth(ms)
    out.push({ label: `${MONTHS[Number(ms.slice(5, 7)) - 1]} ${ms.slice(2, 4)}`, startDay: start, endDay: last > to ? to : last })
  }
  return out
}

/** Buckets for a range, oldest first, ending at (and including) today. `nowHour` is the current Halifax hour. */
export function makeBuckets(range: RangeId, today: string, nowHour = 23, custom?: CustomRange): Bucket[] {
  switch (range) {
    case '24h':
      return Array.from({ length: 24 }, (_, i) => {
        const back = 23 - i
        const h = nowHour - back
        const day = h >= 0 ? today : addDays(today, -1)
        const hour = (h + 24) % 24
        return { label: `${String(hour).padStart(2, '0')}:00`, startDay: day, endDay: day, hour }
      })
    case '7d':
    case '30d': {
      const n = range === '7d' ? 7 : 30
      return Array.from({ length: n }, (_, i) => {
        const k = addDays(today, -(n - 1 - i))
        return { label: range === '7d' ? new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8))).toLocaleDateString('en-CA', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }) : shortDay(k), startDay: k, endDay: k }
      })
    }
    case '12w': {
      const thisWeek = weekStart(today)
      return Array.from({ length: 12 }, (_, i) => {
        const start = addDays(thisWeek, -7 * (11 - i))
        const end = i === 11 ? today : addDays(start, 6)
        return { label: shortDay(start), startDay: start, endDay: end }
      })
    }
    case '12m': {
      const thisMonth = today.slice(0, 7) + '-01'
      return Array.from({ length: 12 }, (_, i) => {
        const start = addMonths(thisMonth, -(11 - i))
        return { label: `${MONTHS[Number(start.slice(5, 7)) - 1]} ${start.slice(2, 4)}`, startDay: start, endDay: i === 11 ? today : lastDayOfMonth(start) }
      })
    }
    case '4q': {
      const m = Number(today.slice(5, 7))
      const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1
      const thisQ = `${today.slice(0, 4)}-${String(qStartMonth).padStart(2, '0')}-01`
      return Array.from({ length: 4 }, (_, i) => {
        const start = addMonths(thisQ, -3 * (3 - i))
        const q = Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1
        return { label: `Q${q} ${start.slice(0, 4)}`, startDay: start, endDay: i === 3 ? today : lastDayOfMonth(addMonths(start, 2)) }
      })
    }
    case 'custom': {
      if (!custom) throw new Error('A custom range needs a start and end day.')
      return customBuckets(custom.from, custom.to)
    }
    case '3y': {
      const y = Number(today.slice(0, 4))
      return [y - 2, y - 1, y].map((yy) => ({ label: yy === y ? `${yy} (to date)` : String(yy), startDay: `${yy}-01-01`, endDay: yy === y ? today : `${yy}-12-31` }))
    }
  }
}

export function daysBetween(startDay: string, endDay: string): string[] {
  const out: string[] = []
  for (let k = startDay; k <= endDay; k = addDays(k, 1)) out.push(k)
  return out
}

export interface Reading {
  value: number | null
  /** How many of the selected accounts report this metric. */
  reporting: number
}

/** Sum a metric over accounts and a bucket. Null only when no selected account can report it. */
export function readBucket(accounts: { id: string; network: Network }[], bucket: Bucket): Record<MetricKey, Reading> {
  const out = {} as Record<MetricKey, Reading>
  for (const m of METRICS) {
    let sum = 0
    let reporting = 0
    for (const a of accounts) {
      if (!AVAILABILITY[a.network][m.key]) continue
      reporting++
      for (const day of daysBetween(bucket.startDay, bucket.endDay)) {
        const v = dayMetrics(a.id, a.network, day)[m.key]
        if (v === null) continue
        sum += bucket.hour !== undefined ? v * hourWeight(bucket.hour) : v
      }
    }
    out[m.key] = { value: reporting ? Math.round(sum) : null, reporting }
  }
  return out
}

export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}
