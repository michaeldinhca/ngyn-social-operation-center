# NGYN Municipal Social Platform — handoff for Claude

Snapshot: October 21, 2026. This package captures the current interactive prototype, including local changes not present in the last hosted deployment.

## Start here

1. Read `NGYN_Municipal_Social_Platform_Codex_Build_Brief.md` as the product source of truth.
2. Open `NGYN_Municipal_Social_Platform.html`. All application CSS and JavaScript are embedded in this one file. Online sample photos still require internet access.
3. Prefer serving it over localhost for predictable localStorage, IndexedDB and clipboard behavior: run `node serve.cjs` in this directory, then visit `http://127.0.0.1:4173/`. No dependency installation is needed.
4. Inspect `source/dist/` for the editable modular source and `source/tests/` for the tests.
5. Use `manifest.json` to verify the combined HTML and source hashes.

The combined file contains multiple inline script elements intentionally. Preserve their order and boundaries: the current app uses global declarations and sequential overrides. Concatenating everything into one script changes function hoisting and can break startup.

## What this product is

A standalone, original municipal social media management platform. It must not fork or modify Postiz. The intended production stack is Next.js/React/TypeScript, NestJS, PostgreSQL, Redis/BullMQ and private Canadian-region object storage, with one isolated deployment per municipality.

**The delivered implementation is presently a buildless HTML/CSS/JavaScript prototype, not that production stack.** It uses browser-local storage and mock workflows. There is no real authentication, backend RBAC, social integration, AI gateway, mail service or durable server audit log.

The user values a coherent, realistic, highly interactive UI. Keep external API operations mocked unless separately authorized and verified. Never present fake social success, synthetic analytics or a mock connection as live production functionality.

## Accepted UI direction

- NGYN charcoal/lime branding: roughly `#151813` and `#D0FC70`, plus a light theme.
- Restrained enterprise UI inspired by Glow UI's public reference; the licensed Figma kit was not imported.
- Readable typography: roughly 14–15 px body/navigation, larger headings.
- Outline navigation icons, collapsible sections, and an icon-only rail with labels/tooltips.
- Real free Unsplash sample photography, credited with source links and marked as illustrative locations. Do not imply these are real Harbourview assets.
- Personal theme, text size, contrast, reduced-motion and focus preferences live under the current user's Preferences only. No workspace-wide AODA configuration.
- The GHL accessibility kit reference was not available locally. Do not claim it was followed or that AODA compliance is certified.

## Required menu grouping — preserve this

1. **Engagement:** SOC, Inbox & Comments, Social Listening.
2. **Social Channels & Content:** Social Channels, All Content, Publishing Calendar, Media Storage, Asset Groups.
3. **Advertising:** currently a planned campaign entry; details remain to be designed.
4. **Insights:** Analytics & Reports.
5. **Settings:** Users & Access, Activity Log, My Preferences.

Navigation is filtered by demo function permissions. “View as user” is a deliberate testing/impersonation control, not authentication.

## Domain and access rules

### Users

- Create a person using name and login email, optionally record a simulated invitation.
- Function permissions and account assignments are separate. New users have no account access by default.
- A function grant alone must never reveal or authorize an unassigned social channel or ad account.
- Independent direct permissions are distinct from Asset Group roles. Removing a group role must not revoke unrelated direct permissions.
- Group creator/approver grants are scoped per channel; a creator in group A who approves in group B must not gain approval rights in A.

### Independent Social Channels

- Create the channel first, separately from any group; it begins unlinked.
- Supported mock choices: Facebook, Instagram, Bluesky, LinkedIn, YouTube and X.
- Each channel owns its connection health, simulated token expiry, and mock reauthorization metadata.
- Link existing channels to an Asset Group as a second action. Unlink before moving to another group in the current single-group-membership model.
- Creating/linking a channel must not automatically grant users access.
- Expired connections block simulated queue processing; no real token is acquired or stored.

### Asset Groups

- Group channels under a shared brand/direction, with space for ad accounts later.
- Delete requires the separate `assets.delete` permission; management permission alone is insufficient.
- Deleting a group only unlinks channels. Preserve channel IDs, tokens/connection metadata, posts, conversations and independent user grants.
- Group-specific roles end with the group. Deleted group metadata is archived in the demo store; there is no restore UI yet.
- People & access has separate content creator, content approver and ad manager assignments. Accounts must be explicitly selected; newly linked channels are not automatically added.
- Ad-manager roles can currently be recorded, but no ad accounts are implemented, so they grant no ad-account scope or spend authority.

### Brand & direction

