// One-time sign-in: runs Facebook Login on localhost, swaps the code for a long-lived user token,
// picks the test Page, and writes the Page token and linked Instagram account into .env.
// Tokens are never printed. Run: npm run auth, then open the link it shows.
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
const env = process.env
const appId = env.META_APP_ID
const appSecret = env.META_APP_SECRET
const version = env.META_GRAPH_VERSION ?? 'v26.0'
const redirect = env.META_REDIRECT_URI ?? 'http://localhost:8791/callback'
const scopes = env.META_SCOPES ?? [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_read_user_content',
  'pages_manage_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'business_management',
].join(',')

if (!appId || !appSecret) {
  console.error('Set META_APP_ID and META_APP_SECRET in .env first (Meta app dashboard, App settings, Basic).')
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

async function graph<T>(path: string, params: Record<string, string>, token?: string): Promise<T> {
  const q = new URLSearchParams(params)
  if (token) {
    q.set('access_token', token)
    q.set('appsecret_proof', createHmac('sha256', appSecret ?? '').update(token).digest('hex'))
  }
  const r = await fetch(`https://graph.facebook.com/${version}/${path}?${q}`)
  const j = (await r.json()) as T & { error?: { message?: string } }
  if (j.error) throw new Error(j.error.message ?? `Graph error ${r.status}`)
  return j
}

const state = randomBytes(16).toString('hex')
const { port, pathname } = new URL(redirect)
// A Facebook Login for Business configuration replaces the scope list when one is set.
const login = new URLSearchParams({ client_id: appId, redirect_uri: redirect, state, response_type: 'code' })
if (env.META_LOGIN_CONFIG_ID) login.set('config_id', env.META_LOGIN_CONFIG_ID)
else login.set('scope', scopes)
const authorize = `https://www.facebook.com/${version}/dialog/oauth?${login}`

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
    if (!code) return done(`Facebook did not sign in: ${url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? 'no code'}`)
    const short = await graph<{ access_token: string }>('oauth/access_token', { client_id: appId, client_secret: appSecret, redirect_uri: redirect, code })
    // Page tokens taken from a long-lived user token don't expire on a timer.
    const long = await graph<{ access_token: string }>('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token })
    const pages = await graph<{ data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string } }[] }>('me/accounts', { fields: 'id,name,access_token,instagram_business_account' }, long.access_token)
    if (!pages.data.length) return done('This login manages no Pages, or the Page was not ticked in the login dialog.')
    const page = env.META_PAGE_ID ? pages.data.find((p) => p.id === env.META_PAGE_ID) : pages.data.length === 1 ? pages.data[0] : undefined
    if (!page) {
      const list = pages.data.map((p) => `  ${p.id}  ${p.name}`).join('\n')
      return done(`Pick the TEST Page: set META_PAGE_ID in .env to one of these, then run npm run auth again.\n${list}`)
    }
    const values: Record<string, string> = { META_PAGE_ID: page.id, META_PAGE_ACCESS_TOKEN: page.access_token, META_IG_USER_ID: page.instagram_business_account?.id ?? '' }
    setEnv(envFile, values)
    done(`Saved the token for Page "${page.name}" (${page.id}) to .env.${values.META_IG_USER_ID ? ` Linked Instagram account: ${values.META_IG_USER_ID}.` : ' No Instagram account is linked to this Page.'} You can close this tab.`, true)
  } catch (e) {
    done(`Sign-in failed: ${e instanceof Error ? e.message : 'unknown error'}`)
  }
})

server.listen(Number(port || 80), '127.0.0.1', () => {
  console.log(`Open this link and sign in with the account that manages the TEST Page:\n${authorize}`)
})
