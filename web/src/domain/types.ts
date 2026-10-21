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
  | 'channels.manage'
  | 'assets.manage'
  | 'assets.delete'

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

export interface Review {
  by: string
  at: string
}

export interface BrandLogo {
  id: string
  name: string
  /** data: URL. Seed logos are generated SVG marks; uploads stay in this browser. */
  image: string
}

/** Sample working canvases, not verified platform requirements. */
export const CANVASES: { label: string; width: number; height: number }[] = [
  { label: 'Square', width: 1080, height: 1080 },
  { label: 'Portrait', width: 1080, height: 1350 },
  { label: 'Tall portrait', width: 1080, height: 1440 },
  { label: 'Vertical', width: 1080, height: 1920 },
  { label: 'Landscape', width: 1200, height: 630 },
  { label: 'Widescreen', width: 1920, height: 1080 },
]

export interface VisualReference {
  id: string
  canvas: string
  width: number
  height: number
  photo: number
  note: string
}

export interface MasterDirection {
  name: string
  logos: BrandLogo[]
  /** Exactly two or three hex colours. */
  palette: string[]
  headingFont: string
  bodyFont: string
  voice: string
  mood: string
  tone: string
  dos: string[]
  donts: string[]
  updatedAt: string
  updatedBy: string
}

export interface GuidelineSet {
  id: string
  name: string
  purpose: string
  voice: string
  voiceId: string | null
  dos: string[]
  donts: string[]
  visuals: VisualReference[]
  reviewed: Review | null
}

export interface BrandVoice {
  id: string
  name: string
  method: 'website' | 'description'
  source: string
  context: string
  voice: string
  mood: string
  tone: string
  audience: string
  reviewed: Review | null
  createdAt: string
}

export interface BrandPackage {
  master: MasterDirection
  sets: GuidelineSet[]
  voices: BrandVoice[]
}

export interface AssetGroup {
  id: string
  name: string
  color: string
  description: string
  assignments: GroupAssignment[]
  brand: BrandPackage
  createdAt: string
}

export interface ArchivedGroup extends AssetGroup {
  archivedAt: string
  archivedBy: string
  unlinkedChannelIds: string[]
}

export type PostStatus = 'Draft' | 'In review' | 'Approved' | 'Scheduled' | 'Published' | 'Failed'

export interface PostMetrics {
  impressions: number
  engagements: number
  /** Synthetic growth percentage, for the trending view. */
  trend: number
  observedAt: string
}

export type PostFormat = 'Feed' | 'Reel' | 'Story' | 'Short' | 'Thread'

export interface PostEvent {
  id: string
  at: string
  actor: string
  action: 'Created' | 'Edited' | 'Submitted' | 'Approved' | 'Returned' | 'Scheduled' | 'Rescheduled' | 'Unscheduled' | 'Published' | 'Failed'
  note?: string
}

export interface Post {
  id: string
  /** Posts created together in one composer session share a batchId, one post per destination channel. */
  batchId: string
  accountId: string
  title: string
  text: string
  /** Optional follow-up comment, posted by staff after publishing where the network allows. */
  comment: string
  format: PostFormat
  status: PostStatus
  photo: number
  /** Stored media asset used for the image, when chosen from Media Storage. */
  mediaId: string | null
  assetGroupId: string | null
  guidelineId: string | null
  history: PostEvent[]
  /** Reviewer note from the last return to draft. */
  reviewNote: string | null
  alt: string
  scheduledFor: string | null
  publishedAt: string | null
  createdAt: string
  createdBy: string
  metrics: PostMetrics | null
  failureReason?: string
}

export type Sentiment = 'Negative' | 'Concerned' | 'Neutral' | 'Positive'
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

export type AdNetwork = 'Meta' | 'Google' | 'LinkedIn' | 'X'
export const AD_NETWORKS: AdNetwork[] = ['Meta', 'Google', 'LinkedIn', 'X']

/** A mock ad account. No real account, payment method or spend exists anywhere in the mockup. */
export interface AdAccount {
  id: string
  name: string
  network: AdNetwork
  /** Linking to an Asset Group grants nobody access. */
  assetGroupId: string | null
  /** Simulated planning limit in cents (CAD). Not a platform or bank limit. */
  limitCents: number
  createdAt: string
}

export type CampaignStatus = 'Draft' | 'In review' | 'Approved'
export type CampaignObjective = 'Awareness' | 'Service announcement' | 'Event promotion' | 'Traffic' | 'Engagement'
export const OBJECTIVES: CampaignObjective[] = ['Awareness', 'Service announcement', 'Event promotion', 'Traffic', 'Engagement']

export interface CampaignEvent {
  id: string
  at: string
  actor: string
  action: 'Created' | 'Edited' | 'Submitted' | 'Approved' | 'Returned' | 'Launch blocked'
  note?: string
}

export interface AdCampaign {
  id: string
  name: string
  adAccountId: string
  objective: CampaignObjective
  headline: string
  body: string
  /** Optional approved post the ad is based on. */
  postId: string | null
  audience: { area: string; ageMin: number; ageMax: number; language: 'English' | 'French' | 'Bilingual'; interests: string[] }
  /** Day keys, YYYY-MM-DD (Halifax). */
  startDay: string
  endDay: string
  dailyBudgetCents: number
  status: CampaignStatus
  reviewNote: string | null
  /** Always 0 in the mockup: spending is disabled. */
  spentCents: number
  history: CampaignEvent[]
  createdBy: string
  createdAt: string
}

export type MediaStatus = 'Needs review' | 'Approved' | 'Rejected'

export interface MediaVersion {
  id: string
  name: string
  at: string
  by: string
  bytes: number | null
  blobId: string | null
  photo: number | null
}

export interface MediaFolder {
  id: string
  name: string
}

export interface MediaAsset {
  id: string
  name: string
  mime: string
  folderId: string | null
  source: 'sample' | 'upload'
  /** Sample photo index for seeded assets. */
  photo: number | null
  /** IndexedDB key for uploaded files. */
  blobId: string | null
  bytes: number | null
  width: number | null
  height: number | null
  alt: string
  tags: string[]
  status: MediaStatus
  reviewedBy: string | null
  ownerId: string
  /** When set, only people with access to one of these channels can use the asset. */
  channelIds: string[]
  createdAt: string
  updatedAt: string
  versions: MediaVersion[]
  trashedAt: string | null
}

export interface DemoState {
  version: 4
  seededAt: string
  users: User[]
  accounts: SocialAccount[]
  groups: AssetGroup[]
  archivedGroups: ArchivedGroup[]
  media: MediaAsset[]
  mediaFolders: MediaFolder[]
  adAccounts: AdAccount[]
  campaigns: AdCampaign[]
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
