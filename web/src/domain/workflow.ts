import type { PostStatus } from './types'

// Approval workflow (docs/handoff/CLAUDE_HANDOFF.md, "Single-post composer" and "All Content"):
// Draft -> In review -> Approved -> Scheduled -> Published, with return-to-draft on review.
// Human review and approval always come before scheduling. Publishing never happens outside the demo queue.

export type PostAction = 'edit' | 'submit' | 'approve' | 'return' | 'schedule' | 'reschedule' | 'unschedule' | 'delete'

export interface PostPerms {
  /** content.create on the post's channel */
  create: boolean
  /** content.approve on the post's channel */
  approve: boolean
  /** content.publish on the post's channel */
  publish: boolean
}

export function postActions(status: PostStatus, p: PostPerms): PostAction[] {
  const out: PostAction[] = []
  if (status === 'Draft' || status === 'Failed') {
    if (p.create) out.push('edit', 'submit')
    if (p.create && status === 'Draft') out.push('delete')
    if (p.publish && status === 'Failed') out.push('reschedule')
  }
  if (status === 'In review' && p.approve) out.push('approve', 'return')
  if (status === 'Approved' && p.publish) out.push('schedule', 'return')
  if (status === 'Scheduled' && p.publish) out.push('reschedule', 'unschedule')
  return out
}

/** Status after an action. Throws on an action that the status does not allow. */
export function nextStatus(status: PostStatus, action: PostAction): PostStatus {
  const t: Partial<Record<PostAction, Partial<Record<PostStatus, PostStatus>>>> = {
    submit: { Draft: 'In review', Failed: 'In review' },
    approve: { 'In review': 'Approved' },
    return: { 'In review': 'Draft', Approved: 'Draft' },
    schedule: { Approved: 'Scheduled' },
    reschedule: { Scheduled: 'Scheduled', Failed: 'Scheduled' },
    unschedule: { Scheduled: 'Approved' },
  }
  const next = t[action]?.[status]
  if (!next) throw new Error(`Cannot ${action} a post that is ${status}.`)
  return next
}

export function isEditable(status: PostStatus): boolean {
  return status === 'Draft' || status === 'Failed'
}
