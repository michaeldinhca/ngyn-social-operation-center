# Build report: MOCKUP-V1-REMAINING

- Work item: `MOCKUP-V1-REBUILD`, sections 3 to 5 (Advertising, Insights, Settings)
- State: `BUILT_AWAITING_REVIEW`
- Date: 2026-10-24 (written 2026-10-21, paused, then finished and tested)
- Run it: `cd web && npm install && npm run dev`, then open http://localhost:5173. The demo data resets once because its shape changed (store version 4).

With this, **every menu screen is rebuilt**. None is a placeholder any more.

## Scope implemented

### Advertising: Campaigns

- Campaign list with status filter ("In review, 1 need you"), planned budget, spent ($0.00) and a persistent **no-spend guard** banner.
- **Campaign editor:**
  - basics (name, ad account, objective), creative (headline, ad text, optional approved post), audience (area, age range, language, interests), schedule and simulated daily budget;
  - **Budget review** panel: days, total planned, a bar showing the campaign plus what other in-review and approved campaigns already commit against the account's simulated limit, a clearly synthetic impressions and clicks estimate, and a list of what must be fixed before submitting;
  - submit for approval, approve, return to draft with a required note, delete a draft, and a history of every step.
- **Spend guard:** the "Authorize spend" button is permanently disabled. "Request launch" on an approved campaign is always refused with an explanation and written to the activity log. Spent stays $0.00.
- **Ad accounts** tab: three mock accounts (Meta, Google, LinkedIn) with a simulated limit, group link, who has access, and a mock "Add ad account". No payment method, no connection.
- Access follows the channel rules: a function plus an explicitly assigned ad account, directly or through an Asset Group ad-manager role that selects the account. A function alone reveals nothing. Linking an ad account to a group grants nobody access.
- Asset Groups: the ad-manager role now selects ad accounts (it used to say "grants nothing yet").

### Insights: Analytics & Reports

- Filters: period (24 hours hourly, 7 and 30 days daily, 12 weeks, 12 months, 4 quarters, 3 years), network and department. Filters fall back to "All" when a different person is selected under "View as".
- Six KPI tiles with change versus the previous period and how many channels report each metric: impressions, reach, engagements, followers gained, engagement rate, average sentiment.
- **Unavailable is never zero.** Bluesky has no impressions or reach, and LinkedIn, YouTube and X have no reach, so those values show "Unavailable", are excluded from totals, and an explanation lists which channels are left out.
- Chart with a metric switch, hover values and a full data table; department comparison; a per-network "what can be reported" table; a sortable channel comparison with bars.
- Sentiment appears only for channels where you have inbox access.
- **Export:** a time-series CSV, a channel-comparison CSV (every row has `data_status = SAMPLE`, unavailable cells are empty) and a PDF with totals, previous-period change, unavailable notes and tables, with a diagonal **SAMPLE** watermark on every page. The PDF is written by a small in-repo writer. Each export is audited.
- Everything comes from a deterministic synthetic generator and is labelled as such. The source and refresh time are on screen and in the PDF.

### Settings

- **Users & Access** (administrators only): 30 people with search and role, department and status filters. A person dialog with Profile, Functions (grouped, with descriptions), Direct access (channels and ad accounts) and **Effective access** (what they can actually see and do, with each source: direct assignment or named Asset Group role).
  - Add person: login email checked and unique; starts with the usual functions for the role if you choose, and **never any channel or ad account access**.
  - A warning appears when functions have no accounts to act on.
  - The last active administrator can't be suspended or demoted; making someone an administrator asks for confirmation.
  - Invitations are simulated: recorded in the log, no email, and "Mark as accepted" for the demo.
  - Every permission change is written to the activity log with what changed.
- **Activity Log:** filters for text, person, category and date range, paging at 25, with 48 seeded fictional events plus everything done in the demo. States plainly that a real log is append-only and server-side.
- **My Preferences:** theme, text size, higher contrast, reduced motion and stronger focus. Changes apply immediately, are saved per person under "View as", and carry no compliance claim. A live preview shows the effect.

## Bugs found and fixed while testing

1. Saving a new campaign closed the editor instead of opening the saved campaign.
2. The analytics filters stayed on a department the next person could not see (for example "Transit" carried over to a Customer Service analyst), which produced an empty page.
3. The preference switches referred to their labels with an id containing a space, so a screen reader would not have announced their names.
4. An approved campaign still said "Ready to submit for approval".
5. The Users list was cramped on a phone; it now shows a one-line summary per person.

## Checks run

- `npm run typecheck`: clean
- `npm test`: **60/60** across 10 files. New this stretch: ad rules (days, totals, commitments, the limit guard, validation, estimates), ad account permissions, analytics generator and buckets, CSV, PDF (valid structure, watermark on every page, escaping, paging) and roles and functions.
- `npm run dry-run`: **193/193**, zero page errors (127 existing plus 66 new). The new checks cover:
  - Campaigns: draft, over-limit block, submit, approve, return needing a note, refused and audited launch with $0.00 spent, mock ad accounts, a group ad-manager seeing only their account, a direct assignment, and no Campaigns nav without the functions.
  - Analytics: period, network and department filters, Unavailable not zero, a CSV marked SAMPLE with empty cells for unavailable values, a valid watermarked PDF, audited exports, a scoped analyst, sentiment needing inbox access, and no nav without the reports function.
  - Users: listing and filtering, invalid and duplicate email, a new person with no access, a function alone granting nothing, a direct assignment, audited permission changes, last-administrator protection, and administrator confirmation.
  - Activity Log: paging, category, person, search and date filters.
  - Preferences: apply immediately, per-person, reset.
  - 390px layouts for all six new screens.
- Screenshots: `.dry-run/web/`

## Known gaps

- Analytics are synthetic. Whether each network can really report each metric comes from provider docs and is unverified.
- Charts are SVG with a table alternative. There has been no screen-reader pass, and calendar drag and drop still needs a mouse (the post dialog is the keyboard route).
- The campaign editor has no preview of how the ad looks on the network.
- Ad accounts can be added and limited, but not renamed or deleted, and campaigns have no "archived" state.
- No saved or scheduled reports. Exports are generated in the browser from the report on screen.
- The activity log can be reset with the rest of the demo data.
- Users & Access has no bulk edit, and there is no "remove person" (people can be suspended).

## Questions for the Product Director

1. **Ad accounts:** the handoff said they were planned later. Is it right to model them as mock accounts that belong to Asset Groups, with their own simulated limit, as I did?
2. Should **approving a campaign** require someone other than its author (separation of duties)? Today only the function decides, as with posts.
3. Analytics periods: are the seven periods right (24 hours to 3 years), or should fiscal-year and custom date ranges be added?
4. Should the analytics PDF include a chart image, or are tables enough for the demo?
5. **Users:** should "Administrator" stay a role label that grants everything, or become a function that can be given without the label?
