# YouTube connector

Real YouTube Data API v3 calls for the NGYN Social Operation Center, kept out of the browser. One test channel. See `docs/adr/0006-youtube-connector.md`.

**Test channel only.** Never connect a municipal channel until the Product Director approves production use.

## Set up

1. In Google Cloud console, create or pick a project and enable **YouTube Data API v3** and **YouTube Analytics API**.
2. Configure the OAuth consent screen (External, Testing) and add the Google account that owns the test channel as a test user.
3. Create an OAuth client ID of type **Web application** with `http://localhost:8793/callback` as an authorized redirect URI.
4. `cp .env.example .env`, then fill in `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.
5. `npm install`, then `npm run auth` and open the link it prints. Pick the test channel (a brand account shows up as its own entry). It saves the refresh token and channel ID into `.env` and never prints them.

## Use

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests with a fake client. No network |
| `npm run auth` | Signs in with Google on localhost and saves the refresh token to `.env` |
| `npm run smoke` | Prints the channel and the latest comments. Read-only |
| `npm run smoke -- --upload short.mp4 captions.vtt "Title"` | Also uploads one video as **private**, with captions, and reads its metrics |
| `npm start` | Local API on `http://127.0.0.1:8792`, answering only `http://localhost:5173` |

## Local API

| Method and path | Body or query | Result |
| --- | --- | --- |
| `GET /health` | | `{ ok, configured, paused }` |
| `GET /youtube/status` | | channel title, subscribers (`null` if hidden), video count |
| `GET /youtube/inbox` | `max` (up to 100), `held=true` for comments held for review | comments on our videos, marked `untrusted` |
| `GET /youtube/metrics` | `id` (repeat, up to 50) | views, likes, comments, shares; reach and saves are `null` |
| `POST /youtube/uploads` | the raw file, `content-type: video/mp4` or `video/quicktime` | `{ uploadId }`, kept in memory for 30 minutes |
| `POST /youtube/videos` | `{ uploadId, title, description, tags?, approvedBy, captions: { body, language }, madeForKids, privacy?, format? }` | `{ id, url }` |
| `POST /youtube/replies` | `{ parentId \| videoId, text, approvedBy }` | `{ id, url }` |
| `POST /youtube/comments/moderate` | `{ commentIds, status: rejected \| published \| heldForReview, approvedBy }` | `{ ids, status }` |
| `DELETE /youtube/videos` | `{ id, approvedBy }` | `{ deleted: true }` |

Rules the connector enforces itself:
- Every write needs `approvedBy`, including moderating a comment.
- Creating `.data/PAUSED` blocks uploads, replies and comments. Moderation still works.
- **Captions are required** (SRT or WebVTT, with a language code). They're the video's ALT text, and AODA and WCAG 1.2.2 expect captions on recorded video. The video is uploaded private, captions are added, and only then is it made public or unlisted. If captions fail, it stays private.
- `madeForKids` must be answered on every upload; YouTube requires it.
- `format` is `short` by default: the connector reads the MP4 or MOV and refuses anything over 3 minutes or landscape. Use `format: "video"` for a regular video.
- Titles up to 100 characters, descriptions up to 5000 bytes, tags up to 500 characters, no `<` or `>`. Comments up to 10,000 characters.
- Replies to a reply go under the thread's top comment (YouTube doesn't nest deeper). New top-level comments only on our own videos. Deletes only on our own videos.
- Every write is appended to `.data/audit.jsonl`.

Limits to know:
- **Uploads from an unaudited Google Cloud project are locked to private**, whatever privacy is asked for. Public uploads need YouTube's API compliance audit for the project.
- Quota: 10,000 units a day by default. An upload costs far more than a read, so a handful of uploads can use the day's quota.
- While the consent screen is in Testing, Google expires refresh tokens after 7 days; run `npm run auth` again. Publishing the app for production needs Google's verification for the `youtube.force-ssl` scope.
- YouTube's API doesn't report reach or impressions. Shares come from the Analytics API, lag a day or two, and are `null` until then.
- The inbox shows up to five replies per thread and is polled; YouTube has no comment webhooks. YouTube has no direct messages.
- The local connector caps files at 256 MB.
