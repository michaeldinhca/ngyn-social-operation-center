// The MCP server as an Express app, built from its settings so tests can run it in-process.
import express from 'express'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { GovernanceStore, SCOPES } from './governance.ts'
import { SocOAuthProvider } from './oauth.ts'
import { syncGovernanceLog } from './sync.ts'
import { buildServer } from './tools.ts'

export interface AppOptions {
  publicUrl: URL
  passcode: string
  governance: GovernanceStore
  /** Where clients and hashed tokens are kept; null keeps them in memory. */
  oauthFile: string | null
  trustProxy?: boolean
  now?: () => number
}

export function createApp(o: AppOptions) {
  const resourceUrl = new URL('/mcp', o.publicUrl)
  const provider = new SocOAuthProvider({ file: o.oauthFile, passcode: o.passcode, issuer: o.publicUrl, governance: o.governance, now: o.now })

  const app = express()
  // Behind a tunnel or proxy the client address arrives in X-Forwarded-For; the SDK's rate limits need it.
  if (o.trustProxy) app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl: o.publicUrl,
      resourceServerUrl: resourceUrl,
      scopesSupported: [SCOPES.read, SCOPES.draft],
      resourceName: 'NGYN Social Operation Center (Harbourview demo)',
    }),
  )

  app.post('/signin', express.urlencoded({ extended: false, limit: '10kb' }), (req, res) => {
    const r = provider.completeSignIn(req.body ?? {})
    if ('redirect' in r) return res.redirect(302, r.redirect)
    res.status(r.status).type('html').send(r.html)
  })

  const bearer = requireBearerAuth({ verifier: provider, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl) })

  app.post('/mcp', bearer, express.json({ limit: '1mb' }), async (req, res) => {
    syncGovernanceLog(o.governance)
    // Stateless: a fresh server and transport per request, bound to the caller's token.
    const server = buildServer(req.auth!, { governance: o.governance, now: o.now })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  })

  app.all('/mcp', (_req, res) => res.status(405).set('allow', 'POST').json({ error: 'Use POST.' }))

  return { app, provider }
}
