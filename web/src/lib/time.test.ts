import { describe, expect, it } from 'vitest'
import { dayKeyHalifax, halifaxToISO, moveToDay, toHalifaxInput } from './time'

describe('Halifax time', () => {
  it('converts winter (AST, UTC-4) wall time to UTC', () => {
    expect(halifaxToISO('2026-12-01T10:30')).toBe('2026-12-01T14:30:00.000Z')
  })
  it('converts summer (ADT, UTC-3) wall time to UTC', () => {
    expect(halifaxToISO('2026-07-01T10:30')).toBe('2026-07-01T13:30:00.000Z')
  })
  it('round-trips through the input format', () => {
    expect(toHalifaxInput(halifaxToISO('2026-11-02T10:30'))).toBe('2026-11-02T10:30')
  })
  it('handles the autumn DST change day', () => {
    expect(toHalifaxInput(halifaxToISO('2026-11-01T09:00'))).toBe('2026-11-01T09:00')
  })
  it('keeps the clock time when moving to another day', () => {
    expect(toHalifaxInput(moveToDay(halifaxToISO('2026-11-02T10:30'), '2026-11-05'))).toBe('2026-11-05T10:30')
  })
  it('day key uses Halifax, not UTC', () => {
    expect(dayKeyHalifax('2026-11-03T02:00:00.000Z')).toBe('2026-11-02')
  })
})
