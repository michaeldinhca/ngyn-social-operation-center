NGYN Municipal Social Platform — Codex Build Brief
Purpose: Build a municipal-first social media management application from scratch for Halifax-style requirements and reuse across Canadian municipalities. Do not use or fork Postiz. Use established product interfaces as interaction inspiration, not copies. This file is a product/engineering handoff, not a claim that all specified APIs are available.
1. Product decisions and boundaries
- One maintained NGYN codebase, deployed as a separate instance per municipality (dedicated database, secrets, storage, social app credentials, configuration, and deployment). No shared multi-tenant data in v1.
- Municipal operators work in one responsive web app; no second back-office portal required.
- Build a real, coherent prototype first with realistic, explicitly fictional demo data and navigable workflows; then implement real integrations one at a time. Every simulation must be visibly labeled. No dummy data in production reports.
- Priority is accessible, reliable municipal operations, not consumer influencer features. AI advises/drafts; humans approve external posts and responses.
- Establish integration feasibility and privacy first. Never represent an unsupported platform operation as working.
- This brief intentionally omits client-specific identifiers from the UI and reusable architecture. The underlying procurement requirements were sourced from HRM-2026-0368, Appendix A (pp. 20–21) and Appendix C; contract considerations from the supplied professional-services MSA.
2. Technology architecture
Layer	Selected stack / approach
Frontend	Next.js + React + TypeScript; Tailwind CSS, shadcn/ui, Lucide
Backend	NestJS (TypeScript), modular monolith, documented REST APIs + OpenAPI
Database	PostgreSQL; migrations and explicit data ownership boundaries
Jobs	Redis + BullMQ; retry policies, dead-letter handling, idempotency and cancellation
Media	Private S3-compatible object storage deployed in Canada, controlled access, lifecycle policies
AI	Provider-neutral gateway with configurable model, Canadian data-handling review, prompt/version logs without exposing secrets
Integrations	Independent adapter per platform; OAuth / platform-native authentication as permitted; encrypted token vault
Identity	OIDC/SAML-ready, unique accounts, MFA for privileged users, session control
Deployment	Docker, Canadian region, instance-level isolation, automated backups and restores
Quality	TypeScript strict, lint, formatting, unit/integration/e2e tests, security scans, CI


Do not prematurely introduce microservices or Kubernetes. Keep the app modular so individual social adapters and listening data providers can be swapped.
3. Product information architecture / screens
Primary sidebar: Overview; Resident Inbox; Publishing Calendar; Content & Approvals; Social Listening; Analytics & Reports; Media Library; Paid Advertising; Emergency Controls; Administration.

Global UI: municipality selector/configuration (deployment specific), account/department filters, search, notification centre, user profile, account health/integration indicators, accessibility and audit breadcrumbs. Desktop-first operational density with a usable mobile-responsive layout.

