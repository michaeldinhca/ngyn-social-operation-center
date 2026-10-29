# Execution queue

Last updated: 2026-10-28
Phase: 1, UI mockup (build and deploy)
Parallel work limit: 1

## Director decisions

- 2026-10-21: "Continue build for all other pages, I will comment later." Sections 3 to 5 are being built without a stop between them.
- 2026-10-21: "Pause for now, log the progress." Work paused; see `docs/work-items/MOCKUP-V1-REMAINING/PROGRESS.md`.
- 2026-10-26 (answers to the section 3 to 5 questions): (1) the ads layer is a thin governance layer, not a copy of Meta or Google Ads Manager, and the product is meant to be driven by the customer's ChatGPT; ad account model still open. (2) Yes: nobody approves what they wrote (applied to posts and campaigns). (3) Add a custom date range to analytics (done). (4) No chart images in the PDF; ChatGPT works through our MCP. (5) Administrator access becomes its own function (done). Design recorded in `docs/adr/0002-agent-access-via-mcp.md`.
- 2026-10-27: Bluesky connector approved ("do it"). Built in `connectors/bluesky` (ADR 0003): local only, test account only, no deployment. The Director will share Meta app details separately.
- 2026-10-27: "Fix everything" from the QA report. Two product calls were taken as defaults and can be reversed: (1) an approver can approve all linked channel copies at once, each still checked on its own; (2) a new "View content" function lets Viewers read posts and the calendar on assigned channels.
- 2026-10-27: Resident comments and messages reach ChatGPT only if the municipality approves it (recorded in ADR 0002: off by default, admin records the written approval, audited). Ran a gstack `/qa-only` persona test of the mockup: health 89/100, 14 UX issues (7 medium, 7 low), 0 console errors. Report: `docs/qa/2026-10-27-ux-persona-qa/QA-REPORT.md`.
- 2026-10-27: "You do the LinkedIn connector and Meta connector, I will provide the app later." Built in `connectors/linkedin` and `connectors/meta` (ADR 0004), same rules as Bluesky: local, test accounts only, live checks wait for the app details.
- 2026-10-27: "Make the connection for EACH user able to integrate their ChatGPT into the system, maybe the MCP server." Built `mcp/` (ADR 0005): every staff member connects their own ChatGPT with OAuth and it acts only as them. Agent access is off per person until an administrator grants read or draft. Local only; a public URL for ChatGPT is a deployment and needs approval.
- 2026-10-28: "Build any connector left, assuming we have the related app, except X." YouTube was the only one left: built in `connectors/youtube` (ADR 0006), same rules, test channel only. No X connector.
- 2026-10-24: "At 2 pm, do anything that left." Sections 3 to 5 were finished and tested at 2 pm. All 13 screens are now rebuilt.
- 2026-10-21: "Rebuild all pages of Social Channels & Content, it is important." Stops 2b and 2c were built together and are reviewed together.
- 2026-10-21: "Build the UI interaction mockup first." Backend work waits. The rebuild uses the frontend part of ADR 0001 (React + Vite SPA with a mock adapter) in `web/`. The v0 prototype stays as the reference.
- 2026-10-21: Review **section by section**. The agent builds one menu section, reports, and stops for comments before starting the next.
- 2026-10-21 (§ 1 R1): role-based demo permissions are the default; SOC keyword click keeps searching the inbox; the inbox is sentiment based, not ticket based (no priority).

## Current task

| Work-item ID | Work | State | Owner |
| --- | --- | --- | --- |
| `QA-UX-FIX-001` | Fix all 14 QA issues. Report: `docs/qa/2026-10-27-ux-persona-qa/QA-REPORT.md` (Fixes Applied) | `BUILT_AWAITING_REVIEW` | Claude |
| `BLUESKY-CONNECTOR` | `connectors/bluesky`: publish, reply, inbox, metrics, delete, with approval, pause and audit rules. 13/13 unit; live public read verified | `BUILT_AWAITING_REVIEW`; live account test needs the Director's test account in `.env` | Claude |
| `LINKEDIN-CONNECTOR` | `connectors/linkedin`: member or company page posts with image ALT, threaded replies, comment inbox, metrics, delete; OAuth helper writes the token to `.env`. 15/15 unit | `BUILT_AWAITING_REVIEW`; live test needs the Director's LinkedIn app and a test member or page | Claude |
| `META-CONNECTOR` | `connectors/meta`: Facebook Page and linked Instagram posts, replies, hide comments, comment inbox, metrics, Facebook delete; OAuth helper picks the test Page. 16/16 unit | `BUILT_AWAITING_REVIEW`; live test needs the Director's Meta app and a test Page | Claude |
| `YOUTUBE-CONNECTOR` | `connectors/youtube`: Shorts or videos with required captions (private until captions are on), replies, channel comment inbox, moderation, metrics, delete; Google OAuth helper writes the refresh token to `.env`. 18/18 unit | `BUILT_AWAITING_REVIEW`; live test needs the Director's Google Cloud project and a test channel | Claude |
| `MCP-AGENT-SURFACE` | `mcp/`: per-person OAuth, 13 tools (9 read, 4 draft), per-person grant, resident content gate, audit as "ChatGPT for <person>". 15/15 end-to-end; live process check passed | `BUILT_AWAITING_REVIEW`; connecting real ChatGPT needs an approved public URL (`MCP-PUBLIC-URL`) | Claude |
| `MOCKUP-V1-REBUILD` § 3 to § 5 | Advertising, Analytics & Reports, Settings. Report: `docs/work-items/MOCKUP-V1-REMAINING/BUILD-REPORT.md` | `BUILT_AWAITING_REVIEW` | Claude |

