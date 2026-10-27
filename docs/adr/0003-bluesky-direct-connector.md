# ADR 0003: Bluesky through our own connector

- Status: **ACCEPTED for a local test connector** (Product Director, 2026-10-27: "do it"). Production use waits for `STACK-DECISION-001`.
- Related: ADR 0001 (stack and Zernio), ADR 0002 (agent access via MCP).

## Context

Bluesky's API (AT Protocol) is open: no app review, no paid tier, and an app password is enough for a single account. Zernio would add a vendor that stores tokens outside Canada (ADR 0001) for a network we can reach directly. Bluesky is also 6 of the 18 demo channels.

## Decision

1. Build a Bluesky connector in `connectors/bluesky`, using `@atproto/api` (pinned 0.24.3). It is a plain Node module with a narrow `BlueskyClient` seam, so the same code can later sit behind the backend's `SocialGateway`.
2. Credentials stay server-side. The connector reads an app password from a git-ignored `.env`. The browser never sees it.
3. The connector carries the product rules itself, so they hold even if a caller is wrong: a named approver on every post, reply and delete; the emergency pause blocks publishing and replies; ALT text on images; the 300 grapheme limit; deletes only on the connected account; an audit line for every write; metrics Bluesky doesn't have are `null`, not zero; resident text is marked untrusted.
4. For now it runs only on a developer machine, on `127.0.0.1`, for the mockup's origin, with a **test account only**. No deployment and no municipal account.

## Consequences

- The mockup still uses mock data. Wiring the Inbox, Composer and Analytics to the connector is a separate work item (`BLUESKY-WIRE-UP`).
- Residency: posts and replies are public on the AT Protocol network. The account's data lives on its PDS (bsky.social is run by Bluesky in the US). The app password and the audit log stay on our machine. A municipality could later use a self-hosted PDS in Canada.
- Bluesky has no webhooks. The inbox is polled, and DMs (a separate chat service) are not built.
- App passwords are a single-account tool. A multi-municipality product should move to AT Protocol OAuth, which needs a public client metadata URL, so it waits for a hosted backend.
