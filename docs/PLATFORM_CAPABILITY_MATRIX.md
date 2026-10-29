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

## LinkedIn through our own connector (`connectors/linkedin`, ADR 0004)

Built 2026-10-27 against the REST API, version 202610. **U-test** means covered by unit tests with a fake client; **Pending** needs the Director's LinkedIn app and a test member or page.

| Capability | Status |
| --- | --- |
| Sign in (OAuth, token written to `.env`) | Pending |
| Post text as a member (`w_member_social`) or a company page (`w_organization_social`, Community Management API approval) | U-test; Pending |
| Image with ALT text (PNG, JPEG, GIF) through the Images API | U-test; Pending |
| 3000 character limit; text escaped for LinkedIn's "little" format, hashtags kept | U-test |
| Reply to a comment, threaded | U-test; Pending |
| Comments on our posts (inbox) | U-test; Pending. Company pages only: reading a member's own posts needs restricted `r_member_social` |
| Reactions and comments per post | U-test; Pending |
| Impressions, reach, clicks, shares | Company pages only (share statistics). Member posts: null |
| Delete our own post | U-test; Pending |
| Page messages, webhooks | None through the API here; the inbox is polled |

## Facebook Page and Instagram through our own connector (`connectors/meta`, ADR 0004)

Built 2026-10-27 against Graph API v26.0, every call signed with `appsecret_proof`. Same legend.

| Capability | Facebook | Instagram |
| --- | --- | --- |
| Sign in (Facebook Login, Page token written to `.env`) | Pending | Linked account found at sign-in; Pending |
| Publish text | U-test; Pending | Not possible: Instagram posts need an image |
| Publish one image with ALT text | U-test (`alt_text_custom`); Pending | U-test (`alt_text`, public JPEG URL required); Pending |
| Limits checked before calling out | 63,206 characters | 2200 characters, 30 hashtags, 20 @ tags, no links |
| Reply to comments | U-test; Pending | U-test; Pending |
| Hide and unhide comments | U-test; Pending | U-test; Pending |
| Comments on our posts (inbox) | U-test; Pending | U-test; Pending |
| Reactions or likes, comments, shares | U-test; Pending | U-test; Pending |
| Views and reach | `post_media_view` and `post_total_media_view_unique`; null if withheld (`post_impressions` was retired in Nov 2025) | `views`, `reach`, `saved`, `shares` insights; null if withheld |
| Delete our own post | U-test; Pending | Not offered by the connector |
| DMs and webhooks | Not built (need a public HTTPS endpoint and the 24-hour window) | Not built |
| Pages managed by others (municipal clients) | Needs App Review, Advanced Access and business verification | Same |

## YouTube through our own connector (`connectors/youtube`, ADR 0006)

Built 2026-10-28 against the Data API v3 and the Analytics API. Same legend; **Pending** needs the Director's Google Cloud project and a test channel.

| Capability | Status |
| --- | --- |
| Sign in (Google OAuth with PKCE, refresh token written to `.env`) | Pending |
| Upload a Short (3 minutes or less, square or vertical, checked from the file) or a regular video | U-test; Pending. Unaudited projects: YouTube locks uploads to private |
| Captions as ALT text (SRT or WebVTT required; video stays private until they're on) | U-test; Pending |
| Title 100 characters, description 5000 bytes, tags 500 characters, no `<` `>`, made-for-kids answer required | U-test |
| Reply to a comment (under the thread's top comment) or comment on our video | U-test; Pending |
| Comments across the channel (inbox), including those held for review | U-test; Pending. Up to five replies per thread |
| Hide (reject), show again, or approve held comments | U-test; Pending |
| Views, likes, comments | U-test; Pending. Likes `null` if hidden |
| Shares | Analytics API, a day or two behind; `null` until then |
| Reach, impressions, saves | U: not in YouTube's API. `null` |
| Delete our own video | U-test; Pending |
| DMs, webhooks | None: YouTube has no DMs and no comment webhooks; the inbox is polled |
| Quota | 10,000 units a day by default; uploads use most of it |

## Still to verify (per platform)

- App review or approval needed (Zernio's app vs our own app), and how posts are attributed.
- Rate limits (team-wide in Zernio), retries, idempotency behavior.
- Token expiry and reconnect behavior (`account.disconnected`).
- API costs passed through (X).
- Data retention and deletion of post history and inbox messages.

Public listening across news, blogs and forums needs a separate licensed provider; it's out of Zernio's scope.
