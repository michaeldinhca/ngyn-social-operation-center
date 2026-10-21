# Execution queue

Last updated: 2026-10-21
Phase: 1, UI mockup (build and deploy)
Parallel work limit: 1

## Director decisions

- 2026-10-21: "Build the UI interaction mockup first." Backend work waits. The rebuild uses the frontend part of ADR 0001 (React + Vite SPA with a mock adapter) in `web/`. The v0 prototype stays as the reference.
- 2026-10-21: Review **section by section**. The agent builds one menu section, reports, and stops for comments before starting the next.
- 2026-10-21: § 2 is reviewed in three stops (2a, 2b, 2c), as proposed and approved ("do it").
- 2026-10-21 (§ 1 R1): role-based demo permissions are the default; SOC keyword click keeps searching the inbox; the inbox is sentiment based, not ticket based (no priority).

## Current task

| Work-item ID | Work | State | Owner |
| --- | --- | --- | --- |
| `MOCKUP-V1-REBUILD` § 2a | Social Channels + Asset Groups. Report: `docs/work-items/MOCKUP-V1-CHANNELS-GROUPS/BUILD-REPORT.md` | `BUILT_AWAITING_REVIEW` | Claude |

## Rebuild sections (review one at a time)

| § | Section | Screens | State |
| ---: | --- | --- | --- |
| 1 | Shell + Engagement | SOC, Inbox & Comments, Social Listening | R1 answers applied (priority removed, sentiment-first inbox) |
| 2a | Social Channels + Asset Groups | Connections, capabilities, linking, group roles, brand direction, brand voices, delete | `BUILT_AWAITING_REVIEW` |
| 2b | All Content + Composer + Publishing Calendar | Approval workflow, per-network composer, month/week calendar with reschedule | `QUEUED` |
| 2c | Media Storage | Library, IndexedDB uploads, review, versions, trash, composer reuse | `QUEUED` |
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
- Required action: review § 2a and answer the 2 questions in its build report.
- Evidence: typecheck clean, 12/12 unit, 61/61 browser dry-run, screenshots in `.dry-run/web/`.
- Stop condition: § 2b does not start until § 2a comments are addressed or accepted.
