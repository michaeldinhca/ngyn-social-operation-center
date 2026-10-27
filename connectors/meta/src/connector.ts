// Meta connector core: one Facebook Page and, optionally, the Instagram professional account linked to it.
// Every call goes through MetaClient, a narrow wrapper over the Graph API, so the rules here can be
// tested without the network.
//
// Rules carried over from the product (AI.md):
// - A person approves every post, reply, hide and delete. Each refuses without approvedBy.
// - The emergency pause blocks publishing and replying. Hiding a comment is moderation and still works.
// - Metrics Meta doesn't return are null, never zero.
// - Resident text from comments is untrusted data, returned as-is and never acted on.

export type MetaNetwork = 'facebook' | 'instagram'

export const LIMITS = {
  facebookPost: 63_206,
  facebookComment: 8_000,
  instagramCaption: 2_200,
  instagramComment: 2_200,
  instagramHashtags: 30,
  instagramMentions: 20,
  alt: 1_000,
  facebookImageBytes: 10_000_000,
}

export interface MetaClient {
  page(): Promise<{ id: string; name: string; followers?: number }>
  instagram(): Promise<{ id: string; username: string; followers?: number; posts?: number } | null>
  fbPost(input: { message: string; link?: string }): Promise<string>
  fbPhoto(input: { bytes: Uint8Array; mime: string; caption: string; alt: string }): Promise<string>
  /** Comment on a post, or reply to a comment. */
  fbComment(objectId: string, message: string): Promise<string>
  fbFeed(limit: number, perPost: number): Promise<RawThread[]>
  fbStats(postIds: string[]): Promise<RawStats[]>
  fbDelete(postId: string): Promise<void>
  fbHide(commentId: string, hidden: boolean): Promise<void>
  igContainer(input: { imageUrl: string; caption: string; altText: string }): Promise<string>
  igContainerStatus(containerId: string): Promise<string>
  igPublish(containerId: string): Promise<{ id: string; permalink?: string }>
  igReply(commentId: string, message: string): Promise<string>
  igMedia(limit: number, perPost: number): Promise<RawThread[]>
  igStats(mediaIds: string[]): Promise<RawStats[]>
  igHide(commentId: string, hidden: boolean): Promise<void>
}

export interface RawThread {
  id: string
  permalink?: string
  comments: RawComment[]
}

export interface RawComment {
  id: string
  text: string
  /** Facebook returns the commenter only when the app has pages_read_user_content. */
  fromId?: string
  fromName?: string
  createdAt: string
  parentId?: string
  hidden?: boolean
}

export interface RawStats {
  id: string
  reactions?: number
  comments?: number
  shares?: number
  saves?: number
  views?: number | null
  reach?: number | null
}

export class ConnectorError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export interface PublishInput {
  network: MetaNetwork
  text: string
  /** Name of the person who approved this post in the Social Operation Center. Required. */
  approvedBy: string
  /** Facebook only: a link attached to a text post. */
  link?: string
  /** Facebook: image bytes. Instagram: needs imageUrl instead, because Meta fetches the file itself. */
  image?: { bytes?: Uint8Array; mime?: string; imageUrl?: string; alt: string }
}

export interface ReplyInput {
  network: MetaNetwork
  /** Facebook: post or comment ID. Instagram: comment ID. */
  parentId: string
  text: string
  approvedBy: string
}

export interface Published {
  id: string
  url: string | null
}

/** A comment on one of our posts, shaped like an Inbox & Comments conversation. Text is untrusted resident content. */
export interface InboxItem {
  id: string
  network: MetaNetwork
  kind: 'Comment'
  reason: 'comment' | 'reply'
  author: { id: string | null; displayName: string | null }
  text: string
  createdAt: string
  postId: string
  inReplyTo: string | null
  hidden: boolean
  url: string | null
  untrusted: true
}

export interface Metrics {
  id: string
  network: MetaNetwork
  reactions: number
  comments: number
  shares: number | null
  saves: number | null
  /** null when Meta doesn't return it, never zero. */
  views: number | null
  reach: number | null
}

export interface AuditEntry {
  at: string
  action: string
  detail: string
  actor: string
}

