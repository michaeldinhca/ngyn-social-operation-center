// MCP server for the Social Operation Center (ADR 0005). Each staff member connects their own
// ChatGPT (or any MCP client) with OAuth; every tool call runs as that person.
//
// Local by default (127.0.0.1). ChatGPT needs a public HTTPS URL, which means a tunnel or a host,
// and that is a deployment: it needs the Product Director's approval first (AI.md).
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { GovernanceStore } from './governance.ts'
import { installFileStorage } from './store.ts'
import { syncGovernanceLog } from './sync.ts'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.data')
const env = process.env
const PORT = Number(env.MCP_PORT ?? 8800)
const HOST = env.MCP_HOST ?? '127.0.0.1'
const publicUrl = new URL(env.MCP_PUBLIC_URL ?? `http://localhost:${PORT}`)

installFileStorage(join(dataDir, 'demo-store.json'))
const governance = new GovernanceStore(join(dataDir, 'governance.json'))
const { app } = createApp({ publicUrl, passcode: env.DEMO_SIGNIN_PASSCODE ?? '', governance, oauthFile: join(dataDir, 'oauth.json'), trustProxy: env.TRUST_PROXY === '1' })

app.listen(PORT, HOST, () => {
  syncGovernanceLog(governance)
  console.log(`SOC MCP server on http://${HOST}:${PORT}/mcp (public URL ${new URL('/mcp', publicUrl).href})`)
})
