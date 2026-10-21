# Progress log: MOCKUP-V1 sections 3, 4 and 5

- Status: **PAUSED by the Product Director, 2026-10-21.** Code is written but **not yet browser-tested** and not reviewed.
- Instruction before the pause: "continue build for all other pages, I will comment later".
- State: `IN_PROGRESS` (nothing here is `BUILT_AWAITING_REVIEW` yet).

## What exists (all 13 menu screens now have a real page; none are placeholders)

| § | Screen | Written | Verified |
| --- | --- | --- | --- |
| 3 | Campaigns (list, campaign editor, ad accounts) | Yes | Typecheck and build only |
| 4 | Analytics & Reports (filters, KPIs, chart, departments, channels, CSV and PDF export) | Yes | Typecheck, build, unit tests for the generator, CSV and PDF writer |
| 5 | Users & Access (list, person dialog with functions, direct access, effective access; add person; simulated invitation) | Yes | Typecheck and build only |
| 5 | Activity Log (filters, pagination) | Yes | Typecheck and build only |
| 5 | My Preferences | Yes | Typecheck and build only |

## Checks run at the pause

- `tsc --noEmit`: clean
- `vitest`: **60/60** (was 29), across 10 files
- `vite build`: succeeds
- **Browser dry-run (`npm run dry-run`): NOT run for these screens.** The existing 127 checks have not been re-run since the changes below, so regressions in sections 1 and 2 are possible (seed data changed, `assignGroupRole` and `updateGroupRole` gained an ad-account argument, the chart label logic changed, demo store version is now 4).

## Design decisions made along the way (please review)

1. **Mock ad accounts were introduced.** The handoff said ad accounts were "planned". Scenario 11 needs somewhere to draft a campaign, so there are 3 mock accounts (Meta, Google, LinkedIn) with a simulated limit each. They have no payment method and no connection.
2. **Ad access follows the channel rules:** function AND an explicitly assigned ad account, directly or through an Asset Group ad-manager role that selects the account. A function alone reveals nothing. Linking an ad account to a group grants nobody access. The old "ad managers grant nothing yet" placeholder in Asset Groups now selects ad accounts.
3. **No-spend guard:** campaigns end at "Approved". "Authorize spend" is permanently disabled and spent is always $0.00. "Request launch" exists only to show the guard: it is always refused and written to the activity log.
4. **Simulated limit check** blocks submitting a campaign whose total plus what other in-review or approved campaigns already commit exceeds the account limit.
5. **Analytics are synthetic and deterministic** (same account and day give the same numbers). A metric a network cannot report is `null` and shown as "Unavailable", excluded from totals, never zero. Per-network availability is a demo assumption from provider docs, unverified.
6. **Exports:** CSV (time series, channel comparison) and a PDF, all marked SAMPLE (a column in CSV, a diagonal watermark on every PDF page). The PDF is produced by a small in-repo writer, not a library. Each export is audited.
7. **Sentiment in analytics** needs inbox permission on the channels, because it comes from conversation text.
8. **Users & Access:** administrator only. New people get no channel or ad access. A role can seed the usual functions but never accounts. The last active administrator can't be demoted or suspended. Making someone an administrator asks for confirmation. Invitations are recorded only; no email is sent.
9. **Activity log seed:** 48 varied fictional events over the last two weeks so the log is not empty.

## Files added or changed since the last pushed commit (`9689e7d`)

- Domain: `ads.ts`, `analytics.ts`, `roles.ts`, `permissions.ts` (ad account checks), `types.ts`, and tests
- Mock API: `api-ads.ts`, `api-analytics.ts`, `api-users.ts`, `api-assets.ts` (ad-manager roles), `seed.ts`, `core.ts`, `db.ts`
- Libraries: `pdf.ts`, `csv.ts` and tests
- Pages: `pages/ads/*`, `pages/insights/Analytics.tsx`, `pages/settings/*`, `GroupPeople.tsx`
- Shell and routing: `nav.ts`, `router.tsx`, chart label thinning in `charts.tsx`

## Next steps when work resumes

1. Run the existing browser dry-run first and fix any regression in sections 1 and 2.
2. Add dry-run checks for: campaign draft, submit, approve, return, blocked launch, over-limit block, ad-manager role scoping; analytics period, network and department filters, unavailable metrics, and CSV and PDF downloads containing SAMPLE; users (add person, no default access, last-admin protection, effective access, invitation), activity log filters and paging, and preferences applying per user.
3. Look at every new screen in the browser at desktop and 390px.
4. Write the build report with questions for the Director, update `REQUIREMENTS.md` (F10, F11, F18, scenarios 7, 11, 12), set the items to `BUILT_AWAITING_REVIEW`, and push.

## Environment note

The Vite dev server (`npm run dev` in `web/`) died when the previous session ended, which is why `http://localhost:5173` stopped working. It was restarted during this session and is running now, but it will stop again when the session ends. The repo is public, so the source is browsable on GitHub. A hosted preview (for example GitHub Pages) has not been set up and needs the Director's approval.
