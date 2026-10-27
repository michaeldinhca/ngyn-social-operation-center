import { describe, expect, it } from 'vitest'
import { AVAILABILITY, customGranularity, dayMetrics, hourWeight, makeBuckets, percentChange, readBucket, validateCustom } from './analytics'

const TODAY = '2026-10-21'

describe('analytics generator', () => {
  it('is deterministic for the same account and day', () => {
    expect(dayMetrics('social-1', 'Facebook', '2026-10-01')).toEqual(dayMetrics('social-1', 'Facebook', '2026-10-01'))
    expect(dayMetrics('social-1', 'Facebook', '2026-10-01')).not.toEqual(dayMetrics('social-2', 'Facebook', '2026-10-01'))
  })

  it('returns null, not zero, for metrics a network cannot report', () => {
    const b = dayMetrics('social-12', 'Bluesky', '2026-10-01')
    expect(b.impressions).toBeNull()
    expect(b.reach).toBeNull()
    expect(b.engagements).not.toBeNull()
    expect(AVAILABILITY.Bluesky.impressions).toBe(false)
  })

  it('hourly weights sum to one', () => {
    const sum = Array.from({ length: 24 }, (_, h) => hourWeight(h)).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it('builds the right number of buckets for each range, ending today', () => {
    expect(makeBuckets('24h', TODAY, 14)).toHaveLength(24)
    expect(makeBuckets('7d', TODAY)).toHaveLength(7)
    expect(makeBuckets('30d', TODAY)).toHaveLength(30)
    expect(makeBuckets('12w', TODAY)).toHaveLength(12)
    expect(makeBuckets('12m', TODAY)).toHaveLength(12)
    expect(makeBuckets('4q', TODAY)).toHaveLength(4)
    expect(makeBuckets('3y', TODAY)).toHaveLength(3)
    for (const r of ['7d', '30d', '12w', '12m', '4q', '3y'] as const) expect(makeBuckets(r, TODAY).at(-1)!.endDay).toBe(TODAY)
  })

  it('hourly buckets span yesterday and today and end at the current hour', () => {
    const b = makeBuckets('24h', TODAY, 9)
    expect(b.at(-1)!.hour).toBe(9)
    expect(b[0].startDay).toBe('2026-10-20')
    expect(b.at(-1)!.startDay).toBe(TODAY)
  })

  it('weeks start on Sunday and quarters are labelled', () => {
    expect(makeBuckets('12w', TODAY).at(-1)!.startDay).toBe('2026-10-18')
    expect(makeBuckets('4q', TODAY).at(-1)!.label).toBe('Q4 2026')
    expect(makeBuckets('4q', TODAY)[0].label).toBe('Q1 2026')
  })

  it('a bucket is unavailable only when no selected account reports the metric', () => {
    const bluesky = [{ id: 'social-12', network: 'Bluesky' as const }]
    expect(readBucket(bluesky, makeBuckets('7d', TODAY)[0]).impressions).toEqual({ value: null, reporting: 0 })
    const mixed = [...bluesky, { id: 'social-1', network: 'Facebook' as const }]
    const r = readBucket(mixed, makeBuckets('7d', TODAY)[0])
    expect(r.impressions.value).not.toBeNull()
    expect(r.impressions.reporting).toBe(1)
  })

  it('percent change ignores missing or zero baselines', () => {
    expect(percentChange(110, 100)).toBe(10)
    expect(percentChange(90, 100)).toBe(-10)
    expect(percentChange(null, 100)).toBeNull()
    expect(percentChange(100, 0)).toBeNull()
  })

  it('a day is larger than any single hour of it', () => {
    const acc = [{ id: 'social-1', network: 'Facebook' as const }]
    const day = readBucket(acc, { label: 'd', startDay: '2026-10-01', endDay: '2026-10-01' }).impressions.value!
    const hour = readBucket(acc, { label: 'h', startDay: '2026-10-01', endDay: '2026-10-01', hour: 12 }).impressions.value!
    expect(hour).toBeLessThan(day)
  })

  describe('custom range', () => {
    const custom = (from: string, to: string) => makeBuckets('custom', TODAY, 23, { from, to })

    it('uses daily buckets up to 31 days, weekly up to about six months, then monthly', () => {
      expect(customGranularity('2026-10-01', '2026-10-10')).toBe('Daily')
      expect(customGranularity('2026-07-01', '2026-10-10')).toBe('Weekly')
      expect(customGranularity('2025-01-01', '2026-10-10')).toBe('Monthly')
      expect(custom('2026-10-01', '2026-10-10')).toHaveLength(10)
    })

    it('weekly buckets are clipped to the chosen range and cover it exactly', () => {
      const b = custom('2026-07-01', '2026-10-10')
      expect(b[0].startDay).toBe('2026-07-01')
      expect(b.at(-1)!.endDay).toBe('2026-10-10')
      for (let i = 1; i < b.length; i++) expect(b[i].startDay > b[i - 1].endDay).toBe(true)
    })

    it('monthly buckets are clipped and contiguous', () => {
      const b = custom('2025-01-15', '2026-10-10')
      expect(b[0].startDay).toBe('2025-01-15')
      expect(b[0].endDay).toBe('2025-01-31')
      expect(b.at(-1)!.endDay).toBe('2026-10-10')
      expect(b).toHaveLength(22)
    })

    it('a single day is one bucket', () => {
      expect(custom('2026-10-01', '2026-10-01')).toHaveLength(1)
    })

    it('validates the range', () => {
      expect(validateCustom('2026-10-01', '2026-10-10', TODAY)).toBeNull()
      expect(validateCustom('', '2026-10-10', TODAY)).toMatch(/Choose/)
      expect(validateCustom('2026-10-10', '2026-10-01', TODAY)).toMatch(/on or before/)
      expect(validateCustom('2026-10-01', '2026-11-01', TODAY)).toMatch(/today at the latest/)
      expect(validateCustom('2022-12-31', '2026-10-01', TODAY)).toMatch(/starts on/)
      expect(validateCustom('2023-01-01', '2026-10-21', TODAY)).toMatch(/at most 3 years/)
    })
  })
})
