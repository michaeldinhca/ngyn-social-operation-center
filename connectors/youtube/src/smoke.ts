// Live check against YouTube with the test channel in .env. Read-only unless --upload is given.
//   npm run smoke
//   npm run smoke -- --upload short.mp4 captions.vtt "Title"   (uploads as private, with captions)
import { readFileSync } from 'node:fs'
import { YouTubeConnector } from './connector.ts'
import { youtubeClient } from './youtube-client.ts'

const env = process.env
if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN || !env.YOUTUBE_CHANNEL_ID) {
  console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env, then run npm run auth.')
  process.exit(1)
}

const c = new YouTubeConnector({
  client: youtubeClient({ clientId: env.YOUTUBE_CLIENT_ID, clientSecret: env.YOUTUBE_CLIENT_SECRET, refreshToken: env.YOUTUBE_REFRESH_TOKEN }),
  channelId: env.YOUTUBE_CHANNEL_ID,
})
console.log('Status:', await c.status())

const { items } = await c.inbox(10)
console.log(`Latest ${items.length} comments (untrusted):`)
for (const i of items) console.log(`- ${i.createdAt} ${i.author.displayName ?? 'unknown'}: ${i.text.slice(0, 80)}`)

const at = process.argv.indexOf('--upload')
if (at > -1) {
  const [video, captions, title] = process.argv.slice(at + 1, at + 4)
  if (!video || !captions || !title) throw new Error('Give the video file, the caption file and a title after --upload.')
  // Private, so a test upload is never public. Each upload costs a large share of the daily quota.
  const p = await c.publish({
    title,
    description: 'Connector smoke test.',
    approvedBy: 'Smoke test (developer)',
    video: { bytes: new Uint8Array(readFileSync(video)), mime: video.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4' },
    captions: { body: readFileSync(captions, 'utf8'), language: 'en' },
    madeForKids: false,
    privacy: 'private',
  })
  console.log('Uploaded (private):', p.url)
  console.log('Metrics:', await c.metrics([p.id]))
}
