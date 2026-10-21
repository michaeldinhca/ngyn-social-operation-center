import { isCompletePackage } from '@/domain/brand'
import { canViewAccount, hasAccountFunction, hasFunction } from '@/domain/permissions'
import { nextStatus, postActions, type PostAction } from '@/domain/workflow'
import type { MediaAsset, Network, Post, PostFormat, PostStatus, SocialAccount } from '@/domain/types'
import { NETWORK_FORMATS, NETWORK_LIMITS } from '@/lib/networks'
import { actorName, actorOf, ApiError, audit, ctx, nowISO, uid, wait } from './core'
import { db, persist } from './db'

// Content workflow. Rules enforced here, per channel:
// - Create / edit / submit: content.create. Approve / return: content.approve. Schedule: content.publish.
// - Human approval always precedes scheduling. Nothing is ever sent to a platform.
// - While the emergency pause is on, nothing can be scheduled or rescheduled.

export interface PostMediaRef {
  id: string
  name: string
  photo: number | null
  blobId: string | null
  mime: string
  status: MediaAsset['status']
}

export interface PostRow extends Post {
  account: SocialAccount
  authorName: string
  groupName: string | null
  media: PostMediaRef | null
  actions: PostAction[]
}

function requireContentAccess(s: ReturnType<typeof db>, actorId: string) {
  const a = actorOf(s, actorId)
  const c = ctx(s)
  const ok = a.isAdmin || (['content.create', 'content.approve', 'content.publish', 'reports.view'] as const).some((f) => hasFunction(a, f, c))
  if (!ok) throw new ApiError('Content needs a content or reports permission.')
  return a
}

function toRow(s: ReturnType<typeof db>, actorId: string, p: Post): PostRow {
  const a = actorOf(s, actorId)
  const c = ctx(s)
  const m = s.media.find((x) => x.id === p.mediaId)
  return {
    ...p,
    account: s.accounts.find((x) => x.id === p.accountId)!,
    authorName: s.users.find((u) => u.id === p.createdBy)?.name ?? 'Unknown',
    groupName: s.groups.find((g) => g.id === p.assetGroupId)?.name ?? null,
    media: m ? { id: m.id, name: m.name, photo: m.photo, blobId: m.blobId, mime: m.mime, status: m.status } : null,
    actions: postActions(p.status, {
      create: hasAccountFunction(a, 'content.create', p.accountId, c),
      approve: hasAccountFunction(a, 'content.approve', p.accountId, c),
      publish: hasAccountFunction(a, 'content.publish', p.accountId, c),
    }),
  }
}

export interface PostFilters {
  network: Network | 'All'
  status: PostStatus | 'All'
  group: string
  q: string
  /** Optional ISO range, used by the calendar. Matches scheduledFor or publishedAt. */
  from?: string
  to?: string
}

export function listPosts(actorId: string, f: PostFilters): Promise<{ rows: PostRow[]; canCreate: boolean; paused: boolean; hasChannels: boolean }> {
  const s = db()
  const a = requireContentAccess(s, actorId)
  const q = f.q.trim().toLowerCase()
  const when = (p: Post) => p.scheduledFor ?? p.publishedAt
  const rows = s.posts
    .filter((p) => canViewAccount(a, p.accountId, ctx(s)))
    .filter((p) => f.network === 'All' || s.accounts.find((x) => x.id === p.accountId)?.network === f.network)
    .filter((p) => f.status === 'All' || p.status === f.status)
    .filter((p) => f.group === 'All' || p.assetGroupId === f.group)
    .filter((p) => !q || (p.title + ' ' + p.text + ' ' + p.id).toLowerCase().includes(q))
    .filter((p) => (!f.from && !f.to) || (when(p) && (!f.from || when(p)! >= f.from) && (!f.to || when(p)! < f.to)))
    .map((p) => toRow(s, actorId, p))
    .sort((x, y) => (y.scheduledFor ?? y.publishedAt ?? y.createdAt).localeCompare(x.scheduledFor ?? x.publishedAt ?? x.createdAt))
  const hasChannels = a.isAdmin || s.accounts.some((acc) => canViewAccount(a, acc.id, ctx(s)))
  const canCreate = a.isAdmin || s.accounts.some((acc) => hasAccountFunction(a, 'content.create', acc.id, ctx(s)))
  return wait({ rows, canCreate, paused: s.emergency.paused, hasChannels })
}

