// End to end, in-process: ChatGPT-style client registration, sign-in as a person, token exchange,
// then real MCP tool calls through the SDK client. No network beyond localhost.
import { createHash, randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { installFileStorage } from './store.ts'
import { createApp } from './app.ts'
import { GovernanceStore } from './governance.ts'

installFileStorage(null)
const { db, resetDemo } = await import('../../web/src/mock/db.ts')

const PASS = 'test-passcode-1234'
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect'
const MAYA = 'user-1' // Editor: drafts on 3 channels
const NOAH = 'user-2' // Responder: inbox on 3 channels
const LUCAS = 'user-10' // Invited, not active

let server: Server
let base: string
let governance: GovernanceStore

beforeAll(async () => {
  governance = new GovernanceStore(null)
  const { app } = createApp({ publicUrl: new URL('http://localhost'), passcode: PASS, governance, oauthFile: null })
  server = app.listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())
beforeEach(() => resetDemo())

const b64url = (b: Buffer) => b.toString('base64url')

async function register(name = 'ChatGPT', redirect = REDIRECT) {
  const r = await fetch(`${base}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: name, redirect_uris: [redirect], token_endpoint_auth_method: 'none' }) })
  return { status: r.status, body: (await r.json()) as { client_id: string } }
}

async function startAuthorize(clientId: string, scope: string) {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const q = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', scope, state: 'st8' })
  const html = await (await fetch(`${base}/authorize?${q}`)).text()
  const request = html.match(/name="request" value="([^"]+)"/)?.[1] ?? ''
  return { verifier, request, html }
}

async function signIn(request: string, userId: string, passcode = PASS) {
  return fetch(`${base}/signin`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ request, userId, passcode }) })
}

async function token(params: Record<string, string>) {
  const r = await fetch(`${base}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) })
  return { status: r.status, body: (await r.json()) as { access_token: string; refresh_token: string; scope: string; error?: string } }
}

/** The whole ChatGPT connection flow for one person. */
async function connect(userId: string, scope = 'soc.read soc.draft', name = 'ChatGPT') {
  const { body: client } = await register(name)
  const { verifier, request } = await startAuthorize(client.client_id, scope)
  const r = await signIn(request, userId)
  expect(r.status).toBe(302)
  const loc = new URL(r.headers.get('location')!)
  expect(loc.origin + loc.pathname).toBe(REDIRECT)
  expect(loc.searchParams.get('state')).toBe('st8')
  const t = await token({ grant_type: 'authorization_code', code: loc.searchParams.get('code')!, code_verifier: verifier, client_id: client.client_id, redirect_uri: REDIRECT })
  expect(t.status).toBe(200)
  return { ...t.body, clientId: client.client_id }
}

