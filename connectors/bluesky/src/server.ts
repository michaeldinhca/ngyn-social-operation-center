// Local HTTP front for the connector. Listens on 127.0.0.1 only and answers only the mockup's origin.
// Not for deployment: there is no login here, so anyone on this machine can call it.
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atprotoClient } from './atproto-client.ts'
import { BlueskyConnector, ConnectorError, type AuditEntry } from './connector.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', '.data')
const auditFile = join(dataDir, 'audit.jsonl')
const pauseFile = join(dataDir, 'PAUSED')
const PORT = Number(process.env.CONNECTOR_PORT ?? 8787)
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',')
const MAX_BODY = 4_000_000

mkdirSync(dataDir, { recursive: true })

const audit = (e: AuditEntry) => appendFileSync(auditFile, JSON.stringify(e) + '\n')

const configured = !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD)
const connector = configured ? new BlueskyConnector({
  client: atprotoClient(process.env.BLUESKY_SERVICE ?? 'https://bsky.social'),
  identifier: process.env.BLUESKY_IDENTIFIER ?? '',
  password: process.env.BLUESKY_APP_PASSWORD ?? '',
  // The pause is a file so it holds across restarts: create .data/PAUSED to stop all publishing.
  isPaused: () => existsSync(pauseFile),
  audit,
}) : null

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const c of req) {
    size += (c as Buffer).length
    if (size > MAX_BODY) throw new ConnectorError('Request is too large.', 413)
    chunks.push(c as Buffer)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
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
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, configured, paused: existsSync(pauseFile) })
    if (!connector) throw new ConnectorError('Not configured. Copy .env.example to .env and set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD.', 503)
    if (req.method === 'GET' && url.pathname === '/bluesky/status') return send(res, 200, await connector.status())
    if (req.method === 'GET' && url.pathname === '/bluesky/inbox') return send(res, 200, await connector.inbox(Number(url.searchParams.get('limit') ?? 30), url.searchParams.get('cursor') ?? undefined))
    if (req.method === 'GET' && url.pathname === '/bluesky/metrics') return send(res, 200, await connector.metrics(url.searchParams.getAll('uri')))
    if (req.method === 'POST' && url.pathname === '/bluesky/posts') {
      const b = await body(req)
      const img = b.image as { base64?: string; mime?: string; alt?: string } | undefined
      return send(res, 201, await connector.publish({
        text: str(b.text),
        approvedBy: str(b.approvedBy),
        image: img?.base64 ? { bytes: new Uint8Array(Buffer.from(img.base64, 'base64')), mime: str(img.mime), alt: str(img.alt) } : undefined,
      }))
    }
    if (req.method === 'POST' && url.pathname === '/bluesky/replies') {
      const b = await body(req)
      return send(res, 201, await connector.reply({ parentUri: str(b.parentUri), text: str(b.text), approvedBy: str(b.approvedBy) }))
    }
    if (req.method === 'DELETE' && url.pathname === '/bluesky/posts') {
      const b = await body(req)
      return send(res, 200, await connector.remove(str(b.uri), str(b.approvedBy)))
    }
    return send(res, 404, { error: 'Not found.' })
  } catch (e) {
    const status = e instanceof ConnectorError ? e.status : 502
    // Upstream errors can echo request details; keep the message, never the credentials.
    const message = e instanceof Error ? e.message : 'Bluesky request failed.'
    return send(res, status, { error: message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Bluesky connector on http://127.0.0.1:${PORT} (audit: ${auditFile})`)
})