export interface PostDetail {
  post: PostRow
  siblings: { id: string; accountName: string; network: Network; status: PostStatus }[]
  paused: boolean
  guideline: { name: string; reviewed: boolean } | null
}

function loadPost(s: ReturnType<typeof db>, actorId: string, id: string) {
  const a = requireContentAccess(s, actorId)
  const p = s.posts.find((x) => x.id === id)
  if (!p || !canViewAccount(a, p.accountId, ctx(s))) throw new ApiError('Post not found or not in your account scope.')
  return p
}

export function getPost(actorId: string, id: string): Promise<PostDetail> {
  const s = db()
  const p = loadPost(s, actorId, id)
  const a = actorOf(s, actorId)
  const group = s.groups.find((g) => g.id === p.assetGroupId)
  const set = group?.brand.sets.find((x) => x.id === p.guidelineId)
  return wait({
    post: toRow(s, actorId, p),
    siblings: s.posts
      .filter((x) => x.batchId === p.batchId && x.id !== p.id && canViewAccount(a, x.accountId, ctx(s)))
      .map((x) => ({ id: x.id, accountName: s.accounts.find((c) => c.id === x.accountId)!.name, network: s.accounts.find((c) => c.id === x.accountId)!.network, status: x.status })),
    paused: s.emergency.paused,
    guideline: set ? { name: set.name, reviewed: !!set.reviewed } : null,
  })
}

function event(s: ReturnType<typeof db>, actorId: string, p: Post, action: Post['history'][number]['action'], note?: string) {
  p.history.push({ id: uid('ev'), at: nowISO(), actor: actorName(s, actorId), action, note })
}

function mediaProblem(s: ReturnType<typeof db>, p: Post): string | null {
  if (!p.mediaId) return null
  const m = s.media.find((x) => x.id === p.mediaId)
  if (!m || m.trashedAt) return 'The chosen media is no longer available. Pick another image.'
  if (m.status !== 'Approved') return `The chosen media "${m.name}" is ${m.status.toLowerCase()}. Use approved media or remove it.`
  return null
}

function submitProblems(s: ReturnType<typeof db>, p: Post): string[] {
  const out: string[] = []
  const acc = s.accounts.find((a) => a.id === p.accountId)!
  if (!p.title.trim()) out.push('Add an internal title.')
  if (!p.text.trim()) out.push(`Write the ${acc.network} caption.`)
  else if (p.text.length > NETWORK_LIMITS[acc.network]) out.push(`${acc.network} caption is over the planning limit of ${NETWORK_LIMITS[acc.network]} characters.`)
  if (!p.alt.trim()) out.push('Add ALT text for the image.')
  const mp = mediaProblem(s, p)
  if (mp) out.push(mp)
  const group = s.groups.find((g) => g.id === p.assetGroupId)
  if (p.guidelineId) {
    const set = group?.brand.sets.find((x) => x.id === p.guidelineId)
    if (!set || !set.reviewed || !isCompletePackage(set)) out.push('The selected guideline is not reviewed. Review it in Asset Groups or clear the brand context.')
  }
  return out
}

export interface PostPatch {
  title: string
  text: string
  comment: string
  format: PostFormat
  alt: string
  photo: number
  mediaId: string | null
}

