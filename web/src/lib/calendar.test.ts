import { describe, expect, it } from 'vitest'
import { addDays, addMonths, monthGrid, monthLabel, weekGrid, weekStart } from './calendar'

describe('calendar math', () => {
  it('October 2026 starts on a Thursday and the grid begins the Sunday before', () => {
    const g = monthGrid('2026-10-15')
    expect(g[0].key).toBe('2026-09-27')
    expect(g[0].inMonth).toBe(false)
    expect(g.find((c) => c.key === '2026-10-01')!.inMonth).toBe(true)
    expect(g.length % 7).toBe(0)
    expect(g.at(-1)!.key).toBe('2026-10-31')
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('weeks start on Sunday and have seven days', () => {
    expect(weekStart('2026-10-21')).toBe('2026-10-18')
    expect(weekGrid('2026-10-21').map((c) => c.key)).toEqual(['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'])
  })

  it('does not drift across the autumn clock change', () => {
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDays('2026-11-07', 1)).toBe('2026-11-08')
  })

  it('labels the month', () => {
    expect(monthLabel('2026-10-21')).toBe('October 2026')
  })
})
