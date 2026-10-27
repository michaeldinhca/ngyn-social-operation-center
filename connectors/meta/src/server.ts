// Local HTTP front for the connector. Listens on 127.0.0.1 only and answers only the mockup's origin.
// Not for deployment: there is no login here, so anyone on this machine can call it.
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ConnectorError, MetaConnector, type AuditEntry, type MetaNetwork } from './connector.ts'
import { graphClient } from './graph-client.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', '.data')
const auditFile = join(dataDir, 'audit.jsonl')
const pauseFile = join(dataDir, 'PAUSED')
const PORT = Number(process.env.CONNECTOR_PORT ?? 8789)
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',')
const MAX_BODY = 15_000_000

mkdirSync(dataDir, { recursive: true })

const audit = (e: AuditEntry) => appendFileSync(auditFile, JSON.stringify(e) + '\n')

const env = process.env
const configured = !!(env.META_PAGE_ID && env.META_PAGE_ACCESS_TOKEN && env.META_APP_SECRET)
const connector = configured ? new MetaConnector({
  client: graphClient({ pageId: env.META_PAGE_ID ?? '', pageToken: env.META_PAGE_ACCESS_TOKEN ?? '', appSecret: env.META_APP_SECRET ?? '', instagramId: env.META_IG_USER_ID || undefined, version: env.META_GRAPH_VERSION ?? 'v26.0' }),
  pageId: env.META_PAGE_ID ?? '',
  instagramId: env.META_IG_USER_ID || undefined,
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

function network(v: unknown): MetaNetwork {
  if (v === 'facebook' || v === 'instagram') return v
  throw new ConnectorError('network must be facebook or instagram.')
}

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
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, configured, paused: existsSync(pauseFile), instagram: !!env.META_IG_USER_ID })
    if (!connector) throw new ConnectorError('Not configured. Copy .env.example to .env, set the app ID and secret, then run npm run auth.', 503)
    if (req.method === 'GET' && url.pathname === '/meta/status') return send(res, 200, await connector.status())
    if (req.method === 'GET' && url.pathname === '/meta/inbox') return send(res, 200, await connector.inbox(network(q.get('network')), Number(q.get('posts') ?? 10), Number(q.get('perPost') ?? 25)))
    if (req.method === 'GET' && url.pathname === '/meta/metrics') return send(res, 200, await connector.metrics(network(q.get('network')), q.getAll('id')))
    if (req.method === 'POST' && url.pathname === '/meta/posts') {
      const b = await body(req)
      const img = b.image as { base64?: string; mime?: string; imageUrl?: string; alt?: string } | undefined
      return send(res, 201, await connector.publish({
        network: network(b.network),
        text: str(b.text),
        approvedBy: str(b.approvedBy),
        link: str(b.link) || undefined,
        image: img ? { bytes: img.base64 ? new Uint8Array(Buffer.from(img.base64, 'base64')) : undefined, mime: str(img.mime) || undefined, imageUrl: str(img.imageUrl) || undefined, alt: str(img.alt) } : undefined,
      }))
    }
    if (req.method === 'POST' && url.pathname === '/meta/replies') {
      const b = await body(req)
      return send(res, 201, await connector.reply({ network: network(b.network), parentId: str(b.parentId), text: str(b.text), approvedBy: str(b.approvedBy) }))
    }
    if (req.method === 'POST' && url.pathname === '/meta/comments/hide') {
      const b = await body(req)
      return send(res, 200, await connector.hide(network(b.network), str(b.commentId), b.hidden !== false, str(b.approvedBy)))
    }
    if (req.method === 'DELETE' && url.pathname === '/meta/posts') {
      const b = await body(req)
      return send(res, 200, await connector.remove(network(b.network), str(b.id), str(b.approvedBy)))
    }
    return send(res, 404, { error: 'Not found.' })
  } catch (e) {
    const status = e instanceof ConnectorError ? e.status : 502
    // Upstream errors can echo request details; keep the message, never the tokens.
    const message = e instanceof Error ? e.message : 'Meta request failed.'
    return send(res, status, { error: message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Meta connector on http://127.0.0.1:${PORT} (audit: ${auditFile})`)
})