export function savePost(actorId: string, id: string, patch: PostPatch) {
  const s = db()
  const p = loadPost(s, actorId, id)
  if (!postActions(p.status, { create: hasAccountFunction(actorOf(s, actorId), 'content.create', p.accountId, ctx(s)), approve: false, publish: false }).includes('edit')) {
    throw new ApiError(`A ${p.status.toLowerCase()} post can't be edited here. Return it to draft first, or you don't have create access on this channel.`)
  }
  const acc = s.accounts.find((a) => a.id === p.accountId)!
  if (!NETWORK_FORMATS[acc.network].includes(patch.format)) throw new ApiError(`${acc.network} doesn't offer the ${patch.format} planning format.`)
  Object.assign(p, { title: patch.title.trim(), text: patch.text.trim(), comment: patch.comment.trim(), format: patch.format, alt: patch.alt.trim(), photo: patch.photo, mediaId: patch.mediaId })
  // Editing a failed post sends it back to draft so it goes through review again.
  if (p.status === 'Failed') {
    p.status = 'Draft'
    p.failureReason = undefined
  }
  event(s, actorId, p, 'Edited')
  audit(s, actorId, 'Post edited', `${p.id} ${p.title}`)
  persist()
  return wait(true)
}

export interface TransitionOpts {
  note?: string
  /** ISO instant, for schedule and reschedule. */
  scheduledFor?: string
}

export function transitionPost(actorId: string, id: string, action: Exclude<PostAction, 'edit' | 'delete'>, opts: TransitionOpts = {}) {
  const s = db()
  const p = loadPost(s, actorId, id)
  const row = toRow(s, actorId, p)
  if (!row.actions.includes(action)) {
    throw new ApiError(`You can't ${action} this ${p.status.toLowerCase()} post. It needs the right function on ${row.account.name}.`)
  }
  const next = nextStatus(p.status, action)

  if (action === 'submit') {
    const problems = submitProblems(s, p)
    if (problems.length) throw new ApiError(`Not ready for review: ${problems.join(' ')}`)
    p.failureReason = undefined
    p.reviewNote = null
    event(s, actorId, p, 'Submitted')
  } else if (action === 'approve') {
    const mp = mediaProblem(s, p)
    if (mp) throw new ApiError(mp)
    event(s, actorId, p, 'Approved', opts.note?.trim() || undefined)
  } else if (action === 'return') {
    if (!opts.note?.trim()) throw new ApiError('Add a note so the author knows what to change.')
    p.reviewNote = opts.note.trim()
    p.scheduledFor = null
    event(s, actorId, p, 'Returned', opts.note.trim())
  } else if (action === 'schedule' || action === 'reschedule') {
    if (s.emergency.paused) throw new ApiError('Emergency pause is active. Scheduling is locked until an administrator resumes publishing.')
    if (!opts.scheduledFor) throw new ApiError('Choose a date and time.')
    if (new Date(opts.scheduledFor).getTime() < Date.now() + 5 * 60_000) throw new ApiError('Choose a time at least 5 minutes from now.')
    const mp = mediaProblem(s, p)
    if (mp) throw new ApiError(mp)
    const had = p.status === 'Scheduled'
    p.scheduledFor = opts.scheduledFor
    p.failureReason = undefined
    event(s, actorId, p, had || action === 'reschedule' ? 'Rescheduled' : 'Scheduled', opts.note)
  } else if (action === 'unschedule') {
    p.scheduledFor = null
    event(s, actorId, p, 'Unscheduled')
  }
  p.status = next
  audit(s, actorId, `Post ${action}`, `${p.id} ${p.title} → ${next}`)
  persist()
  const expired = (action === 'schedule' || action === 'reschedule') && row.account.connection.status === 'Expired'
  return wait({ status: next, warning: expired ? `${row.account.name} has an expired connection. The demo queue will block this post until the channel is reconnected.` : null })
}

export function deletePost(actorId: string, id: string) {
  const s = db()
  const p = loadPost(s, actorId, id)
  if (!toRow(s, actorId, p).actions.includes('delete')) throw new ApiError('Only drafts can be deleted, by someone with create access on the channel.')
  s.posts = s.posts.filter((x) => x.id !== id)
  audit(s, actorId, 'Draft deleted', `${p.id} ${p.title}`)
  persist()
  return wait(true)
}