Design reference: Sprout Social for enterprise dashboard and analytics; Agorapulse for inbox and assignments; Hootsuite for content planning; Government of Canada Design System for accessible form/navigation conventions (without copying federal branding). Implement original UI using shadcn/ui; configurable municipality branding, dark/light contrast where feasible, WCAG-aligned keyboard focus/labels/semantic controls.
4. Functional backlog — RFP baseline (P0 unless noted)
ID	Module	Requirement / acceptance target
F01	Social accounts	Centralized management for 8 Facebook pages, 2 Instagram accounts, 6 Bluesky accounts, 1 LinkedIn account, 1 YouTube account in demo; expandable without fixed limits; optional X integration compatibility. Each connection shows authorized capabilities, expiry, errors and sync health.
F02	Accounts and users	Minimum 30 unique users; administrator, approver, editor, responder, analyst, viewer with customizable account, department and action-level permissions. No unauthorized cross-account access.
F03	Identity/audit	Unique authentication, secure sessions, privileged MFA, permission change audits, attribution on every publish/reply/approval.
F04	Content calendar	Monthly view across all users/accounts/channels; switch calendar/list; filters, draft/scheduled/published/failed status, editing, queue inspection.
F05	Composer/scheduling	Rich post composer; text/photos/videos per supported channel; content adaptations, preview, accessible descriptions, scheduling and retry on rate limit; timezone-safe publish time.
F06	Approvals	Draft -> Submit -> Review -> Approve/Reject -> Schedule/Publish; optional multi-step review by department; approval history; prevent non-approvers from publishing.
F07	Resident inbox	Consolidate available incoming public comments/posts and DMs for managed accounts with near-real-time polling/webhooks where available; preserve origin link and sync status. Clearly surface unsupported platform actions.
F08	Assignment/case	Assign items to individual users/departments, priority/status/categories, internal notes, queue/SLA indicators, notifications, reply drafting, follow-up audit.
F09	Reply workflow	Draft, review and send replies only when provider API allows; threaded conversation history; duplicates/idempotency safeguards. No real send from demo mode.
F10	Analytics	Reach, impressions, engagements, audience growth, sentiment (where supported or derived), cross-account comparisons; hourly/daily/weekly/monthly/quarterly/annual date ranges; indicators marked unavailable if the API cannot provide them.
F11	Reporting	Filterable dashboards, export CSV/PDF, traceable data source and refresh timestamp, comparisons and department reports. Never fabricate metrics.
F12	Listening	Keyword/hashtag/topic/account mentions tracking across permitted sources; source-coverage map, sentiment and configurable alerts/dashboards; broad coverage of news/blogs/forums is desirable and subject to provider licensing.
F13	Mobile	Responsive application for staff to view inbox, approve posts, monitor alerts and perform approved tasks on phones.
F14	Media library	Central approved photo/video/asset repository with metadata, tags, search, versioning, reviewer approval, access control, reuse and storage policies.
F15	Accessibility	ALT text authoring per image/channel where supported, captions/transcripts workflow, accessible content prompts, contrast/keyboard/screen reader testing.
F16	Emergency	Global authorized pause/cancel of pending scheduled posts with confirmed queue enforcement, emergency banner, audited reason, notification, and explicit resume workflow. Emergency pause is stated as an asset in the RFP but treated as core differentiator in our product.
F17	Support/operations	Admin diagnostics, user onboarding, documentation, platform integration health, deployment runbooks, ticket/escalation process and regular product enhancements.
F18	Advertising	P2 / desirable: view or manage paid social campaigns, spend and performance where permitted. Advertising purchasing must never occur without explicit authorization.
F19	X compatibility	P1 / optional: architecture should accommodate reactivating the currently inactive X account without significant redesign; commercial API terms must be assessed.


Important: Public listening is fundamentally different from monitoring owned account comments. Social platform permissions, commercial API licensing, rate limits and product review can prevent some capabilities. Record actual capability status by platform in a matrix. Do not promise universal access.
5. Municipal-specific enhancements (NGYN proposed features, not mandatory source requirements)
ID	Priority	Feature	Behavior
E01	P1	AI-assisted post composer	Plain-language, accessible post drafts and channel variations from human-approved facts; never publish autonomously.
E02	P1	Resident inquiry classification	Categorize into roads, transit, recreation, permits, waste, emergency and configurable departments; staff override.
E03	P1	Intelligent assignment	Recommend department/owner based on topic, channel and workflow; human confirmation/override.
E04	P1	Suggested replies	Generate response drafts with source attribution and confidence indication; require human review before posting.
E05	P1	Sentiment and urgency	Classify sentiment, urgency and emerging issues with uncertainty flags; avoid treating sentiment as ground truth.
E06	P1	Crisis/reputation signals	Detect spikes, trending incidents and unusually negative engagement; staff-configured alert thresholds and verification.
E07	P1	Municipal case tracking	Case IDs, interdepartmental reassignment, escalation, internal notes, due dates, resolution, follow-up.
E08	P1	Report copilot	Human-reviewable daily/weekly/monthly summaries with data lineage and cited source metrics.
E09	P1	Accessibility assistant	ALT text suggestions, caption/transcript drafts, plain-language review, translation drafts; editorial approval.
E10	P1	Knowledge-assisted drafting	Optional approved municipal knowledge base of policies/services/FAQs with provenance and expiration dates.
E11	P1	Audit-grade workflow	Immutable event history, reviewer identity, timestamps, version of approved content, exports and controlled retention.
E12	P2	Public issue heatmap	Categorize location-tagged issues when residents voluntarily provide adequate geographic data; privacy minimization.
E13	P2	Workflow analytics	Response time, queue backlog, assignment throughput, overdue cases and department-level performance.
E14	P2	Emergency templates	Pre-approved response templates, approval chains and bulk scheduling overrides.
E15	P2	Multilingual assistance	Translation drafts and bilingual/multilingual publishing subject to human validation.
E16	P2	External service integrations	Optional integrations with municipal CRM/311, service desk and Open Data; no Odoo dependency.