- One master direction per Asset Group; many subordinate guideline sets.
- Master contains multiple named logo versions, a palette of exactly two or three hex colours, typography, voice, mood, tone and non-negotiable DO/DON'T rules.
- Each guideline set combines written guidance and **its own** visual references. They are edited together, not as detached top-level libraries.
- A complete, reviewed package needs a name, written purpose/direction and at least one visual reference. Updating master rules requires renewed review.
- Reference canvases: square 1080×1080, portrait 1080×1350, tall portrait 1080×1440, vertical 1080×1920, landscape 1200×630, widescreen 1920×1080. These are sample working canvases, not verified platform requirements.
- Compiled brief previews always include master rules before guideline additions, logos/palette and selected visuals. No AI call is made.
- Human attestation is implemented. Automated semantic conflict detection or guaranteed adherence by a future model is **not** implemented.

### Brand Voice

- Create by website URL reference or a written brand description, plus optional context.
- Website mode validates HTTPS but does not fetch the page. Both paths create an editable generic mock voice draft.
- User reviews voice, mood, tone and audience before saving.
- Apply reviewed profiles to a guideline without removing its visuals; applying a voice marks that guideline for renewed review.

## Implemented interactive screens

### SOC — social management, not a ticket platform

The user explicitly rejected ticket-style priorities, case backlog and SLA metrics in SOC. The current redesigned screen contains:

- Last five published/failed attempts with delivery health.
- Next five scheduled posts, ordered by requested publish time.
- Negative/angry comments and DMs, simulated AI sentiment score/confidence, source channel and responding staff member.
- Highlight keyword cloud derived from accessible demo text.
- Trending published posts ranked by synthetic engagement.
- Seven-day impressions, engagement and average sentiment charts, with a readable daily values table.
- Prominent emergency publishing pause/resume and queue enforcement.
- Manual Next update and timed 12-second mock updates that change actual demo records, engagement samples and publication states.

All scores and analytics are visibly synthetic. No live platform analytics or model is connected. Sentiment ranges from −100 to +100; missing samples display unavailable, not fabricated neutral values. Network/account visibility filtering must remain intact.

### Single-post composer

- Full screen with editor left and destination-shaped previews right.
- Multi-channel account selection within the user's create-content scope.
- Shared caption/comment mode; customization toggle reveals network tabs. Each network keeps its own caption, follow-up comment and format planning label.
- Turning customization off returns to shared content without discarding variations.
- Stock photo choices, local photo upload, ALT text, brand/guideline context and mock AI drafting.
- Draft autosave in browser; explicit Save Draft and Submit for Approval.
- One logical batch produces linked per-channel variations using `batchId`.
- Feed/Reel/Story are mock planning labels. Video uploading in this composer is not implemented; platform format support and character limits remain unverified.
- Human review/approval precedes separate scheduling. Publishing is disabled externally.

### All Content / Inbox

- Network/status/search filters, load-more cards and approximate native layouts.
- Draft edit → review → approve/return → schedule workflow.
- Inbox/comment filtering, sentiment override, explicit response owner, internal notes, mock suggestions, saved reply drafts, reviewed resolution and reopen.
- SOC routes conversations to Inbox & Comments; do not turn SOC back into a ticket dashboard.

### Media Storage

- Folder management, search, sorting, type filter, grid/list views and multi-select.
- Metadata: name, type, actual dimensions when known, upload size when known, ALT text, tags, review status, owner/account scope and replacement-version metadata.
- Local upload/replace is implemented using IndexedDB blobs. Supported file types: PNG/JPEG/WebP/GIF, MP4/WebM and PDF, up to 20 MB each.
- Rename, move to folder, edit details, approve/reject, recoverable trash/restore.
- Remote stock samples open the original source; uploaded local blobs have a download action.
- Demo links use `#media=<id>` and require that browser's local data. They are not public asset URLs.
- Reuse approved images in the composer; current local composer-image limit is 600 KB.
- Canva/Drive controls are explicitly mock integration states.

## Architecture of this prototype

`source/dist/index.html` loads the following files sequentially. Later modules wrap/reassign earlier global functions. Preserve order until intentionally refactoring:

| File | Main responsibility |
| --- | --- |
| `app.js`, `direction.js`, `groups.js` | Original shell, legacy demo and visual direction; mostly superseded UI |
| `users.js` | User directory, direct function/account grants |
| `assets.js` | Asset groups, mock channel records, sample profile artwork |
| `operations.js` | Base navigation, content, inbox, preferences, emergency queue, audit and brand boards |
| `navigation.js` | Icons, collapsible menu, stock-photo sources and visual-reference hooks |
| `channels.js` | Independent connections, token metadata, linking and permissioned group deletion |
| `brand-packages.js` | Multi-logo master, two/three-colour palette, integrated guide+visual sets |
| `composer.js` | Single-post editor, network variations and preview hooks |
| `media-storage.js` | Library, IndexedDB blobs, media workflow and composer reuse |
| `brand-voice.js` | Brand Voice flow and final requested menu grouping |
| `group-people.js` | Scoped group roles and effective permission helpers |
| `soc-dashboard.js` | Final social-focused SOC and simulated update stream |

