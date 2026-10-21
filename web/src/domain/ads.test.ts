import { describe, expect, it } from 'vitest'
import { campaignDays, committedCents, estimate, guardCheck, totalBudgetCents } from './ads'
import type { AdCampaign } from './types'

const camp = (over: Partial<AdCampaign> = {}): AdCampaign => ({
  id: 'c1',
  name: 'Winter parking',
  adAccountId: 'ad-0',
  objective: 'Awareness',
  headline: 'Parking ban starts Dec 1',
  body: 'Move your car so plows can clear the street.',
  postId: null,
  audience: { area: 'Harbourview', ageMin: 18, ageMax: 65, language: 'English', interests: [] },
  startDay: '2026-11-25',
  endDay: '2026-12-04',
  dailyBudgetCents: 2500,
  status: 'Draft',
  reviewNote: null,
  spentCents: 0,
  history: [],
  createdBy: 'u',
  createdAt: '',
  ...over,
})

describe('advertising rules', () => {
  it('counts campaign days inclusively and rejects reversed ranges', () => {
    expect(campaignDays('2026-11-25', '2026-12-04')).toBe(10)
    expect(campaignDays('2026-11-25', '2026-11-25')).toBe(1)
    expect(campaignDays('2026-12-04', '2026-11-25')).toBe(0)
    expect(campaignDays('', '2026-11-25')).toBe(0)
  })

  it('total budget is daily budget times days', () => {
    expect(totalBudgetCents(camp())).toBe(25000)
  })

  it('only campaigns in review or approved commit budget; drafts commit nothing', () => {
    const all = [camp({ id: 'a', status: 'Approved' }), camp({ id: 'b', status: 'Draft' }), camp({ id: 'c', status: 'In review' }), camp({ id: 'd', adAccountId: 'other', status: 'Approved' })]
    expect(committedCents(all, 'ad-0')).toBe(50000)
    expect(committedCents(all, 'ad-0', 'a')).toBe(25000)
  })

  it('blocks submission over the simulated account limit', () => {
    const existing = camp({ id: 'x', status: 'Approved' })
    const g = guardCheck(camp(), [existing], 40000)
    expect(g.ok).toBe(false)
    expect(g.problems.join(' ')).toMatch(/exceeds/)
    expect(guardCheck(camp(), [existing], 60000).ok).toBe(true)
  })

  it('validates required fields, age range, minimum budget and length', () => {
    expect(guardCheck(camp({ name: ' ' }), [], 1e9).ok).toBe(false)
    expect(guardCheck(camp({ audience: { area: 'x', ageMin: 40, ageMax: 20, language: 'English', interests: [] } }), [], 1e9).problems.join(' ')).toMatch(/Age range/)
    expect(guardCheck(camp({ dailyBudgetCents: 100 }), [], 1e9).problems.join(' ')).toMatch(/at least \$5/)
    expect(guardCheck(camp({ startDay: '2026-01-01', endDay: '2026-12-31' }), [], 1e12).problems.join(' ')).toMatch(/90 days/)
  })

  it('estimates are ranges and labelled synthetic', () => {
    const e = estimate('Meta', 25000)
    expect(e.impressions[0]).toBeLessThan(e.impressions[1])
    expect(e.label).toMatch(/Synthetic/)
    expect(estimate('LinkedIn', 25000).impressions[1]).toBeLessThan(e.impressions[1])
  })
})
