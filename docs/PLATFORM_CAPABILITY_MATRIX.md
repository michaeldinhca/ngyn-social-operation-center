# Platform capability matrix

Required by the brief (section 8) before any production capability is promised. **Nothing here has been tested by us yet.** Each cell records its evidence source.

Legend: **S** supported, **SA** supported with approval or paid API, **U** unsupported, **?** unknown or not yet tested. Suffix `(Z-doc)` means "Zernio documentation claims it, not verified by NGYN".

Last updated: 2026-10-21. Source: https://docs.zernio.com/platforms/compare

| Capability | Facebook | Instagram | Bluesky | LinkedIn | YouTube | X |
| --- | --- | --- | --- | --- | --- | --- |
| Publish text | S (Z-doc) | ? | S (Z-doc) | S (Z-doc) | U | S (Z-doc) |
| Publish image | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | U | S (Z-doc) |
| Publish video / reel / short | S (Z-doc) | S (Z-doc) | S, limited (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) |
| Stories / carousels | ? | S (Z-doc) | ? | ? | ? | ? |
| Alt text on media | ? | ? | ? | ? | ? | ? |
| Read comments on owned posts | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | SA, polling must be on (Z-doc) |
| Reply to comments | S (Z-doc) | S (Z-doc) | ? | S, public only (Z-doc) | S, public only (Z-doc) | ? |
| Hide / delete comments | ? | ? | ? | ? | ? | ? |
| Read / send DMs | S (Z-doc) | S (Z-doc) | S, no attachments (Z-doc) | ? | U (Z-doc) | SA, dm scopes (Z-doc) |
| Post analytics | S (Z-doc) | S (Z-doc) | S (Z-doc) | S, partial metrics (Z-doc) | S (Z-doc) | S (Z-doc) |
| Account / audience analytics | ? | S (Z-doc) | ? | ? | S, demographics (Z-doc) | ? |
| Comment / message webhooks | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) | S (Z-doc) |
| Public keyword listening (non-owned) | ? | ? | ? | ? | ? | ? |
| Data processing region (via Zernio) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) | UK/EU/US, not Canada (Z-doc) |

## Still to verify (per platform)

- App review or approval needed (Zernio's app vs our own app), and how posts are attributed.
- Rate limits (team-wide in Zernio), retries, idempotency behavior.
- Token expiry and reconnect behavior (`account.disconnected`).
- API costs passed through (X).
- Data retention and deletion of post history and inbox messages.

Public listening across news, blogs and forums needs a separate licensed provider; it's out of Zernio's scope.