## Rebuild sections (review one at a time)

| § | Section | Screens | State |
| ---: | --- | --- | --- |
| 1 | Shell + Engagement | SOC, Inbox & Comments, Social Listening | R1 answers applied (priority removed, sentiment-first inbox) |
| 2a | Social Channels + Asset Groups | Connections, capabilities, linking, group roles, brand direction, brand voices, delete | `BUILT_AWAITING_REVIEW` |
| 2b | All Content + Composer + Publishing Calendar | Approval workflow, per-network composer, month/week/list calendar with reschedule | `BUILT_AWAITING_REVIEW` |
| 2c | Media Storage | Library, browser uploads, review, versions, trash, composer reuse | `BUILT_AWAITING_REVIEW` |
| 3 | Advertising | Campaigns, campaign editor with simulated budget and no-spend guard, ad accounts | `BUILT_AWAITING_REVIEW` |
| 4 | Insights | Analytics & Reports with SAMPLE-watermarked CSV and PDF export | `BUILT_AWAITING_REVIEW` |
| 5 | Settings | Users & Access, Activity Log, My Preferences | `BUILT_AWAITING_REVIEW` |

## Waiting on the Product Director

| Work-item ID | Decision needed | Recommendation |
| --- | --- | --- |
| `STACK-DECISION-001` | Backend part of ADR 0001 (Zernio behind a `SocialGateway`, Fastify + Drizzle + Postgres + pg-boss) | Decide after the mockup; Zernio is not usable for Canadian municipal production without written client approval (see ADR) |
| `MCP-PUBLIC-URL` | A public HTTPS address for `mcp/` so ChatGPT can connect (a tunnel for a test, or a host) | A short-lived tunnel for one test session with the Director's ChatGPT, then decide hosting with `STACK-DECISION-001` |
| `MOCKUP-V0-DEPLOY` | Deploy target for the mockup (v1 build, or v0 in the meantime) | `mockup.ngynsolutions.com` via `all-site-code`, which also gives per-page review comments |


## Later queue

| Work-item ID | Work | State | Depends on |
| --- | --- | --- | --- |
| `AGENT-ACCESS-UI` | Users & Access screens for agent access per person and the resident content approval (today the `mcp` admin command), plus an agent filter in the Activity Log | `QUEUED` | Review of `MCP-AGENT-SURFACE` |
| `BLUESKY-WIRE-UP` | Point the mockup's Bluesky channels at the local connector when it is running (inbox, composer publish after approval, metrics), with mock data as the fallback | `QUEUED` | `BLUESKY-CONNECTOR` live test passes |
| `LINKEDIN-META-WIRE-UP` | Same as `BLUESKY-WIRE-UP` for LinkedIn, Facebook, Instagram and YouTube channels | `QUEUED` | Live tests pass with the Director's apps |
| `ZERNIO-SPIKE` | Free-tier account, 2 test accounts (not municipal), verify publish/comments/DMs/analytics/webhooks, fill the capability matrix | `QUEUED` | Director approval for vendor signup and test connections |

## Latest handoff

- Next actor: Product Director
- New 2026-10-28: YouTube connector (ADR 0006), 18/18 unit. To go live: a Google Cloud project with YouTube Data API v3 and Analytics API, an OAuth client and a test channel (see its README). Every network except X now has a connector.
- 2026-10-27: LinkedIn and Meta connectors (ADR 0004) and the per-person MCP server (ADR 0005) are built and tested locally. To go live: share the LinkedIn and Meta app details and test accounts (each connector's README lists the setup), and decide `MCP-PUBLIC-URL` so ChatGPT can connect. Evidence: LinkedIn 15/15, Meta 16/16, MCP 15/15 end-to-end plus a live OAuth and tool call against the running server.
- Required action: review all five sections (every menu screen is rebuilt) and answer the questions in the four build reports: `MOCKUP-V1-ENGAGEMENT`, `MOCKUP-V1-CHANNELS-GROUPS`, `MOCKUP-V1-CONTENT-MEDIA` and `MOCKUP-V1-REMAINING`. Decide `MOCKUP-V0-DEPLOY` (host for a shareable preview) and `STACK-DECISION-001`.
- Evidence: typecheck clean, 78/78 unit, 220/220 browser dry-run, zero page errors, screenshots in `.dry-run/web/`.
- Stop condition: no deployment, hosted preview or vendor signup until approved here.