/** All posts of one composer batch the actor can see, for editing in the composer. */
export function getBatch(actorId: string, batchId: string): Promise<PostRow[]> {
  const s = db()
  const a = requireContentAccess(s, actorId)
  const rows = s.posts.filter((p) => p.batchId === batchId && canViewAccount(a, p.accountId, ctx(s))).map((p) => toRow(s, actorId, p))
  if (!rows.length) throw new ApiError('That post group was not found, or is not in your account scope.')
  return wait(rows)
}

// ---------- Composer ----------

export interface ComposerContext {
  channels: (SocialAccount & { groupName: string | null })[]
  groups: { id: string; name: string; guidelines: { id: string; name: string; reviewed: boolean; complete: boolean }[] }[]
  paused: boolean
}

export function composerContext(actorId: string): Promise<ComposerContext> {
  const s = db()
  const a = actorOf(s, actorId)
  const c = ctx(s)
  const channels = s.accounts.filter((acc) => hasAccountFunction(a, 'content.create', acc.id, c))
  const groupIds = new Set(channels.map((x) => x.assetGroupId).filter(Boolean))
  return wait({
    channels: channels.map((x) => ({ ...x, groupName: s.groups.find((g) => g.id === x.assetGroupId)?.name ?? null })),
    groups: s.groups.filter((g) => groupIds.has(g.id)).map((g) => ({ id: g.id, name: g.name, guidelines: g.brand.sets.map((x) => ({ id: x.id, name: x.name, reviewed: !!x.reviewed, complete: isCompletePackage(x) })) })),
    paused: s.emergency.paused,
  })
}

export interface ComposerVariant {
  text: string
  comment: string
  format: PostFormat
}

export interface ComposerInput {
  batchId: string | null
  channelIds: string[]
  title: string
  /** One resolved variant per selected channel id. */
  variants: Record<string, ComposerVariant>
  photo: number
  mediaId: string | null
  alt: string
  assetGroupId: string | null
  guidelineId: string | null
  submit: boolean
}

export interface ComposerResult {
  batchId: string
  ids: string[]
  created: number
  updated: number
  removedDrafts: number
  keptLocked: string[]
  submitted: number
}