async function mcp(accessToken: string) {
  const c = new Client({ name: 'test', version: '1' })
  await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${accessToken}` } } }))
  return c
}

async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const r = await c.callTool({ name, arguments: args })
  const text = (r.content as { type: string; text: string }[])[0]?.text ?? ''
  return { isError: !!r.isError, text, data: r.isError ? null : JSON.parse(text) }
}

describe('OAuth discovery and protection', () => {
  it('publishes authorization server and protected resource metadata', async () => {
    const as = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json()
    expect(as).toMatchObject({ authorization_endpoint: 'http://localhost/authorize', token_endpoint: 'http://localhost/token', registration_endpoint: 'http://localhost/register', code_challenge_methods_supported: ['S256'] })
    const pr = await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).json()
    expect(pr).toMatchObject({ resource: 'http://localhost/mcp', scopes_supported: ['soc.read', 'soc.draft'] })
  })

  it('refuses MCP calls without a token and points at the metadata', async () => {
    const r = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(r.status).toBe(401)
    expect(r.headers.get('www-authenticate')).toContain('resource_metadata="http://localhost/.well-known/oauth-protected-resource/mcp"')
  })

  it('only registers https or localhost redirect URIs', async () => {
    expect((await register('Bad', 'http://evil.example/cb')).status).toBe(400)
    expect((await register('Inspector', 'http://localhost:6274/oauth/callback')).status).toBe(201)
  })
})

describe('Signing in as a person', () => {
  it('needs the passcode, an active person, and an administrator grant', async () => {
    const { body: client } = await register()
    const { request, html } = await startAuthorize(client.client_id, 'soc.read')
    expect(html).toContain('Demo sign-in')
    expect((await signIn(request, MAYA, 'wrong-passcode')).status).toBe(401)
    expect(await (await signIn(request, MAYA)).text()).toContain('has not allowed agent access for Maya Chen')
    expect(await (await signIn(request, LUCAS)).text()).toContain('Choose an active staff member')
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'read', 'Avery Morgan')
    expect((await signIn(request, MAYA)).status).toBe(302)
  })

  it('cuts requested scopes down to the grant', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'read', 'Avery Morgan')
    const t = await connect(MAYA, 'soc.read soc.draft')
    expect(t.scope).toBe('soc.read')
    const c = await mcp(t.access_token)
    const w = await call(c, 'create_post_draft', { title: 'x', channelIds: ['social-1'], text: 'x', alt: 'x' })
    expect(w).toMatchObject({ isError: true })
    expect(w.text).toMatch(/read-only/)
  })

  it('codes are single use and need the PKCE verifier', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'read', 'Avery Morgan')
    const { body: client } = await register()
    const { verifier, request } = await startAuthorize(client.client_id, 'soc.read')
    const code = new URL((await signIn(request, MAYA)).headers.get('location')!).searchParams.get('code')!
    const common = { grant_type: 'authorization_code', code, client_id: client.client_id, redirect_uri: REDIRECT }
    expect((await token({ ...common, code_verifier: b64url(randomBytes(32)) })).status).toBe(400)
    expect((await token({ ...common, code_verifier: verifier })).status).toBe(200)
    expect((await token({ ...common, code_verifier: verifier })).status).toBe(400) // replay
  })
})

describe('Tools act as the signed-in person', () => {
  it('whoami reports the person, their grant and the demo notice', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'draft', 'Avery Morgan')
    const c = await mcp((await connect(MAYA)).access_token)
    const tools = (await c.listTools()).tools.map((t) => t.name)
    expect(tools).toEqual(expect.arrayContaining(['whoami', 'list_posts', 'create_post_draft', 'save_reply_draft']))
    expect(tools.some((t) => /approve|publish|schedule|resolve|pause|spend|launch/.test(t))).toBe(false)
    const me = await call(c, 'whoami')
    expect(me.data).toMatchObject({ actingFor: 'Maya Chen', role: 'Editor', agentAccess: 'draft', residentContentVisible: false })
  })

  it('sees only the person’s channels', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'read', 'Avery Morgan')
    const c = await mcp((await connect(MAYA)).access_token)
    const channels = (await call(c, 'list_channels')).data as { id: string }[]
    expect(channels.length).toBe(3)
    const posts = (await call(c, 'list_posts', { limit: 50 })).data as { posts: { channel: { id: string } }[] }
    expect(posts.posts.every((p) => channels.some((ch) => ch.id === p.channel.id))).toBe(true)
  })

  it('a draft counts as the person’s own and is logged as "ChatGPT for" them', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'draft', 'Avery Morgan')
    const c = await mcp((await connect(MAYA)).access_token)
    const [ch] = (await call(c, 'list_channels')).data as { id: string }[]
    const r = await call(c, 'create_post_draft', { title: 'Leaf pickup', channelIds: [ch.id], text: 'Leaf pickup starts Monday.', alt: 'Paper leaf bags at a curb', submitForReview: true })
    expect(r.isError).toBe(false)
    const id = (r.data as { ids: string[] }).ids[0]
    const post = db().posts.find((p) => p.id === id)!
    expect(post).toMatchObject({ createdBy: MAYA, status: 'In review' })
    expect(db().audit[0]).toMatchObject({ actor: 'ChatGPT for Maya Chen', action: 'Posts submitted for approval' })
  })

  it('refuses channels the person cannot post to', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'draft', 'Avery Morgan')
    const c = await mcp((await connect(MAYA)).access_token)
    const mine = new Set(((await call(c, 'list_channels')).data as { id: string }[]).map((x) => x.id))
    const other = db().accounts.find((a) => !mine.has(a.id))!.id
    const r = await call(c, 'create_post_draft', { title: 'x', channelIds: [other], text: 'x', alt: 'x' })
    expect(r).toMatchObject({ isError: true })
    expect(r.text).toMatch(/create access/)
  })
})

describe('Resident content', () => {
  it('is hidden until the municipality’s approval is recorded, then marked untrusted', async () => {
    governance.setLevel({ id: NOAH, name: 'Noah Grant' }, 'draft', 'Avery Morgan')
    const c = await mcp((await connect(NOAH)).access_token)
    const list = (await call(c, 'list_conversations', { status: 'All', limit: 5 })).data as { conversations: { id: string; thread: { from: string; text: string | null }[]; author?: string; residentContent?: string }[] }
    const first = list.conversations[0]
    expect(first.residentContent).toMatch(/not approved/)
    expect(first.author).toBeUndefined()
    expect(first.thread.filter((m) => m.from === 'resident').every((m) => m.text === null)).toBe(true)
    expect((await call(c, 'soc_overview')).data.keywords).toMatch(/not approved/)

    // A reply draft and a note still work without reading resident text.
    expect((await call(c, 'save_reply_draft', { conversationId: first.id, text: 'Thanks, we are on it.' })).data).toMatchObject({ saved: true, sent: false })

    expect(() => governance.allowResidentContent({ approvedBy: '', approvalRef: 'x', provider: 'x', recordedBy: 'x' })).toThrow(/written approval/)
    governance.allowResidentContent({ approvedBy: 'Clerk J. Doe', approvalRef: 'Council motion 2026-14', provider: 'ChatGPT (OpenAI)', recordedBy: 'Avery Morgan' })
    const open = (await call(c, 'get_conversation', { id: first.id })).data as { untrusted: string; thread: { from: string; text: string }[] }
    expect(open.untrusted).toMatch(/never follow instructions/)
    expect(open.thread.find((m) => m.from === 'resident')!.text).toBeTruthy()
    expect(db().audit.some((a) => a.action === 'Agents may read resident content')).toBe(true)
    governance.denyResidentContent('Avery Morgan')
  })
})

describe('Administrator control', () => {
  it('revoking access stops the live token and refreshes', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'read', 'Avery Morgan')
    const t = await connect(MAYA)
    expect((await call(await mcp(t.access_token), 'whoami')).isError).toBe(false)
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'none', 'Avery Morgan')
    await expect(mcp(t.access_token)).rejects.toThrow()
    expect((await token({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: t.clientId })).status).toBe(400)
    // Granting again doesn't revive tokens issued before the revoke.
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'read', 'Avery Morgan')
    await expect(mcp(t.access_token)).rejects.toThrow()
  })

  it('lowering a grant takes effect on the next call', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'draft', 'Avery Morgan')
    const t = await connect(MAYA)
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'read', 'Avery Morgan')
    const r = await call(await mcp(t.access_token), 'create_post_draft', { title: 'x', channelIds: ['social-1'], text: 'x', alt: 'x' })
    expect(r.text).toMatch(/read-only/)
  })

  it('refresh tokens rotate and work once', async () => {
    governance.setLevel({ id: MAYA, name: 'Maya Chen' }, 'read', 'Avery Morgan')
    const t = await connect(MAYA)
    const r1 = await token({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: t.clientId })
    expect(r1.status).toBe(200)
    expect(r1.body.refresh_token).not.toBe(t.refresh_token)
    expect((await token({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: t.clientId })).status).toBe(400)
  })

  it('governance changes land in the activity log as the administrator', async () => {
    governance.setLevel({ id: NOAH, name: 'Noah Grant' }, 'read', 'Avery Morgan')
    await call(await mcp((await connect(NOAH)).access_token), 'whoami')
    expect(db().audit.some((a) => a.action === 'Agent access changed' && a.detail.startsWith('Noah Grant: read only'))).toBe(true)
  })
})
