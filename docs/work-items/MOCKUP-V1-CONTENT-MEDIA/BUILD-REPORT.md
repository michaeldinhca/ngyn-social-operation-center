# Build report: MOCKUP-V1-CONTENT-MEDIA

- Work item: `MOCKUP-V1-REBUILD`, review stops 2b and 2c (All Content, Composer, Publishing Calendar, Media Storage)
- State: `BUILT_AWAITING_REVIEW`
- Date: 2026-10-21
- Run it: `cd web && npm run dev`, then open http://localhost:5173 (the demo data resets once because its shape changed)

With stop 2a, every page under **Social Channels & Content** is now rebuilt.

## Scope implemented

### All Content

- Card grid of every post in your channel scope, with a network, status, Asset Group and search filter, and a Load more button (12 at a time).
- "Needs you" shortcuts: awaiting your approval, ready to schedule, returned to draft. They count only posts you can act on.
- Each card shows the channel, format, author, caption, image, and a time or status line.
- **Post dialog** (also opened from the SOC):
  - an approximate native layout for the network (Facebook, Instagram, Bluesky, LinkedIn, YouTube Short, X);
  - status, author, brand context, ALT text, media, follow-up comment, the same post on other channels, and the full history.
  - Actions depend on your function **on that post's channel**:
    - creators: edit in composer, submit, delete a draft;
    - approvers: approve, or return with a required note;
    - publishers: schedule an approved post (Halifax time, at least 5 minutes ahead), reschedule, unschedule, retry a failed post.
  - Warnings for an expired connection, the emergency pause, and media that is no longer approved.

### Composer

- Full screen: editor on the left, live previews on the right with one tab per selected channel.
- **Destinations:** only channels where you can create content. Expired channels are flagged.
- **Content:**
  - internal title; one shared caption, or **Customize for each network** (a tab per network with its own caption, follow-up comment and format label);
  - turning customization off returns to the shared text and keeps the network versions;
  - character counter with planning limits (not verified platform rules) and a clear over-limit message.
- **Mock AI draft:** a topic box that uses the chosen brand rules, shows its basis, and is labelled "No model called".
- **Image:** pick approved media from Media Storage (uploads included) or a credited sample photo. ALT text is required.
- **Brand context:** the Asset Group is chosen automatically when all channels share one; only reviewed, complete guidelines can be selected.
- Autosave in this browser (restored after a reload), **Save draft**, **Submit for approval**. One save creates linked per-channel posts with a shared batch id.
- **Fixed from v0:** deselecting a channel and saving now removes that channel's stale draft. Posts already in review or later are never touched, and you are told which ones were left alone.
- Editing an existing post opens the whole batch in the composer.

### Publishing Calendar

- **Month, week and list** views in America/Halifax, with previous, next and Today.
- Network and status filters. Status colours: approved, scheduled, published, failed.
- **Drag a scheduled post to another day** to reschedule it (keeps its clock time). **Drag an approved post** from the "Needs scheduling" panel onto a day to schedule it at 10:00.
- Dropping on a past day is rejected. During the **emergency pause**, a banner shows, dragging is disabled and the API refuses scheduling, so the lock holds from the calendar and from the post dialog.
- Opening a post gives the same workflow dialog, a keyboard-friendly alternative to dragging. Narrow phones default to the list view.

### Media Storage

- Folders (create, rename, delete: files move to Unfiled and are never deleted), Unfiled, and Trash, with counts.
- Search by name, ALT text or tag; filters for type, review status and **Missing ALT**; sort; grid and list views; select all and bulk actions.
- **Uploads** (PNG, JPEG, WebP, GIF, MP4, WebM, PDF up to 20 MB): stored in this browser's IndexedDB, drag and drop supported, real pixel size read for images.
- **Detail dialog:**
  - edit name, ALT text, tags, folder, and limit the file to channels;
  - approve or reject (approving an image needs ALT text; changing the ALT text of an approved image sends it back to review);
  - **Replace file**, which keeps the old file as a version and needs review again;
  - download (uploads) or the Unsplash credit (samples), and the posts that use it.
- Trash is recoverable. A file used by an unpublished post can't be trashed. Permanent delete only works from the trash.
- Canva and Google Drive are clearly labelled mock integrations. Only approved images can be used in posts.

## Demo data changes

- Posts now carry history, formats, brand context, follow-up comments, and one "returned with a note" draft.
- Scheduled posts spread across the next three weeks at business-hour slots so the calendar has something to show; two approved posts wait for scheduling.
- 20 media assets in 3 folders: most approved, 4 needing review, 1 rejected, 3 images with no ALT text.

## Checks run

- `npm run typecheck`: clean
- `npm test`: **29/29**, adding the workflow rules (who can do what at each status, no skipped steps), Halifax time and DST, and calendar math.
- `npm run dry-run`: **127/127**, zero page errors. 66 new checks cover, among others:
  - paging and filters; approve, a rejected past time, schedule and return;
  - role checks: an editor, a Recreation approver and a viewer;
  - composer autosave and restore, per-network captions kept when customization is off, the over-limit warning, ALT required, linked drafts, the stale-draft fix, submit, editing a saved batch;
  - calendar drag to reschedule and schedule, a rejected past drop, week and list views, the pause lock in the calendar and in the dialog;
  - media: upload and reload, ALT-gated approval, replace and versions, folders and moves, filters, trash and restore, the used-media guard, and an approver reaching Media Storage;
  - 390px layouts for content, composer, calendar and media.
- Screenshots: `.dry-run/web/`

## Known gaps

- Video and PDF uploads are stored but have no preview. Video isn't supported in the composer.
- Character limits and formats are planning values, not verified (see the capability matrix).
- Multi-step department approval isn't modelled. An author can't approve their own post only because the function is separate, not because of an explicit rule.
- Calendar drag and drop needs a mouse. The post dialog is the keyboard route; a screen reader pass hasn't been done.

## Questions for the Product Director

1. Should an approver be blocked from approving **their own** post (separation of duties)? Today only the functions decide.
2. Scheduling uses the demo queue's rule of "at least 5 minutes ahead". Is that the right minimum, or should we allow immediate publishing for approved posts?
3. While the emergency pause is on, you can still write, submit and approve, but not schedule. Should approving be locked too?

## Director answer (2026-10-26)

Question 1 (should an approver be blocked from approving their own post?): **yes.** Done: nobody can approve or return a post they wrote. The post dialog explains it and the API refuses.
