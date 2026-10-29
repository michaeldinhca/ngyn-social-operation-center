// YouTube connector core: one channel. Every call goes through YouTubeClient, a narrow wrapper over
// the Data API v3 and the Analytics API, so the rules here can be tested without the network.
//
// Rules carried over from the product (AI.md):
// - A person approves every upload, reply, moderation change and delete. Each refuses without approvedBy.
// - The emergency pause blocks publishing and replying. Moderating a comment still works.
// - Captions stand in for ALT text: a video isn't made viewable until its captions are on it.
// - Metrics YouTube doesn't return are null, never zero.
// - Resident text from comments is untrusted data, returned as-is and never acted on.
import { mp4Info } from './mp4.ts'

export const LIMITS = {
  title: 100,
  descriptionBytes: 5_000,
  tagsChars: 500,
  comment: 10_000,
  shortSeconds: 180,
  /** Local cap so the connector never holds huge files in memory. YouTube itself allows far more. */
  videoBytes: 256_000_000,
  captionBytes: 1_000_000,
}

export type Privacy = 'public' | 'unlisted' | 'private'
export type Moderation = 'published' | 'heldForReview' | 'rejected'

export interface YouTubeClient {
  channel(): Promise<{ id: string; title: string; subscribers?: number; videos?: number }>
  /** Uploads the file as private and returns the video ID. */
  uploadVideo(input: { bytes: Uint8Array; mime: string; title: string; description: string; tags: string[]; madeForKids: boolean }): Promise<string>
  uploadCaptions(videoId: string, input: { body: string; language: string; name: string }): Promise<string>
  setPrivacy(videoId: string, privacy: Privacy, madeForKids: boolean): Promise<void>
  /** Channel that owns each video; missing when the video doesn't exist. */
  videoOwners(ids: string[]): Promise<Record<string, string>>
  deleteVideo(id: string): Promise<void>
  threads(input: { channelId: string; max: number; moderation: 'published' | 'heldForReview' }): Promise<RawComment[]>
  /** Top-level comment on a video. */
  comment(videoId: string, text: string): Promise<string>
  reply(parentId: string, text: string): Promise<string>
  moderate(commentIds: string[], status: Moderation): Promise<void>
  stats(ids: string[]): Promise<RawStats[]>
  /** Shares per video from the Analytics API; a video is missing when it has no data yet. Throws when unavailable. */
  shares(ids: string[]): Promise<Record<string, number>>
}

export interface RawComment {
  id: string
  videoId: string
  text: string
  authorChannelId?: string
  authorName?: string
  createdAt: string
  parentId?: string
  moderation?: string
}

export interface RawStats {
  id: string
  views?: number
  likes?: number
  comments?: number
}

export class ConnectorError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export interface PublishInput {
  title: string
  description: string
  tags?: string[]
  /** Name of the person who approved this video in the Social Operation Center. Required. */
  approvedBy: string
  video: { bytes: Uint8Array; mime: string }
  /** SRT or WebVTT text. Required: captions are the video's ALT text. */
  captions: { body: string; language: string }
  /** YouTube requires every upload to say whether it's made for kids. */
  madeForKids: boolean
  privacy?: Privacy
  /** short (default): 3 minutes or less, square or vertical. video: any length or shape. */
  format?: 'short' | 'video'
}

export interface ReplyInput {
  /** Reply to this comment... */
  parentId?: string
  /** ...or comment on this video of ours. */
  videoId?: string
  text: string
  approvedBy: string
}

export interface Published {
  id: string
  url: string | null
}

/** A comment on one of our videos, shaped like an Inbox & Comments conversation. Text is untrusted resident content. */
export interface InboxItem {
  id: string
  network: 'youtube'
  kind: 'Comment'
  reason: 'comment' | 'reply'
  author: { id: string | null; displayName: string | null }
  text: string
  createdAt: string
  postId: string
  inReplyTo: string | null
  held: boolean
  url: string
  untrusted: true
}

export interface Metrics {
  id: string
  network: 'youtube'
  /** Likes; null when the channel hides them. */
  reactions: number | null
  comments: number | null
  shares: number | null
  saves: null
  views: number | null
  /** YouTube's API doesn't report reach or impressions. */
  reach: null
}

export interface AuditEntry {
  at: string
  action: string
  detail: string
  actor: string
}

export interface ConnectorOptions {
  client: YouTubeClient
  channelId: string
  isPaused?: () => boolean
  audit?: (e: AuditEntry) => void
  now?: () => Date
}

const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime'])
const CHANNEL = /^UC[A-Za-z0-9_-]{22}$/
const VIDEO = /^[A-Za-z0-9_-]{11}$/
// Thread IDs are opaque; reply IDs are the thread ID, a dot, then more characters.
const COMMENT = /^[A-Za-z0-9_-]{10,60}(\.[A-Za-z0-9_-]{10,60})?$/
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
// YouTube rejects < and > in titles and descriptions.
const ANGLE = /[<>]/

