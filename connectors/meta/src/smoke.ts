// Live check against Meta with the test Page in .env. Read-only unless --post is given.
//   npm run smoke
//   npm run smoke -- --post "Text"            (Facebook text post)
import { MetaConnector } from './connector.ts'
import { graphClient } from './graph-client.ts'

const env = process.env
if (!env.META_PAGE_ID || !env.META_PAGE_ACCESS_TOKEN || !env.META_APP_SECRET) {
  console.error('Set META_APP_ID and META_APP_SECRET in .env, then run npm run auth.')
  process.exit(1)
}

const instagramId = env.META_IG_USER_ID || undefined
const c = new MetaConnector({
  client: graphClient({ pageId: env.META_PAGE_ID, pageToken: env.META_PAGE_ACCESS_TOKEN, appSecret: env.META_APP_SECRET, instagramId, version: env.META_GRAPH_VERSION ?? 'v26.0' }),
  pageId: env.META_PAGE_ID,
  instagramId,
})
console.log('Status:', await c.status())

for (const network of instagramId ? (['facebook', 'instagram'] as const) : (['facebook'] as const)) {
  const { items } = await c.inbox(network, 5, 5)
  console.log(`Latest ${items.length} ${network} comments (untrusted):`)
  for (const i of items) console.log(`- ${i.createdAt} ${i.author.displayName ?? 'unknown'}: ${i.text.slice(0, 80)}`)
}

const at = process.argv.indexOf('--post')
if (at > -1) {
  const text = process.argv[at + 1]
  if (!text) throw new Error('Give the text after --post.')
  const p = await c.publish({ network: 'facebook', text, approvedBy: 'Smoke test (developer)' })
  console.log('Published:', p.url)
  console.log('Metrics:', await c.metrics('facebook', [p.id]))
}
