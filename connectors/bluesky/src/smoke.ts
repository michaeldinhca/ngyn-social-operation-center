// Live check against the test account. Read-only unless --post is given.
//   npm run smoke                      login, profile, latest inbox items
//   npm run smoke -- --post "Hello"    also publishes one post (you approve it by typing the command)
import { atprotoClient } from './atproto-client.ts'
import { BlueskyConnector } from './connector.ts'

const connector = new BlueskyConnector({
  client: atprotoClient(process.env.BLUESKY_SERVICE ?? 'https://bsky.social'),
  identifier: process.env.BLUESKY_IDENTIFIER ?? '',
  password: process.env.BLUESKY_APP_PASSWORD ?? '',
  audit: (e) => console.log('AUDIT', JSON.stringify(e)),
})

const status = await connector.status()
console.log('Connected as', status.handle, `(${status.followers} followers, ${status.posts} posts)`)

const inbox = await connector.inbox(5)
console.log(`Inbox: ${inbox.items.length} recent mentions, replies or quotes`)
for (const i of inbox.items) console.log(` - ${i.reason} from @${i.author.handle}: ${i.text.slice(0, 80)}`)

const at = process.argv.indexOf('--post')
if (at > -1) {
  const text = process.argv[at + 1]
  if (!text) throw new Error('Give the post text after --post.')
  const r = await connector.publish({ text, approvedBy: `smoke test (${status.handle})` })
  console.log('Published', r.url)
  const [m] = await connector.metrics([r.uri])
  console.log('Metrics', m)
}
