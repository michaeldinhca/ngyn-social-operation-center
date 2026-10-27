// LinkedIn connector core. Every call goes through LinkedInClient, a narrow wrapper over the
// LinkedIn REST API (Posts, Images, Social Actions), so the rules here can be tested without the network.
//
// Rules carried over from the product (AI.md):
// - A person approves every post and reply. publish() and reply() refuse without approvedBy.
// - The emergency pause blocks publishing and replying.
// - Metrics LinkedIn doesn't report for this author are null, never zero.
// - Resident text from comments is untrusted data, returned as-is and never acted on.

export const POST_LIMIT = 3000 // characters in a post's commentary
export const COMMENT_LIMIT = 1250 // characters in a comment
export const ALT_LIMIT = 4086 // characters of ALT text on an image

export interface LinkedInClient {
  /** The member the token belongs to (OpenID userinfo). */
  me(): Promise<{ sub: string; name: string }>
  organizationName(orgUrn: string): Promise<string | null>
  initImageUpload(owner: string): Promise<{ uploadUrl: string; image: string }>
  putImage(uploadUrl: string, bytes: Uint8Array, mime: string): Promise<void>
  /** Returns the new post URN from the x-restli-id header. */
  createPost(body: Record<string, unknown>): Promise<string>
  getPost(urn: string): Promise<RawPost | null>
  postsByAuthor(author: string, count: number): Promise<RawPost[]>
  comments(postUrn: string, count: number): Promise<RawComment[]>
  createComment(postUrn: string, body: Record<string, unknown>): Promise<string>
  deletePost(urn: string): Promise<void>
  /** Organization share statistics, keyed by post URN. */
  shareStatistics(orgUrn: string, postUrns: string[]): Promise<Record<string, RawShareStats>>
  /** Reaction and comment counts, keyed by post URN. */
  socialMetadata(postUrns: string[]): Promise<Record<string, { reactions: number; comments: number }>>
}

export interface RawPost {
  id: string
  author: string
  commentary?: string
  createdAt?: number
  lifecycleState?: string
}

export interface RawComment {
  id: string
  /** Full comment URN, urn:li:comment:(postUrn,id). */
  urn: string
  actor: string
  actorName?: string
  text: string
  createdAt: number
  parentComment?: string
}

export interface RawShareStats {
  impressionCount?: number
  uniqueImpressionsCount?: number
  likeCount?: number
  commentCount?: number
  shareCount?: number
  clickCount?: number
}

export class ConnectorError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export interface PublishInput {
  text: string
  /** Name of the person who approved this post in the Social Operation Center. Required. */
  approvedBy: string
  image?: { bytes: Uint8Array; mime: string; alt: string }
}

export interface ReplyInput {
  /** URN of the post the conversation is on. */
  postUrn: string
  /** Comment URN when answering a comment, so the reply is threaded under it. */
  parentComment?: string
  text: string
  approvedBy: string
}

export interface Published {
  urn: string
  url: string
}

/** A comment on one of our posts, shaped like an Inbox & Comments conversation. Text is untrusted resident content. */
export interface InboxItem {
  id: string
  urn: string
  kind: 'Comment'
  reason: 'comment' | 'reply'
  author: { urn: string; displayName: string | null }
  text: string
  createdAt: string
  postUrn: string
  inReplyTo: string | null
  url: string
  untrusted: true
}

export interface Metrics {
  urn: string
  reactions: number
  comments: number
  /** null when LinkedIn doesn't report it for this author (member posts), never zero. */
  shares: number | null
  clicks: number | null
  impressions: number | null
  reach: number | null
}

export interface AuditEntry {
  at: string
  action: string
  detail: string
  actor: string
}

