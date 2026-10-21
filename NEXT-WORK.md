# Execution queue

Last updated: 2026-10-21
Phase: 1, UI mockup (build and deploy)
Parallel work limit: 1

## Director decisions

- 2026-10-21: "Continue build for all other pages, I will comment later." Sections 3 to 5 are being built without a stop between them.
- 2026-10-21: "Pause for now, log the progress." Work paused; see `docs/work-items/MOCKUP-V1-REMAINING/PROGRESS.md`.
- 2026-10-21: "Rebuild all pages of Social Channels & Content, it is important." Stops 2b and 2c were built together and are reviewed together.
- 2026-10-21: "Build the UI interaction mockup first." Backend work waits. The rebuild uses the frontend part of ADR 0001 (React + Vite SPA with a mock adapter) in `web/`. The v0 prototype stays as the reference.
- 2026-10-21: Review **section by section**. The agent builds one menu section, reports, and stops for comments before starting the next.
- 2026-10-21 (§ 1 R1): role-based demo permissions are the default; SOC keyword click keeps searching the inbox; the inbox is sentiment based, not ticket based (no priority).

## Current task

| Work-item ID | Work | State | Owner |
| --- | --- | --- | --- |
| `MOCKUP-V1-REBUILD` § 3 to § 5 | Advertising, Analytics & Reports, Settings. Log: `docs/work-items/MOCKUP-V1-REMAINING/PROGRESS.md` | `IN_PROGRESS` (PAUSED by the Director 2026-10-21; code written, not browser-tested) | Claude |

## Rebuild sections (review one at a time)

| § | Section | Screens | State |
| ---: | --- | --- | --- |
| 1 | Shell + Engagement | SOC, Inbox & Comments, Social Listening | R1 answers applied (priority removed, sentiment-first inbox) |
| 2a | Social Channels + Asset Groups | Connections, capabilities, linking, group roles, brand direction, brand voices, delete | `BUILT_AWAITING_REVIEW` |
| 2b | All Content + Composer + Publishing Calendar | Approval workflow, per-network composer, month/week/list calendar with reschedule | `BUILT_AWAITING_REVIEW` |
| 2c | Media Storage | Library, browser uploads, review, versions, trash, composer reuse | `BUILT_AWAITING_REVIEW` |
| 3 | Advertising | Campaigns, campaign editor with simulated budget and no-spend guard, ad accounts | `IN_PROGRESS` (written, untested in browser) |
| 4 | Insights | Analytics & Reports with SAMPLE-watermarked CSV and PDF export | `IN_PROGRESS` (written, untested in browser) |
| 5 | Settings | Users & Access, Activity Log, My Preferences | `IN_PROGRESS` (written, untested in browser) |

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

- Next actor: Claude, when the Director says to resume
- Required action: resume at "Next steps" in the progress log (run the browser dry-run first, then test the new screens).
- Evidence at the pause: typecheck clean, 60/60 unit, build succeeds. Browser dry-run NOT run for sections 3 to 5, and not re-run for sections 1 and 2 since the changes.
- Stop condition: nothing from sections 3 to 5 is reviewable until the dry-run passes and a build report exists.
