# ADR 0004: LinkedIn and Meta through our own connectors

- Status: **ACCEPTED for local test connectors** (Product Director, 2026-10-27: "you do the LinkedIn connector and Meta connector, I will provide the app later"). Production use waits for `STACK-DECISION-001`.
- Related: ADR 0001 (stack and Zernio), ADR 0003 (Bluesky connector, same pattern).

## Context

The Director owns a Meta developer app ("NGYN") and wants to reuse it instead of a unified vendor (Zernio stores tokens outside Canada, ADR 0001). LinkedIn and Meta both require an app of our own anyway for production. The app details come later, so the connectors are built and tested against fakes now and checked live once the app and test accounts exist.

## Decision

1. Two connectors in the Bluesky pattern: `connectors/linkedin` and `connectors/meta` (Facebook Page plus the Instagram account linked to it). Plain `fetch` against the REST and Graph APIs behind a narrow client seam (`LinkedInClient`, `MetaClient`), so the same code can later sit behind the backend's `SocialGateway`. No SDK dependency.
2. Pinned API versions, set in `.env`: LinkedIn `202610`, Graph `v26.0`.
3. Sign-in is a local OAuth helper (`npm run auth`) that writes tokens into the git-ignored `.env`. Tokens are never printed, sent to the browser, or put in chat. Meta calls carry `appsecret_proof`.
4. The connectors carry the product rules themselves: a named approver on every write (including hiding a comment), the emergency pause blocks publishing and replies, ALT text on images, network limits checked before calling out, deletes only on our own posts, an audit line per write, unavailable metrics as `null`, resident text marked untrusted.
5. Local only, `127.0.0.1`, the mockup's origin, **test accounts only**. Ports: Bluesky 8787, LinkedIn 8788, Meta 8789.

## Consequences

- Live behavior is unverified until the Director supplies the app details and test accounts. The capability matrix records each item as unit-tested (U-test) or pending.
- **Meta:** posting to Pages the app's own people don't manage needs App Review with Advanced Access and business verification. Instagram needs a public image URL, so a hosted media store is required before Instagram posting can come from the mockup's media library. Comment and message webhooks need a public HTTPS endpoint, so the local connector polls. DMs are not built.
- **LinkedIn:** company pages need the Community Management API product, which LinkedIn approves per app. Member tokens last 60 days without refresh. Reading a member's own posts needs `r_member_social`, which is restricted, so the inbox needs a company page. LinkedIn has no page-message API.
- Residency: LinkedIn and Meta process the posts themselves; our side keeps tokens and the audit log on the developer machine.
