// YouTubeClient over the Data API v3 and the Analytics API. Plain fetch, no SDK.
// Holds the refresh token and swaps it for short-lived access tokens in memory. Tokens are never
// logged or returned.
import { randomBytes } from 'node:crypto'
import { ConnectorError, type RawComment, type YouTubeClient } from './connector.ts'

export interface GoogleOptions {
  clientId: string
  clientSecret: string
  refreshToken: string
  fetchImpl?: typeof fetch
  now?: () => number
}

const API = 'https://www.googleapis.com/youtube/v3'
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3'
const ANALYTICS = 'https://youtubeanalytics.googleapis.com/v2/reports'
const TOKEN = 'https://oauth2.googleapis.com/token'

type Params = Record<string, string | number | boolean | undefined>

interface GoogleError {
  error?: { code?: number; message?: string; errors?: { reason?: string }[] } | string
  error_description?: string
}

const RATE = new Set(['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'uploadLimitExceeded'])

function fail(res: Response, j: GoogleError): never {
  if (typeof j.error === 'string') {
    // Token endpoint: invalid_grant means the refresh token was revoked or expired.
    throw new ConnectorError(j.error === 'invalid_grant' ? 'YouTube sign-in expired or was revoked. Run npm run auth again.' : `Google said: ${j.error_description ?? j.error}`, 401)
  }
  const reason = j.error?.errors?.[0]?.reason ?? ''
  const status = RATE.has(reason) ? 429 : res.status === 401 ? 401 : res.status === 403 ? 403 : res.status === 404 ? 404 : res.status === 400 ? 400 : 502
  throw new ConnectorError(`YouTube said: ${j.error?.message ?? res.status}${reason ? ` (${reason})` : ''}`, status)
}

export function youtubeClient(o: GoogleOptions): YouTubeClient {
  const f = o.fetchImpl ?? fetch
  const now = o.now ?? Date.now
  let access: { token: string; until: number } | null = null

  async function token() {
    if (access && access.until > now() + 60_000) return access.token
    const res = await f(TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: o.clientId, client_secret: o.clientSecret, refresh_token: o.refreshToken }),
    })
    const j = (await res.json().catch(() => ({}))) as GoogleError & { access_token?: string; expires_in?: number }
    if (!res.ok || !j.access_token) fail(res, j)
    access = { token: j.access_token, until: now() + (j.expires_in ?? 3600) * 1000 }
    return access.token
  }

  async function call<T>(method: string, url: string, p: Params = {}, init: { json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}): Promise<{ data: T; res: Response }> {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(p)) if (v !== undefined) q.set(k, String(v))
    const headers: Record<string, string> = { authorization: `Bearer ${await token()}`, ...init.headers }
    let body = init.body
    if (init.json !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(init.json)
    }
    const res = await f(q.size ? `${url}?${q}` : url, { method, headers, body })
    const text = await res.text()
    let j = {} as T & GoogleError
    try {
      if (text) j = JSON.parse(text)
    } catch {
      // Error pages from the upload host can be HTML; the status code still tells us what happened.
    }
    if (!res.ok) fail(res, j)
    return { data: j, res }
  }

  type Snippet = { textOriginal?: string; textDisplay?: string; authorDisplayName?: string; authorChannelId?: { value?: string }; publishedAt: string; parentId?: string; videoId?: string; moderationStatus?: string }
  const toComment = (id: string, s: Snippet, videoId: string): RawComment => ({
    id,
    videoId,
    // textOriginal is what the resident typed; textDisplay is HTML.
    text: s.textOriginal ?? s.textDisplay ?? '',
    authorChannelId: s.authorChannelId?.value,
    authorName: s.authorDisplayName,
    createdAt: new Date(s.publishedAt).toISOString(),
    parentId: s.parentId,
    moderation: s.moderationStatus,
  })

  return {
    async channel() {
      const { data } = await call<{ items?: { id: string; snippet: { title: string }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string } }[] }>('GET', `${API}/channels`, { part: 'snippet,statistics', mine: true })
      const c = data.items?.[0]
      if (!c) throw new ConnectorError('This Google account has no YouTube channel.', 404)
      const st = c.statistics
      return { id: c.id, title: c.snippet.title, subscribers: st && !st.hiddenSubscriberCount && st.subscriberCount ? Number(st.subscriberCount) : undefined, videos: st?.videoCount ? Number(st.videoCount) : undefined }
    },

    async uploadVideo({ bytes, mime, title, description, tags, madeForKids }) {
      // Resumable upload: send the metadata, get an upload URL, then send the bytes in one PUT.
      const { res } = await call('POST', `${UPLOAD}/videos`, { uploadType: 'resumable', part: 'snippet,status', notifySubscribers: false }, {
        // Category 25 is News & Politics, the closest fit for municipal updates.
        json: { snippet: { title, description, tags, categoryId: '25' }, status: { privacyStatus: 'private', selfDeclaredMadeForKids: madeForKids, embeddable: true } },
        headers: { 'x-upload-content-type': mime, 'x-upload-content-length': String(bytes.byteLength) },
      })
      const location = res.headers.get('location')
      if (!location?.startsWith('https://')) throw new ConnectorError('YouTube did not return an upload URL.', 502)
      const put = await f(location, { method: 'PUT', headers: { authorization: `Bearer ${await token()}`, 'content-type': mime }, body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }) })
      const j = (await put.json().catch(() => ({}))) as GoogleError & { id?: string }
      if (!put.ok || !j.id) fail(put, j)
      return j.id
    },

    async uploadCaptions(videoId, { body, language, name }) {
      // multipart/related: the caption resource as JSON, then the file.
      const boundary = `ngyn${randomBytes(12).toString('hex')}`
      const multipart = [
        `--${boundary}`,
        'content-type: application/json; charset=UTF-8',
        '',
        JSON.stringify({ snippet: { videoId, language, name, isDraft: false } }),
        `--${boundary}`,
        'content-type: application/octet-stream',
        '',
        body,
        `--${boundary}--`,
        '',
      ].join('\r\n')
      const { data } = await call<{ id: string }>('POST', `${UPLOAD}/captions`, { uploadType: 'multipart', part: 'snippet' }, { body: multipart, headers: { 'content-type': `multipart/related; boundary=${boundary}` } })
      return data.id
    },

    async setPrivacy(videoId, privacy, madeForKids) {
      // Updating the status part replaces it, so send every field we set at upload.
      await call('PUT', `${API}/videos`, { part: 'status' }, { json: { id: videoId, status: { privacyStatus: privacy, selfDeclaredMadeForKids: madeForKids, embeddable: true } } })
    },

    async videoOwners(ids) {
      const { data } = await call<{ items?: { id: string; snippet: { channelId: string } }[] }>('GET', `${API}/videos`, { part: 'snippet', id: ids.join(','), maxResults: 50 })
      return Object.fromEntries((data.items ?? []).map((v) => [v.id, v.snippet.channelId]))
    },

    async deleteVideo(id) {
      await call('DELETE', `${API}/videos`, { id })
    },

    async threads({ channelId, max, moderation }) {
      const { data } = await call<{ items?: { id: string; snippet: { videoId: string; topLevelComment: { id: string; snippet: Snippet } }; replies?: { comments: { id: string; snippet: Snippet }[] } }[] }>('GET', `${API}/commentThreads`, {
        part: 'snippet,replies',
        allThreadsRelatedToChannelId: channelId,
        maxResults: max,
        moderationStatus: moderation,
        order: 'time',
        textFormat: 'plainText',
      })
      // The replies part carries up to five replies per thread; that's enough for the inbox view.
      return (data.items ?? []).flatMap((t) => [
        toComment(t.snippet.topLevelComment.id, t.snippet.topLevelComment.snippet, t.snippet.videoId),
        ...(t.replies?.comments ?? []).map((r) => toComment(r.id, r.snippet, t.snippet.videoId)),
      ])
    },

    async comment(videoId, text) {
      const { data } = await call<{ id: string }>('POST', `${API}/commentThreads`, { part: 'snippet' }, { json: { snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } } } })
      return data.id
    },

    async reply(parentId, text) {
      const { data } = await call<{ id: string }>('POST', `${API}/comments`, { part: 'snippet' }, { json: { snippet: { parentId, textOriginal: text } } })
      return data.id
    },

    async moderate(commentIds, status) {
      await call('POST', `${API}/comments/setModerationStatus`, { id: commentIds.join(','), moderationStatus: status })
    },

    async stats(ids) {
      const { data } = await call<{ items?: { id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>('GET', `${API}/videos`, { part: 'statistics', id: ids.join(','), maxResults: 50 })
      const n = (v?: string) => (v === undefined ? undefined : Number(v))
      return (data.items ?? []).map((v) => ({ id: v.id, views: n(v.statistics?.viewCount), likes: n(v.statistics?.likeCount), comments: n(v.statistics?.commentCount) }))
    },

    async shares(ids) {
      const { data } = await call<{ rows?: [string, number][] }>('GET', ANALYTICS, {
        ids: 'channel==MINE',
        startDate: '2005-02-14',
        endDate: new Date(now()).toISOString().slice(0, 10),
        metrics: 'shares',
        dimensions: 'video',
        filters: `video==${ids.join(',')}`,
      })
      return Object.fromEntries(data.rows ?? [])
    },
  }
}
