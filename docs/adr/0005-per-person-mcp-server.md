# ADR 0005: A per-person MCP server for ChatGPT

- Status: **ACCEPTED for a local build** (Product Director, 2026-10-27: "make the connection for EACH user able to integrate their ChatGPT into the system, maybe the MCP server"). Exposing it to ChatGPT needs a public HTTPS URL, which is a deployment and waits for approval. ADR 0002 stays the design reference; this ADR answers its authentication and tool-list questions for the mockup.
- Related: ADR 0002 (agent access via MCP), ADR 0001 (stack).

## Decision

1. **`mcp/`**, an MCP server over Streamable HTTP (stateless, `@modelcontextprotocol/sdk` 1.32.1), runs the mock API from `web/src/mock` in Node with a file-backed `localStorage`. Tools call the same functions as the screens, so people and agents share one permission model.
2. **One person per connection.** The server is its own OAuth 2.1 authorization server: dynamic client registration (ChatGPT registers itself), authorization code with PKCE (S256), `iss` in the redirect, 1-hour access tokens, 30-day rotating refresh tokens, stored hashed. The person signs in on our page; the token is bound to them. In the mockup, sign-in is a demo staff picker plus a passcode from `.env`; a real deployment uses the municipality's SSO.
3. **Administrator grant per person: `none` (default), `read`, `draft`.** Scopes `soc.read` and `soc.draft` are the intersection of what the client asks for and the grant, re-checked on every request. Revoking also signs agents out (tokens issued earlier stop working, even after a new grant).
4. **No approve, publish, schedule, resolve, pause or spend tools.** Drafts count as the person's, so separation of duties applies.
5. **Resident content off by default** (Director decision of 2026-10-27, ADR 0002): enabling it records who approved it, the reference and the provider, and is audited. While off, tools return sentiment, category and counts, with no resident text or names, and SOC keywords are withheld.
6. **Audit** labels agent work "<client> for <person>" through one hook in `web/src/mock/core.ts`. Governance changes go through `mcp/.data/governance.json`, which the admin command writes and the server re-reads, so the two never hold stale copies of each other's state.
7. Local by default on `127.0.0.1:8800`.

## Consequences

- ChatGPT can't reach a local server. A tunnel or host (with `MCP_PUBLIC_URL` set) is needed, and needs the Director's approval per deployment.
- The server's demo store is separate from each browser's mockup store. A real backend replaces both with one database.
- The admin command stands in for Users & Access screens (agent access per person, resident content approval), which are still to be built.
- Write rate limit: 30 an hour per person, in memory.
- Open: per-tool confirmation in ChatGPT (write tools are marked not read-only, so ChatGPT asks), the agent filter in the activity log, and which identity provider production uses.
