// Domain model for the mockup. Resource names follow the shape a unified social API
// (for example Zernio: profiles, accounts, posts, comments, conversations) would return,
// so the mock adapter can later be replaced by a real backend without touching screens.

export type Network = 'Facebook' | 'Instagram' | 'Bluesky' | 'LinkedIn' | 'YouTube' | 'X'
export const NETWORKS: Network[] = ['Facebook', 'Instagram', 'Bluesky', 'LinkedIn', 'YouTube', 'X']

export type Department = 'Communications' | 'Public Works' | 'Transit' | 'Recreation' | 'Customer Service' | 'IT'
export type StaffRole = 'Administrator' | 'Approver' | 'Editor' | 'Responder' | 'Analyst' | 'Viewer'

export type FunctionId =
  | 'content.create'
  | 'content.approve'
  | 'content.publish'
  | 'inbox.respond'
  | 'reports.view'
  | 'ads.create'
  | 'ads.manage'
  | 'ads.accounts.add'

export interface User {
  id: string
  name: string
  email: string
  department: Department
  role: StaffRole
  status: 'Active' | 'Invited' | 'Suspended'
  /** Direct function grants. Independent of any Asset Group role. */
  functions: FunctionId[]
  /** Direct account assignments. A function grant alone never reveals an unassigned channel. */
  channels: string[]
  adAccounts: string[]
}

export type ConnectionStatus = 'Healthy' | 'Expiring' | 'Expired' | 'Error'

export interface SocialAccount {
  id: string
  name: string
  handle: string
  network: Network
  department: Department
  /** Asset Group the channel is linked to. Linking never grants access. */
  assetGroupId: string | null
  connection: { status: ConnectionStatus; expiresAt: string; lastSync: string }
}

export type GroupRole = 'creator' | 'approver' | 'ads'

export interface GroupAssignment {
  userId: string
  role: GroupRole
  /** Explicitly selected channels; newly linked channels are not added automatically. */
  channelIds: string[]
  adAccountIds: string[]
}

export interface AssetGroup {
  id: string
  name: string
  color: string
  voice: string
  assignments: GroupAssignment[]
}

export type PostStatus = 'Draft' | 'In review' | 'Approved' | 'Scheduled' | 'Published' | 'Failed'

export interface PostMetrics {
  impressions: number
  engagements: number
  /** Synthetic growth percentage, for the trending view. */
  trend: number
  observedAt: string
}

export interface Post {
  id: string
  batchId: string
  accountId: string
  title: string
  text: string
  status: PostStatus
  photo: number
  alt: string
  scheduledFor: string | null
  publishedAt: string | null
  createdAt: string
  createdBy: string
  metrics: PostMetrics | null
  failureReason?: string
}

export type Sentiment = 'Negative' | 'Concerned' | 'Neutral' | 'Positive'
export type Priority = 'Normal' | 'High' | 'Critical'
export type Category = 'Roads' | 'Transit' | 'Recreation' | 'Permits' | 'Waste' | 'Emergency' | 'General'
export const CATEGORIES: Category[] = ['Roads', 'Transit', 'Recreation', 'Permits', 'Waste', 'Emergency', 'General']

export interface ThreadMessage {
  id: string
  from: 'resident' | 'staff'
  author: string
  text: string
  at: string
}

export interface InternalNote {
  id: string
  author: string
  text: string
  at: string
}

export interface Conversation {
  id: string
  accountId: string
  kind: 'Comment' | 'Message'
  /** Post the comment was left on, when kind is Comment. */
  postId: string | null
  author: string
  thread: ThreadMessage[]
  createdAt: string
  status: 'Open' | 'Resolved'
  ownerId: string | null
  category: Category
  priority: Priority
  /** Staff-set sentiment. Starts from the simulated classifier and can be overridden. */
  sentiment: Sentiment
  ai: { score: number | null; confidence: number; category: Category; source: string }
  notes: InternalNote[]
  replyDraft: string
  resolvedBy: string | null
}

export type MentionSource = 'Owned comment' | 'Public post' | 'News' | 'Forum' | 'Blog'

export interface ListeningTopic {
  id: string
  name: string
  keywords: string[]
  createdBy: string
  createdAt: string
}

export interface Mention {
  id: string
  topicId: string
  network: Network | 'Web'
  source: MentionSource
  author: string
  text: string
  url: string
  at: string
  sentiment: number
}

export interface ListeningAlert {
  id: string
  topicId: string
  kind: 'volume' | 'negative'
  /** Mentions per day for volume, or negative share percent for negative. */
  threshold: number
  enabled: boolean
  createdBy: string
  triggeredAt: string | null
}

export interface AuditEvent {
  id: string
  at: string
  actor: string
  action: string
  detail: string
}

export interface FeedEvent {
  id: string
  at: string
  kind: 'conversation' | 'engagement' | 'failure' | 'healthy' | 'blocked'
  title: string
  detail: string
}

export interface EmergencyState {
  paused: boolean
  reason: string | null
  changedAt: string | null
  changedBy: string | null
}

export interface DemoState {
  version: 1
  seededAt: string
  users: User[]
  accounts: SocialAccount[]
  groups: AssetGroup[]
  posts: Post[]
  conversations: Conversation[]
  topics: ListeningTopic[]
  mentions: Mention[]
  alerts: ListeningAlert[]
  audit: AuditEvent[]
  feed: FeedEvent[]
  emergency: EmergencyState
  updateIndex: number
}

/** The demo administrator identity used by "View as user". Not authentication. */
export const ADMIN_ID = 'admin'
