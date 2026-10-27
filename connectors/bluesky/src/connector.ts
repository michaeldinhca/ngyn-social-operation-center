// Bluesky connector core. Every call goes through BlueskyClient, a narrow wrapper over
// @atproto/api, so the rules here can be tested without the network.
//
// Rules carried over from the product (AI.md):
// - A person approves every post and reply. publish() and reply() refuse without approvedBy.
// - The emergency pause blocks publishing and replying.
// - Metrics Bluesky can't report (impressions, reach) are null, never zero.
// - Resident text from notifications is untrusted data, returned as-is and never acted on.

export const POST_LIMIT = 300 // graphemes, Bluesky's own limit for a post
export const IMAGE_LIMIT_BYTES = 2_000_000 // Bluesky's current blob limit for images, approximately

export interface Facet {
  index: { byteStart: number; byteEnd: number }
  features: unknown[]
}

export interface BlueskyClient {
  login(identifier: string, password: string): Promise<{ did: string; handle: string }>
  getProfile(actor: string): Promise<{ did: string; handle: string; displayName?: string; followersCount?: number; followsCount?: number; postsCount?: number }>
  /** Text length in graphemes and the link/mention/tag facets for it. */
  richText(text: string): Promise<{ text: string; graphemes: number; facets?: Facet[] }>
  uploadImage(bytes: Uint8Array, mime: string): Promise<unknown>
  createPost(record: Record<string, unknown>): Promise<{ uri: string; cid: string }>
  getPosts(uris: string[]): Promise<RawPost[]>
  listNotifications(limit: number, cursor?: string): Promise<{ cursor?: string; notifications: RawNotification[] }>
  deletePost(uri: string): Promise<void>
}

export interface RawPost {
  uri: string
  cid: string
  author: { did: string; handle: string; displayName?: string }
  record: { text?: string; createdAt?: string; reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } } }
  likeCount?: number
  repostCount?: number
  replyCount?: number
  quoteCount?: number
  indexedAt: string
}

export interface RawNotification {
  uri: string
  cid: string
  author: { did: string; handle: string; displayName?: string }
  reason: string
  reasonSubject?: string
  record: { text?: string; createdAt?: string; reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } } }
  isRead: boolean
  indexedAt: string
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
  langs?: string[]
}

export interface ReplyInput {
  /** at:// URI of the post or comment being answered. */
  parentUri: string
  text: string
  approvedBy: string
}

export interface Published {
  uri: string
  cid: string
  url: string
}

/** A mention, reply or quote, shaped like an Inbox & Comments conversation. Text is untrusted resident content. */
export interface InboxItem {
  id: string
  uri: string
  cid: string
  kind: 'Comment'
  reason: 'mention' | 'reply' | 'quote'
  author: { handle: string; displayName: string | null; did: string }
  text: string
  createdAt: string
  isRead: boolean
  /** The post this answers, when it is a reply. */
  inReplyTo: string | null
  url: string
  untrusted: true
}

export interface Metrics {
  uri: string
  likes: number
  reposts: number
  replies: number
  quotes: number
  /** Bluesky doesn't report these. null means unavailable, not zero. */
  impressions: null
  reach: null
}

export interface AuditEntry {
  at: string
  action: string
  detail: string
  actor: string
}

export interface ConnectorOptions {
  client: BlueskyClient
  identifier: string
  password: string
  isPaused?: () => boolean
  audit?: (e: AuditEntry) => void
  now?: () => Date
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/** Public web link for an at:// post URI. */
export function postUrl(uri: string, handle: string): string {
  const rkey = uri.split('/').pop()
  return `https://bsky.app/profile/${handle}/post/${rkey}`
}

export class BlueskyConnector {
  private session: { did: string; handle: string } | null = null
  private readonly o: Required<Omit<ConnectorOptions, 'client' | 'identifier' | 'password'>> & Pick<ConnectorOptions, 'client' | 'identifier' | 'password'>

  constructor(options: ConnectorOptions) {
    if (!options.identifier || !options.password) throw new ConnectorError('Set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD. Use an app password, never the account password.', 500)
    this.o = { isPaused: () => false, audit: () => {}, now: () => new Date(), ...options }
  }

  private async ensure() {
    if (!this.session) this.session = await this.o.client.login(this.o.identifier, this.o.password)
    return this.session
  }

  private log(action: string, detail: string, actor: string) {
    this.o.audit({ at: this.o.now().toISOString(), action, detail, actor })
  }

  private guard(approvedBy: string, what: string) {
    if (!approvedBy?.trim()) throw new ConnectorError(`A person must approve this ${what} first. Pass approvedBy.`, 403)
    if (this.o.isPaused()) throw new ConnectorError('Emergency pause is active. Nothing is published until an administrator resumes.', 423)
  }

  private async checkText(text: string) {
    const t = text?.trim() ?? ''
    if (!t) throw new ConnectorError('Write the text first.')
    const rt = await this.o.client.richText(t)
    if (rt.graphemes > POST_LIMIT) throw new ConnectorError(`Bluesky allows ${POST_LIMIT} characters. This has ${rt.graphemes}.`)
    return rt
  }

