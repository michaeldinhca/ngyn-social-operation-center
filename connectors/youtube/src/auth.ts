// One-time sign-in: runs Google OAuth on localhost (PKCE, offline access), then writes the refresh
// token and the chosen channel into .env. Tokens are never printed. Run: npm run auth, then open the
// link it shows and pick the TEST channel in Google's account chooser.
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
const env = process.env
const clientId = env.YOUTUBE_CLIENT_ID
const clientSecret = env.YOUTUBE_CLIENT_SECRET
const redirect = env.YOUTUBE_REDIRECT_URI ?? 'http://localhost:8793/callback'
// force-ssl covers upload, comments, moderation and delete; analytics adds shares.
const scopes = env.YOUTUBE_SCOPES ?? 'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly'

if (!clientId || !clientSecret) {
  console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env first (Google Cloud console, APIs & Services, Credentials).')
  process.exit(1)
}

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
const verifier = randomBytes(32).toString('base64url')
const challenge = createHash('sha256').update(verifier).digest('base64url')
const { port, pathname } = new URL(redirect)
const authorize = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirect,
  response_type: 'code',
  scope: scopes,
  state,
  code_challenge: challenge,
  code_challenge_method: 'S256',
  // offline + consent makes Google return a refresh token every time.
  access_type: 'offline',
  prompt: 'consent select_account',
})}`

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', redirect)
  if (url.pathname !== pathname) return res.writeHead(404).end()
  const done = (msg: string, ok = false) => {
    res.writeHead(ok ? 200 : 400, { 'content-type': 'text/plain; charset=utf-8' }).end(msg)
    console.log(msg)
    server.close()
    if (!ok) process.exitCode = 1
  }
  try {
    if (url.searchParams.get('state') !== state) return done('State did not match. Start again with npm run auth.')
    const code = url.searchParams.get('code')
    if (!code) return done(`Google did not sign in: ${url.searchParams.get('error') ?? 'no code'}`)
    const t = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: clientId, client_secret: clientSecret, code_verifier: verifier }),
    })
    const tok = (await t.json()) as { access_token?: string; refresh_token?: string; scope?: string; error?: string; error_description?: string }
    if (!tok.access_token) return done(`Token exchange failed: ${tok.error_description ?? tok.error ?? t.status}`)
    if (!tok.refresh_token) return done('Google returned no refresh token. Remove the app from your Google account permissions and run npm run auth again.')
    const missing = scopes.split(' ').filter((s) => !tok.scope?.split(' ').includes(s))
    const ch = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { authorization: `Bearer ${tok.access_token}` } })
    const chj = (await ch.json()) as { items?: { id: string; snippet: { title: string } }[]; error?: { message?: string } }
    const channel = chj.items?.[0]
    if (!channel) return done(chj.error?.message ? `YouTube said: ${chj.error.message}` : 'This Google account has no YouTube channel. Create one, or pick the brand account in the chooser.')
    setEnv(envFile, { YOUTUBE_REFRESH_TOKEN: tok.refresh_token, YOUTUBE_CHANNEL_ID: channel.id })
    done(`Saved the sign-in for channel "${channel.snippet.title}" (${channel.id}) to .env.${missing.length ? ` Not granted: ${missing.join(', ')}; the related features will fail.` : ''} You can close this tab.`, true)
  } catch (e) {
    done(`Sign-in failed: ${e instanceof Error ? e.message : 'unknown error'}`)
  }
})

server.listen(Number(port || 80), '127.0.0.1', () => {
  console.log(`Open this link and sign in with the Google account that owns the TEST channel:\n${authorize}`)
})
