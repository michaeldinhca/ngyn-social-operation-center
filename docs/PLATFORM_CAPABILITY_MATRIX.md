# Platform capability matrix

Required by the brief (section 8) before any production capability is promised. **Nothing here has been tested by us yet.** Each cell records its evidence source.

Legend: **S** supported, **SA** supported with approval or paid API, **U** unsupported, **?** unknown or not yet tested. Suffix `(Z-doc)` means "Zernio documentation claims it, not verified by NGYN".

Last updated: 2026-10-21. Source: https://docs.zernio.com/platforms/compare

| Capability | Facebook | Instagram | Bluesky | LinkedIn | YouTube | X |
| --- | --- | --- | --- | --- | --- | --- |
| Publish text | S (Z-doc) | ? | S (Z-doc) | S (Z-doc) | U | S (Z-doc) |
| Publish image | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | U | S (Z-doc) |
| Publish video / reel / short | S (Z-doc) | S (Z-doc) | S, limited (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) |
| Stories / carousels | ? | S (Z-doc) | ? | ? | ? | ? |
| Alt text on media | ? | ? | ? | ? | ? | ? |
| Read comments on owned posts | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | SA, polling must be on (Z-doc) |
| Reply to comments | S (Z-doc) | S (Z-doc) | ? | S, public only (Z-doc) | S, public only (Z-doc) | ? |
| Hide / delete comments | ? | ? | ? | ? | ? | ? |
| Read / send DMs | S (Z-doc) | S (Z-doc) | S, no attachments (Z-doc) | ? | U (Z-doc) | SA, dm scopes (Z-doc) |
| Post analytics | S (Z-doc) | S (Z-doc) | S (Z-doc) | S, partial metrics (Z-doc) | S (Z-doc) | S (Z-doc) |
| Account / audience analytics | ? | S (Z-doc) | ? | ? | S, demographics (Z-doc) | ? |
| Comment / message webhooks | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) |
| Public keyword listening (non-owned) | ? | ? | ? | ? | ? | ? |
| Data processing region (via Zernio) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) |

## Bluesky through our own connector (`connectors/bluesky`, ADR 0003)

Built 2026-10-27, no vendor in between. Legend for this table: **U-test** covered by unit tests with a fake client, **Live-public** checked against Bluesky's public API without logging in, **Pending** needs the test account.

| Capability | Status |
| --- | --- |
| Log in with an app password | U-test; live Pending |
| Account profile and counts | U-test; Live-public (profile read worked 2026-10-27) |
| Publish text with links, @mentions and #tags | U-test; facet detection Live-public; posting Pending |
| Publish one image with ALT text (PNG, JPEG, WebP, GIF, about 2 MB) | U-test; Pending |
| 300 grapheme limit | U-test (enforced before calling Bluesky) |
| Read mentions, replies and quotes on the account | U-test; Pending |
| Reply in a thread (root and parent set) | U-test; Pending |
| Delete our own post | U-test; Pending |
| Post metrics: likes, reposts, replies, quotes | U-test; Pending |
| Impressions and reach | U: Bluesky doesn't report them. The connector returns null (shown as Unavailable) |
| DMs | Not built. Bluesky chat uses a separate service and needs an app password with DM access |
| Video, multiple images, threads of our own | Not built |
| Push (webhooks) | None. Bluesky has no webhooks; the inbox is polled |

## Still to verify (per platform)

- App review or approval needed (Zernio's app vs our own app), and how posts are attributed.
- Rate limits (team-wide in Zernio), retries, idempotency behavior.
- Token expiry and reconnect behavior (`account.disconnected`).
- API costs passed through (X).
- Data retention and deletion of post history and inbox messages.

Public listening across news, blogs and forums needs a separate licensed provider; it's out of Zernio's scope.