  async status() {
    const s = await this.ensure()
    const p = await this.o.client.getProfile(s.did)
    return { connected: true, did: p.did, handle: p.handle, displayName: p.displayName ?? null, followers: p.followersCount ?? 0, following: p.followsCount ?? 0, posts: p.postsCount ?? 0 }
  }

  async publish(input: PublishInput): Promise<Published> {
    this.guard(input.approvedBy, 'post')
    const rt = await this.checkText(input.text)
    if (input.image) {
      if (!input.image.alt?.trim()) throw new ConnectorError('Add ALT text for the image.')
      if (!IMAGE_TYPES.has(input.image.mime)) throw new ConnectorError('Bluesky images must be PNG, JPEG, WebP or GIF.')
      if (input.image.bytes.byteLength > IMAGE_LIMIT_BYTES) throw new ConnectorError('The image is over the Bluesky size limit (about 2 MB). Use a smaller file.')
    }
    const s = await this.ensure()
    const record: Record<string, unknown> = { $type: 'app.bsky.feed.post', text: rt.text, createdAt: this.o.now().toISOString(), langs: input.langs ?? ['en'] }
    if (rt.facets?.length) record.facets = rt.facets
    if (input.image) {
      const blob = await this.o.client.uploadImage(input.image.bytes, input.image.mime)
      record.embed = { $type: 'app.bsky.embed.images', images: [{ image: blob, alt: input.image.alt.trim() }] }
    }
    const r = await this.o.client.createPost(record)
    this.log('Bluesky post published', `${r.uri} (approved by ${input.approvedBy.trim()})`, input.approvedBy.trim())
    return { ...r, url: postUrl(r.uri, s.handle) }
  }

  async reply(input: ReplyInput): Promise<Published> {
    this.guard(input.approvedBy, 'reply')
    if (!input.parentUri?.startsWith('at://')) throw new ConnectorError('parentUri must be an at:// post URI.')
    const rt = await this.checkText(input.text)
    const s = await this.ensure()
    const [parent] = await this.o.client.getPosts([input.parentUri])
    if (!parent) throw new ConnectorError('That post no longer exists or is not visible.', 404)
    // A reply points at its parent and at the thread's first post.
    const root = parent.record.reply?.root ?? { uri: parent.uri, cid: parent.cid }
    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text: rt.text,
      createdAt: this.o.now().toISOString(),
      reply: { root, parent: { uri: parent.uri, cid: parent.cid } },
    }
    if (rt.facets?.length) record.facets = rt.facets
    const r = await this.o.client.createPost(record)
    this.log('Bluesky reply published', `${r.uri} in reply to ${parent.uri} (approved by ${input.approvedBy.trim()})`, input.approvedBy.trim())
    return { ...r, url: postUrl(r.uri, s.handle) }
  }

  /** Mentions, replies and quotes for the inbox. Likes, reposts and follows are left out. */
  async inbox(limit = 30, cursor?: string): Promise<{ items: InboxItem[]; cursor: string | null }> {
    await this.ensure()
    const r = await this.o.client.listNotifications(Math.min(Math.max(limit, 1), 100), cursor)
    const items = r.notifications
      .filter((n): n is RawNotification & { reason: InboxItem['reason'] } => n.reason === 'mention' || n.reason === 'reply' || n.reason === 'quote')
      .map((n) => ({
        id: n.cid,
        uri: n.uri,
        cid: n.cid,
        kind: 'Comment' as const,
        reason: n.reason,
        author: { handle: n.author.handle, displayName: n.author.displayName ?? null, did: n.author.did },
        text: n.record.text ?? '',
        createdAt: n.record.createdAt ?? n.indexedAt,
        isRead: n.isRead,
        inReplyTo: n.record.reply?.parent.uri ?? null,
        url: postUrl(n.uri, n.author.handle),
        untrusted: true as const,
      }))
    return { items, cursor: r.cursor ?? null }
  }

  async metrics(uris: string[]): Promise<Metrics[]> {
    if (!uris.length) return []
    if (uris.length > 25) throw new ConnectorError('Ask for 25 posts or fewer at a time.')
    await this.ensure()
    const posts = await this.o.client.getPosts(uris)
    return posts.map((p) => ({ uri: p.uri, likes: p.likeCount ?? 0, reposts: p.repostCount ?? 0, replies: p.replyCount ?? 0, quotes: p.quoteCount ?? 0, impressions: null, reach: null }))
  }

  async remove(uri: string, approvedBy: string) {
    if (!approvedBy?.trim()) throw new ConnectorError('A person must approve deleting a post. Pass approvedBy.', 403)
    const s = await this.ensure()
    if (!uri.startsWith(`at://${s.did}/`)) throw new ConnectorError('Only posts from the connected account can be deleted.', 403)
    await this.o.client.deletePost(uri)
    this.log('Bluesky post deleted', `${uri} (approved by ${approvedBy.trim()})`, approvedBy.trim())
    return { deleted: true }
  }
}
