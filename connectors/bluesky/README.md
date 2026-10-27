# Bluesky connector

Real Bluesky calls for the NGYN Social Operation Center, kept out of the browser. See `docs/adr/0003-bluesky-direct-connector.md`.

**Test account only.** Never connect a municipal account until the Product Director approves production use.

## Set up

1. Create a test Bluesky account, then an app password: bsky.app, Settings, Privacy and security, App passwords. Don't tick direct-message access.
2. `cp .env.example .env` and fill in the handle and the app password. `.env` is git-ignored.
3. `npm install`

## Use

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests with a fake client. No network |
| `npm run smoke` | Logs in, prints the profile and the 5 latest mentions/replies. Read-only |
| `npm run smoke -- --post "Text"` | Also publishes one post and reads its metrics |
| `npm start` | Local API on `http://127.0.0.1:8787`, answering only `http://localhost:5173` |

## Local API

| Method and path | Body or query | Result |
| --- | --- | --- |
| `GET /health` | | `{ ok, configured, paused }` |
| `GET /bluesky/status` | | handle, followers, posts |
| `GET /bluesky/inbox` | `limit`, `cursor` | mentions, replies and quotes, marked `untrusted` |
| `GET /bluesky/metrics` | `uri` (repeat, up to 25) | likes, reposts, replies, quotes; impressions and reach are `null` |
| `POST /bluesky/posts` | `{ text, approvedBy, image?: { base64, mime, alt } }` | `{ uri, cid, url }` |
| `POST /bluesky/replies` | `{ parentUri, text, approvedBy }` | `{ uri, cid, url }` |
| `DELETE /bluesky/posts` | `{ uri, approvedBy }` | `{ deleted: true }` |

Rules the connector enforces itself:
- Every write needs `approvedBy`.
- Creating `.data/PAUSED` blocks posts and replies until the file is removed. This is the emergency pause.
- Images need ALT text.
- Posts are limited to 300 graphemes.
- Deletes work only on the connected account's posts.
- Every write is appended to `.data/audit.jsonl`.

There's no login on the local API, so don't expose the port beyond this machine.
