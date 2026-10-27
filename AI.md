# AI operating guide: NGYN Social Operation Center

This repository is the source of truth for the NGYN Social Operation Center (SOC): a municipal social media management product. Chat messages, agent memory, local files and the hosted demo don't count as decisions until they are recorded here and pushed to `main`.

## Current phase

**Phase 1: UI mockup.** Build and deploy a coherent, interactive, clearly fictional UI mockup. No production backend, real social connections, real AI calls, real invitations or real spend. See `NEXT-WORK.md` for the active task.

## Required reading order

Before doing any work, read these files completely in this order:

1. `AI.md` (this file)
2. `NEXT-WORK.md`: the single active task and queue
3. `REQUIREMENTS.md`: what the product must do and the mockup status of each item
4. `docs/ARCHITECTURE.md`: how the current prototype is wired (load order matters)
5. `docs/adr/`: accepted and proposed decisions
6. `docs/handoff/CLAUDE_HANDOFF.md` and `docs/handoff/BUILD_BRIEF.md` when touching a domain rule
7. The latest report in `docs/dry-runs/`

If two files conflict, stop and record the conflict in the work item's report. Don't pick a version from chat history.

## Roles

- **Product Director (the user):** sets priority, accepts UI direction, approves every deployment, external connection and stack decision.
- **Implementation agent (Claude, Codex or another agent):** builds only the `DO_NEXT` item, writes a build report, runs tests and the dry-run, pushes. Never marks its own work accepted, deployed or live.
- **Reviewer (Codex or the Product Director):** reviews the report and output, records one consolidated list of changes per round.

## Workflow states

`DO_NEXT`, `IN_PROGRESS`, `BUILT_AWAITING_REVIEW`, `REVISION_REQUIRED_R1..R3`, `WAITING_FOR_DIRECTOR`, `APPROVED_COMPLETE`, `DEPLOYED_UNVERIFIED`, `DEPLOYED_VERIFIED`, `BLOCKED`, `QUEUED`.

Only one item may be `DO_NEXT` or `IN_PROGRESS` at a time unless the Product Director approves parallel work. After three review rounds with blocking issues, set `WAITING_FOR_DIRECTOR`.

## Non-negotiable product rules

These come from the handoff and the Product Director. Don't change them without a recorded decision.

1. **Original product.** Don't fork, copy or modify Postiz or any other product's code or licensed design kits.
2. **Honest simulation.** Every mock, synthetic metric, simulated AI score and mock connection is visibly labelled. Never present fake social success, synthetic analytics or a mock connection as live functionality.
3. **Humans approve everything external.** AI drafts and advises; a person approves every post, reply and spend. No autonomous publishing.
4. **Access model.** Function permissions and account assignments are separate. A function grant alone never reveals or authorizes an unassigned channel or ad account. New users and newly linked channels grant nothing by default. Group roles are scoped per group.
5. **Emergency pause** blocks all pending publishing until an authorized resume, and is always audited.
6. **SOC is a social operations view, not a ticket dashboard.** No ticket priorities, case backlog or SLA metrics on the SOC screen. Case-style work lives in Inbox & Comments.
7. **Menu grouping** (Engagement / Social Channels & Content / Advertising / Insights / Settings) is accepted. Preserve it; the dry-run checks it.
8. **Fictional demo identity.** The demo municipality is "Harbourview" and is fictional. Never show a real municipality, client, procurement number or real resident data in the UI. Stock photos are credited and marked as illustrative.
9. **Accessibility.** WCAG-aligned work is expected, but never claim AODA/WCAG compliance or certification. Personal display preferences live under My Preferences only.
10. **Copy style.** No em dashes or en dashes in UI or marketing copy.
11. **People and agents follow the same rules.** The product is meant to be driven by the customer's ChatGPT through our MCP server (ADR 0002, proposed). An agent acts for a named person with that person's permissions, cannot approve its own or its delegate's work, and has no way to spend. Nobody approves or returns something they wrote.
12. **Administrator power is the "Administrator access" function,** never the role label.

## Engineering rules for mockup v1 (`web/`)

- Screens call `src/api/hooks.ts` only. Permission checks live in `src/mock/api.ts` at each action, mirroring a real backend, and use `src/domain/permissions.ts`.
- Every change runs `npm run typecheck`, `npm test` and `npm run build && npm run dry-run` in `web/`. Add a dry-run step for each new interaction.
- The rebuild is reviewed one menu section at a time (see `NEXT-WORK.md`). Don't start the next section before the current one is reviewed.

## Engineering rules for connectors (`connectors/`)

- Connectors are the only code that calls a real social network. Phase 1 exception, recorded in ADR 0003: the Bluesky connector, on a developer machine, with a **test account only**.
- Credentials live in a git-ignored `.env`, never in the browser, the repo, chat or logs.
- Each connector enforces the product rules itself (named approver, emergency pause, ALT text, audit). Unit tests use a fake client and no network; live checks are opt-in scripts.

## Engineering rules for prototype v0

- `source/dist/` is the editable source. `NGYN_Municipal_Social_Platform.html` at the root is a **build output**; regenerate it with `npm run build`, never hand-edit it.
- Script and stylesheet order in `source/dist/index.html` is load-bearing: later files reassign globals defined by earlier ones. Don't merge scripts into one block or reorder them without a refactor task.
- Keep browser storage keys and data shapes backward compatible, or add a migration (see `docs/ARCHITECTURE.md`).
- Every change runs `npm test` and `npm run dry-run`. Add a unit test or a dry-run step for each new behavior or fixed bug.
- No network calls other than the existing Unsplash image URLs. No API keys, tokens or secrets in the repo, ever.

## Build report

For each work item, create `docs/work-items/<ID>/BUILD-REPORT.md` with: scope implemented, files changed, tests and dry-run results (counts), screenshots path, known gaps, and open questions for the Product Director. Set the item to `BUILT_AWAITING_REVIEW` in `NEXT-WORK.md` and push.

## Git

- Pull `main` before starting. Small focused commits. Never force-push `main`.
- A push or a passing dry-run does not mean approved or deployed.
- Deployment (any public or shared URL) needs explicit Product Director approval per deployment, recorded in `NEXT-WORK.md`.

## Folder map

| Path | Purpose |
| --- | --- |
| `AI.md` | Agent rules and workflow |
| `NEXT-WORK.md` | Active task, queue, latest handoff |
| `REQUIREMENTS.md` | Requirements with mockup status |
| `docs/ARCHITECTURE.md` | Current prototype architecture and target architecture |
| `docs/adr/` | Architecture decision records |
| `docs/PLATFORM_CAPABILITY_MATRIX.md` | Evidence-backed per-platform capability status |
| `docs/dry-runs/` | Dated browser dry-run reports |
| `docs/handoff/` | Original Codex handoff and build brief (reference, read-only) |
| `connectors/` | Real network connectors, run locally (Bluesky first, ADR 0003); see each README |
| `web/` | **Mockup v1** (React + Vite). All new UI work goes here; see `web/README.md` |
| `docs/work-items/` | Build reports per work item and review section |
| `source/dist/` | Prototype v0 source (HTML/CSS/JS), kept as reference |
| `source/tests/` | Unit tests (`node --test`) and `e2e/dry-run.cjs` |
| `NGYN_Municipal_Social_Platform.html` | Built single-file mockup |
