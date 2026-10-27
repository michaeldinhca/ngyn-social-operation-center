# Architecture

## 1. Current prototype (Phase 1 mockup v0)

A buildless HTML/CSS/JavaScript app. All state lives in the browser. There is no server apart from the optional static `serve.cjs`.

```
source/dist/index.html  --(npm run build)-->  NGYN_Municipal_Social_Platform.html  (single file, deployable as-is)
        |                                       + manifest.json (SHA-256 of output and every embedded file)
        +-- 10 stylesheets, 14 scripts, loaded in a fixed order
```

### Script load order is load-bearing

Each later file wraps or reassigns globals defined earlier (for example `group-people.js` replaces `hasAccountFunction` to add group-scoped grants). The build keeps every script as its own `<script>` element; merging them changes hoisting and breaks startup.

| Order | File | Responsibility |
| --- | --- | --- |
| 1 | `app.js` | Original shell, seed data, modal/toast helpers (UI mostly superseded) |
| 2 | `direction.js`, `groups.js` | Legacy visual direction and groups (superseded) |
| 3 | `users.js` | User directory, direct function and account grants, `hasAccountFunction` |
| 4 | `assets.js` | Asset groups, channel records, profile artwork |
| 5 | `operations.js` | Navigation, page router (`renderWorkspace`), content, inbox, preferences, emergency queue, audit, brand boards |
| 6 | `navigation.js` | Icons, collapsible menu, stock photo sources |
| 7 | `channels.js` | Independent channels, connection/token metadata, linking, permissioned group deletion |
| 8 | `brand-packages.js` | Master brand (logos, 2 to 3 colour palette), guideline + visual sets |
| 9 | `composer.js` | Single-post composer, network variations, previews |
| 10 | `media-storage.js` | Media library, IndexedDB blobs, review, trash, composer reuse |
| 11 | `brand-voice.js` | Brand Voice flow; final menu grouping |
| 12 | `group-people.js` | Group-scoped roles and effective permission helpers |
| 13 | `soc-dashboard.js` | Social Operation Center screen and simulated update stream |

### Permission model (client-side demo logic only)

`can(fn)` checks the current user's function grants. `hasAccountFunction(user, fn, 'channels', id)` requires **both** the function **and** an account assignment, directly or through a group role scoped to that group's channels. Admin bypasses. "View as user" switches `viewUser`; it is impersonation for testing, not authentication.

### Browser persistence

| Key | Contents |
| --- | --- |
| `ngyn-demo`, `ngyn-groups-v1` | Legacy seed state |
| `ngyn-user-access-v2` | Direct function and account grants |
| `ngyn-asset-groups-v1` | Groups, channels, connection metadata, group role assignments, archived groups |
| `ngyn-operations-v1` | Posts, conversations, events, emergency pause, brand boards and voices, SOC stats |
| `ngyn-media-metadata-v1` | Media metadata, folders, trash |
| IndexedDB `ngyn-media-files-v1` / `files` | Uploaded and replaced media blobs |
| `ngyn-preferences-<user>`, `ngyn-navigation-<user>` | Personal display and menu settings |
| `ngyn-single-composer-<user>` | Working composer draft |

Seed baseline: 18 social accounts, 30 fictional staff, 80 conversations, 42 posts, 20 stock media records. Changing a stored shape needs a migration or a version bump of the key.

### Testing

- `npm test`: 14 unit tests. They extract functions from the source with `vm` (search markers are function names, so renaming a function can silently break a test's extraction).
- `npm run dry-run`: Playwright drives the built single file through all pages and the key workflows (25 checks). Set `CHROMIUM_PATH` to reuse an installed Chromium.

### Known technical debt

Global override chains, inline HTML string templates, mutable audit log, no module boundaries. Fine for a mockup; the rebuild (section 2) replaces it rather than extending it.

## 2. Target architecture (proposed, see ADR 0001)

```
Browser (React SPA, shadcn/ui)
   |  typed API client
   |-- mock adapter (mockup phase: seeded fixtures, Zernio-shaped resources)
   '-- HTTP adapter (pilot) --> NGYN API (TypeScript modular monolith)
                                 |-- Auth (OIDC/SAML, MFA), RBAC (function x account scope)
                                 |-- Content, approvals, schedule queue (pg-boss), emergency pause
                                 |-- Inbox, cases, notes, audit (append-only)
                                 |-- Media (private S3-compatible, Canadian region)
                                 |-- AI gateway (provider-neutral, human review)
                                 |-- SocialGateway --> Zernio API (publish now, inbox, analytics, webhooks)
                                 '-- Listening provider (separate, licensed)
                               PostgreSQL (one database per municipality instance)
```

Agents: the customer's ChatGPT connects through an MCP server that calls the same service layer as the UI, as a delegate of a named person (ADR 0002, proposed). The mock API in `web/src/mock/` is the draft tool contract.

Key rule: the schedule and the emergency pause live in our database. Zernio only receives a post when it is approved and due.
