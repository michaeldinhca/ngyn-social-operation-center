import { canViewAccount, hasFunction } from '@/domain/permissions'
import type { DemoState, MediaAsset, MediaFolder, MediaStatus } from '@/domain/types'
import { actorName, actorOf, ApiError, audit, ctx, nowISO, uid, wait } from './core'
import { deleteBlob, putBlob } from './blobs'
import { db, persist } from './db'

// Media Storage. Rules:
// - Browsing needs a content function (create, approve or publish). Managing needs content.create.
// - An asset limited to channels is visible only to people with access to one of them.
// - Only Approved assets can be used in a post. Replacing a file sends it back to review.
// - Trash is recoverable. Uploads are stored in this browser's IndexedDB, never sent anywhere.

export const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf']
export const MAX_BYTES = 20 * 1024 * 1024

function mayBrowse(s: DemoState, actorId: string) {
  const a = actorOf(s, actorId)
  const c = ctx(s)
  return a.isAdmin || hasFunction(a, 'content.create', c) || hasFunction(a, 'content.approve', c) || hasFunction(a, 'content.publish', c)
}

function mayManage(s: DemoState, actorId: string) {
  const a = actorOf(s, actorId)
  return a.isAdmin || hasFunction(a, 'content.create', ctx(s))
}

function mayReview(s: DemoState, actorId: string) {
  const a = actorOf(s, actorId)
  const c = ctx(s)
  return a.isAdmin || hasFunction(a, 'content.approve', c)
}

function visible(s: DemoState, actorId: string, m: MediaAsset) {
  const a = actorOf(s, actorId)
  if (a.isAdmin || !m.channelIds.length) return true
  return m.channelIds.some((id) => canViewAccount(a, id, ctx(s)))
}

function load(s: DemoState, actorId: string, id: string, need: 'view' | 'manage' | 'review' = 'manage') {
  if (!mayBrowse(s, actorId)) throw new ApiError('Media Storage needs a content permission.')
  const m = s.media.find((x) => x.id === id)
  if (!m || !visible(s, actorId, m)) throw new ApiError('Media not found or not in your account scope.')
  if (need === 'manage' && !mayManage(s, actorId)) throw new ApiError('Managing media needs the content creation function.')
  if (need === 'review' && !mayReview(s, actorId)) throw new ApiError('Approving media needs the content approval function.')
  return m
}

export interface MediaFilters {
  folder: string // 'all' | 'unfiled' | 'trash' | folderId
  type: 'All' | 'Image' | 'Video' | 'Document'
  status: MediaStatus | 'All' | 'Missing ALT'
  sort: 'newest' | 'oldest' | 'name' | 'size'
  q: string
}

const kind = (m: MediaAsset) => (m.mime.startsWith('image/') ? 'Image' : m.mime.startsWith('video/') ? 'Video' : 'Document')

export interface MediaRow extends MediaAsset {
  ownerName: string
  usedInPosts: number
}

export function listMedia(actorId: string, f: MediaFilters): Promise<{ rows: MediaRow[]; folders: (MediaFolder & { count: number })[]; counts: { all: number; trash: number; needsReview: number; missingAlt: number }; canManage: boolean; canReview: boolean }> {
  const s = db()
  if (!mayBrowse(s, actorId)) throw new ApiError('Media Storage needs a content permission.')
  const all = s.media.filter((m) => visible(s, actorId, m))
  const live = all.filter((m) => !m.trashedAt)
  const q = f.q.trim().toLowerCase()
  const inFolder = (m: MediaAsset) => (f.folder === 'all' ? true : f.folder === 'unfiled' ? !m.folderId : m.folderId === f.folder)
  const pool = f.folder === 'trash' ? all.filter((m) => m.trashedAt) : live.filter(inFolder)
  const rows = pool
    .filter((m) => f.type === 'All' || kind(m) === f.type)
    .filter((m) => (f.status === 'All' ? true : f.status === 'Missing ALT' ? m.mime.startsWith('image/') && !m.alt.trim() : m.status === f.status))
    .filter((m) => !q || (m.name + ' ' + m.alt + ' ' + m.tags.join(' ')).toLowerCase().includes(q))
    .sort((a, b) => (f.sort === 'name' ? a.name.localeCompare(b.name) : f.sort === 'size' ? (b.bytes ?? 0) - (a.bytes ?? 0) : f.sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.updatedAt.localeCompare(a.updatedAt)))
    .map((m) => ({ ...m, ownerName: s.users.find((u) => u.id === m.ownerId)?.name ?? 'Unknown', usedInPosts: s.posts.filter((p) => p.mediaId === m.id).length }))
  return wait({
    rows,
    folders: s.mediaFolders.map((fo) => ({ ...fo, count: live.filter((m) => m.folderId === fo.id).length })),
    counts: { all: live.length, trash: all.filter((m) => m.trashedAt).length, needsReview: live.filter((m) => m.status === 'Needs review').length, missingAlt: live.filter((m) => m.mime.startsWith('image/') && !m.alt.trim()).length },
    canManage: mayManage(s, actorId),
    canReview: mayReview(s, actorId),
  })
}