CSS files follow similar layered overrides. This is fast prototype scaffolding with technical debt, not a recommended production architecture. Prefer a controlled component/state refactor over adding further chains of global overrides.

## Browser persistence

Important keys/databases include:

- `ngyn-demo`, `ngyn-groups-v1`: legacy seed/demo state.
- `ngyn-user-access-v2`: direct user functions and channel/ad assignments.
- `ngyn-asset-groups-v1`: groups, independent channels, connection metadata, group role assignments and archived groups.
- `ngyn-operations-v1`: posts, conversations, events, emergency pause, brand boards/voices and synthetic SOC stats.
- `ngyn-media-metadata-v1`: media metadata/folders/trash.
- IndexedDB `ngyn-media-files-v1`, object store `files`: uploaded/replaced blobs.
- `ngyn-preferences-<user>` and `ngyn-navigation-<user>`: personal display/menu settings.
- `ngyn-single-composer-<user>`: single-post working draft.

The baseline is 18 social accounts, 30 fictional staff, 80 conversations, 42 content posts and 20 stock-media records. Tests performed in the hosted browser may have added local records. **This export contains seed/source code, not the user's browser data or uploaded media.** A newly served origin starts with baseline data; optional X accounts can be added in the UI.

## Verification and known gaps — read before claiming completion

Last full automated run: **14 tests passed**:

```sh
cd source
node --test tests/workflow.test.cjs tests/channel-lifecycle.test.cjs tests/group-media.test.cjs tests/soc.test.cjs
```

Browser-verified flows include SOC panels/chart switching/manual updates, requested menu grouping, folder creation/list view, media trash/restore, Brand Voice description → review → save, group role assignment, channel creation → linking → group deletion without losing the connection, and composer shared/network variation persistence.

Outstanding verification/issues:

1. **Group-derived content visibility fix is packaged but was not deployed or browser-retested yet.** The hosted browser showed five permitted posts but still rendered a legacy “No channel access” message because a view guard checked only direct `user.channels`. The local `operations.js` fix now checks effective account access. Recheck this first.
2. **Media upload is implemented but not browser-confirmed.** A generated PNG fixture was passed through the file chooser, but the test did not complete successfully and the file was not found afterward. Investigate file chooser/async upload timing and IndexedDB errors before claiming uploads work. Fixture generator: `source/tests/generate-upload-fixture.cjs`; fixture: `source/tests/fixtures/media-upload-demo.png`.
3. A full browser regression of the combined HTML has not been completed. Syntax/embedding checks are run by the bundler; localhost browser infrastructure previously could not reach the local server from the tool environment.
4. Media replacement/download, multiple-logo uploads, deeper group-role revoke tests and full keyboard/screen-reader testing need additional browser coverage.
5. Calendar currently reuses a filtered content/schedule view. Social Listening, Advertising and Analytics remain explicitly planned screens; SOC's synthetic graphs do not make those integrations complete.
6. Audit is mutable browser data. Permissions are client-side demo logic. There is no production auth, encryption/token vault, queue worker, server storage, backup/restore or Canadian-region deployment review.
7. Some legacy seed conversation owners lack assigned channel permissions. Resolution correctly checks owner permissions, so those assignments may need correction in Users & Access.
8. Saving a shared composer draft after changing selected destinations may retain prior draft variations for deselected channels; investigate/prune safely without modifying approved/published variants.
9. Synthetic graphs distribute sample totals over days. They must never be promoted to production reports.

## Source versus deployed version

Hosted demo: `https://ngyn-municipal-demo-2026.minh-dnd.chatgpt.site/`.

Last confirmed deployed source commit: `1f07ce2e890ec8b1fe1e96a56da371e23809f17a`. It includes the SOC redesign and the previously pending menu/media/voice/group-role screens. The combined export also includes the subsequent local group-visibility fix and PNG upload-test fixture files. Do not assume this single HTML is byte-identical to the hosted deployment.

Do not deploy, message users, connect real accounts or send real invitations merely because this handoff describes those future features. Continue the user's authorized UI work, keeping all external transmission and AI publishing human-controlled.

## Recommended next work

1. Run the package and confirm the accepted SOC/menu against the user's screenshots.
2. Fix/retest the two outstanding checks above: effective group access display and file upload.
3. Add regression coverage for media selection/replacement/trash, cross-group role isolation, and master-rule review invalidation.
4. Consolidate globals into components/state modules with explicit permissions at action boundaries. Preserve the current interaction design and data shape/migrations.
5. Before production implementation, complete the brief's architecture/database/milestone/privacy/API-feasibility deliverables. Verify each social capability from primary platform evidence; do not infer support from SDKs or the current mock UI.

## Filesystem guardrails

The original workspace is a local mirror of the ChatGPT project “Custom WebApp.” Every file under `sources/` is read-only reference material. Never edit, rename, move or delete synced source files. Preserve unrelated changes. The package contains no tokens, Git credentials, production secrets or personal browser data.
