# Meta connector (Facebook Page and Instagram)

Real Graph API calls for the NGYN Social Operation Center, kept out of the browser. One test Facebook Page and, if linked to it, its Instagram professional account. See `docs/adr/0004-linkedin-and-meta-connectors.md`.

**Test Page and test Instagram account only.** Never connect a municipal Page until the Product Director approves production use.

## Set up

1. Use the NGYN Meta app (or any Business-type app). Add the **Facebook Login for Business** product and, for Instagram, the Instagram API with Facebook Login.
2. In Facebook Login settings, add `http://localhost:8791/callback` to the valid OAuth redirect URIs. In App settings, Advanced, turn on **Require app secret**.
3. `cp .env.example .env`, then fill in `META_APP_ID` and `META_APP_SECRET`. If the app uses a Login for Business configuration, set `META_LOGIN_CONFIG_ID`.
4. `npm install`, then `npm run auth` and open the link it prints. Tick only the test Page in Meta's dialog. It saves the Page token and the linked Instagram account into `.env` and never prints them.

In development mode this works only for people with a role on the app (admin, developer, tester) and Pages they manage. Pages owned by others need App Review and Advanced Access.

## Use

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests with a fake client. No network |
| `npm run auth` | Signs in with Facebook on localhost and saves the Page token to `.env` |
| `npm run smoke` | Prints the Page and Instagram account and the latest comments. Read-only |
| `npm run smoke -- --post "Text"` | Also publishes one Facebook text post and reads its metrics |
| `npm start` | Local API on `http://127.0.0.1:8789`, answering only `http://localhost:5173` |

## Local API

Every route takes `network`: `facebook` or `instagram`.

| Method and path | Body or query | Result |
| --- | --- | --- |
| `GET /health` | | `{ ok, configured, paused, instagram }` |
| `GET /meta/status` | | Page and Instagram account |
| `GET /meta/inbox` | `network`, `posts`, `perPost` | comments on our latest posts, marked `untrusted` |
| `GET /meta/metrics` | `network`, `id` (repeat, up to 25) | reactions, comments, shares, saves, views, reach (`null` when Meta doesn't return one) |
| `POST /meta/posts` | `{ network, text, approvedBy, link?, image?: { base64, mime, imageUrl, alt } }` | `{ id, url }` |
| `POST /meta/replies` | `{ network, parentId, text, approvedBy }` | `{ id, url }` |
| `POST /meta/comments/hide` | `{ network, commentId, hidden, approvedBy }` | `{ id, hidden }` |
| `DELETE /meta/posts` | `{ network: "facebook", id, approvedBy }` | `{ deleted: true }` |

Rules the connector enforces itself:
- Every write needs `approvedBy`, including hiding a comment.
- Creating `.data/PAUSED` blocks posts and replies. Hiding a comment still works, because it's moderation.
- Images need ALT text (sent as `alt_text_custom` on Facebook and `alt_text` on Instagram).
- Instagram: an image is required, sent as a public `https://` JPEG URL (Meta downloads it; there's no upload). Caption up to 2200 characters, 30 hashtags, 20 @ tags; no links.
- Deletes work only on the connected Page's Facebook posts. Instagram posts aren't deleted through the connector.
- Every write is appended to `.data/audit.jsonl`.
- Every Graph call carries `appsecret_proof`.

Limits to know:
- `post_impressions` was retired in November 2025. Views and reach come from the newer media-view metrics and are `null` if Meta withholds them.
- Meta delivers comments and messages by webhook, which needs a public HTTPS URL. This local connector polls instead.
- Messenger and Instagram direct messages are not built (they need webhooks and the 24-hour reply window).
