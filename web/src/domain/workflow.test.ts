import { describe, expect, it } from 'vitest'
import { nextStatus, postActions } from './workflow'

const none = { create: false, approve: false, publish: false }

describe('post workflow', () => {
  it('a creator can edit, submit and delete a draft but not approve or schedule it', () => {
    expect(postActions('Draft', { ...none, create: true })).toEqual(['edit', 'submit', 'delete'])
  })

  it('only approvers act on posts in review, and creators cannot approve their own', () => {
    expect(postActions('In review', { ...none, create: true })).toEqual([])
    expect(postActions('In review', { ...none, approve: true })).toEqual(['approve', 'return'])
  })

  it('scheduling needs publish permission and an approved post', () => {
    expect(postActions('Approved', { ...none, approve: true })).toEqual([])
    expect(postActions('Approved', { ...none, publish: true })).toEqual(['schedule', 'return'])
    expect(postActions('Draft', { ...none, publish: true })).toEqual([])
  })

  it('published posts allow no workflow actions', () => {
    expect(postActions('Published', { create: true, approve: true, publish: true })).toEqual([])
  })

  it('failed posts can be edited, resubmitted or retried by publishers', () => {
    expect(postActions('Failed', { create: true, approve: false, publish: true })).toEqual(['edit', 'submit', 'reschedule'])
  })

  it('transitions follow Draft to Published order and reject skips', () => {
    expect(nextStatus('Draft', 'submit')).toBe('In review')
    expect(nextStatus('In review', 'approve')).toBe('Approved')
    expect(nextStatus('Approved', 'schedule')).toBe('Scheduled')
    expect(nextStatus('Scheduled', 'unschedule')).toBe('Approved')
    expect(() => nextStatus('Draft', 'schedule')).toThrow()
    expect(() => nextStatus('Draft', 'approve')).toThrow()
    expect(() => nextStatus('Published', 'return')).toThrow()
  })
})
