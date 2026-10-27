# QA Report: NGYN Social Operation Center (mockup v1)

| Field | Value |
|-------|-------|
| **Date** | 2026-10-27 |
| **URL** | http://localhost:5173 (Vite dev server) |
| **Branch** | main |
| **Commit** | c59f83c (2026-10-26) |
| **PR** | none |
| **Tier** | Standard (Full, browser, report only) |
| **Scope** | Full app, tested as real personas: Demo administrator, Maya Chen (Editor), Harper Wood and Emma Roy (Approvers), Noah Grant (Responder), Sofia Patel (Viewer), Liam Brooks (Analyst) |
| **Probe budget / guarded command time** | 900 s configured / unmeasured (probes were not run through the deadline guard, see Limits) |
| **Pages visited** | 14 routes (13 menu pages + composer), plus 5 pages at 375 px |
| **Screenshots** | 36 in `screenshots/` |
| **Framework** | React SPA, hash router (no reload on navigation) |
| **Driver** | gstack `$B` headless Chromium (Aside not installed) |
| **Total session elapsed** | unmeasured |

## Charters

| # | Contract (expected) | Risk | Entrypoint | Persona | Exit | Outcome |
|---|---|---|---|---|---|---|
| C1 | Every menu page loads with content, no console errors | blank/broken screen | each nav link | Admin | all 13 pages visited | Pass |
| C2 | An editor can draft a post and submit it for approval in one sitting without confusion | core task friction | Composer | Maya Chen | submitted or blocked | Pass with friction (ISSUE-001, 002, 011, 012, 013) |
| C3 | An approver finds waiting work and can approve or return it | approval flow unclear | All Content "Needs you" | Harper Wood, Emma Roy | approved | Pass with friction (ISSUE-006) |
| C4 | A responder reads the inbox, understands sentiment and can act | inbox triage unclear | Inbox & Comments | Noah Grant | reply drafted | Pass with friction (ISSUE-003, 004, 005) |
| C5 | A viewer sees only permitted things, no dead ends | leakage / dead ends | SOC, direct URLs | Sofia Patel | pages visited | Pass on guards; product question (ISSUE-008) |
| C6 | Phone width (375 px) usable on key pages | layout overflow | SOC, Inbox, Content, Analytics, Composer | Admin | screenshots | Pass on overflow; friction (ISSUE-010) |
| C7 | Analytics custom range and exports behave and are clearly SAMPLE | misleading data | Analytics | Liam Brooks | export menu opened | Pass |

Isolation: the browser-local demo store in the headless profile only. The target is local, so demo mutations (submit, approve) were allowed. Nothing external was contacted.

## Health Score: 89/100 (provisional, Performance not tested, Accessibility partial)

| Category | Score | Basis |
|----------|-------|-------|
| Console | 100 | 0 console errors on every page and after every flow |
| Links | 100 | All 13 menu routes resolve |
| Visual | 84 | 2 medium |
| Functional | 100 | Every core flow completed; guards held |
| UX | 50 | 4 medium, 6 low |
| Performance | not scored | not tested |
| Content | 89 | 1 medium, 1 low |
| Accessibility | 100 (provisional) | Only form labels, channel checkboxes and dialog focus were checked |

Score = (100×.15 + 100×.10 + 84×.10 + 100×.20 + 50×.15 + 89×.05 + 100×.15) / .90 = 89.

Reading: the product works. What hurts is friction a real municipal staff member would feel on the first day.

## Top 3 Things to Fix

1. **ISSUE-001: The composer's errors appear only in a toast that disappears.** Submitting with a missing title and ALT text showed "Not ready for approval (Facebook): Add an internal title. Add ALT text for the image." in a toast. The fields were not marked, and only Facebook was named although Bluesky was also selected.
2. **ISSUE-005: An inbox reply can't be resolved until a separate owner save.** "Review & resolve" answered "Assign and save a response owner first." The owner has to be chosen in another column and saved with "Save owner & sentiment". There is no "Assign to me".
3. **ISSUE-004: The mock AI reply answers a different complaint.** For "Bus 5 skipped my stop again", the suggestion said "The accessible stop for the Route 8 detour is at the temporary Alder Street shelter."