6. Demo dataset and clickable acceptance scenarios
Build a seeded demonstration mode with no actual vendor API calls, real residents, or real advertising spend. Seed 18 accounts: Facebook 8, Instagram 2, Bluesky 6, LinkedIn 1, YouTube 1. Seed 30 staff users distributed across Communications, Public Works, Recreation, Transit, Customer Service and IT, with realistic roles and channel restrictions. Seed 60–100 sample inbox items, 40+ content posts spanning draft/review/scheduled/published/failed, 20 media assets including some missing ALT text, listening topics, trend samples, 2 campaigns, emergency/audit events, plus historical reports. Dates and names must be fictional and clearly marked.

Make these end-to-end interactions actually work in demo mode (persist through database or browser demo-store; ideally backend DB):
1. Login as demo administrator, editor, approver and responder; verify role-gated navigation and actions.
2. Switch account/department filters; see only permitted content.
3. Create multimedia post; set ALT text; submit for approval; reject/revise/approve; schedule and observe calendar and queue.
4. Open resident inbox; filter by network, sentiment, category and assigned owner; classify/assign, save internal note, draft reply, mark resolved.
5. Trigger AI-style response suggestion in mock mode, edit and approve; never send a real message.
6. View listening topic/keyword dashboard; set alert; drill into sample mentions with sources.
7. Open analytics and change reporting period, network and department; export sample CSV/PDF with SAMPLE watermark.
8. Search media, edit ALT text, approve or reject asset.
9. Trigger emergency pause as administrator; verify scheduled jobs are blocked and editors cannot resume; reauthorize/resume and audit everything.
10. Configure 30 users, roles and account-level permissions; test denied action as viewer.
11. Create advertising campaign draft and review simulated budget, with explicit no-spend guard.
12. Display integration health and limitations for all active networks and potential X.
7. Minimum data model (starting point, refine before migrations)
MunicipalityConfiguration, Department, User, IdentityProviderLink, Membership, Role, Permission, SocialAccount, SocialCredentialReference, ProviderCapability, ProviderSyncJob, ContentPost, PostVariant, MediaAsset, MediaVersion, ApprovalRequest, ApprovalAction, PublishJob, ExternalPublication, Conversation, ExternalMessage, ResidentCase, CaseAssignment, InternalNote, ReplyDraft, ListeningTopic, ListeningSource, ListeningMention, SentimentAnalysis, ListeningAlert, AnalyticsSnapshot, ReportDefinition, ExportJob, AdvertisingCampaign, EmergencyEvent, AIJob, AIModelConfiguration, AuditEvent, Notification, RetentionPolicy.