export interface ConnectorOptions {
  client: MetaClient
  pageId: string
  /** Set when an Instagram professional account is linked to the Page. */
  instagramId?: string
  isPaused?: () => boolean
  audit?: (e: AuditEntry) => void
  now?: () => Date
  /** Waits between Instagram container status checks. Tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>
}

const FB_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif'])
// Graph IDs are digits, joined by underscores for posts (page_post) and comments (page_post_comment).
const ID = /^[0-9]+(_[0-9]+){0,2}$/

export class MetaConnector {
  private readonly o: Required<Omit<ConnectorOptions, 'client' | 'pageId' | 'instagramId'>> & Pick<ConnectorOptions, 'client' | 'pageId' | 'instagramId'>

  constructor(options: ConnectorOptions) {
    if (!options.pageId || !ID.test(options.pageId)) throw new ConnectorError('Set META_PAGE_ID to the test Page ID (run npm run auth).', 500)
    this.o = { isPaused: () => false, audit: () => {}, now: () => new Date(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), ...options }
  }

  private log(action: string, detail: string, actor: string) {
    this.o.audit({ at: this.o.now().toISOString(), action, detail, actor })
  }

  private approver(approvedBy: string, what: string) {
    if (!approvedBy?.trim()) throw new ConnectorError(`A person must approve this ${what} first. Pass approvedBy.`, 403)
    return approvedBy.trim()
  }

  private guard(approvedBy: string, what: string) {
    const by = this.approver(approvedBy, what)
    if (this.o.isPaused()) throw new ConnectorError('Emergency pause is active. Nothing is published until an administrator resumes.', 423)
    return by
  }

  private needInstagram() {
    if (!this.o.instagramId) throw new ConnectorError('No Instagram account is linked. Link one to the Page, then run npm run auth again.', 409)
  }

  private checkText(text: string, limit: number, label: string) {
    const t = text?.trim() ?? ''
    if (!t) throw new ConnectorError('Write the text first.')
    if (t.length > limit) throw new ConnectorError(`${label} allows ${limit} characters. This has ${t.length}.`)
    return t
  }

  private checkId(id: string, what: string) {
    if (!ID.test(id ?? '')) throw new ConnectorError(`${what} must be a Meta ID.`)
  }

  async status() {
    const [page, ig] = await Promise.all([this.o.client.page(), this.o.instagramId ? this.o.client.instagram() : Promise.resolve(null)])
    return {
      connected: true,
      facebook: { id: page.id, name: page.name, followers: page.followers ?? null },
      instagram: ig ? { id: ig.id, username: ig.username, followers: ig.followers ?? null, posts: ig.posts ?? null } : null,
    }
  }

  async publish(input: PublishInput): Promise<Published> {
    const by = this.guard(input.approvedBy, 'post')
    if (input.network === 'instagram') return this.publishInstagram(input, by)
    const text = this.checkText(input.text, LIMITS.facebookPost, 'Facebook')
    if (input.link && !/^https:\/\//.test(input.link)) throw new ConnectorError('The link must start with https://.')
    let id: string
    if (input.image) {
      const { bytes, mime, alt } = input.image
      if (!alt?.trim()) throw new ConnectorError('Add ALT text for the image.')
      if (alt.trim().length > LIMITS.alt) throw new ConnectorError(`ALT text is limited to ${LIMITS.alt} characters.`)
      if (!bytes || !mime) throw new ConnectorError('Send the image file for a Facebook photo post.')
      if (!FB_IMAGE_TYPES.has(mime)) throw new ConnectorError('Facebook images must be PNG, JPEG or GIF here.')
      if (bytes.byteLength > LIMITS.facebookImageBytes) throw new ConnectorError('The image is over 10 MB. Use a smaller file.')
      if (input.link) throw new ConnectorError('A Facebook photo post cannot carry a link card. Put the link in the text.')
      id = await this.o.client.fbPhoto({ bytes, mime, caption: text, alt: alt.trim() })
    } else {
      id = await this.o.client.fbPost({ message: text, link: input.link })
    }
    this.log('Facebook post published', `${id} (approved by ${by})`, by)
    return { id, url: `https://www.facebook.com/${id}` }
  }

  private async publishInstagram(input: PublishInput, by: string): Promise<Published> {
    this.needInstagram()
    const text = this.checkText(input.text, LIMITS.instagramCaption, 'Instagram')
    if ((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > LIMITS.instagramHashtags) throw new ConnectorError(`Instagram allows ${LIMITS.instagramHashtags} hashtags.`)
    if ((text.match(/@[\w.]+/g) ?? []).length > LIMITS.instagramMentions) throw new ConnectorError(`Instagram allows ${LIMITS.instagramMentions} @ tags.`)
    if (input.link) throw new ConnectorError('Instagram posts cannot carry links.')
    const img = input.image
    if (!img) throw new ConnectorError('Instagram posts need an image.')
    if (!img.alt?.trim()) throw new ConnectorError('Add ALT text for the image.')
    if (img.alt.trim().length > LIMITS.alt) throw new ConnectorError(`ALT text is limited to ${LIMITS.alt} characters.`)
    // Meta downloads the file from a public URL. The local connector has nowhere public to put bytes.
    if (!img.imageUrl || !/^https:\/\//.test(img.imageUrl)) throw new ConnectorError('Instagram needs a public https:// JPEG URL (imageUrl). Meta downloads it itself.')
    const container = await this.o.client.igContainer({ imageUrl: img.imageUrl, caption: text, altText: img.alt.trim() })
    // Image containers are usually ready at once; wait briefly before giving up.
    for (let i = 0; ; i++) {
      const s = await this.o.client.igContainerStatus(container)
      if (s === 'FINISHED') break
      if (s === 'ERROR' || s === 'EXPIRED') throw new ConnectorError(`Instagram could not process the image (${s}). Check it is a JPEG under 8 MB.`, 502)
      if (i >= 9) throw new ConnectorError('Instagram is still processing the image. Try publishing again in a minute.', 504)
      await this.o.sleep(1000)
    }
    const media = await this.o.client.igPublish(container)
    this.log('Instagram post published', `${media.id} (approved by ${by})`, by)
    return { id: media.id, url: media.permalink ?? null }
  }

  async reply(input: ReplyInput): Promise<Published> {
    const by = this.guard(input.approvedBy, 'reply')
    this.checkId(input.parentId, 'parentId')
    let id: string
    if (input.network === 'instagram') {
      this.needInstagram()
      id = await this.o.client.igReply(input.parentId, this.checkText(input.text, LIMITS.instagramComment, 'Instagram'))
    } else {
      id = await this.o.client.fbComment(input.parentId, this.checkText(input.text, LIMITS.facebookComment, 'Facebook'))
    }
    const label = input.network === 'instagram' ? 'Instagram' : 'Facebook'
    this.log(`${label} reply published`, `${id} in reply to ${input.parentId} (approved by ${by})`, by)
    return { id, url: null }
  }

  /** Hides or unhides a resident's comment. Moderation, so the pause doesn't block it, but it needs an approver. */
  async hide(network: MetaNetwork, commentId: string, hidden: boolean, approvedBy: string) {
    const by = this.approver(approvedBy, hidden ? 'hide' : 'unhide')
    this.checkId(commentId, 'commentId')
    if (network === 'instagram') {
      this.needInstagram()
      await this.o.client.igHide(commentId, hidden)
    } else {
      await this.o.client.fbHide(commentId, hidden)
    }
    this.log(`${network === 'instagram' ? 'Instagram' : 'Facebook'} comment ${hidden ? 'hidden' : 'unhidden'}`, `${commentId} (approved by ${by})`, by)
    return { id: commentId, hidden }
  }

