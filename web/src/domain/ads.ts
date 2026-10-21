import type { AdCampaign, AdNetwork, CampaignStatus } from './types'

// Advertising rules (docs/handoff/CLAUDE_HANDOFF.md, "Advertising"; brief F18):
// - Advertising purchasing never happens without explicit authorization. The mockup has NO path to spend:
//   campaigns end at "Approved", and any launch request is blocked and audited.
// - Budgets and estimates are simulated planning numbers, never platform forecasts.

const DAY = 864e5
const utc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function campaignDays(startDay: string, endDay: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay) || !/^\d{4}-\d{2}-\d{2}$/.test(endDay)) return 0
  const n = Math.round((utc(endDay) - utc(startDay)) / DAY) + 1
  return n > 0 ? n : 0
}

export function totalBudgetCents(c: Pick<AdCampaign, 'startDay' | 'endDay' | 'dailyBudgetCents'>): number {
  return campaignDays(c.startDay, c.endDay) * c.dailyBudgetCents
}

/** Budget already promised on an account: campaigns in review or approved. Drafts commit nothing. */
export function committedCents(campaigns: AdCampaign[], adAccountId: string, excludeId?: string): number {
  return campaigns.filter((c) => c.adAccountId === adAccountId && c.id !== excludeId && (c.status === 'In review' || c.status === 'Approved')).reduce((sum, c) => sum + totalBudgetCents(c), 0)
}

export interface GuardCheck {
  ok: boolean
  problems: string[]
  committed: number
  limit: number
  total: number
}

/** Checks that must pass before a campaign can be submitted. Passing never authorizes spend. */
export function guardCheck(c: AdCampaign, all: AdCampaign[], limitCents: number): GuardCheck {
  const problems: string[] = []
  const days = campaignDays(c.startDay, c.endDay)
  const total = totalBudgetCents(c)
  const committed = committedCents(all, c.adAccountId, c.id)
  if (!c.name.trim()) problems.push('Name the campaign.')
  if (!c.headline.trim()) problems.push('Write a headline.')
  if (!c.body.trim()) problems.push('Write the ad text.')
  if (!c.audience.area.trim()) problems.push('Describe the target area.')
  if (c.audience.ageMin < 13 || c.audience.ageMax > 65 || c.audience.ageMin > c.audience.ageMax) problems.push('Age range must be between 13 and 65, with the minimum not above the maximum.')
  if (days === 0) problems.push('Choose a start day on or before the end day.')
  if (days > 90) problems.push('Campaigns run at most 90 days in this mockup.')
  if (c.dailyBudgetCents < 500) problems.push('Daily budget must be at least $5.00.')
  if (total + committed > limitCents) problems.push(`This campaign plus ${money(committed)} already committed exceeds the account's simulated limit of ${money(limitCents)}.`)
  return { ok: problems.length === 0, problems, committed, limit: limitCents, total }
}

export function money(cents: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100)
}

// Synthetic cost-per-thousand-impressions assumptions, in dollars. Not market data.
const CPM: Record<AdNetwork, number> = { Meta: 9, Google: 6, LinkedIn: 28, X: 11 }
const CTR: Record<AdNetwork, [number, number]> = { Meta: [0.6, 1.2], Google: [0.4, 0.9], LinkedIn: [0.35, 0.7], X: [0.5, 1.0] }

export interface Estimate {
  impressions: [number, number]
  clicks: [number, number]
  label: string
}

/** Planning-only estimate. Clearly synthetic: not a prediction from any ad platform. */
export function estimate(network: AdNetwork, totalCents: number): Estimate {
  const base = (totalCents / 100 / CPM[network]) * 1000
  const impressions: [number, number] = [Math.round(base * 0.75), Math.round(base * 1.25)]
  const [lo, hi] = CTR[network]
  return { impressions, clicks: [Math.round((impressions[0] * lo) / 100), Math.round((impressions[1] * hi) / 100)], label: 'Synthetic planning estimate, not a platform forecast' }
}

export const NEXT_CAMPAIGN_STATUS: Record<'submit' | 'approve' | 'return', Partial<Record<CampaignStatus, CampaignStatus>>> = {
  submit: { Draft: 'In review' },
  approve: { 'In review': 'Approved' },
  return: { 'In review': 'Draft', Approved: 'Draft' },
}

export const LAUNCH_BLOCKED = 'Spending is disabled in this mockup. A real launch needs a connected ad account, a payment method, a real budget authorization and written approval. Nothing was requested or charged.'
