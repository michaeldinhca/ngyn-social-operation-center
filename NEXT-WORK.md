# Execution queue

Last updated: 2026-10-21
Phase: 1, UI mockup (build and deploy)
Parallel work limit: 1

## Director decisions

- 2026-10-21: "Rebuild all pages of Social Channels & Content, it is important." Stops 2b and 2c were built together and are reviewed together.
- 2026-10-21: "Build the UI interaction mockup first." Backend work waits. The rebuild uses the frontend part of ADR 0001 (React + Vite SPA with a mock adapter) in `web/`. The v0 prototype stays as the reference.
- 2026-10-21: Review **section by section**. The agent builds one menu section, reports, and stops for comments before starting the next.
(m) => m- 2026-10-21 (§ 1 R1): role-based demo permissions are the default; SOC keyword click keeps searching the inbox; the inbox is sentiment based, not ticket based (no priority).

## Current task

| Work-item ID | Work | State | Owner |
| --- | --- | --- | --- |
| `MOCKUP-V1-REBUILD` § 2b + 2c | All Content, Composer, Publishing Calendar, Media Storage. Report: `docs/work-items/MOCKUP-V1-CONTENT-MEDIA/BUILD-REPORT.md` | `BUILT_AWAITING_REVIEW` | Claude |

## Rebuild sections (review one at a time)

| § | Section | Screens | State |
| ---: | --- | --- | --- |
| 1 | Shell + Engagement | SOC, Inbox & Comments, Social Listening | R1 answers applied (priority removed, sentiment-first inbox) |
| 2a | Social Channels + Asset Groups | Connections, capabilities, linking, group roles, brand direction, brand voices, delete | `BUILT_AWAITING_REVIEW` |
| 2b | All Content + Composer + Publishing Calendar | Approval workflow, per-network composer, month/week/list calendar with reschedule | `BUILT_AWAITING_REVIEW` |
| 2c | Media Storage | Library, browser uploads, review, versions, trash, composer reuse | `BUILT_AWAITING_REVIEW` |
| 3 | Advertising | Campaign draft with simulated budget and no-spend guard | `QUEUED` |
| 4 | Insights | Analytics & Reports with SAMPLE-watermarked CSV/PDF export | `QUEUED` |
| 5 | Settings | Users & Access, Activity Log, My Preferences | `QUEUED` |

## Waiting on the Product Director

| Work-item ID | Decision needed | Recommendation |
| --- | --- | --- |
| `STACK-DECISION-001` | Backend part of ADR 0001 (Zernio behind a `SocialGateway`, Fastify + Drizzle + Postgres + pg-boss) | Decide after the mockup; Zernio is not usable for Canadian municipal production without written client approval (see ADR) |
| `MOCKUP-V0-DEPLOY` | Deploy target for the mockup (v1 build, or v0 in the meantime) | `mockup.ngynsolutions.com` via `all-site-code`, which also gives per-page review comments |

## Later queue

| Work-item ID | Work | State | Depends on |
| --- | --- | --- | --- |
| `ZERNIO-SPIKE` | Free-tier account, 2 test accounts (not municipal), verify publish/comments/DMs/analytics/webhooks, fill the capability matrix | `QUEUED` | Director approval for vendor signup and test connections |

## Latest handoff

- Next actor: Product Director
- Required action: review § 2b and § 2c (all of Social Channels & Content is now rebuilt) and answer the questions in the build reports.
- Evidence: typecheck clean, 29/29 unit, 127/127 browser dry-run, screenshots in `.dry-run/web/`.
- Stop condition: § 3 (Advertising) does not start until § 2 comments are addressed or accepted.
