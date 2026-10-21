# Build report: MOCKUP-V1-ENGAGEMENT

- Work item: `MOCKUP-V1-REBUILD`, review section 1 of 5 (app shell + Engagement)
- State: `BUILT_AWAITING_REVIEW`
- Date: 2026-10-21
- Run it: `cd web && npm install && npm run dev`, then open http://localhost:5173

## Scope implemented

### App shell (shared by every section)

- Accepted menu grouping with collapsible sections and a collapsible icon rail (tooltips and labels kept).
- Screens from later sections are visible in the menu with a "Next" tag and a "Not rebuilt yet" page.
- Navigation is filtered by the current user's functions.
- Topbar: page title, **View as** (demo administrator plus 30 fictional staff, testing only, not login), light/dark toggle.
- **Emergency pause banner** across every page while publishing is paused (reason, who, when).
- Reset demo data (restores the fictional baseline in this browser).
- Per-user preferences for theme, text size, contrast, reduced motion and focus are wired in. The full My Preferences screen comes with the Settings section.
- Phone layout: drawer navigation, no horizontal scroll at 390px.

### SOC

- Four stat tiles: impressions, engagement, average sentiment, publishing health.
- Last 5 aired attempts with health, and next 5 scheduled posts (paused or expired-token states shown).
- 7-day chart with Impressions / Engagement / Sentiment tabs, hover tooltip, and a daily values table. Missing sentiment days show "No samples" and the line breaks; nothing is filled in.
- Angry and negative open conversations (score −50 or lower) with type filter, simulated score, confidence, responding owner. Each row opens the conversation in the inbox.
- Keyword cloud; selecting a word searches the inbox.
- Trending posts with credited sample photos.
- Admin only: emergency pause and resume (reason required, audited), Next update and timed 12-second demo updates that change real demo records, and the social update feed.
- "Process next demo publication" for users with publish permission. It is blocked by the pause and by expired connections.

### Inbox & Comments

- Filters: network, type, sentiment, category, owner, status, search. Deep links from the SOC work (`?c=`, `?q=`, `?sentiment=`).
- List shows priority, sentiment and category, plus owner.
- Detail view:
  - full thread and the post a comment was left on;
  - per-network capability note (from Zernio docs, marked unverified);
  - simulated classifier score and confidence ("Unavailable" when missing, never neutral);
  - staff overrides for owner, sentiment, category and priority (E02);
  - internal notes;
  - reply draft with a mock AI suggestion that shows confidence and basis (E04);
  - Review & resolve confirmation, and reopen.
- The owner list only offers people with inbox permission on that channel. Resolve re-checks it.

### Social Listening (new; v0 only had a placeholder)

- Topics with keywords, 7-day mention count, negative share and alert flag.
- Coverage warning: owned-account comments versus sources that need a licensed provider.
- Per topic:
  - mention volume bar chart and table;
  - sentiment split;
  - source coverage list tagged "Owned account" or "Licence needed";
  - alerts (negative share or volume) checked against sample data when saved, with mute and unmute;
  - mention list with source filter and placeholder source links.
- Create topic.

## Changes from v0 to review

1. **Seed permissions are role-based.** In v0 almost every staff user had only `content.create` and no channels, so "View as" showed little. Each role now gets its usual functions and its department's channels. There are deliberate edge cases:
   - Sofia Patel: viewer with no channels;
   - Lucas Bell: invited, not active;
   - Owen Baker: 311 responder who also covers the Communications accounts;
   - Lily Green: Communications creator through a group role only;
   - Theo Wright: 311 approver through a group role only.
2. Seed text is varied (24 conversation templates across 7 categories, 14 post templates) instead of one repeated message.
3. Account names are more realistic (for example "Harbourview Snow & Roads", "harbourview.transit"). All are still fictional.
4. Inbox adds a category taxonomy (Roads, Transit, Recreation, Permits, Waste, Emergency, General) and per-network capability notes.
5. Post rows open a read-only post preview. Editing and approval come with the Content section.
6. Timed demo updates stop when you leave the SOC page. In v0 they ran globally. Reduced motion turns them off.

## Checks run

- `npm run typecheck`: clean
- `npm test`: 7/7 (permission rules: function AND account, group scope, cross-group isolation, unlink ends a group role, ad roles grant no channel, suspended users have no access)
- `npm run dry-run`: **29/29**, zero page errors. It covers menu grouping, pause/resume, demo updates, chart switching, SOC to inbox deep link, assign/note/suggest/resolve, listening alert and topic creation, viewer without channels, responder scoping, an out-of-scope deep link that stays hidden, light theme, collapsed rail and 390px layouts.
- Screenshots: `.dry-run/web/`

## Known gaps

- The bundle is about 580 KB (182 KB gzip). That's fine for a mockup; code splitting comes later.
- No keyboard-only or screen reader pass yet, beyond semantic markup and labels.
- Sample photos are 5 Unsplash images (same as v0).

## Questions for the Product Director

1. Is the role-based seed (change 1) the right default for demos?
2. Should keyword clicks search the inbox (current), or open Social Listening?
3. Inbox priority (Normal/High/Critical) is kept from v0. Keep it, given that SOC deliberately has no ticket metrics?
