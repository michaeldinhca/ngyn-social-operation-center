// One-time sign-in: runs LinkedIn's OAuth on localhost and writes the access token into .env.
// The token is never printed. Run: npm run auth, then open the link it shows.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
const clientId = process.env.LINKEDIN_CLIENT_ID
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
const redirect = process.env.LINKEDIN_REDIRECT_URI ?? 'http://localhost:8790/callback'
// Member posting works with the default "Share on LinkedIn" product. Company pages need the
// Community Management API product: add w_organization_social r_organization_social.
const scopes = process.env.LINKEDIN_SCOPES ?? 'openid profile w_member_social'

if (!clientId || !clientSecret) {
  console.error('Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env first (LinkedIn developer portal, Auth tab).')
  process.exit(1)
}

/** Sets KEY=value in .env, replacing the line if it exists. */
function setEnv(file: string, values: Record<string, string>) {
  let text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`
    const re = new RegExp(`^#?\\s*${k}=.*$`, 'm')
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, '\n')}${line}\n`
  }
  writeFileSync(file, text)
}

const state = randomBytes(16).toString('hex')
const { port, pathname } = new URL(redirect)
const authorize = `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirect, state, scope: scopes })}`

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', redirect)
  if (url.pathname !== pathname) return res.writeHead(404).end()
  const done = (msg: string, ok = false) => {
    res.writeHead(ok ? 200 : 400, { 'content-type': 'text/plain; charset=utf-8' }).end(msg)
    console.log(msg)
    server.close()
    if (!ok) process.exitCode = 1
  }
  if (url.searchParams.get('state') !== state) return done('State did not match. Start again with npm run auth.')
  const code = url.searchParams.get('code')
  if (!code) return done(`LinkedIn did not sign in: ${url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? 'no code'}`)
  const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: clientId, client_secret: clientSecret }),
  })
  const t = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!t.access_token) return done(`Token exchange failed: ${t.error_description ?? r.status}`)
  const values: Record<string, string> = { LINKEDIN_ACCESS_TOKEN: t.access_token }
  if (t.expires_in) values.LINKEDIN_TOKEN_EXPIRES = new Date(Date.now() + t.expires_in * 1000).toISOString()
  // Default the author to the signed-in member when none is set yet.
  if (!process.env.LINKEDIN_AUTHOR_URN) {
    const me = (await (await fetch('https://api.linkedin.com/v2/userinfo', { headers: { authorization: `Bearer ${t.access_token}` } })).json()) as { sub?: string }
    if (me.sub) values.LINKEDIN_AUTHOR_URN = `urn:li:person:${me.sub}`
  }
  setEnv(envFile, values)
  done(`Saved the token to .env${values.LINKEDIN_TOKEN_EXPIRES ? `, valid until ${values.LINKEDIN_TOKEN_EXPIRES}` : ''}. You can close this tab.`, true)
})

server.listen(Number(port || 80), '127.0.0.1', () => {
  console.log(`Open this link and sign in with the TEST LinkedIn account:\n${authorize}`)
})