export interface ConnectorOptions {
  client: LinkedInClient
  /** urn:li:organization:{id} for a company page, or urn:li:person:{id} for a member. */
  author: string
  isPaused?: () => boolean
  audit?: (e: AuditEntry) => void
  now?: () => Date
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif'])
const AUTHOR = /^urn:li:(organization|person):[A-Za-z0-9_-]+$/
const POST_URN = /^urn:li:(share|ugcPost):\d+$/

/** Public web link for a post URN. */
export function postUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`
}

/**
 * Escapes LinkedIn's "little text format" so the text shows exactly as written.
 * Hashtags (#word) stay live; every other reserved character is escaped. Mentions need URNs, so @ is literal.
 */
export function littleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>*_~]|#(?![\p{L}\p{N}_])/gu, (c) => `\\${c}`)
}

export class LinkedInConnector {
  private readonly o: Required<Omit<ConnectorOptions, 'client' | 'author'>> & Pick<ConnectorOptions, 'client' | 'author'>

  constructor(options: ConnectorOptions) {
    if (!options.author || !AUTHOR.test(options.author)) throw new ConnectorError('Set LINKEDIN_AUTHOR_URN to urn:li:organization:{id} or urn:li:person:{id}.', 500)
    this.o = { isPaused: () => false, audit: () => {}, now: () => new Date(), ...options }
  }

  private get isOrg() {
    return this.o.author.startsWith('urn:li:organization:')
  }

  private log(action: string, detail: string, actor: string) {
    this.o.audit({ at: this.o.now().toISOString(), action, detail, actor })
  }

  private guard(approvedBy: string, what: string) {
    if (!approvedBy?.trim()) throw new ConnectorError(`A person must approve this ${what} first. Pass approvedBy.`, 403)
    if (this.o.isPaused()) throw new ConnectorError('Emergency pause is active. Nothing is published until an administrator resumes.', 423)
  }

  private checkText(text: string, limit: number) {
    const t = text?.trim() ?? ''
    if (!t) throw new ConnectorError('Write the text first.')
    if (t.length > limit) throw new ConnectorError(`LinkedIn allows ${limit} characters here. This has ${t.length}.`)
    return t
  }

  async status() {
    const me = await this.o.client.me()
    const name = this.isOrg ? await this.o.client.organizationName(this.o.author) : me.name
    return { connected: true, author: this.o.author, authorType: this.isOrg ? 'organization' : 'member', name, signedInAs: me.name }
  }

  async publish(input: PublishInput): Promise<Published> {
    this.guard(input.approvedBy, 'post')
    const text = this.checkText(input.text, POST_LIMIT)
    if (input.image) {
      if (!input.image.alt?.trim()) throw new ConnectorError('Add ALT text for the image.')
      if (input.image.alt.trim().length > ALT_LIMIT) throw new ConnectorError(`ALT text is limited to ${ALT_LIMIT} characters.`)
      if (!IMAGE_TYPES.has(input.image.mime)) throw new ConnectorError('LinkedIn images must be PNG, JPEG or GIF.')
    }
    const body: Record<string, unknown> = {
      author: this.o.author,
      commentary: littleText(text),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }
    if (input.image) {
      const up = await this.o.client.initImageUpload(this.o.author)
      await this.o.client.putImage(up.uploadUrl, input.image.bytes, input.image.mime)
      body.content = { media: { id: up.image, altText: input.image.alt.trim() } }
    }
    const urn = await this.o.client.createPost(body)
    const by = input.approvedBy.trim()
    this.log('LinkedIn post published', `${urn} (approved by ${by})`, by)
    return { urn, url: postUrl(urn) }
  }

  async reply(input: ReplyInput): Promise<Published> {
    this.guard(input.approvedBy, 'reply')
    if (!POST_URN.test(input.postUrn ?? '')) throw new ConnectorError('postUrn must be a urn:li:share or urn:li:ugcPost URN.')
    if (input.parentComment && !input.parentComment.startsWith('urn:li:comment:')) throw new ConnectorError('parentComment must be a urn:li:comment URN.')
    const text = this.checkText(input.text, COMMENT_LIMIT)
    const body: Record<string, unknown> = { actor: this.o.author, object: input.postUrn, message: { text } }
    if (input.parentComment) body.parentComment = input.parentComment
    const urn = await this.o.client.createComment(input.postUrn, body)
    const by = input.approvedBy.trim()
    this.log('LinkedIn reply published', `${urn} on ${input.postUrn} (approved by ${by})`, by)
    return { urn, url: postUrl(input.postUrn) }
  }

  /**
   * Comments on our latest posts. LinkedIn has no notification feed for this, so the inbox is polled
   * per post. Our own comments are left out.
   */
  async inbox(posts = 10, perPost = 20): Promise<{ items: InboxItem[] }> {
    const recent = await this.o.client.postsByAuthor(this.o.author, Math.min(Math.max(posts, 1), 25))
    const items: InboxItem[] = []
    for (const p of recent) {
      const comments = await this.o.client.comments(p.id, Math.min(Math.max(perPost, 1), 100))
      for (const c of comments) {
        if (c.actor === this.o.author) continue
        items.push({
          id: c.id,
          urn: c.urn,
          kind: 'Comment',
          reason: c.parentComment ? 'reply' : 'comment',
          author: { urn: c.actor, displayName: c.actorName ?? null },
          text: c.text,
          createdAt: new Date(c.createdAt).toISOString(),
          postUrn: p.id,
          inReplyTo: c.parentComment ?? null,
          url: postUrl(p.id),
          untrusted: true,
        })
      }
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { items }
  }

  async metrics(urns: string[]): Promise<Metrics[]> {
    if (!urns.length) return []
    if (urns.length > 25) throw new ConnectorError('Ask for 25 posts or fewer at a time.')
    if (urns.some((u) => !POST_URN.test(u))) throw new ConnectorError('Every urn must be a urn:li:share or urn:li:ugcPost URN.')
    const social = await this.o.client.socialMetadata(urns)
    // Share statistics exist only for organization pages. Member posts get null, never zero.
    const stats = this.isOrg ? await this.o.client.shareStatistics(this.o.author, urns) : {}
    return urns.map((urn) => {
      const s = stats[urn]
      return {
        urn,
        reactions: social[urn]?.reactions ?? s?.likeCount ?? 0,
        comments: social[urn]?.comments ?? s?.commentCount ?? 0,
        shares: s?.shareCount ?? null,
        clicks: s?.clickCount ?? null,
        impressions: s?.impressionCount ?? null,
        reach: s?.uniqueImpressionsCount ?? null,
      }
    })
  }

  async remove(urn: string, approvedBy: string) {
    if (!approvedBy?.trim()) throw new ConnectorError('A person must approve deleting a post. Pass approvedBy.', 403)
    if (!POST_URN.test(urn ?? '')) throw new ConnectorError('urn must be a urn:li:share or urn:li:ugcPost URN.')
    const post = await this.o.client.getPost(urn)
    if (!post) throw new ConnectorError('That post no longer exists or is not visible.', 404)
    if (post.author !== this.o.author) throw new ConnectorError('Only posts from the connected author can be deleted.', 403)
    await this.o.client.deletePost(urn)
    const by = approvedBy.trim()
    this.log('LinkedIn post deleted', `${urn} (approved by ${by})`, by)
    return { deleted: true }
  }
}