## Console Health

| Error | Count | First seen |
|-------|-------|------------|
| none | 0 | |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 7 |
| Low | 7 |
| **Total** | **14** |

## Issues

### ISSUE-001: The composer's errors appear only in a toast that disappears

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | http://localhost:5173/#/composer |

**Observed:** Maya Chen chose 2 channels (Facebook and Bluesky) and typed a caption. The internal title and the ALT text were empty, yet "Submit for approval" was enabled. Clicking it showed only the toast "Not ready for approval (Facebook): Add an internal title. Add ALT text for the image." The two fields were not marked as invalid, and Bluesky was not mentioned.
**Expected:** Either the errors sit inline at each field (and the view scrolls to the first one), or Submit is disabled with a visible list of what's missing. Every affected channel is named.
**Evidence:** `screenshots/editor-filled.png` (before), `screenshots/editor-submit.png` (toast)
**Confirmation:** Observed once. Submit then succeeded after both fields were filled ("Submitted for approval: 2 posts").

**Repro:** View as Maya Chen, then Create content, then Choose channels (tick 2, Apply). Type a caption and leave the title and ALT text empty. Click "Submit for approval".

### ISSUE-002: The composer's sticky action bar covers the form

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | http://localhost:5173/#/composer |

**Observed:**
- At 1280×720 the action bar (Discard / Save draft / Submit) sits on top of the Caption field label, and its note "Draft kept in this browser. Nothing is sent." wraps onto 4 lines.
- At 1440×900 it still covers the character-counter line.

**Expected:** The bar never hides form content: the form gets bottom padding equal to the bar's height, and the note stays on one line or is shortened.
**Evidence:** `screenshots/editor-composer.png` (1280), `screenshots/replay-composer-1440.png` (1440)
**Confirmation:** Replayed at a second viewport. Confirmed.

### ISSUE-003: The inbox conversation and reply column is too narrow

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | http://localhost:5173/#/inbox |

**Observed:**
- At 1280 wide, the detail pane's middle column (message plus reply box) shows about 3 words per line, and the suggested reply is cut off inside a small textarea.
- At 1440 the reply box measured 342 px wide.
- Meanwhile the list column and the classifier column each take more room.

**Expected:** The reply is the main task on this screen, so the message and the reply get the widest column. The classifier and owner fields can stack below or sit in a slimmer side column.
**Evidence:** `screenshots/page-inbox.png`, `screenshots/responder-resolve.png`, `screenshots/replay-inbox-1440.png`
**Confirmation:** Replayed at 1440 (342 px measured). Confirmed.

### ISSUE-004: The mock AI reply answers a different complaint

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | content |
| **URL** | http://localhost:5173/#/inbox |

**Observed:** On the DM "Bus 5 skipped my stop again this morning and I was late for work.", "Mock AI suggestion" inserted: "Thanks for letting us know, and sorry for the trouble. The accessible stop for the Route 8 detour is at the temporary Alder Street shelter. We have passed your feedback to Transit operations." The label says it is a per-category template ("Transit").
**Expected:** Even a mock suggestion should fit the message, or say plainly that it is generic ("Generic Transit template"). In a demo, a wrong-topic answer reads as the AI being wrong, and it teaches staff to trust blindly or not at all.
**Evidence:** `screenshots/responder-resolve.png`
**Confirmation:** Observed once.

### ISSUE-005: Resolving a reply needs a separate owner save first

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | http://localhost:5173/#/inbox |

**Observed:** As Noah Grant, clicking "Review & resolve" on an unassigned conversation gave the toast "Assign and save a response owner first." The owner is picked in another column (Response owner), and only "Save owner & sentiment" makes it stick. There is no "Assign to me" shortcut.
**Expected:** One click claims the conversation ("Assign to me"), or resolving it as the current user assigns them automatically, and the action states why it needs an owner.
**Evidence:** `screenshots/responder-resolve.png`
**Confirmation:** Observed once.