export function isCaptionFile(body: string) {
  const t = body.replace(/^﻿/, '').trimStart()
  return t.startsWith('WEBVTT') || /^\d+\r?\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/.test(t)
}

export class YouTubeConnector {
  private readonly o: Required<Omit<ConnectorOptions, 'client' | 'channelId'>> & Pick<ConnectorOptions, 'client' | 'channelId'>

  constructor(options: ConnectorOptions) {
    if (!CHANNEL.test(options.channelId ?? '')) throw new ConnectorError('Set YOUTUBE_CHANNEL_ID to the test channel (run npm run auth).', 500)
    this.o = { isPaused: () => false, audit: () => {}, now: () => new Date(), ...options }
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

  private async ours(id: string) {
    if (!VIDEO.test(id ?? '')) throw new ConnectorError('The video ID must be an 11 character YouTube ID.')
    const owners = await this.o.client.videoOwners([id])
    if (!owners[id]) throw new ConnectorError('That video was not found.', 404)
    if (owners[id] !== this.o.channelId) throw new ConnectorError('Only videos on the connected channel can be changed.', 403)
  }

  async status() {
    const c = await this.o.client.channel()
    return { connected: true, channel: { id: c.id, title: c.title, subscribers: c.subscribers ?? null, videos: c.videos ?? null } }
  }

  async publish(input: PublishInput): Promise<Published> {
    const by = this.guard(input.approvedBy, 'video')
    const title = input.title?.trim() ?? ''
    if (!title) throw new ConnectorError('Give the video a title.')
    if ([...title].length > LIMITS.title) throw new ConnectorError(`YouTube titles allow ${LIMITS.title} characters.`)
    const description = input.description?.trim() ?? ''
    if (Buffer.byteLength(description) > LIMITS.descriptionBytes) throw new ConnectorError(`YouTube descriptions allow ${LIMITS.descriptionBytes} bytes.`)
    if (ANGLE.test(title) || ANGLE.test(description)) throw new ConnectorError('YouTube does not allow < or > in titles and descriptions.')
    const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean)
    if (tags.some((t) => ANGLE.test(t))) throw new ConnectorError('Tags cannot contain < or >.')
    // YouTube counts a tag with a space as if it were quoted, two characters more.
    if (tags.reduce((n, t) => n + t.length + (t.includes(' ') ? 2 : 0), 0) + Math.max(tags.length - 1, 0) > LIMITS.tagsChars) throw new ConnectorError(`Tags allow ${LIMITS.tagsChars} characters in total.`)
    if (typeof input.madeForKids !== 'boolean') throw new ConnectorError('Say whether the video is made for kids (madeForKids). YouTube requires it.')
    const privacy = input.privacy ?? 'public'
    if (!['public', 'unlisted', 'private'].includes(privacy)) throw new ConnectorError('privacy must be public, unlisted or private.')

    const { bytes, mime } = input.video ?? {}
    if (!bytes?.byteLength || !mime) throw new ConnectorError('Send the video file.')
    if (!VIDEO_TYPES.has(mime)) throw new ConnectorError('Videos must be MP4 or MOV here.')
    if (bytes.byteLength > LIMITS.videoBytes) throw new ConnectorError('The video is over 256 MB, the local connector limit.')
    if ((input.format ?? 'short') === 'short') {
      const info = mp4Info(bytes)
      if (!info) throw new ConnectorError('Could not read the video length and shape. Use an MP4 or MOV file.')
      if (info.durationSec > LIMITS.shortSeconds + 0.5) throw new ConnectorError(`A Short can be at most 3 minutes. This is ${Math.round(info.durationSec)} seconds.`)
      if (info.width > info.height) throw new ConnectorError('A Short must be square or vertical. This video is landscape; send it as format "video".')
    }

    const cap = input.captions
    if (!cap?.body?.trim()) throw new ConnectorError('Add captions (SRT or WebVTT). They are the video\'s ALT text.')
    if (!isCaptionFile(cap.body)) throw new ConnectorError('Captions must be an SRT or WebVTT file.')
    if (Buffer.byteLength(cap.body) > LIMITS.captionBytes) throw new ConnectorError('The caption file is over 1 MB.')
    if (!LANGUAGE.test(cap.language ?? '')) throw new ConnectorError('Give the caption language as a code, like en or fr-CA.')

    // Upload private, add captions, then open it up, so nobody sees the video without captions.
    const id = await this.o.client.uploadVideo({ bytes, mime, title, description, tags, madeForKids: input.madeForKids })
    this.log('YouTube video uploaded (private)', `${id} (approved by ${by})`, by)
    try {
      await this.o.client.uploadCaptions(id, { body: cap.body, language: cap.language, name: '' })
    } catch (e) {
      const why = e instanceof Error ? e.message : 'unknown error'
      this.log('YouTube captions failed', `${id}: ${why}. The video stays private.`, by)
      throw new ConnectorError(`The video ${id} is uploaded but stays private: the captions failed (${why}). Fix the captions and add them in YouTube Studio, or delete the video.`, 502)
    }
    if (privacy !== 'private') await this.o.client.setPrivacy(id, privacy, input.madeForKids)
    this.log('YouTube video published', `${id} as ${privacy}, with ${cap.language} captions (approved by ${by})`, by)
    return { id, url: (input.format ?? 'short') === 'short' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}` }
  }

  async reply(input: ReplyInput): Promise<Published> {
    const by = this.guard(input.approvedBy, 'reply')
    const text = input.text?.trim() ?? ''
    if (!text) throw new ConnectorError('Write the text first.')
    if (text.length > LIMITS.comment) throw new ConnectorError(`YouTube comments allow ${LIMITS.comment} characters.`)
    if (!!input.parentId === !!input.videoId) throw new ConnectorError('Pass parentId to reply to a comment, or videoId to comment on our video.')
    let id: string
    if (input.parentId) {
      if (!COMMENT.test(input.parentId)) throw new ConnectorError('parentId must be a YouTube comment ID.')
      // Replies go under the thread's top comment; YouTube doesn't nest deeper.
      id = await this.o.client.reply(input.parentId.split('.')[0], text)
    } else {
      await this.ours(input.videoId ?? '')
      id = await this.o.client.comment(input.videoId ?? '', text)
    }
    this.log('YouTube reply published', `${id} in reply to ${input.parentId ?? input.videoId} (approved by ${by})`, by)
    return { id, url: null }
  }

  /**
   * Hides a resident's comment (rejected) or shows it again (published), or approves one held for review.
   * Moderation, so the pause doesn't block it, but it needs an approver.
   */
  async moderate(commentIds: string[], status: Moderation, approvedBy: string) {
    const by = this.approver(approvedBy, 'moderation')
    if (!['published', 'heldForReview', 'rejected'].includes(status)) throw new ConnectorError('status must be published, heldForReview or rejected.')
    if (!commentIds.length || commentIds.length > 50) throw new ConnectorError('Moderate between 1 and 50 comments at a time.')
    commentIds.forEach((id) => {
      if (!COMMENT.test(id ?? '')) throw new ConnectorError('Every commentId must be a YouTube comment ID.')
    })
    await this.o.client.moderate(commentIds, status)
    const label = status === 'rejected' ? 'hidden' : status === 'published' ? 'shown' : 'held for review'
    this.log(`YouTube comment ${label}`, `${commentIds.join(', ')} (approved by ${by})`, by)
    return { ids: commentIds, status }
  }

  /** Comments across the channel's videos, newest first. Polled: YouTube has no comment webhooks. */
  async inbox(max = 50, held = false): Promise<{ items: InboxItem[] }> {
    const raw = await this.o.client.threads({ channelId: this.o.channelId, max: Math.min(Math.max(max, 1), 100), moderation: held ? 'heldForReview' : 'published' })
    const items: InboxItem[] = raw
      .filter((c) => c.authorChannelId !== this.o.channelId)
      .map((c) => ({
        id: c.id,
        network: 'youtube',
        kind: 'Comment',
        reason: c.parentId ? 'reply' : 'comment',
        author: { id: c.authorChannelId ?? null, displayName: c.authorName ?? null },
        text: c.text,
        createdAt: c.createdAt,
        postId: c.videoId,
        inReplyTo: c.parentId ?? null,
        held: held || c.moderation === 'heldForReview',
        url: `https://www.youtube.com/watch?v=${c.videoId}&lc=${c.id}`,
        untrusted: true,
      }))
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { items }
  }

  async metrics(ids: string[]): Promise<Metrics[]> {
    if (!ids.length) return []
    if (ids.length > 50) throw new ConnectorError('Ask for 50 videos or fewer at a time.')
    ids.forEach((id) => {
      if (!VIDEO.test(id ?? '')) throw new ConnectorError('Every id must be an 11 character YouTube ID.')
    })
    const stats = new Map((await this.o.client.stats(ids)).map((s) => [s.id, s]))
    // Analytics lag a day or two, and need the yt-analytics scope; without them shares are unknown, not zero.
    const shares = await this.o.client.shares(ids).catch(() => ({}) as Record<string, number>)
    return ids.map((id) => {
      const s = stats.get(id)
      return { id, network: 'youtube', reactions: s?.likes ?? null, comments: s?.comments ?? null, shares: shares[id] ?? null, saves: null, views: s?.views ?? null, reach: null }
    })
  }

  async remove(id: string, approvedBy: string) {
    const by = this.approver(approvedBy, 'delete')
    await this.ours(id)
    await this.o.client.deleteVideo(id)
    this.log('YouTube video deleted', `${id} (approved by ${by})`, by)
    return { deleted: true }
  }
}
