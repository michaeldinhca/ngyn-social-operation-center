// Local HTTP front for the connector. Listens on 127.0.0.1 only and answers only the mockup's origin.
// Not for deployment: there is no login here, so anyone on this machine can call it.
//
// Videos are too big for a JSON body, so publishing takes two calls: POST the raw file to
// /youtube/uploads, then POST the metadata with the uploadId it returned to /youtube/videos.
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ConnectorError, LIMITS, YouTubeConnector, type AuditEntry, type Moderation, type Privacy } from './connector.ts'
import { youtubeClient } from './youtube-client.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', '.data')
const auditFile = join(dataDir, 'audit.jsonl')
const pauseFile = join(dataDir, 'PAUSED')
const PORT = Number(process.env.CONNECTOR_PORT ?? 8792)
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',')
const MAX_JSON = 2_000_000
const STAGED_FOR = 30 * 60_000

mkdirSync(dataDir, { recursive: true })

const audit = (e: AuditEntry) => appendFileSync(auditFile, JSON.stringify(e) + '\n')

const env = process.env
const configured = !!(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && env.YOUTUBE_REFRESH_TOKEN && env.YOUTUBE_CHANNEL_ID)
const connector = configured ? new YouTubeConnector({
  client: youtubeClient({ clientId: env.YOUTUBE_CLIENT_ID ?? '', clientSecret: env.YOUTUBE_CLIENT_SECRET ?? '', refreshToken: env.YOUTUBE_REFRESH_TOKEN ?? '' }),
  channelId: env.YOUTUBE_CHANNEL_ID ?? '',
  // The pause is a file so it holds across restarts: create .data/PAUSED to stop all publishing.
  isPaused: () => existsSync(pauseFile),
  audit,
}) : null

// Uploaded files wait in memory until they're published or expire. Never written to disk.
const staged = new Map<string, { bytes: Uint8Array; mime: string; until: number }>()
const sweep = () => {
  for (const [id, s] of staged) if (s.until < Date.now()) staged.delete(id)
}

async function raw(req: IncomingMessage, max: number): Promise<Buffer> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const c of req) {
    size += (c as Buffer).length
    if (size > max) throw new ConnectorError('Request is too large.', 413)
    chunks.push(c as Buffer)
  }
  return Buffer.concat(chunks)
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const b = await raw(req, MAX_JSON)
  if (!b.length) return {}
  try {
    return JSON.parse(b.toString('utf8'))
  } catch {
    throw new ConnectorError('Body must be JSON.')
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('vary', 'origin')
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE')
  } else if (origin) {
    return send(res, 403, { error: 'Origin not allowed.' })
  }
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  const url = new URL(req.url ?? '/', 'http://localhost')
  const q = url.searchParams
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, configured, paused: existsSync(pauseFile) })
    if (!connector) throw new ConnectorError('Not configured. Copy .env.example to .env, set the client ID and secret, then run npm run auth.', 503)
    if (req.method === 'GET' && url.pathname === '/youtube/status') return send(res, 200, await connector.status())
    if (req.method === 'GET' && url.pathname === '/youtube/inbox') return send(res, 200, await connector.inbox(Number(q.get('max') ?? 50), q.get('held') === 'true'))
    if (req.method === 'GET' && url.pathname === '/youtube/metrics') return send(res, 200, await connector.metrics(q.getAll('id')))
    if (req.method === 'POST' && url.pathname === '/youtube/uploads') {
      const mime = (req.headers['content-type'] ?? '').split(';')[0].trim()
      if (mime !== 'video/mp4' && mime !== 'video/quicktime') throw new ConnectorError('Send the file with content-type video/mp4 or video/quicktime.', 415)
      const bytes = await raw(req, LIMITS.videoBytes)
      if (!bytes.length) throw new ConnectorError('The file is empty.')
      sweep()
      const uploadId = randomUUID()
      staged.set(uploadId, { bytes: new Uint8Array(bytes), mime, until: Date.now() + STAGED_FOR })
      return send(res, 201, { uploadId, bytes: bytes.length, expiresInMinutes: STAGED_FOR / 60_000 })
    }
    if (req.method === 'POST' && url.pathname === '/youtube/videos') {
      const b = await body(req)
      sweep()
      const file = staged.get(str(b.uploadId))
      if (!file) throw new ConnectorError('Upload the file to /youtube/uploads first, then pass its uploadId. Uploads expire after 30 minutes.')
      const cap = b.captions as { body?: string; language?: string } | undefined
      const published = await connector.publish({
        title: str(b.title),
        description: str(b.description),
        tags: Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === 'string') : [],
        approvedBy: str(b.approvedBy),
        video: { bytes: file.bytes, mime: file.mime },
        captions: { body: str(cap?.body), language: str(cap?.language) },
        madeForKids: b.madeForKids as boolean,
        privacy: (str(b.privacy) || undefined) as Privacy | undefined,
        format: b.format === 'video' ? 'video' : 'short',
      })
      staged.delete(str(b.uploadId))
      return send(res, 201, published)
    }
    if (req.method === 'POST' && url.pathname === '/youtube/replies') {
      const b = await body(req)
      return send(res, 201, await connector.reply({ parentId: str(b.parentId) || undefined, videoId: str(b.videoId) || undefined, text: str(b.text), approvedBy: str(b.approvedBy) }))
    }
    if (req.method === 'POST' && url.pathname === '/youtube/comments/moderate') {
      const b = await body(req)
      const ids = Array.isArray(b.commentIds) ? b.commentIds.map(str) : [str(b.commentId)].filter(Boolean)
      return send(res, 200, await connector.moderate(ids, str(b.status) as Moderation, str(b.approvedBy)))
    }
    if (req.method === 'DELETE' && url.pathname === '/youtube/videos') {
      const b = await body(req)
      return send(res, 200, await connector.remove(str(b.id), str(b.approvedBy)))
    }
    return send(res, 404, { error: 'Not found.' })
  } catch (e) {
    const status = e instanceof ConnectorError ? e.status : 502
    // Upstream errors can echo request details; keep the message, never the tokens.
    const message = e instanceof Error ? e.message : 'YouTube request failed.'
    return send(res, status, { error: message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`YouTube connector on http://127.0.0.1:${PORT} (audit: ${auditFile})`)
})