Include consistent UUIDs, timestamps/time zones, actor identity, foreign keys, optimistic locking/versioning and clear deletion/retention policy. Encrypt tokens, never log private messages or secrets by default, and avoid storing more resident information than needed.
8. Integration feasibility spike: mandatory before promising production capability
For Facebook, Instagram, Bluesky, LinkedIn, YouTube, document per platform and per account type:
- Auth model, app verification/review and production approval needed.
- Create/schedule/edit/delete post; photo/video and ALT support.
- Read owned post comments; reply/moderate; read/send direct messages; available webhooks; polling frequency/rate limits.
- Account/post analytics: reach, impressions, audience growth, engagement, sentiment input availability.
- Keyword/topic/public conversation search beyond owned accounts.
- API costs, licensing, data retention, geography of data processing, user-consent restrictions and API limitations.
- Token rotation, retries, outages, idempotency and provider-side post scheduling constraints.
Create a live, evidence-backed PLATFORM_CAPABILITY_MATRIX.md with columns: supported, supported with approval/paid API, unsupported, unknown/not yet tested. Never infer support solely from the presence of an SDK. Social listening across major sites, news and forums may require separate commercial listening/data providers; AI does not bypass these restrictions.
9. Privacy, security, procurement and operational constraints
- Canada-only personal information storage and access unless written direction permits otherwise is a key contract concern under the supplied MSA Privacy Protection Schedule. Review support access, backups, analytics processors, cloud telemetry, AI prompts/model hosting and social-platform API flows. Canada-hosted infrastructure alone is insufficient.
- Strong auditability, RBAC, least privilege, MFA, encryption, credential rotation, backup/restore tests, vulnerability management, logging without sensitive content, incident reporting and retention controls.
- RFP insurance schedule: CAD $2M commercial general liability, $2M professional liability, $5M cyber liability. MSA has a generally higher CGL default but expressly allows the solicitation to specify prevailing amounts; get formal confirmation.
- Contract: initial five years plus five optional one-year extensions; termination-for-convenience and indemnification clauses require legal review. No published budget in supplied RFP.
- Confirm whether the procuring body permits an under-development solution before proposing it. Do not misrepresent prototype screens or synthetic analytics as deployable compliance.
- Accessibility goals: WCAG-aligned UX, keyboard-first workflows, ALT/caption support and accessible exports; test rather than merely asserting compliance.
10. Delivery plan / Codex tasks
Phase 0 — Feasibility: Read this brief; inspect current working directory without overwriting existing projects. Produce architecture decision records (ADRs), dependency/license list, platform capability checklist, privacy/data-flow diagram, risk register, and prioritized issue board. Verify developer app approval path, especially Meta, LinkedIn, Bluesky and YouTube. No large production feature development until feasibility is known.

Phase 1 — Interactive demo: Build full navigation, realistic fictional seed data and all 12 demo workflows. Provide test credentials, startup instructions, tests and honest simulated capability badges. Achieve functional coherent UI rather than static screenshots.

Phase 2 — Core backend: Data model, identity, roles, tenants-as-isolated-instances, accounts, approval and publishing queues, durable audit, media and responsive interfaces.

Phase 3 — Real integrations: Connect first permitted network end-to-end; add remaining networks independently; ensure failures and permission denials are gracefully represented. No fake-success publish states.

Phase 4 — Engagement and listening: Central inbox, assignments/cases, provider-specific replies, sentiment, topic alerts and licensed data sources.

Phase 5 — AI and reporting: Provider-neutral gateway with human oversight, verifiable metrics, historical exports, accessibility features and knowledge-assisted drafting.

Phase 6 — Hardening: Pen testing/security checks, backup restore drills, privacy review, access audit, e2e testing, uptime/runbooks and municipal onboarding.
11. Estimates (planning only; not guaranteed)
#	Area / Workstream	Estimated Hours
1	Architecture & project foundation	30–50
2	Authentication, organizations & permissions	40–70
3	Social platform integrations	100–200
4	Content calendar & publishing	50–90
5	Unified inbox & assignments	70–130
6	Social listening & sentiment	80–160
7	AI features	40–80
8	Analytics & reporting	50–90
9	Administration, audit & emergency controls	40–70
10	Testing, security & deployment	80–140
	Total	580–1,080


Estimates represent supervised engineering time assuming viable APIs, not pure model generation time. Broad commercial listening, legal review, insurance, API licensing and production maintenance are excluded. Historical planning estimate for production-oriented AI-assisted work: 150–400 million model tokens, but highly uncertain; measure actual input/output token use in Codex instead of treating this as a quote. The RFP bid submission was listed for November 9, 2026 at 2 PM Atlantic; a secure production system cannot responsibly be assumed ready by then.