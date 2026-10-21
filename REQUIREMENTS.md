# Requirements

Source: `docs/handoff/BUILD_BRIEF.md` (RFP baseline F01 to F19, NGYN enhancements E01 to E16) and `docs/handoff/CLAUDE_HANDOFF.md` (accepted UI direction and domain rules). This file tracks what the **UI mockup** must show. Production status is tracked separately once Phase 2 starts.

Mockup status values:

- **Done**: interactive and verified by unit tests or the dry-run.
- **Partial**: some of the flow works; gaps listed.
- **Placeholder**: menu entry with a "planned" screen only.
- **Not started**

Status as of 2026-10-21 (dry-run `docs/dry-runs/2026-10-21.md`).

## 1. RFP baseline

| ID | Requirement | Mockup status | Notes / gaps |
| --- | --- | --- | --- |
| F01 | Social accounts: 8 Facebook, 2 Instagram, 6 Bluesky, 1 LinkedIn, 1 YouTube, optional X; each shows capabilities, expiry, errors, sync health | Done | Independent channels, mock token expiry and reauthorization. Capability detail per account is thin. |
| F02 | 30+ users; admin, approver, editor, responder, analyst, viewer; account/department/action-level permissions | Done | Function grants + account assignments + group roles. Department-level scoping is not modelled. |
| F03 | Identity and audit: unique auth, sessions, MFA, attribution | Partial | "View as user" impersonation only (no login). Activity log exists but is mutable browser data. |
| F04 | Content calendar: monthly view, calendar/list switch, filters, queue inspection | Partial | Calendar reuses the filtered content card view. **No month grid yet.** |
| F05 | Composer and scheduling: text/photo/video per channel, adaptations, preview, ALT, timezone-safe scheduling | Partial | Single-post composer with per-network variations and previews. No video upload. Character limits unverified. |
| F06 | Approvals: Draft, Submit, Review, Approve/Reject, Schedule; history; non-approvers blocked | Done | Single-step approval. Multi-step department review not modelled. |
| F07 | Resident inbox: comments, posts, DMs, origin link, sync status | Done | Mock conversations only. Unsupported platform actions not yet surfaced per network. |
| F08 | Assignment/case: owner, department, status, notes, reply drafting | Done | Lives in Inbox & Comments, not SOC (accepted direction). |
| F09 | Reply workflow: draft, review, send only when API allows | Partial | Drafts and reviewed resolution. Sending is disabled by design. |
| F10 | Analytics: reach, impressions, engagement, growth, sentiment, date ranges, unavailable indicators | Partial | SOC shows 7-day synthetic charts. **Analytics & Reports is a placeholder.** |
| F11 | Reporting: dashboards, CSV/PDF export with SAMPLE watermark, data source and refresh time | Not started | |
| F12 | Listening: keywords, topics, mentions, source coverage, alerts | Placeholder | Screen currently titled "Insights preview" (wrong heading). |
| F13 | Mobile: inbox, approvals, alerts on phones | Partial | No horizontal scroll at 390px on SOC, Inbox, Content, Media. Phone task flows not reviewed. |
| F14 | Media library: metadata, tags, search, versions, review, access control, reuse | Done | IndexedDB upload verified in browser 2026-10-21. Replace/download need more coverage. |
| F15 | Accessibility: ALT per image, captions workflow, keyboard and screen reader testing | Partial | ALT required in composer. Captions workflow and screen reader testing not done. |
| F16 | Emergency pause: global pause, banner, audited reason, explicit resume | Done | Verified in dry-run. Notification to staff is mock only. |
| F17 | Support/operations: diagnostics, onboarding, health | Not started | |
| F18 | Advertising (P2): campaigns, spend, no-spend guard | Placeholder | Ad-manager role recordable; no ad accounts. |
| F19 | X compatibility (P1) | Done | X can be added as an independent mock channel. |

## 2. NGYN enhancements (mockup scope)

| ID | Feature | Mockup status |
| --- | --- | --- |
| E01 | AI-assisted post composer (mock drafts, never publishes) | Done (mock) |
| E02 | Resident inquiry classification with override | Partial (sentiment override; category taxonomy thin) |
| E03 | Intelligent assignment suggestions | Not started |
| E04 | Suggested replies with confidence | Done (mock) |
| E05 | Sentiment and urgency with uncertainty flags | Partial (sentiment and confidence shown; urgency not shown) |
| E06 | Crisis/reputation spike signals | Not started |
| E07 | Municipal case tracking | Partial (inside Inbox) |
| E08 | Report copilot | Not started |
| E09 | Accessibility assistant (ALT suggestions etc.) | Not started |
| E10 | Knowledge-assisted drafting | Not started |
| E11 | Audit-grade workflow | Partial (browser-local log) |
| E12 to E16 | Heatmap, workflow analytics, emergency templates, multilingual, 311/CRM | Not started (P2) |

## 3. Accepted domain rules (must hold in every build)

Detailed in `docs/handoff/CLAUDE_HANDOFF.md` "Domain and access rules". Summary:

- **Users:** function permissions and account assignments are separate; new users have no account access.
- **Channels:** created independently and unlinked; linking to an Asset Group grants nobody access; expired connections block the queue.
- **Asset Groups:** deleting needs `assets.delete`; deletion only unlinks channels and ends group-scoped roles; direct grants survive; creator/approver grants are scoped per group.
- **Brand & direction:** one master per group, two or three palette colours, multiple named logos; guideline sets carry their own visuals; master changes force renewed review.
- **Brand Voice:** website URL (validated, not fetched) or description; editable mock draft; human review before use.
- **SOC:** last 5 aired, next 5 scheduled, negative comments/DMs with simulated scores, keyword cloud, trending posts, 7-day charts with a data table, emergency pause, simulated updates. No ticket metrics.

## 4. Mockup acceptance scenarios (brief section 6)

| # | Scenario | Status |
| --- | --- | --- |
| 1 | Log in as admin/editor/approver/responder; role-gated navigation | Partial (View as user, no login screen) |
| 2 | Account/department filters show only permitted content | Done (accounts); departments not modelled |
| 3 | Multimedia post, ALT, submit, reject/revise/approve, schedule, see calendar and queue | Partial (no month calendar) |
| 4 | Inbox filter, classify/assign, note, draft reply, resolve | Done |
| 5 | AI-style suggestion in mock mode, edit and approve, never send | Done |
| 6 | Listening dashboard, alert, sample mentions with sources | Not started |
| 7 | Analytics period/network/department, CSV/PDF export with SAMPLE watermark | Not started |
| 8 | Media search, ALT edit, approve/reject | Done |
| 9 | Emergency pause; editors cannot resume; resume and audit | Done |
| 10 | 30 users, roles, account permissions; denied action as viewer | Done |
| 11 | Ad campaign draft with simulated budget and no-spend guard | Not started |
| 12 | Integration health and limitations for all networks and X | Partial (connection health only; no capability matrix screen) |

## 5. Non-functional (mockup)

- Single static deployable (no server needed) plus optional `serve.cjs` for local use.
- Light and dark themes; 14 to 15 px body text; visible focus; no horizontal page scroll at 390px.
- Zero uncaught page errors in the dry-run.
- No network calls except credited Unsplash images.