export function getMedia(actorId: string, id: string): Promise<MediaRow & { folderName: string | null; usedIn: { id: string; title: string; status: string }[] }> {
  const s = db()
  const m = load(s, actorId, id, 'view')
  const actor = actorOf(s, actorId)
  return wait({
    ...m,
    ownerName: s.users.find((u) => u.id === m.ownerId)?.name ?? 'Unknown',
    usedInPosts: s.posts.filter((p) => p.mediaId === m.id).length,
    folderName: s.mediaFolders.find((f) => f.id === m.folderId)?.name ?? null,
    // Only posts on channels the viewer can see are listed.
    usedIn: s.posts.filter((p) => p.mediaId === m.id && canViewAccount(actor, p.accountId, ctx(s))).map((p) => ({ id: p.id, title: p.title, status: p.status })),
  })
}

/** Approved, live media the actor can reuse in a post. */
export function listUsableMedia(actorId: string): Promise<MediaAsset[]> {
  const s = db()
  if (!mayBrowse(s, actorId)) throw new ApiError('Media Storage needs a content permission.')
  return wait(s.media.filter((m) => !m.trashedAt && m.status === 'Approved' && m.mime.startsWith('image/') && visible(s, actorId, m)))
}

// ---------- Folders ----------

export function createFolder(actorId: string, name: string) {
  const s = db()
  if (!mayManage(s, actorId)) throw new ApiError('Managing media needs the content creation function.')
  const n = name.trim()
  if (!n) throw new ApiError('Name the folder.')
  if (s.mediaFolders.some((f) => f.name.toLowerCase() === n.toLowerCase())) throw new ApiError('A folder with this name already exists.')
  const f = { id: uid('folder'), name: n }
  s.mediaFolders.push(f)
  audit(s, actorId, 'Media folder created', n)
  persist()
  return wait(f.id)
}

export function renameFolder(actorId: string, id: string, name: string) {
  const s = db()
  if (!mayManage(s, actorId)) throw new ApiError('Managing media needs the content creation function.')
  const f = s.mediaFolders.find((x) => x.id === id)
  if (!f) throw new ApiError('Folder not found.')
  const n = name.trim()
  if (!n) throw new ApiError('Name the folder.')
  if (s.mediaFolders.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) throw new ApiError('A folder with this name already exists.')
  audit(s, actorId, 'Media folder renamed', `${f.name} → ${n}`)
  f.name = n
  persist()
  return wait(true)
}

export function deleteFolder(actorId: string, id: string) {
  const s = db()
  if (!mayManage(s, actorId)) throw new ApiError('Managing media needs the content creation function.')
  const f = s.mediaFolders.find((x) => x.id === id)
  if (!f) throw new ApiError('Folder not found.')
  const moved = s.media.filter((m) => m.folderId === id)
  moved.forEach((m) => (m.folderId = null))
  s.mediaFolders = s.mediaFolders.filter((x) => x.id !== id)
  audit(s, actorId, 'Media folder deleted', `${f.name}: ${moved.length} file(s) moved to Unfiled. No file was deleted.`)
  persist()
  return wait(moved.length)
}

// ---------- Files ----------

export interface UploadInput {
  name: string
  mime: string
  bytes: number
  width: number | null
  height: number | null
  blob: Blob
  folderId: string | null
}

function checkFile(name: string, mime: string, bytes: number) {
  if (!ALLOWED_TYPES.includes(mime)) throw new ApiError(`${name}: use PNG, JPEG, WebP, GIF, MP4, WebM or PDF.`)
  if (bytes > MAX_BYTES) throw new ApiError(`${name}: files can be up to 20 MB.`)
}

export async function uploadMedia(actorId: string, input: UploadInput) {
  const s = db()
  if (!mayManage(s, actorId)) throw new ApiError('Uploading needs the content creation function.')
  checkFile(input.name, input.mime, input.bytes)
  if (input.folderId && !s.mediaFolders.some((f) => f.id === input.folderId)) throw new ApiError('Folder not found.')
  const blobId = uid('blob')
  try {
    await putBlob(blobId, input.blob)
  } catch {
    throw new ApiError(`Could not store ${input.name}. Check that browser storage is available.`)
  }
  const now = nowISO()
  const asset: MediaAsset = {
    id: uid('media'),
    name: input.name,
    mime: input.mime,
    folderId: input.folderId,
    source: 'upload',
    photo: null,
    blobId,
    bytes: input.bytes,
    width: input.width,
    height: input.height,
    alt: '',
    tags: [],
    status: 'Needs review',
    reviewedBy: null,
    ownerId: actorOf(s, actorId).user?.id ?? 'user-0',
    channelIds: [],
    createdAt: now,
    updatedAt: now,
    versions: [],
    trashedAt: null,
  }
  s.media.unshift(asset)
  audit(s, actorId, 'Media uploaded', `${asset.name} (${Math.round(asset.bytes! / 1024)} KB), stored in this browser. Review required.`)
  persist()
  return wait(asset.id)
}

