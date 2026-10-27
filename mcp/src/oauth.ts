// OAuth 2.1 authorization server for the MCP endpoint, one person per connection.
// ChatGPT registers itself (dynamic client registration), sends the person here to sign in,
// and gets tokens bound to that person. Every token is re-checked against the administrator's
// current grant on each request, so lowering someone's agent access takes effect at once.
//
// Sign-in is a demo stand-in for the municipality's single sign-on: pick a demo staff member and
// enter the passcode from .env. Tokens are stored hashed; the raw values exist only in the client.
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Response } from 'express'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import { InvalidGrantError, InvalidRequestError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import { db } from '../../web/src/mock/db.ts'
import type { GovernanceStore } from './governance.ts'

export const ACCESS_TTL_S = 3600
export const REFRESH_TTL_S = 30 * 24 * 3600
const CODE_TTL_MS = 5 * 60_000
const REQUEST_TTL_MS = 10 * 60_000

interface TokenRecord {
  kind: 'access' | 'refresh'
  userId: string
  clientId: string
  scopes: string[]
  resource?: string
  issuedAt: number
  expiresAt: number
}

interface Persisted {
  clients: Record<string, OAuthClientInformationFull>
  tokens: Record<string, TokenRecord>
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex')
const secret = () => randomBytes(32).toString('base64url')
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** ChatGPT's redirect is https; MCP Inspector and other local tools use localhost. Nothing else. */
function redirectAllowed(uri: string) {
  try {
    const u = new URL(uri)
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))
  } catch {
    return false
  }
}

export class SocOAuthProvider implements OAuthServerProvider {
  private p: Persisted
  private pending = new Map<string, { clientId: string; params: AuthorizationParams; expires: number }>()
  private codes = new Map<string, { clientId: string; userId: string; scopes: string[]; params: AuthorizationParams; expires: number }>()

  constructor(
    private readonly opts: { file: string | null; passcode: string; issuer: URL; governance: GovernanceStore; now?: () => number },
  ) {
    if (opts.passcode.length < 12) throw new Error('Set DEMO_SIGNIN_PASSCODE in .env to at least 12 characters.')
    this.p = opts.file && existsSync(opts.file) ? JSON.parse(readFileSync(opts.file, 'utf8')) : { clients: {}, tokens: {} }
  }

  private now() {
    return this.opts.now?.() ?? Date.now()
  }

