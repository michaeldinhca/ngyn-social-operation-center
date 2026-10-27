// LinkedInClient over the versioned REST API (api.linkedin.com/rest). Plain fetch, no SDK.
// The access token stays in this process; it is never logged or returned.
import { ConnectorError, type LinkedInClient, type RawComment, type RawPost, type RawShareStats } from './connector.ts'

const API = 'https://api.linkedin.com'
const enc = encodeURIComponent

export function restClient(token: string, version: string, fetchImpl: typeof fetch = fetch): LinkedInClient {
  async function call(path: string, init: RequestInit & { method?: string; restli?: string } = {}) {
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      'linkedin-version': version,
      'x-restli-protocol-version': '2.0.0',
    }
    if (init.body) headers['content-type'] = 'application/json'
    if (init.restli) headers['x-restli-method'] = init.restli
    const res = await fetchImpl(path.startsWith('http') ? path : `${API}${path}`, { ...init, headers })
    if (!res.ok) {
      let detail = ''
      try {
        const j = (await res.json()) as { message?: string }
        detail = j.message ?? ''
      } catch {
        // No JSON body.
      }
      const status = res.status === 401 ? 401 : res.status === 403 ? 403 : res.status === 404 ? 404 : res.status === 429 ? 429 : 502
      throw new ConnectorError(`LinkedIn said ${res.status}${detail ? `: ${detail}` : ''}`, status)
    }
    return res
  }
  const json = async <T,>(path: string, init?: Parameters<typeof call>[1]) => (await (await call(path, init)).json()) as T

  const toPost = (p: { id: string; author: string; commentary?: string; createdAt?: number; lifecycleState?: string }): RawPost => ({
    id: p.id,
    author: p.author,
    commentary: p.commentary,
    createdAt: p.createdAt,
    lifecycleState: p.lifecycleState,
  })

  return {
    async me() {
      const u = await json<{ sub: string; name?: string }>('/v2/userinfo')
      return { sub: u.sub, name: u.name ?? u.sub }
    },
    async organizationName(orgUrn) {
      const id = orgUrn.split(':').pop()
      try {
        const o = await json<{ localizedName?: string }>(`/rest/organizations/${id}`)
        return o.localizedName ?? null
      } catch {
        return null
      }
    },
    async initImageUpload(owner) {
      const r = await json<{ value: { uploadUrl: string; image: string } }>('/rest/images?action=initializeUpload', {
        method: 'POST',
        body: JSON.stringify({ initializeUploadRequest: { owner } }),
      })
      return r.value
    },
    async putImage(uploadUrl, bytes, mime) {
      const res = await fetchImpl(uploadUrl, { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': mime }, body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }) })
      if (!res.ok) throw new ConnectorError(`LinkedIn image upload failed (${res.status}).`, 502)
    },
    async createPost(body) {
      const res = await call('/rest/posts', { method: 'POST', body: JSON.stringify(body) })
      const id = res.headers.get('x-restli-id')
      if (!id) throw new ConnectorError('LinkedIn created the post but returned no ID.', 502)
      return id
    },
    async getPost(urn) {
      try {
        return toPost(await json(`/rest/posts/${enc(urn)}`))
      } catch (e) {
        if (e instanceof ConnectorError && e.status === 404) return null
        throw e
      }
    },
    async postsByAuthor(author, count) {
      const r = await json<{ elements: Parameters<typeof toPost>[0][] }>(`/rest/posts?author=${enc(author)}&q=author&count=${count}&sortBy=CREATED`, { restli: 'FINDER' })
      return r.elements.map(toPost)
    },
    async comments(postUrn, count) {
      const r = await json<{ elements: { id?: string; commentUrn?: string; $URN?: string; actor: string; message?: { text?: string }; created?: { time?: number }; parentComment?: string }[] }>(
        `/rest/socialActions/${enc(postUrn)}/comments?count=${count}`,
      )
      return r.elements.map((c): RawComment => {
        const urn = c.commentUrn ?? c.$URN ?? ''
        return { id: c.id ?? urn, urn, actor: c.actor, text: c.message?.text ?? '', createdAt: c.created?.time ?? 0, parentComment: c.parentComment }
      })
    },
    async createComment(postUrn, body) {
      const res = await call(`/rest/socialActions/${enc(postUrn)}/comments`, { method: 'POST', body: JSON.stringify(body) })
      const header = res.headers.get('x-restli-id')
      if (header) return header
      const j = (await res.json().catch(() => ({}))) as { commentUrn?: string; $URN?: string }
      return j.commentUrn ?? j.$URN ?? ''
    },
    async deletePost(urn) {
      await call(`/rest/posts/${enc(urn)}`, { method: 'DELETE', restli: 'DELETE' })
    },
    async shareStatistics(orgUrn, postUrns) {
      const shares = postUrns.filter((u) => u.startsWith('urn:li:share:'))
      const ugc = postUrns.filter((u) => u.startsWith('urn:li:ugcPost:'))
      let q = `/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${enc(orgUrn)}`
      if (shares.length) q += `&shares=List(${shares.map(enc).join(',')})`
      if (ugc.length) q += `&ugcPosts=List(${ugc.map(enc).join(',')})`
      const r = await json<{ elements: { share?: string; ugcPost?: string; totalShareStatistics: RawShareStats }[] }>(q)
      const out: Record<string, RawShareStats> = {}
      for (const e of r.elements) {
        const key = e.share ?? e.ugcPost
        if (key) out[key] = e.totalShareStatistics
      }
      return out
    },
    async socialMetadata(postUrns) {
      const r = await json<{ results: Record<string, { reactionSummaries?: Record<string, { count?: number }>; commentSummary?: { count?: number } }> }>(
        `/rest/socialMetadata?ids=List(${postUrns.map(enc).join(',')})`,
        { restli: 'BATCH_GET' },
      )
      const out: Record<string, { reactions: number; comments: number }> = {}
      for (const [urn, m] of Object.entries(r.results ?? {})) {
        const reactions = Object.values(m.reactionSummaries ?? {}).reduce((n, x) => n + (x.count ?? 0), 0)
        out[urn] = { reactions, comments: m.commentSummary?.count ?? 0 }
      }
      return out
    },
  }
}
