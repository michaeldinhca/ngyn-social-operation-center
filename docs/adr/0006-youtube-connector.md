# ADR 0006: YouTube through our own connector

- Status: **ACCEPTED for a local test connector** (Product Director, 2026-10-28: "build any connector left, assuming we have the related app, except X"). Production use waits for `STACK-DECISION-001`.
- Related: ADR 0003 (Bluesky), ADR 0004 (LinkedIn and Meta), same pattern. X is out of scope by the Director's decision.

## Decision

1. `connectors/youtube`, plain `fetch` against the YouTube Data API v3 and the Analytics API behind a narrow client seam (`YouTubeClient`). No SDK. One channel per connector.
2. Sign-in is a local Google OAuth helper (`npm run auth`, PKCE, offline access) that writes the refresh token into the git-ignored `.env`. Access tokens live only in memory and are refreshed when they expire. Scopes: `youtube.force-ssl` and `yt-analytics.readonly`.
3. The same product rules as the other connectors: a named approver on every write (including moderation), the emergency pause blocks uploads and replies but not moderation, deletes and new comments only on our own videos, an audit line per write, unavailable metrics as `null`, resident text marked untrusted.
4. **Captions stand in for ALT text.** Every upload needs an SRT or WebVTT file. The video is uploaded private, captions are added, and only then is it opened up, so nobody sees it without captions. If captions fail, it stays private.
5. Shorts are the default format, matching the mockup (YouTube: Short). The connector reads the MP4 or MOV container and refuses Shorts over 3 minutes or landscape before using upload quota.
6. Videos reach the local API as a raw upload held in memory for 30 minutes, then a JSON publish call, so large files never travel as base64. Local cap 256 MB.
7. Local only, `127.0.0.1:8792` (sign-in callback on 8793), the mockup's origin, **test channel only**.

## Consequences

- Live behavior is unverified until the Director supplies the Google Cloud project, OAuth client and a test channel.
- Uploads from an unaudited project are locked private by YouTube. Public uploads need the YouTube API compliance audit.
- The default quota (10,000 units a day) allows only a few uploads a day. A quota increase goes through the same audit.
- In Testing mode, refresh tokens expire after 7 days. Production needs Google's OAuth verification for a sensitive scope.
- YouTube reports no reach or impressions through the API; shares lag a day or two. No comment webhooks (polled) and no direct messages.
- Residency: YouTube processes the videos itself; our side keeps the refresh token and the audit log on the developer machine.
