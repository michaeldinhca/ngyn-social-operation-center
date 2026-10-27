// Live check against LinkedIn with the test account in .env. Read-only unless --post is given.
//   npm run smoke
//   npm run smoke -- --post "Text"
import { LinkedInConnector } from './connector.ts'
import { restClient } from './rest-client.ts'

const token = process.env.LINKEDIN_ACCESS_TOKEN
if (!token || !process.env.LINKEDIN_AUTHOR_URN) {
  console.error('Run npm run auth first, or set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN in .env.')
  process.exit(1)
}

const c = new LinkedInConnector({ client: restClient(token, process.env.LINKEDIN_VERSION ?? '202610'), author: process.env.LINKEDIN_AUTHOR_URN })
console.log('Status:', await c.status())

if (process.env.LINKEDIN_AUTHOR_URN.startsWith('urn:li:organization:')) {
  // Reading member posts needs r_member_social, which LinkedIn restricts, so the inbox is org-only here.
  const { items } = await c.inbox(5, 5)
  console.log(`Latest ${items.length} comments (untrusted):`)
  for (const i of items) console.log(`- ${i.createdAt} ${i.author.urn}: ${i.text.slice(0, 80)}`)
}

const at = process.argv.indexOf('--post')
if (at > -1) {
  const text = process.argv[at + 1]
  if (!text) throw new Error('Give the text after --post.')
  const p = await c.publish({ text, approvedBy: 'Smoke test (developer)' })
  console.log('Published:', p.url)
  console.log('Metrics:', await c.metrics([p.urn]))
}
