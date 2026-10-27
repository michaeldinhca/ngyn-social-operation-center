# LinkedIn connector

Real LinkedIn calls for the NGYN Social Operation Center, kept out of the browser. See `docs/adr/0004-linkedin-and-meta-connectors.md`.

**Test member or test company page only.** Never connect a municipal page until the Product Director approves production use.

## Set up

1. In the LinkedIn developer portal, create an app (or use an existing one) and add the **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect** products. For a company page, LinkedIn must also approve the **Community Management API** product for the app.
2. On the app's Auth tab, add `http://localhost:8790/callback` as a redirect URL.
3. `cp .env.example .env`, then fill in `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`. For a company page, also set `LINKEDIN_AUTHOR_URN=urn:li:organization:{id}` and the extra scopes shown in the file.
4. `npm install`, then `npm run auth` and open the link it prints. It saves the token into `.env` and never prints it.

## Use

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests with a fake client. No network |
| `npm run auth` | Signs in with LinkedIn on localhost and saves the token to `.env` |
| `npm run smoke` | Prints the account; for a company page also the latest comments. Read-only |
| `npm run smoke -- --post "Text"` | Also publishes one post and reads its metrics |
| `npm start` | Local API on `http://127.0.0.1:8788`, answering only `http://localhost:5173` |

## Local API

| Method and path | Body or query | Result |
| --- | --- | --- |
| `GET /health` | | `{ ok, configured, paused }` |
| `GET /linkedin/status` | | author URN, page or member name |
| `GET /linkedin/inbox` | `posts`, `perPost` | comments on our latest posts, marked `untrusted` |
| `GET /linkedin/metrics` | `urn` (repeat, up to 25) | reactions, comments; for pages also shares, clicks, impressions, reach (else `null`) |
| `POST /linkedin/posts` | `{ text, approvedBy, image?: { base64, mime, alt } }` | `{ urn, url }` |
| `POST /linkedin/replies` | `{ postUrn, parentComment?, text, approvedBy }` | `{ urn, url }` |
| `DELETE /linkedin/posts` | `{ urn, approvedBy }` | `{ deleted: true }` |

Rules the connector enforces itself:
- Every write needs `approvedBy`.
- Creating `.data/PAUSED` blocks posts and replies until the file is removed.
- Images need ALT text (PNG, JPEG or GIF).
- Posts are limited to 3000 characters, comments to 1250. Text is escaped so LinkedIn shows it as written; `#hashtags` stay live.
- Deletes work only on the connected author's posts.
- Every write is appended to `.data/audit.jsonl`.

Limits to know:
- A member's own posts and comments can't be read back without `r_member_social`, which LinkedIn gives to approved partners only. So the inbox and full metrics need a company page.
- Member tokens last 60 days and there's no refresh token without partner approval. Run `npm run auth` again when it expires.
- No webhooks here; the inbox is polled. LinkedIn has no API for page messages.
