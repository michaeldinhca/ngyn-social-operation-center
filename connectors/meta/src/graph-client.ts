// MetaClient over the Graph API with a Page access token. Plain fetch, no SDK.
// Every call carries appsecret_proof, so a leaked token alone can't be replayed from elsewhere
// once "Require app secret" is on in the app settings. Tokens are never logged or returned.
import { createHmac } from 'node:crypto'
import { ConnectorError, type MetaClient, type RawComment, type RawStats, type RawThread } from './connector.ts'

export interface GraphOptions {
  pageId: string
  pageToken: string
  appSecret: string
  instagramId?: string
  version: string
  fetchImpl?: typeof fetch
}

type Params = Record<string, string | number | boolean | undefined>

export function graphClient(o: GraphOptions): MetaClient {
  const f = o.fetchImpl ?? fetch
  const base = `https://graph.facebook.com/${o.version}`
  const proof = createHmac('sha256', o.appSecret).update(o.pageToken).digest('hex')

  function qs(p: Params) {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(p)) if (v !== undefined) q.set(k, String(v))
    q.set('access_token', o.pageToken)
    q.set('appsecret_proof', proof)
    return q
  }

  async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, p: Params = {}, form?: FormData): Promise<T> {
    let res: Response
    if (form) {
      for (const [k, v] of qs(p)) form.set(k, v)
      res = await f(`${base}/${path}`, { method, body: form })
    } else if (method === 'GET') {
      res = await f(`${base}/${path}?${qs(p)}`)
    } else {
      res = await f(`${base}/${path}`, { method, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: qs(p) })
    }
    const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } }
    if (!res.ok || j.error) {
      const code = j.error?.code
      // 190 is an expired or revoked token; 10 and 200-299 are missing permissions; 4, 17, 32, 613 are rate limits.
      const status = code === 190 ? 401 : code === 10 || (code && code >= 200 && code < 300) ? 403 : code === 4 || code === 17 || code === 32 || code === 613 ? 429 : res.status === 404 ? 404 : 502
      throw new ConnectorError(`Meta said: ${j.error?.message ?? res.status}`, status)
    }
    return j
  }

  const fbComments = (c: { id: string; message?: string; from?: { id: string; name?: string }; created_time: string; parent?: { id: string }; is_hidden?: boolean }): RawComment => ({
    id: c.id,
    text: c.message ?? '',
    fromId: c.from?.id,
    fromName: c.from?.name,
    createdAt: new Date(c.created_time).toISOString(),
    parentId: c.parent?.id,
    hidden: c.is_hidden,
  })

  /** Reads one insights metric; null when Meta has retired or withheld it, never zero. */
  async function insight(id: string, metric: string): Promise<number | null> {
    try {
      const r = await call<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>('GET', `${id}/insights`, { metric })
      const m = r.data[0]
      return m?.total_value?.value ?? m?.values?.[0]?.value ?? null
    } catch {
      return null
    }
  }

  const igId = () => {
    if (!o.instagramId) throw new ConnectorError('No Instagram account is linked.', 409)
    return o.instagramId
  }

  return {
    async page() {
      const p = await call<{ id: string; name: string; followers_count?: number }>('GET', o.pageId, { fields: 'id,name,followers_count' })
      return { id: p.id, name: p.name, followers: p.followers_count }
    },
    async instagram() {
      if (!o.instagramId) return null
      const u = await call<{ id: string; username: string; followers_count?: number; media_count?: number }>('GET', o.instagramId, { fields: 'id,username,followers_count,media_count' })
      return { id: u.id, username: u.username, followers: u.followers_count, posts: u.media_count }
    },
    async fbPost({ message, link }) {
      return (await call<{ id: string }>('POST', `${o.pageId}/feed`, { message, link })).id
    },
    async fbPhoto({ bytes, mime, caption, alt }) {
      const form = new FormData()
      form.set('source', new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }), 'image')
      const r = await call<{ id: string; post_id?: string }>('POST', `${o.pageId}/photos`, { caption, alt_text_custom: alt, published: true }, form)
      // post_id is the feed post (pageId_postId), which is what comments, metrics and delete use.
      return r.post_id ?? r.id
    },
    async fbComment(objectId, message) {
      return (await call<{ id: string }>('POST', `${objectId}/comments`, { message })).id
    },
    async fbFeed(limit, perPost) {
      const r = await call<{ data: { id: string; permalink_url?: string; comments?: { data: Parameters<typeof fbComments>[0][] } }[] }>('GET', `${o.pageId}/feed`, {
        limit,
        fields: `id,permalink_url,comments.limit(${perPost}).filter(stream).order(reverse_chronological){id,message,from,created_time,parent{id},is_hidden}`,
      })
      return r.data.map((p): RawThread => ({ id: p.id, permalink: p.permalink_url, comments: (p.comments?.data ?? []).map(fbComments) }))
    },
    async fbStats(postIds) {
      const r = await call<Record<string, { id: string; shares?: { count: number }; reactions?: { summary?: { total_count: number } }; comments?: { summary?: { total_count: number } } }>>('GET', '', {
        ids: postIds.join(','),
        fields: 'id,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)',
      })
      return Promise.all(postIds.map(async (id): Promise<RawStats> => {
        const p = r[id]
        return {
          id,
          reactions: p?.reactions?.summary?.total_count,
          comments: p?.comments?.summary?.total_count,
          // Meta leaves the shares field out when a post has none.
          shares: p ? (p.shares?.count ?? 0) : undefined,
          // post_impressions was retired in November 2025; media views replaced it.
          views: await insight(id, 'post_media_view'),
          reach: await insight(id, 'post_total_media_view_unique'),
        }
      }))
    },
    async fbDelete(postId) {
      await call('DELETE', postId)
    },
    async fbHide(commentId, hidden) {
      await call('POST', commentId, { is_hidden: hidden })
    },
    async igContainer({ imageUrl, caption, altText }) {
      return (await call<{ id: string }>('POST', `${igId()}/media`, { image_url: imageUrl, caption, alt_text: altText })).id
    },
    async igContainerStatus(containerId) {
      return (await call<{ status_code?: string }>('GET', containerId, { fields: 'status_code' })).status_code ?? 'IN_PROGRESS'
    },
    async igPublish(containerId) {
      const { id } = await call<{ id: string }>('POST', `${igId()}/media_publish`, { creation_id: containerId })
      const m = await call<{ permalink?: string }>('GET', id, { fields: 'permalink' }).catch(() => ({ permalink: undefined }))
      return { id, permalink: m.permalink }
    },
    async igReply(commentId, message) {
      return (await call<{ id: string }>('POST', `${commentId}/replies`, { message })).id
    },
    async igMedia(limit, perPost) {
      const r = await call<{ data: { id: string; permalink?: string; comments?: { data: { id: string; text?: string; username?: string; from?: { id: string; username?: string }; timestamp: string; parent_id?: string; hidden?: boolean }[] } }[] }>('GET', `${igId()}/media`, {
        limit,
        fields: `id,permalink,comments.limit(${perPost}){id,text,username,from,timestamp,parent_id,hidden}`,
      })
      return r.data.map((m): RawThread => ({
        id: m.id,
        permalink: m.permalink,
        comments: (m.comments?.data ?? []).map((c) => ({ id: c.id, text: c.text ?? '', fromId: c.from?.id, fromName: c.from?.username ?? c.username, createdAt: new Date(c.timestamp).toISOString(), parentId: c.parent_id, hidden: c.hidden })),
      }))
    },
    async igStats(mediaIds) {
      return Promise.all(mediaIds.map(async (id): Promise<RawStats> => {
        const m = await call<{ like_count?: number; comments_count?: number }>('GET', id, { fields: 'like_count,comments_count' })
        return {
          id,
          reactions: m.like_count,
          comments: m.comments_count,
          shares: (await insight(id, 'shares')) ?? undefined,
          saves: (await insight(id, 'saved')) ?? undefined,
          views: await insight(id, 'views'),
          reach: await insight(id, 'reach'),
        }
      }))
    },
    async igHide(commentId, hidden) {
      await call('POST', commentId, { hide: hidden })
    },
  }
}