### ISSUE-006: Linked posts are approved one channel at a time

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux |
| **URL** | http://localhost:5173/#/content |

**Observed:** One composer submit created 2 posts (Facebook and Bluesky). Harper Wood approved the Bluesky one, and the dialog still showed "Facebook · In review" under "Same post on other channels". There is no "Approve all linked". The rule is stated ("Each channel is approved and scheduled on its own").
**Expected:** A product decision. If approving per channel is intentional, offer "Approve all N channels" with a per-channel review. Otherwise approval doubles for every extra network.
**Evidence:** `screenshots/approver-dialog.png`
**Confirmation:** Observed once.

### ISSUE-007: Stock photos don't match the post captions

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | content |
| **URL** | http://localhost:5173/#/content |

**Observed:**
- "Winter swim lesson registration opens..." shows a city skyline at sunset.
- "Twelve new low-floor accessible buses..." shows an autumn forest path.
- "Leaf collection" (my new post) got the same forest path without my choosing it.

**Expected:** Seed photos fit the topic (a pool, a bus). Mismatched images make the demo look careless to a municipal buyer.
**Evidence:** `screenshots/page-content.png`
**Confirmation:** Observed on several cards in one screenshot.

### ISSUE-008: The Viewer role can see only the SOC

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | http://localhost:5173/#/soc |

**Observed:**
- Sofia Patel (Viewer) gets the menu SOC and My Preferences only.
- Typing the URLs for All Content, the Calendar, Analytics, Campaigns, Users or Activity Log shows "Your demo user does not have this function" (guards work).
- On the SOC, the only enabled controls are the chart tabs.

**Expected:** A product decision. Most people would expect a "Viewer" to read content, the calendar and reports for their channels. Either widen what a Viewer can read, or rename the role (for example "Dashboard only").
**Evidence:** the command output in this run (menu list and the guard text for 6 routes), `screenshots/viewer-analytics.png`
**Confirmation:** Observed on 6 routes.

### ISSUE-009: An unknown address quietly shows the SOC

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux |
| **URL** | http://localhost:5173/#/groups |

**Observed:** `#/groups` (an address someone might guess for Asset Groups) changed to `#/soc` with no message.
**Expected:** A "Page not found" with a link home, so an old or mistyped shared link isn't mistaken for the right page.
**Evidence:** the first page sweep (`== groups: #/soc`), `screenshots/page-groups.png`
**Confirmation:** Observed once.

### ISSUE-010: On a phone, the inbox filters push every message below the first screen

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux |
| **URL** | http://localhost:5173/#/inbox at 375 px |

**Observed:**
- 7 dropdowns plus a search box take the whole first screen. The first conversation starts at about 650 px.
- The header truncates the page name to "Inbox ..." and "Municipal...", because "View as" takes most of the header width.
- The "Most negative first" sort option is cut off.

**Expected:** On a phone, put the filters behind one "Filters" button and keep the list on the first screen.
**Evidence:** `screenshots/mobile-inbox.png`, `screenshots/mobile-soc.png`
**Confirmation:** Observed once. No horizontal overflow on any of the 5 phone pages (scrollWidth was 375 on each).

### ISSUE-011: The placeholder in "Internal title" looks like a real value

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux |
| **URL** | http://localhost:5173/#/composer |

**Observed:** The empty title field shows "Winter parking ban reminder" in grey. It reads as filled in. The submit check then reported "Add an internal title".
**Expected:** A placeholder that is clearly an example ("e.g. Winter parking ban reminder"), or no placeholder.
**Evidence:** `screenshots/editor-composer.png`, `screenshots/editor-submit.png`
**Confirmation:** Observed once.