  /**
   * Comments on our latest posts. Polled: Meta pushes comments through webhooks, which need a public
   * HTTPS endpoint this local connector doesn't have.
   */
  async inbox(network: MetaNetwork, posts = 10, perPost = 25): Promise<{ items: InboxItem[] }> {
    if (network === 'instagram') this.needInstagram()
    const n = Math.min(Math.max(posts, 1), 25)
    const per = Math.min(Math.max(perPost, 1), 100)
    const threads = network === 'instagram' ? await this.o.client.igMedia(n, per) : await this.o.client.fbFeed(n, per)
    const ours = network === 'instagram' ? this.o.instagramId : this.o.pageId
    const items: InboxItem[] = []
    for (const t of threads) {
      for (const c of t.comments) {
        if (c.fromId && c.fromId === ours) continue
        items.push({
          id: c.id,
          network,
          kind: 'Comment',
          reason: c.parentId ? 'reply' : 'comment',
          author: { id: c.fromId ?? null, displayName: c.fromName ?? null },
          text: c.text,
          createdAt: c.createdAt,
          postId: t.id,
          inReplyTo: c.parentId ?? null,
          hidden: !!c.hidden,
          url: t.permalink ?? null,
          untrusted: true,
        })
      }
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { items }
  }

  async metrics(network: MetaNetwork, ids: string[]): Promise<Metrics[]> {
    if (!ids.length) return []
    if (ids.length > 25) throw new ConnectorError('Ask for 25 posts or fewer at a time.')
    ids.forEach((id) => this.checkId(id, 'Every id'))
    if (network === 'instagram') this.needInstagram()
    const raw = network === 'instagram' ? await this.o.client.igStats(ids) : await this.o.client.fbStats(ids)
    return raw.map((s) => ({
      id: s.id,
      network,
      reactions: s.reactions ?? 0,
      comments: s.comments ?? 0,
      shares: s.shares ?? null,
      saves: network === 'instagram' ? (s.saves ?? null) : null,
      views: s.views ?? null,
      reach: s.reach ?? null,
    }))
  }

  /** Facebook only. Instagram deletion isn't offered here; remove those posts in the Instagram app. */
  async remove(network: MetaNetwork, id: string, approvedBy: string) {
    const by = this.approver(approvedBy, 'delete')
    if (network !== 'facebook') throw new ConnectorError('Only Facebook posts can be deleted through the connector.', 405)
    if (!id?.startsWith(`${this.o.pageId}_`)) throw new ConnectorError('Only posts from the connected Page can be deleted.', 403)
    await this.o.client.fbDelete(id)
    this.log('Facebook post deleted', `${id} (approved by ${by})`, by)
    return { deleted: true }
  }
}
