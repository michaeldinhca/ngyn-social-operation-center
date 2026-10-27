# SOC MCP server: connect your own ChatGPT

Each staff member connects **their own** ChatGPT (or Claude, or any MCP client) to the Social Operation Center. The agent works as that person: their functions, their channels, nothing more. See `docs/adr/0005-per-person-mcp-server.md` and ADR 0002.

It runs on the fictional Harbourview demo data. The server keeps its own copy of the demo store in `.data/demo-store.json`, separate from any browser's mockup.

## What an agent can and can't do

| Scope | Tools |
| --- | --- |
| `soc.read` | `whoami`, `list_channels`, `list_posts`, `get_post`, `list_conversations`, `get_conversation`, `soc_overview`, `get_analytics`, `list_campaigns` |
| `soc.draft` | `create_post_draft` (optionally submit for review), `submit_post_for_review`, `save_reply_draft`, `add_conversation_note` |

There is no tool to approve, publish, schedule, resolve a conversation (that sends the reply), pause, or spend. A draft the agent writes counts as written by the person, so someone else must approve it. Each tool calls the same mock API function the screens use, so permission checks are identical.

Guards:
- **Per-person grant, off by default.** An administrator sets each person to `none`, `read` or `draft`. The token's scopes are cut down to that grant and re-checked on every call, so lowering a grant works at once.
- **Resident content is hidden** until an administrator records the municipality's written approval (who, reference, provider). Until then agents see sentiment, category and counts, never resident text or names, and SOC keywords are withheld. When allowed, resident text is marked untrusted.
- **Audit.** Agent work is logged as "ChatGPT for Maya Chen". Grant changes are logged as the administrator.
- **Limits.** 30 writes an hour per person. Access tokens last 1 hour; refresh tokens 30 days, rotated on each use.

## Run it locally

```
cp .env.example .env            # set DEMO_SIGNIN_PASSCODE
npm install
npm run agent-access -- grant user-1 draft --by "Avery Morgan"
npm start                       # http://127.0.0.1:8800/mcp
```

Test it with MCP Inspector (`npx @modelcontextprotocol/inspector`, transport Streamable HTTP, URL `http://localhost:8800/mcp`). It registers itself, opens the sign-in page, and lists the tools.

## Connect ChatGPT

ChatGPT has to reach the server over public HTTPS. That's a tunnel or a host, which is a **deployment and needs the Product Director's approval first**. Once approved:

1. Set `MCP_PUBLIC_URL=https://<approved host>` and `TRUST_PROXY=1`, then start the server behind the tunnel or proxy.
2. In ChatGPT: Settings, Apps and connectors, Advanced settings, turn on Developer mode, then Create (OpenAI renames these menus from time to time; workspace admins may need to allow custom connectors first). Name it, set the URL to `https://<approved host>/mcp`, authentication OAuth.
3. ChatGPT registers itself and opens the sign-in page. Each person signs in as themselves, so every ChatGPT account gets its own token.

## Administrator command

| Command | What it does |
| --- | --- |
| `npm run agent-access -- list` | Everyone's agent access, the resident content setting, and connected agents |
| `npm run agent-access -- grant <userId> read\|draft --by "Name"` | Allows a person's agents to read, or read and draft |
| `npm run agent-access -- revoke <userId> --by "Name"` | No agent access, and signs their agents out |
| `npm run agent-access -- sign-out <userId> --by "Name"` | Signs their agents out but keeps the grant |
| `npm run agent-access -- resident-content allow --approved-by "Name, title" --ref "Motion or letter" --provider "ChatGPT (OpenAI)" --by "Name"` | Records the municipality's approval |
| `npm run agent-access -- resident-content deny --by "Name"` | Hides resident content again |

In the product these belong on Users & Access; the command stands in until the screens and a backend exist.

## Tests

`npm test` runs the whole flow in-process: client registration, sign-in, PKCE, token exchange, refresh rotation, revocation, and real MCP tool calls through the SDK client.
