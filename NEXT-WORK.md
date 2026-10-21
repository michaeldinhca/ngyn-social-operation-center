# Execution queue

Last updated: 2026-10-21
Phase: 1, UI mockup (build and deploy)
Parallel work limit: 1

## Current task

| Work-item ID | Work | State | Owner |
| --- | --- | --- | --- |
| `DOCS-BASELINE-001` | Repo docs (AI.md, REQUIREMENTS, ARCHITECTURE, ADR 0001, capability matrix), reproducible build, Playwright dry-run | `BUILT_AWAITING_REVIEW` | Claude |

## Waiting on the Product Director

| Work-item ID | Decision needed | Recommendation |
| --- | --- | --- |
| `STACK-DECISION-001` | Accept ADR 0001 (Zernio behind a `SocialGateway`, Vite SPA, Fastify + Drizzle + Postgres + pg-boss) or amend it | Accept, with Zernio residency/DPA check before any municipal proposal |
| `MOCKUP-V0-DEPLOY` | Approve deploying the current built mockup and choose the host | `mockup.ngynsolutions.com` via `all-site-code/ngyn-social-operation-center` (gets the client comment workflow) |

## Ordered queue

| Order | Work-item ID | Work | State | Depends on |
| ---: | --- | --- | --- | --- |
| 1 | `MOCKUP-V0-DEPLOY` | Publish the single-file build to the approved host; verify with the dry-run against the live URL | `WAITING_FOR_DIRECTOR` | Director approval |
| 2 | `MOCKUP-V0-POLISH` | Fix page titles and breadcrumbs for Listening/Calendar/Ads/Analytics; favicon; month/week grid for Publishing Calendar (F04) | `QUEUED` | None |
| 3 | `MOCKUP-PLANNED-SCREENS` | Mock screens for Social Listening (F12, scenario 6), Analytics & Reports with SAMPLE-watermarked CSV/PDF export (F10/F11, scenario 7), Ad campaign draft with no-spend guard (F18, scenario 11), Integration health and limitations (scenario 12) | `QUEUED` | 2 |
| 4 | `MOCKUP-V1-REBUILD` | Rebuild the UI in the accepted frontend stack with a typed API client and a Zernio-shaped mock adapter; port the dry-run | `QUEUED` | `STACK-DECISION-001` |
| 5 | `ZERNIO-SPIKE` | Free-tier account, connect 2 test accounts (not municipal), test publish, comments, DMs, analytics, webhooks; fill `docs/PLATFORM_CAPABILITY_MATRIX.md`; request DPA and hosting region | `QUEUED` | Director approval to create the vendor account and connect test accounts |

## Latest handoff

- Next actor: Product Director
- Required action: review `DOCS-BASELINE-001`, decide `STACK-DECISION-001` and `MOCKUP-V0-DEPLOY`.
- Evidence: `docs/dry-runs/2026-10-21.md` (14/14 unit, 25/25 browser).
- Stop condition: no deployment, vendor signup or external connection until approved here.