export function saveComposer(actorId: string, input: ComposerInput): Promise<ComposerResult> {
  const s = db()
  const a = actorOf(s, actorId)
  const c = ctx(s)
  if (!input.channelIds.length) throw new ApiError('Select at least one channel you can post to.')
  for (const id of input.channelIds) {
    if (!hasAccountFunction(a, 'content.create', id, c)) throw new ApiError('You can only post to channels where you have create access.')
  }
  const channels = input.channelIds.map((id) => s.accounts.find((x) => x.id === id)!)
  if (input.assetGroupId && channels.some((ch) => ch.assetGroupId !== input.assetGroupId)) {
    throw new ApiError('Selected channels must belong to the chosen brand group, or clear the brand context.')
  }
  const batchId = input.batchId ?? uid('batch')
  const existing = s.posts.filter((p) => p.batchId === batchId && canViewAccount(a, p.accountId, c))
  const actor = actorOf(s, actorId).user?.id ?? 'user-0'

  // Validate before changing anything, so a rejected save leaves no partial batch.
  const drafts: Post[] = []
  for (const ch of channels) {
    const v = input.variants[ch.id]
    if (!v) throw new ApiError(`Missing content for ${ch.network}.`)
    if (!NETWORK_FORMATS[ch.network].includes(v.format)) throw new ApiError(`${ch.network} doesn't offer the ${v.format} planning format.`)
    const old = existing.find((p) => p.accountId === ch.id)
    if (old && old.status !== 'Draft' && old.status !== 'Failed') continue
    const post: Post = {
      id: old?.id ?? `POST-${Math.floor(Math.random() * 9e5 + 1e5)}`,
      batchId,
      accountId: ch.id,
      title: input.title.trim(),
      text: v.text.trim(),
      comment: v.comment.trim(),
      format: v.format,
      status: 'Draft',
      photo: input.photo,
      mediaId: input.mediaId,
      assetGroupId: input.assetGroupId,
      guidelineId: input.guidelineId,
      history: old?.history ?? [],
      reviewNote: null,
      alt: input.alt.trim(),
      scheduledFor: null,
      publishedAt: null,
      createdAt: old?.createdAt ?? nowISO(),
      createdBy: old?.createdBy ?? actor,
      metrics: null,
    }
    if (input.submit) {
      const problems = submitProblems(s, post)
      if (problems.length) throw new ApiError(`Not ready for approval (${ch.network}): ${problems.join(' ')}`)
    }
    drafts.push(post)
  }

  let created = 0
  let updated = 0
  const ids: string[] = []
  for (const post of drafts) {
    const i = s.posts.findIndex((p) => p.id === post.id)
    if (i >= 0) {
      s.posts[i] = post
      updated++
      event(s, actorId, post, 'Edited')
    } else {
      s.posts.unshift(post)
      created++
      event(s, actorId, post, 'Created')
    }
    if (input.submit) {
      post.status = 'In review'
      event(s, actorId, post, 'Submitted')
    }
    ids.push(post.id)
  }

  // Channels deselected since the last save: remove their stale drafts. Posts already in review,
  // approved, scheduled or published are never touched.
  let removedDrafts = 0
  const keptLocked: string[] = []
  for (const old of existing) {
    if (input.channelIds.includes(old.accountId)) {
      if (old.status !== 'Draft' && old.status !== 'Failed') {
        keptLocked.push(`${s.accounts.find((x) => x.id === old.accountId)!.name} (${old.status})`)
        ids.push(old.id)
      }
      continue
    }
    if (old.status === 'Draft') {
      s.posts = s.posts.filter((p) => p.id !== old.id)
      removedDrafts++
    } else keptLocked.push(`${s.accounts.find((x) => x.id === old.accountId)!.name} (${old.status})`)
  }

  audit(s, actorId, input.submit ? 'Posts submitted for approval' : 'Posts saved as drafts', `${input.title.trim()}: ${created} created, ${updated} updated, ${removedDrafts} stale draft(s) removed. Batch ${batchId}.`)
  persist()
  return wait({ batchId, ids, created, updated, removedDrafts, keptLocked, submitted: input.submit ? drafts.length : 0 })
}

/** Mock AI drafting. Uses the chosen brand context; never calls a model. */
export function aiDraft(actorId: string, input: { topic: string; assetGroupId: string | null; guidelineId: string | null; networks: Network[] }): Promise<{ text: string; basis: string[]; perNetwork: Partial<Record<Network, string>> }> {
  const s = db()
  const a = actorOf(s, actorId)
  if (!a.isAdmin && !hasFunction(a, 'content.create', ctx(s))) throw new ApiError('Drafting needs the content creation function.')
  const topic = input.topic.trim()
  if (!topic) throw new ApiError('Tell the assistant what the post is about.')
  const group = s.groups.find((g) => g.id === input.assetGroupId)
  const set = group?.brand.sets.find((x) => x.id === input.guidelineId)
  if (input.guidelineId && (!set || !set.reviewed || !isCompletePackage(set))) throw new ApiError('Review the complete guideline package before using it for drafting.')
  const basis = group ? [`Master voice: ${group.brand.master.voice}`, ...group.brand.master.dos.slice(0, 2).map((x) => `DO: ${x}`), ...(set ? [`Guideline: ${set.name}`] : [])] : ['No brand context selected. Generic plain-language draft.']
  const clean = topic.replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
  const base = `${clean.charAt(0).toUpperCase()}${clean.slice(1)}. Find details and next steps on the municipal website.`
  const perNetwork: Partial<Record<Network, string>> = {}
  for (const n of input.networks) {
    const limit = NETWORK_LIMITS[n]
    perNetwork[n] = base.length <= limit ? base : `${base.slice(0, limit - 1).trimEnd()}…`
    if (n === 'LinkedIn') perNetwork[n] = `${base} Staff are available at 311 for questions.`
  }
  return wait({ text: base, basis: [...basis, 'Mock draft: verify every fact before use. No model was called.'], perNetwork })
}
