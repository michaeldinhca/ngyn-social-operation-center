import type { FunctionId, StaffRole } from './types'

export const STAFF_ROLES: StaffRole[] = ['Administrator', 'Approver', 'Editor', 'Responder', 'Analyst', 'Viewer']

/** The usual functions for a staff role. A starting point only: functions and account assignments stay separate. */
export const ROLE_FUNCTIONS: Record<StaffRole, FunctionId[]> = {
  Administrator: ['content.create', 'content.approve', 'content.publish', 'inbox.respond', 'reports.view', 'ads.create', 'ads.manage', 'ads.accounts.add', 'channels.manage', 'assets.manage', 'assets.delete'],
  Approver: ['content.create', 'content.approve', 'content.publish', 'reports.view'],
  Editor: ['content.create'],
  Responder: ['inbox.respond'],
  Analyst: ['reports.view'],
  Viewer: [],
}

export type FunctionArea = 'Content' | 'Engagement' | 'Insights' | 'Advertising' | 'Administration'

export interface FunctionInfo {
  id: FunctionId
  label: string
  description: string
  area: FunctionArea
  /** True when the function only works on channels or ad accounts the person is also assigned. */
  scoped: 'channels' | 'adAccounts' | null
}

export const FUNCTION_CATALOG: FunctionInfo[] = [
  { id: 'content.create', label: 'Create content', description: 'Draft posts and submit them for approval.', area: 'Content', scoped: 'channels' },
  { id: 'content.approve', label: 'Approve content', description: 'Approve or return posts in review.', area: 'Content', scoped: 'channels' },
  { id: 'content.publish', label: 'Schedule and publish', description: 'Schedule approved posts, reschedule and retry.', area: 'Content', scoped: 'channels' },
  { id: 'inbox.respond', label: 'Respond to conversations', description: 'Read, assign, note and resolve comments and messages.', area: 'Engagement', scoped: 'channels' },
  { id: 'reports.view', label: 'View reports', description: 'Social Listening and Analytics & Reports.', area: 'Insights', scoped: null },
  { id: 'ads.create', label: 'Draft advertising', description: 'Create and submit campaign drafts.', area: 'Advertising', scoped: 'adAccounts' },
  { id: 'ads.manage', label: 'Manage advertising', description: 'Approve or return campaigns. Never authorizes spend.', area: 'Advertising', scoped: 'adAccounts' },
  { id: 'ads.accounts.add', label: 'Add ad accounts', description: 'Add mock ad accounts and link them to Asset Groups.', area: 'Advertising', scoped: null },
  { id: 'channels.manage', label: 'Manage social connections', description: 'Add channels and manage connection health.', area: 'Administration', scoped: 'channels' },
  { id: 'assets.manage', label: 'Manage asset groups', description: 'Create groups, link channels, assign roles, edit brand direction.', area: 'Administration', scoped: null },
  { id: 'assets.delete', label: 'Delete asset groups', description: 'Delete a group without deleting its channels.', area: 'Administration', scoped: null },
]

export const FUNCTION_AREAS: FunctionArea[] = ['Content', 'Engagement', 'Insights', 'Advertising', 'Administration']

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const validEmail = (e: string) => EMAIL.test(e.trim())

/** Functions that need a channel or ad account assignment to do anything, but the person has none. */
export function inertFunctions(functions: FunctionId[], channelCount: number, adAccountCount: number): FunctionInfo[] {
  return FUNCTION_CATALOG.filter((f) => functions.includes(f.id) && ((f.scoped === 'channels' && channelCount === 0) || (f.scoped === 'adAccounts' && adAccountCount === 0)))
}