### ISSUE-012: "Apply 0 channels" can be clicked

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux |
| **URL** | http://localhost:5173/#/composer, "Post to channels" dialog |

**Observed:** With nothing ticked, the main button reads "Apply 0 channels" and is enabled.
**Expected:** Disabled until at least one channel is ticked.
**Evidence:** `screenshots/editor-picker-open.png`
**Confirmation:** Observed once.

### ISSUE-013: The composer attaches a photo the editor never chose

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | http://localhost:5173/#/composer |

**Observed:** Without opening "Choose from Media Storage", the preview already showed a forest-path photo (credited "Kristaps Ungurs on Unsplash"), and the post was submitted with it. It then needed ALT text for an image the editor hadn't picked.
**Expected:** No image until the editor chooses one, or a clearly labelled "Sample image, replace before submitting".
**Evidence:** `screenshots/editor-filled.png`, `screenshots/approver-dialog.png` (the image reached the approver)
**Confirmation:** Observed once.

### ISSUE-014: The "View as" switcher is a 30-name list with no search

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux |
| **URL** | every page (header) |

**Observed:**
- A plain dropdown of 30 people. Finding "the Public Works approver" meant trying names one by one (Emma Roy covers Recreation; it took 6 tries to find Harper Wood).
- The invited user "Lucas Bell · Viewer (Invited)" can be selected.

**Expected:** For a demo, group the list by role and show each person's departments, for example "Harper Wood · Approver · Public Works".
**Evidence:** the approver loop output in this run
**Confirmation:** Observed once.

## What worked well (checked, no issue)

- No console errors anywhere. All 13 menu pages and the composer render.
- Emergency pause asks for confirmation and needs a reason.
- Backend refusals work: a Viewer gets a clear message on 6 restricted routes.
- Separation of duties: the author's draft went only to the Public Works approver queue (Harper Wood saw 2, Emma Roy saw 0).
- Custom date range: a backwards range shows "The start day must be on or before the end day. Showing the last valid range."
- Exports list CSV and PDF with SAMPLE labelling.
- No horizontal overflow at 375 px.

## Fixes Applied

None. This was a report-only run (/qa-only).

## Deferred Tests (proposals, not written)

#### ISSUE-001: composer validation surfaces at the fields
**Precondition:** an editor with 2 channels selected, a caption, and an empty title and ALT text. **Action:** Submit for approval. **Expected:** the title and ALT fields are marked invalid and both channels are named.
Value: protects=editors see what blocks a submit; fails_when=errors exist only in a toast; why_new=dry-run checks ALT-required via toast only; seam=none

#### ISSUE-005: one-step claim and resolve
**Precondition:** an unassigned conversation and a responder. **Action:** Review & resolve. **Expected:** the conversation is assigned to the current user, or an inline "Assign to me" is offered.
Value: protects=responders resolve without a separate owner save; fails_when=resolve needs a saved owner first; why_new=no dry-run step for an unassigned resolve; seam=none

#### ISSUE-012: Apply is disabled with 0 channels
Value: protects=no empty destination apply; fails_when=Apply 0 channels enabled; why_new=not covered; seam=none

## Limits (honest coverage)

- I did not run probes through the gstack deadline guard (`gstack-qa-deadline`) or write a per-probe `exploration-NNN.json` checkpoint. The evidence is the command outputs in this session's transcript and the 36 screenshots. Timing is unmeasured.
- Not tested: Performance; a full keyboard-only or screen-reader pass; Social Listening, Channels, Asset Groups, Media Storage, Calendar drag and drop, Campaigns and Users flows (loaded and screenshotted only); light theme; PDF and CSV file contents.
- Most findings were observed once. ISSUE-002 and ISSUE-003 were replayed at a second viewport.
- The run changed browser-local demo data in the headless profile only (2 posts submitted, 1 approved). The user's own browser is unaffected.
- Project-state copy (`$GSTACK_STATE_ROOT/projects/...`): skipped because this session has no resolved gstack state directory. No learning store was written because none was authorized.