export function updateMedia(actorId: string, id: string, patch: { name: string; alt: string; tags: string[]; folderId: string | null; channelIds: string[] }) {
  const s = db()
  const m = load(s, actorId, id)
  const name = patch.name.trim()
  if (!name) throw new ApiError('Name the file.')
  if (patch.folderId && !s.mediaFolders.some((f) => f.id === patch.folderId)) throw new ApiError('Folder not found.')
  const actor = actorOf(s, actorId)
  if (patch.channelIds.some((c) => !canViewAccount(actor, c, ctx(s)))) throw new ApiError('You can only limit media to channels you can access.')
  const altChanged = patch.alt.trim() !== m.alt
  Object.assign(m, { name, alt: patch.alt.trim(), tags: patch.tags.map((t) => t.trim()).filter(Boolean), folderId: patch.folderId, channelIds: patch.channelIds, updatedAt: nowISO() })
  // Changing the description of an approved asset means a person should look at it again.
  if (altChanged && m.status === 'Approved') {
    m.status = 'Needs review'
    m.reviewedBy = null
  }
  audit(s, actorId, 'Media details saved', `${m.name}${altChanged && m.status === 'Needs review' ? '. ALT text changed, review required again.' : ''}`)
  persist()
  return wait(true)
}

export function moveMedia(actorId: string, ids: string[], folderId: string | null) {
  const s = db()
  if (folderId && !s.mediaFolders.some((f) => f.id === folderId)) throw new ApiError('Folder not found.')
  ids.forEach((id) => (load(s, actorId, id).folderId = folderId))
  audit(s, actorId, 'Media moved', `${ids.length} file(s) → ${s.mediaFolders.find((f) => f.id === folderId)?.name ?? 'Unfiled'}`)
  persist()
  return wait(ids.length)
}

export function reviewMedia(actorId: string, ids: string[], decision: 'Approved' | 'Rejected') {
  const s = db()
  for (const id of ids) {
    const m = load(s, actorId, id, 'review')
    if (decision === 'Approved' && m.mime.startsWith('image/') && !m.alt.trim()) throw new ApiError(`${m.name}: add ALT text before approving an image.`)
  }
  ids.forEach((id) => {
    const m = s.media.find((x) => x.id === id)!
    m.status = decision
    m.reviewedBy = actorName(s, actorId)
    m.updatedAt = nowISO()
  })
  audit(s, actorId, decision === 'Approved' ? 'Media approved' : 'Media rejected', `${ids.length} file(s)`)
  persist()
  return wait(ids.length)
}

export async function replaceMedia(actorId: string, id: string, input: Omit<UploadInput, 'folderId'>) {
  const s = db()
  const m = load(s, actorId, id)
  checkFile(input.name, input.mime, input.bytes)
  if (m.mime.split('/')[0] !== input.mime.split('/')[0]) throw new ApiError('Replace a file with one of the same kind (image, video or document).')
  const blobId = uid('blob')
  try {
    await putBlob(blobId, input.blob)
  } catch {
    throw new ApiError('Could not store the new file. Check that browser storage is available.')
  }
  m.versions.unshift({ id: uid('ver'), name: m.name, at: m.updatedAt, by: s.users.find((u) => u.id === m.ownerId)?.name ?? 'Unknown', bytes: m.bytes, blobId: m.blobId, photo: m.photo })
  Object.assign(m, { blobId, photo: null, source: 'upload', mime: input.mime, bytes: input.bytes, width: input.width, height: input.height, status: 'Needs review', reviewedBy: null, updatedAt: nowISO() })
  audit(s, actorId, 'Media replaced', `${m.name}: version ${m.versions.length + 1}. Review required. Posts using it keep the new file only after approval.`)
  persist()
  return wait(m.versions.length + 1)
}

export function trashMedia(actorId: string, ids: string[]) {
  const s = db()
  ids.forEach((id) => {
    const m = load(s, actorId, id)
    const used = s.posts.filter((p) => p.mediaId === id && p.status !== 'Published').length
    if (used) throw new ApiError(`${m.name} is used by ${used} unpublished post(s). Remove it from those posts first.`)
  })
  ids.forEach((id) => (s.media.find((x) => x.id === id)!.trashedAt = nowISO()))
  audit(s, actorId, 'Media moved to trash', `${ids.length} file(s). Recoverable.`)
  persist()
  return wait(ids.length)
}

export function restoreMedia(actorId: string, ids: string[]) {
  const s = db()
  ids.forEach((id) => (load(s, actorId, id).trashedAt = null))
  audit(s, actorId, 'Media restored from trash', `${ids.length} file(s)`)
  persist()
  return wait(ids.length)
}

export async function deleteMediaForever(actorId: string, ids: string[]) {
  const s = db()
  for (const id of ids) {
    const m = load(s, actorId, id)
    if (!m.trashedAt) throw new ApiError('Move a file to the trash before deleting it permanently.')
    for (const b of [m.blobId, ...m.versions.map((v) => v.blobId)]) if (b) await deleteBlob(b).catch(() => undefined)
  }
  s.media = s.media.filter((m) => !ids.includes(m.id))
  audit(s, actorId, 'Media deleted permanently', `${ids.length} file(s)`)
  persist()
  return wait(ids.length)
}