  private save() {
    if (!this.opts.file) return
    mkdirSync(dirname(this.opts.file), { recursive: true })
    writeFileSync(this.opts.file, JSON.stringify(this.p))
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (id) => this.p.clients[id],
      registerClient: (client) => {
        if (!client.redirect_uris.length || !client.redirect_uris.every((u) => redirectAllowed(String(u)))) {
          throw new InvalidRequestError('Redirect URIs must be https, or http on localhost.')
        }
        const full: OAuthClientInformationFull = { ...client, client_id: randomUUID(), client_id_issued_at: Math.floor(this.now() / 1000) }
        this.p.clients[full.client_id] = full
        this.save()
        return full
      },
    }
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    const id = secret()
    this.pending.set(id, { clientId: client.client_id, params, expires: this.now() + REQUEST_TTL_MS })
    res.type('html').send(this.signInPage(id, client))
  }

  /** Handles the sign-in form. Returns where to send the browser, or a page to show again. */
  completeSignIn(form: { request?: string; userId?: string; passcode?: string }): { redirect: string } | { html: string; status: number } {
    const req = form.request ? this.pending.get(form.request) : undefined
    if (!req || req.expires < this.now()) return { status: 400, html: page('Sign-in expired', '<p>This sign-in request has expired. Start the connection again from ChatGPT.</p>') }
    const client = this.p.clients[req.clientId]
    const retry = (msg: string) => ({ status: 401, html: this.signInPage(form.request!, client, msg) })
    if (form.passcode !== this.opts.passcode) return retry('That passcode is not right.')
    const user = db().users.find((u) => u.id === form.userId)
    if (!user || user.status !== 'Active') return retry('Choose an active staff member.')
    const scopes = this.opts.governance.allowedScopes(user.id, req.params.scopes ?? [])
    if (!scopes.length) return retry(`An administrator has not allowed agent access for ${user.name}. Ask them to turn it on first.`)
    this.pending.delete(form.request!)
    const code = secret()
    this.codes.set(code, { clientId: req.clientId, userId: user.id, scopes, params: req.params, expires: this.now() + CODE_TTL_MS })
    const target = new URL(req.params.redirectUri)
    target.searchParams.set('code', code)
    if (req.params.state) target.searchParams.set('state', req.params.state)
    target.searchParams.set('iss', this.opts.issuer.href)
    return { redirect: target.href }
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    const c = this.codes.get(code)
    if (!c || c.clientId !== client.client_id) throw new InvalidGrantError('Unknown authorization code.')
    return c.params.codeChallenge
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string): Promise<OAuthTokens> {
    const c = this.codes.get(code)
    this.codes.delete(code) // single use, even when the exchange fails
    if (!c || c.clientId !== client.client_id || c.expires < this.now()) throw new InvalidGrantError('Authorization code is invalid or expired.')
    if (redirectUri && redirectUri !== c.params.redirectUri) throw new InvalidGrantError('redirect_uri does not match.')
    return this.issue(c.userId, client.client_id, c.scopes, c.params.resource?.href)
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[]): Promise<OAuthTokens> {
    const key = hash(refreshToken)
    const r = this.p.tokens[key]
    if (!r || r.kind !== 'refresh' || r.clientId !== client.client_id || r.expiresAt < this.now() || !this.opts.governance.issuedAfterRevoke(r.userId, r.issuedAt)) {
      throw new InvalidGrantError('Refresh token is invalid, expired or signed out.')
    }
    delete this.p.tokens[key] // rotate
    const now = this.opts.governance.allowedScopes(r.userId, scopes?.length ? scopes.filter((s) => r.scopes.includes(s)) : r.scopes)
    if (!now.length) {
      this.save()
      throw new InvalidGrantError('Agent access for this person has been turned off.')
    }
    return this.issue(r.userId, client.client_id, now, r.resource)
  }

  private issue(userId: string, clientId: string, scopes: string[], resource?: string): OAuthTokens {
    const access = secret()
    const refresh = secret()
    const t = this.now()
    this.p.tokens[hash(access)] = { kind: 'access', userId, clientId, scopes, resource, issuedAt: t, expiresAt: t + ACCESS_TTL_S * 1000 }
    this.p.tokens[hash(refresh)] = { kind: 'refresh', userId, clientId, scopes, resource, issuedAt: t, expiresAt: t + REFRESH_TTL_S * 1000 }
    // Drop expired records so the file doesn't grow forever.
    for (const [k, v] of Object.entries(this.p.tokens)) if (v.expiresAt < t) delete this.p.tokens[k]
    this.save()
    return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: scopes.join(' ') }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const r = this.p.tokens[hash(token)]
    if (!r || r.kind !== 'access' || r.expiresAt < this.now()) throw new InvalidTokenError('Token is invalid or expired.')
    if (!this.opts.governance.issuedAfterRevoke(r.userId, r.issuedAt)) throw new InvalidTokenError('This agent was signed out by an administrator.')
    const user = db().users.find((u) => u.id === r.userId)
    if (!user || user.status !== 'Active') throw new InvalidTokenError('This person is no longer active.')
    // The administrator's current grant wins over what the token was issued with.
    const scopes = this.opts.governance.allowedScopes(r.userId, r.scopes)
    if (!scopes.length) throw new InvalidTokenError('Agent access for this person has been turned off.')
    const client = this.p.clients[r.clientId]
    return {
      token,
      clientId: r.clientId,
      scopes,
      expiresAt: Math.floor(r.expiresAt / 1000),
      resource: r.resource ? new URL(r.resource) : undefined,
      extra: { userId: r.userId, userName: user.name, clientName: client?.client_name ?? 'AI agent' },
    }
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    const key = hash(request.token)
    if (this.p.tokens[key]?.clientId === client.client_id) {
      delete this.p.tokens[key]
      this.save()
    }
  }

  /** Live agent connections, for the admin command. */
  connections() {
    const t = this.now()
    return Object.values(this.p.tokens)
      .filter((r) => r.kind === 'refresh' && r.expiresAt > t && this.opts.governance.issuedAfterRevoke(r.userId, r.issuedAt))
      .map((r) => ({ userId: r.userId, client: this.p.clients[r.clientId]?.client_name ?? r.clientId, scopes: r.scopes, until: new Date(r.expiresAt).toISOString() }))
  }

  private signInPage(requestId: string, client: OAuthClientInformationFull | undefined, error?: string) {
    const users = db().users.filter((u) => u.status === 'Active')
    const options = users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)} · ${esc(u.role)}${u.department ? ` · ${esc(u.department)}` : ''}</option>`).join('')
    const name = esc(client?.client_name ?? 'An AI agent')
    return page(
      'Connect an AI agent',
      `<p><strong>${name}</strong> wants to work in the Harbourview Social Operation Center as you.</p>
<p>It gets your permissions and channels, never more, cut down to what your administrator allows for agents. It can read and, if allowed, write drafts and submit them for review. It can't approve, publish, resolve conversations, pause or spend. Everything it does is logged as "${name} for" your name.</p>
${error ? `<p role="alert" class="err">${esc(error)}</p>` : ''}
<form method="post" action="/signin">
<input type="hidden" name="request" value="${esc(requestId)}">
<label for="u">Who are you?</label>
<select id="u" name="userId" required>${options}</select>
<label for="p">Demo passcode</label>
<input id="p" name="passcode" type="password" autocomplete="off" required>
<button type="submit">Sign in and connect</button>
</form>
<p class="note">Demo sign-in. A real deployment signs you in with your municipality's single sign-on.</p>`,
    )
  }
}

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:34rem;margin:2rem auto;padding:0 16px;color:#16202a;background:#f7f8fa}h1{font-size:1.4rem}label{display:block;margin-top:1rem;font-weight:600}select,input,button{font:inherit;width:100%;padding:.6rem;margin-top:.3rem;box-sizing:border-box}button{margin-top:1.2rem;background:#0b5cad;color:#fff;border:0;border-radius:6px;cursor:pointer}.err{color:#a4161a;font-weight:600}.note{color:#5b6672;font-size:.9rem;margin-top:1.5rem}</style></head>
<body><h1>${esc(title)}</h1>${body}</body></html>`
}
