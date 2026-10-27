# Execution queue

Last updated: 2026-10-27
Phase: 1, UI mockup (build and deploy)
Parallel work limit: 1

## Director decisions

- 2026-10-21: "Continue build for all other pages, I will comment later." Sections 3 to 5 are being built without a stop between them.
- 2026-10-21: "Pause for now, log the progress." Work paused; see `docs/work-items/MOCKUP-V1-REMAINING/PROGRESS.md`.
- 2026-10-26 (answers to the section 3 to 5 questions): (1) the ads layer is a thin governance layer, not a copy of Meta or Google Ads Manager, and the product is meant to be driven by the customer's ChatGPT; ad account model still open. (2) Yes: nobody approves what they wrote (applied to posts and campaigns). (3) Add a custom date range to analytics (done). (4) No chart images in the PDF; ChatGPT works through our MCP. (5) Administrator access becomes its own function (done). Design recorded in `docs/adr/0002-agent-access-via-mcp.md`.
- 2026-10-27: Resident comments and messages reach ChatGPT only if the municipality approves it (recorded in ADR 0002: off by default, admin records the written approval, audited). Ran a gstack `/qa-only` persona test of the mockup: health 89/100, 14 UX issues (7 medium, 7 low), 0 console errors. Report: `docs/qa/2026-10-27-ux-persona-qa/QA-REPORT.md`.
- 2026-10-24: "At 2 pm, do anything that left." Sections 3 to 5 were finished and tested at 2 pm. All 13 screens are now rebuilt.
- 2026-10-21: "Rebuild all pages of Social Channels & Content, it is important." Stops 2b and 2c were built together and are reviewed together.
- 2026-10-21: "Build the UI interaction mockup first." Backend work waits. The rebuild uses the frontend part of ADR 0001 (React + Vite SPA with a mock adapter) in `web/`. The v0 prototype stays as the reference.
- 2026-10-21: Review **section by section**. The agent builds one menu section, reports, and stops for comments before starting the next.
- 2026-10-21 (§ 1 R1): role-based demo permissions are the default; SOC keyword click keeps searching the inbox; the inbox is sentiment based, not ticket based (no priority).

## Current task

| Work-item ID | Work | State | Owner |
| --- | --- | --- | --- |
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
| `MOCKUP-V0-DEPLOY` | Deploy target for the mockup (v1 build, or v0 in the meantime) | `mockup.ngynsolutions.com` via `all-site-code`, which also gives per-page review comments |

| `QA-UX-FIX-001` | Fix the 14 issues in `docs/qa/2026-10-27-ux-persona-qa/QA-REPORT.md`? ISSUE-006 (approve linked posts together) and ISSUE-008 (what a Viewer may read) are product decisions | Fix the 12 non-decision issues in one pass, top 3 first (composer inline errors, one-step claim and resolve, mock reply that fits the message) |

## Later queue

| Work-item ID | Work | State | Depends on |
| --- | --- | --- | --- |
| `MCP-AGENT-SURFACE` | Design the MCP tool list from the mock API (read-only first, then drafts), agent scope, delegation and audit. See ADR 0002 | `QUEUED` | `STACK-DECISION-001` and Director approval of ADR 0002 |
| `ZERNIO-SPIKE` | Free-tier account, 2 test accounts (not municipal), verify publish/comments/DMs/analytics/webhooks, fill the capability matrix | `QUEUED` | Director approval for vendor signup and test connections |

## Latest handoff

- Next actor: Product Director
- Required action: review all five sections (every menu screen is rebuilt) and answer the questions in the four build reports: `MOCKUP-V1-ENGAGEMENT`, `MOCKUP-V1-CHANNELS-GROUPS`, `MOCKUP-V1-CONTENT-MEDIA` and `MOCKUP-V1-REMAINING`. Decide `MOCKUP-V0-DEPLOY` (host for a shareable preview) and `STACK-DECISION-001`.
- Evidence: typecheck clean, 75/75 unit, 204/204 browser dry-run, zero page errors, screenshots in `.dry-run/web/`.
- Stop condition: no deployment, hosted preview or vendor signup until approved here.
