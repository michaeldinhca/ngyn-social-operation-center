# ADR 0001: Tech stack, and Zernio as the social integration backend

- Status: **PROPOSED** (needs Product Director decision)
- Date: 2026-10-21
- Supersedes: the stack table in `docs/handoff/BUILD_BRIEF.md` section 2, if accepted

## Context

The brief selected Next.js + NestJS + PostgreSQL + Redis/BullMQ + Canadian S3, with **our own adapter per social platform** (OAuth, encrypted token vault, publish, inbox sync, analytics). Social integrations alone were estimated at 100 to 200 hours, before Meta/LinkedIn/YouTube app review.

The current priority is a deployable **UI mockup**, then a real product. The Product Director proposed [Zernio](https://go.zernio.com/) (unified social API) to shrink backend scope.

## What Zernio covers (from vendor docs, 2026-10-21, not yet tested by us)

- One API key, REST + OpenAPI 3.1, official Node SDK, MCP server.
- Hosted or headless (white-label) OAuth connect per platform, grouped into **profiles** with our own `externalId`.
- Publishing and scheduling across Facebook, Instagram, Bluesky, LinkedIn, YouTube, X (plus 10 more).
- Unified inbox: comments, DMs, reviews; webhooks `comment.received`, `message.received`, `post.published`, `account.disconnected`.
- Per-post analytics, some account analytics.
- Ads campaign management (Meta, Google, LinkedIn, X and others).
- Pricing per connected account: 1 to 2 free, 3 to 10 at $6, 11 to 100 at $3 (USD/month). Our 18-account demo set is roughly $50 to $75 per month depending on how tiers apply.
- Lists SOC 2, GDPR, 99.7% uptime SLA.

Known per-platform gaps from their compare page: YouTube has no DMs; LinkedIn is not in the DM inbox; Bluesky has no DM attachments and no message lifecycle webhooks; X comment polling must be enabled. Alt text support is not stated for any platform. See `docs/PLATFORM_CAPABILITY_MATRIX.md`.

## What Zernio does not cover (we still build)

Users and login (OIDC/SAML, MFA), RBAC with function vs account scoping, approvals, **our own schedule queue and emergency pause**, durable audit log, media library and storage, brand direction and voice, cases/notes/assignment, AI gateway, reports and exports, **public social listening** (Zernio's inbox is owned-account only; listening needs a separate licensed provider).

## Blocking risk: data residency

The brief and MSA treat **Canada-only storage and access of personal information** as a key contract concern.

Zernio is not a pass-through. Evidence checked 2026-10-21:

- [Privacy policy](https://zernio.com/privacy-policy) section 1.2: Zernio "collect[s] and store[s] access tokens and basic profile information" for connected accounts. Those tokens give full API access to each municipal account. For YouTube, tokens are "encrypted at rest", and scheduled content and metrics are stored.
- [Sub-processors](https://zernio.com/subprocessors) (DPA Schedule 2, dated 2026-10-09): primary Postgres database in London (AWS eu-west-2), app hosting on Vercel London plus global edge, media storage on Cloudflare in Western Europe, operational logs at Axiom US East, and several providers "not pinned to one region" (Upstash Redis, Resend, PostHog and others).
- [Multi-tenant guide](https://docs.zernio.com/guides/multi-tenant): deleting an account "deletes its analytics data", so analytics are stored.
- Comments and DMs reach us through Zernio's inbox API and webhooks, so resident messages transit Zernio's infrastructure at least. Whether they are also stored, and for how long, isn't documented.

There's no Canadian region. A Canadian municipal production deployment can't use Zernio unless the client gives written approval for the UK/EU/US processing and the DPA terms are acceptable. Without that approval, the municipal path needs direct platform adapters behind the same `SocialGateway` interface.

This does **not** block the UI mockup, and it doesn't block a non-municipal pilot.

## Decision (proposed)

### 1. UI mockup (now)

1. **Deploy the current buildless prototype as mockup v0** after Product Director approval. It is already interactive and passes the dry-run, so it costs nothing to ship.
2. **Rebuild the UI in the production frontend stack** behind a typed API client with a **mock adapter**. The mock adapter's resource shapes mirror Zernio's (profiles, accounts, posts, comments, conversations, analytics), so the same screens later call our backend unchanged.
   - Recommended frontend: **React + TypeScript + Vite SPA, TanStack Router + TanStack Query, Tailwind CSS v4, shadcn/ui, Lucide**. A logged-in operations tool doesn't need SSR or SEO, and a static SPA deploys anywhere, including the mockup host.
   - Alternative: Next.js (as in the brief) if we want one full-stack app. It adds server runtime to what is, for the mockup phase, a static site.
   - Tests: Vitest for logic, Playwright for the dry-run (already in `source/tests/e2e`).

### 2. Production backend (after the mockup is accepted)

- **TypeScript modular monolith**: Fastify (or NestJS if the team wants its structure) + Drizzle ORM + PostgreSQL.
- **pg-boss** (Postgres-backed jobs) instead of Redis + BullMQ: one less service per municipality instance, and enough throughput for 18 to 100 accounts.
- **`SocialGateway` interface** with `ZernioGateway` as the first implementation. Direct platform adapters remain possible later (for example, if residency rules out Zernio for a client).
- **We own the schedule.** Approved posts wait in our queue and are sent to Zernio as "publish now" at their due time. We don't hand Zernio a future `scheduledFor`. That keeps approval gating and emergency pause enforceable on our side, with nothing pre-queued at the vendor when a pause is triggered.
- Webhooks from Zernio land in our inbox tables; a scheduled health check covers missed webhooks.
- One Zernio team (and API key) per municipality deployment, matching the one-instance-per-municipality isolation model. A billing pause on one team then can't affect another municipality.
- Media in private S3-compatible storage (Canadian region); we pass Zernio short-lived URLs at publish time.

### Effect on estimates (planning only)

Social integrations drop from about 100 to 200 h to about 30 to 60 h (gateway, webhooks, connect flow, error mapping). Inbox sync and analytics ingestion shrink too. Auth, RBAC, approvals, audit, media, listening, AI and reporting are unchanged.

## Consequences

- Faster path to a working pilot; one vendor for 6+ networks and ads.
- New vendor dependency and lock-in risk, contained by the `SocialGateway` boundary.
- Residency, DPA and platform-app attribution (whether posts show as "via Zernio") must be answered before any municipal proposal relies on it.

## Questions for the Product Director

1. Accept Zernio for the pilot path, subject to a DPA and region check? (Recommended: yes, behind the gateway interface.)
2. Frontend: Vite SPA (recommended) or Next.js?
3. Backend framework: Fastify (recommended, lighter) or NestJS (brief default)?
4. Deploy mockup v0 now to `mockup.ngynsolutions.com`? (Recommended: yes; it gives us the client comment workflow.)
