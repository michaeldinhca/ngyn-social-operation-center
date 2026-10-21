# Build report: MOCKUP-V1-CHANNELS-GROUPS

- Work item: `MOCKUP-V1-REBUILD`, review stop 2a (Social Channels + Asset Groups)
- State: `BUILT_AWAITING_REVIEW`
- Date: 2026-10-21
- Run it: `cd web && npm run dev`, then open http://localhost:5173

## Scope implemented

### Social Channels

- Connections table:
  - every channel in your scope, with Asset Group (or Unlinked), simulated connection health, token expiry and how many people can access it;
  - filters for network, group, connection status and search;
  - summary chips: connected, expiring, expired, unlinked.
- A callout states the rule: creating or linking a channel grants nobody access.
- **Add social channel:** pick Facebook, Instagram, Bluesky, LinkedIn, YouTube or X, then name, handle and simulated expiry.
  - The channel is created unlinked with no access.
  - A non-admin creator is told they won't see it until an admin assigns it.
- **Manage:**
  - edit the simulated token expiry, or **Mock reconnect** (+60 days, no real token);
  - **Who has access**, with each person shown as a direct assignment or a named group role;
  - that network's capabilities.
- **Platform capabilities** view:
  - per-network support taken from the Zernio docs, marked Listed, Partial, Not available or Unknown;
  - labelled unverified.
- Health is computed from the expiry date on every read, so expiry moves with the clock.

### Asset Groups

- Group list shows channel count, people and guidelines reviewed. Only groups whose every linked channel is in your scope are shown.
- Header actions:
  - **Edit details** (name, colour, description);
  - **Link channels**: one group per channel; channels in other groups are locked with "unlink there first";
  - **Delete group**: needs `assets.delete` and typed DELETE. It unlinks channels and keeps them, ends group roles, keeps direct grants, and archives the group.
- Read-only banner when you can view a group but not edit it.
- **Channels tab:** linked channels with health, and unlink. Unlinking also removes that channel from this group's roles.
- **People & access:**
  - content creators, content approvers and ad managers, each with explicitly selected channels (nothing preselected);
  - edit each person's channels, or remove the role;
  - ad managers are recorded but grant no scope or spend, since no ad accounts exist yet.
- **Brand direction, master:**
  - brand name and typefaces;
  - up to 8 named logo versions, with four generated fictional SVG marks seeded and PNG, JPEG, WebP or SVG uploads up to 600 KB kept in the browser;
  - a palette of exactly 2 or 3 colours (picker plus hex);
  - voice, mood, tone, and DO and DON'T rules;
  - saving rule changes warns first, then sends every reviewed set and voice back to review.
- **Brand direction, guideline sets:**
  - name, purpose, voice additions and additional DO and DON'T rules;
  - the inherited master rules shown read-only;
  - the set's **own visual references**: pick one of 6 canvases and one of 5 credited sample photos, plus a note.
  - Review attestation only works when the package is complete: name, purpose and at least one visual.
  - **Brief preview:** compiled brief with master rules first, then guideline additions, voice profile and visuals. "No AI call" label; JSON download only when reviewed.
- **Brand voices:**
  - Create from an HTTPS website reference (validated, never fetched) or a written description, with up to 500 characters of optional context.
  - Review and edit the mock draft (voice, mood, tone, audience) with the master rules shown, then attest.
  - Apply a reviewed voice to a guideline set. The set keeps its visuals and goes back to review.
  - Removing a voice also clears it from any set using it.

## New demo permissions

- Administrators also hold `channels.manage`, `assets.manage` and `assets.delete`.
- **Leo Adams** (Communications approver) also has `assets.manage`. He sees only the Communications group, can edit it, and cannot delete it.
- **Isla Moore** (IT editor) also has `channels.manage`. She sees only the 3 IT channels.

## Checks run

- `npm run typecheck`: clean
- `npm test`: 12/12, adding brand rules: palette 2 to 3, package completeness, brief order, master-change detection, HTTPS voice source.
- `npm run dry-run`: **61/61**, zero page errors. 30 new checks cover:
  - add a channel and confirm it starts unlinked with nobody given access;
  - who-has-access, mock reconnect, capabilities;
  - linking, and locked channels from other groups;
  - role assignment that requires an explicit channel;
  - a master change invalidating reviews, then re-review;
  - brief order and download gating, and blocking attestation on an incomplete set;
  - a voice rejecting http, review, and apply invalidating the set;
  - delete with typed confirmation, keeping the channels;
  - scoped group and channel managers;
  - 390px layouts.
- Screenshots: `.dry-run/web/` (`channels*.png`, `channel-manage.png`, `groups-*.png`, `mobile-*.png`)

## Fixed during build

- After adding a guideline set, the selection jumped back to the first set before the refetch landed. It now keeps the new set selected.

## Known gaps

- There's no restore screen for deleted groups yet. They are archived in the store.
- The capability levels are the provider's claims, not tested by us (see `docs/PLATFORM_CAPABILITY_MATRIX.md`).
- Logo uploads are stored as data URLs inside the demo store, so very large logos would bloat browser storage. That's fine for the demo; real storage comes with Media Storage (2c).

## Questions for the Product Director

1. Should non-admin channel managers (like Isla Moore) be able to **create** channels they then can't see until an admin assigns them, or should creating a channel auto-assign it to its creator? The current rule is "creating grants nobody access", following the handoff.
2. Is a typed DELETE confirmation right for group deletion, or is a checkbox enough?
