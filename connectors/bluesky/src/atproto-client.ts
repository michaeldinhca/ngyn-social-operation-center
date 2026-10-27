import { AtpAgent, RichText } from '@atproto/api'
import type { BlueskyClient, Facet, RawNotification, RawPost } from './connector.ts'

/** The real client: @atproto/api against a PDS (bsky.social by default). */
export function atprotoClient(service = 'https://bsky.social'): BlueskyClient {
  const agent = new AtpAgent({ service })
  return {
    async login(identifier, password) {
      const r = await agent.login({ identifier, password })
      return { did: r.data.did, handle: r.data.handle }
    },
    async getProfile(actor) {
      const r = await agent.getProfile({ actor })
      return r.data
    },
    async richText(text) {
      const rt = new RichText({ text })
      await rt.detectFacets(agent) // resolves @mentions to DIDs; links and #tags too
      return { text: rt.text, graphemes: rt.graphemeLength, facets: rt.facets as Facet[] | undefined }
    },
    async uploadImage(bytes, mime) {
      const r = await agent.uploadBlob(bytes, { encoding: mime })
      return r.data.blob
    },
    async createPost(record) {
      return agent.post(record as Parameters<typeof agent.post>[0])
    },
    async getPosts(uris) {
      const r = await agent.getPosts({ uris })
      return r.data.posts as unknown as RawPost[]
    },
    async listNotifications(limit, cursor) {
      const r = await agent.listNotifications({ limit, cursor })
      return { cursor: r.data.cursor, notifications: r.data.notifications as unknown as RawNotification[] }
    },
    async deletePost(uri) {
      await agent.deletePost(uri)
    },
  }
}
