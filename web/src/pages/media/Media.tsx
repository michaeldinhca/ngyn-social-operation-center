import { useSearch } from '@tanstack/react-router'
import { Check, Download, File, FileText, Film, Folder, FolderPlus, Image as ImageIcon, Pencil, Plug, RotateCcw, Search, Trash2, Undo2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAccounts, useAction, useBlobUrl, useMediaItem, useMediaList } from '@/api/hooks'
import { PostImage } from '@/components/post/PostPreview'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, EmptyState, Field, Input, PageHeader, Segmented, Select, SimBadge, Skeleton, Textarea } from '@/components/ui/primitives'
import type { MediaStatus } from '@/domain/types'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'
import * as media from '@/mock/api-media'
import { SAMPLE_PHOTOS } from '@/mock/photos'

type Row = media.MediaRow

const kindOf = (m: { mime: string }) => (m.mime.startsWith('image/') ? 'image' : m.mime.startsWith('video/') ? 'video' : 'doc')
const sizeText = (b: number | null) => (b === null ? 'Sample file' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const STATUS_TONE: Record<MediaStatus, 'good' | 'warn' | 'bad'> = { Approved: 'good', 'Needs review': 'warn', Rejected: 'bad' }

/** Read a file's pixel size when it is an image. Other types have no dimensions. */
function inspect(file: File): Promise<{ width: number | null; height: number | null }> {
  if (!file.type.startsWith('image/')) return Promise.resolve({ width: null, height: null })
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: null, height: null })
    }
    img.src = url
  })
}

function Thumb({ m, className, width = 400 }: { m: Pick<Row, 'mime' | 'photo' | 'blobId' | 'alt' | 'name'>; className?: string; width?: number }) {
  if (kindOf(m) === 'image') return <PostImage image={{ photo: m.photo, blobId: m.blobId }} alt={m.alt || m.name} width={width} className={className} />
  const Icon = kindOf(m) === 'video' ? Film : FileText
  return (
    <div className={cn('flex items-center justify-center bg-surface-2 text-muted', className)} role="img" aria-label={`${m.name} (${kindOf(m) === 'video' ? 'video' : 'document'})`}>
      <Icon className="size-10" />
    </div>
  )
}

export function MediaPage() {
  const search = useSearch({ from: '/$page' })
  const [folder, setFolder] = useState('all')
  const [type, setType] = useState<media.MediaFilters['type']>('All')
  const [status, setStatus] = useState<media.MediaFilters['status']>('All')
  const [sort, setSort] = useState<media.MediaFilters['sort']>('newest')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState<string[]>([])
  const [open, setOpen] = useState<string | null>(search.c ?? null)
  const [folderDialog, setFolderDialog] = useState<'new' | 'rename' | 'delete' | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [integration, setIntegration] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const list = useMediaList({ folder, type, status, sort, q })
  const upload = useAction(media.uploadMedia)
  const review = useAction(media.reviewMedia, { success: (n) => `${n} file(s) updated.` })
  const trash = useAction(media.trashMedia, { success: (n) => `${n} file(s) moved to the trash. You can restore them.` })
  const restore = useAction(media.restoreMedia, { success: (n) => `${n} file(s) restored.` })
  const purge = useAction(media.deleteMediaForever, { success: (n) => `${n} file(s) deleted permanently.` })
  const d = list.data
  const rows = d?.rows ?? []
  const inTrash = folder === 'trash'
  const current = d?.folders.find((f) => f.id === folder)

  useEffect(() => setSelected((s) => s.filter((id) => rows.some((r) => r.id === id))), [rows.map((r) => r.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (files: FileList | File[]) => {
    const folderId = folder === 'all' || folder === 'unfiled' || folder === 'trash' ? null : folder
    let ok = 0
    for (const file of Array.from(files)) {
      const dims = await inspect(file)
      try {
        await upload.mutateAsync([{ name: file.name, mime: file.type, bytes: file.size, width: dims.width, height: dims.height, blob: file, folderId }])
        ok++
      } catch {
        // useAction already showed the reason as a toast
      }
    }
    if (ok) toast.success(`${ok} file(s) stored in this browser. They need review before use in posts.`)
    if (input.current) input.current.value = ''
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allSelected = rows.length > 0 && selected.length === rows.length

  if (list.error) {
    return (
      <>
        <PageHeader title="Media Storage" />
        <EmptyState title="Not available" icon={<ImageIcon />}>
          {(list.error as Error).message}
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Media Storage"
        description="Your team's reusable photos, videos and documents. Only approved images can be used in posts."
        actions={
          <>
            <SimBadge>Stored in this browser only</SimBadge>
            <Button onClick={() => setIntegration('Canva')}>
              <Plug /> Canva
            </Button>
            <Button onClick={() => setIntegration('Google Drive')}>
              <Plug /> Google Drive
            </Button>
            {d?.canManage && (
              <Button variant="primary" onClick={() => input.current?.click()}>
                <Upload /> Upload
              </Button>
            )}
          </>
        }
      />
      <input ref={input} type="file" multiple accept={media.ALLOWED_TYPES.join(',')} className="hidden" aria-label="Upload files" data-testid="media-upload" onChange={(e) => e.target.files && send(e.target.files)} />

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Folders" className="space-y-1">
          {[
            ['all', 'All files', d?.counts.all],
            ['unfiled', 'Unfiled', undefined],
          ].map(([id, label, n]) => (
            <FolderButton key={id as string} active={folder === id} onClick={() => setFolder(id as string)} icon={<File className="size-4" />} label={label as string} count={n as number | undefined} />
          ))}
          {d?.folders.map((f) => (
            <FolderButton key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)} icon={<Folder className="size-4" />} label={f.name} count={f.count} />
          ))}
          <FolderButton active={inTrash} onClick={() => setFolder('trash')} icon={<Trash2 className="size-4" />} label="Trash" count={d?.counts.trash} />
          {d?.canManage && (
            <div className="space-y-1 pt-2">
              <Button size="sm" className="w-full" onClick={() => setFolderDialog('new')}>
                <FolderPlus /> New folder
              </Button>
              {current && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setFolderDialog('rename')}>
                    <Pencil /> Rename
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setFolderDialog('delete')}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              )}
            </div>
          )}
          {d && (d.counts.needsReview > 0 || d.counts.missingAlt > 0) && (
            <div className="mt-3 space-y-1 rounded-lg border border-border p-3 text-xs text-muted">
              {d.counts.needsReview > 0 && (
                <button type="button" className="block text-left hover:text-text" onClick={() => setStatus('Needs review')}>
                  <strong className="tabular text-warn">{d.counts.needsReview}</strong> need review
                </button>
              )}
              {d.counts.missingAlt > 0 && (
                <button type="button" className="block text-left hover:text-text" onClick={() => setStatus('Missing ALT')}>
                  <strong className="tabular text-bad">{d.counts.missingAlt}</strong> images missing ALT text
                </button>
              )}
            </div>
          )}
        </nav>

        <section
          className={cn('min-w-0 rounded-xl', over && 'outline outline-2 outline-offset-4 outline-accent-strong')}
          aria-label="Files"
          onDragOver={(e) => {
            if (d?.canManage && !inTrash && e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              setOver(true)
            }
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            if (d?.canManage && !inTrash && e.dataTransfer.files.length) send(e.dataTransfer.files)
          }}
        >
          <Card className="mb-4 grid grid-cols-2 items-end gap-3 p-4 md:grid-cols-[1fr_130px_150px_130px_auto]">
            <Field label="Search" className="col-span-2 md:col-span-1">
              {(id) => (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ALT text or tag" className="pl-9" />
                </div>
              )}
            </Field>
            <Field label="Type">
              {(id) => (
                <Select id={id} value={type} onChange={(e) => setType(e.target.value as media.MediaFilters['type'])}>
                  {['All', 'Image', 'Video', 'Document'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Review status">
              {(id) => (
                <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as media.MediaFilters['status'])}>
                  {['All', 'Approved', 'Needs review', 'Rejected', 'Missing ALT'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Sort">
              {(id) => (
                <Select id={id} value={sort} onChange={(e) => setSort(e.target.value as media.MediaFilters['sort'])}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="name">Name</option>
                  <option value="size">Largest</option>
                </Select>
              )}
            </Field>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                ['grid', 'Grid'],
                ['list', 'List'],
              ]}
            />
          </Card>

          {selected.length > 0 && (
            <div role="toolbar" aria-label="Bulk actions" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent-strong/50 bg-accent-soft px-4 py-2.5">
              <span className="mr-2 text-sm font-medium">{selected.length} selected</span>
              {inTrash ? (
                <>
                  <Button size="sm" onClick={() => restore.mutate([selected], { onSuccess: () => setSelected([]) })}>
                    <RotateCcw /> Restore
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => purge.mutate([selected], { onSuccess: () => setSelected([]) })}>
                    <Trash2 /> Delete permanently
                  </Button>
                </>
              ) : (
                <>
                  {d?.canReview && (
                    <>
                      <Button size="sm" onClick={() => review.mutate([selected, 'Approved'], { onSuccess: () => setSelected([]) })}>
                        <Check /> Approve
                      </Button>
                      <Button size="sm" onClick={() => review.mutate([selected, 'Rejected'], { onSuccess: () => setSelected([]) })}>
                        <X /> Reject
                      </Button>
                    </>
                  )}
                  {d?.canManage && (
                    <>
                      <Button size="sm" onClick={() => setMoveOpen(true)}>
                        <Folder /> Move
                      </Button>
                      <Button size="sm" onClick={() => trash.mutate([selected], { onSuccess: () => setSelected([]) })}>
                        <Trash2 /> Trash
                      </Button>
                    </>
                  )}
                </>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          )}

          {!d ? (
            <Skeleton className="h-96" />
          ) : !rows.length ? (
            <EmptyState title={inTrash ? 'Trash is empty' : 'No files match'} icon={<ImageIcon />}>
              {inTrash ? 'Deleted files stay here until you restore or remove them.' : d.canManage ? 'Upload files, drag them here, or clear a filter.' : 'Try clearing a filter.'}
            </EmptyState>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3 px-1 text-sm text-muted">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-[var(--accent-strong)]" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))} aria-label="Select all files" />
                  Select all
                </label>
                <span aria-live="polite">{rows.length} file{rows.length === 1 ? '' : 's'}</span>
              </div>
              {view === 'grid' ? (
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-4">
                  {rows.map((m) => (
                    <li key={m.id} className={cn('group relative overflow-hidden rounded-xl border bg-surface', selected.includes(m.id) ? 'border-accent-strong ring-1 ring-accent-strong' : 'border-border hover:border-border-strong')}>
                      <label className="absolute left-2 top-2 z-10 rounded bg-black/55 p-1">
                        <input type="checkbox" className="size-4 accent-[var(--accent-strong)]" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} aria-label={`Select ${m.name}`} />
                      </label>
                      <button type="button" onClick={() => setOpen(m.id)} className="block w-full text-left">
                        <Thumb m={m} className="aspect-square w-full" />
                        <div className="p-3">
                          <p className="truncate text-sm font-medium">{m.name}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                            {kindOf(m) === 'image' && !m.alt.trim() && <Badge tone="bad">No ALT</Badge>}
                          </div>
                          <p className="tabular mt-1.5 text-xs text-muted">
                            {m.width && m.height ? `${m.width}×${m.height} · ` : ''}
                            {sizeText(m.bytes)}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Card className="overflow-hidden p-0">
                  <ul className="divide-y divide-border">
                    {rows.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                        <input type="checkbox" className="size-4 accent-[var(--accent-strong)]" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} aria-label={`Select ${m.name}`} />
                        <Thumb m={m} width={120} className="size-12 shrink-0 rounded-md" />
                        <button type="button" onClick={() => setOpen(m.id)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-medium">{m.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {m.alt || 'No ALT text'} · {m.tags.join(', ') || 'No tags'}
                          </span>
                        </button>
                        <span className="tabular hidden w-28 text-xs text-muted md:block">
                          {m.width && m.height ? `${m.width}×${m.height}` : 'n/a'} · {sizeText(m.bytes)}
                        </span>
                        <span className="hidden w-24 text-xs text-muted lg:block">{relativeTime(m.updatedAt)}</span>
                        <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <p className="mt-4 text-xs text-muted">
                Uploads are saved in this browser (IndexedDB), up to 20 MB each: PNG, JPEG, WebP, GIF, MP4, WebM or PDF. Stock samples are credited Unsplash photos of illustrative places. Links to a file only work in this browser. They are not public URLs.
              </p>
            </>
          )}
        </section>
      </div>

      <MediaDialog id={open} onClose={() => setOpen(null)} />
      <FolderDialog mode={folderDialog} onClose={() => setFolderDialog(null)} folder={current ?? null} onCreated={(id) => setFolder(id)} onDeleted={() => setFolder('all')} />
      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} folders={d?.folders ?? []} ids={selected} onDone={() => setSelected([])} />
      <Dialog open={!!integration} onOpenChange={(o) => !o && setIntegration(null)} title={`${integration} integration (mock)`} description="Not connected. This button only shows where the integration would go." footer={<Button onClick={() => setIntegration(null)}>Close</Button>}>
        <p className="text-sm text-text-2">A real connection needs an OAuth sign-in and an administrator's approval, and files would be copied into Media Storage for review before use. Nothing is requested or stored in this demo.</p>
      </Dialog>
    </>
  )
}

function FolderButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm', active ? 'bg-accent text-accent-ink font-semibold' : 'text-text-2 hover:bg-surface-2 hover:text-text')}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className={cn('tabular text-xs', active ? 'text-accent-ink/70' : 'text-muted')}>{count}</span>}
    </button>
  )
}

function FolderDialog({ mode, onClose, folder, onCreated, onDeleted }: { mode: 'new' | 'rename' | 'delete' | null; onClose: () => void; folder: { id: string; name: string; count: number } | null; onCreated: (id: string) => void; onDeleted: () => void }) {
  const [name, setName] = useState('')
  const create = useAction(media.createFolder, { success: 'Folder created.' })
  const rename = useAction(media.renameFolder, { success: 'Folder renamed.' })
  const del = useAction(media.deleteFolder, { success: (n) => `Folder deleted. ${n} file(s) moved to Unfiled. No file was deleted.` })
  useEffect(() => {
    if (mode) setName(mode === 'rename' ? (folder?.name ?? '') : '')
  }, [mode, folder])
  const title = mode === 'new' ? 'New folder' : mode === 'rename' ? 'Rename folder' : `Delete ${folder?.name ?? 'folder'}?`
  return (
    <Dialog
      open={!!mode}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={mode === 'delete' ? `${folder?.count ?? 0} file(s) move to Unfiled. No file is deleted.` : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {mode === 'delete' ? (
            <Button variant="danger" onClick={() => del.mutate([folder!.id], { onSuccess: () => (onClose(), onDeleted()) })}>
              Delete folder
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => (mode === 'new' ? create.mutate([name], { onSuccess: (id) => (onClose(), onCreated(id)) }) : rename.mutate([folder!.id, name], { onSuccess: onClose }))}
            >
              {mode === 'new' ? 'Create folder' : 'Save'}
            </Button>
          )}
        </>
      }
    >
      {mode !== 'delete' && <Field label="Folder name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}</Field>}
    </Dialog>
  )
}

function MoveDialog({ open, onOpenChange, folders, ids, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; folders: { id: string; name: string }[]; ids: string[]; onDone: () => void }) {
  const [target, setTarget] = useState('')
  const move = useAction(media.moveMedia, { success: (n) => `${n} file(s) moved.` })
  useEffect(() => {
    if (open) setTarget('')
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Move ${ids.length} file(s)`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => move.mutate([ids, target || null], { onSuccess: () => (onOpenChange(false), onDone()) })}>
            Move
          </Button>
        </>
      }
    >
      <Field label="Destination folder">
        {(id) => (
          <Select id={id} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Unfiled</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Dialog>
  )
}

function MediaDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useMediaItem(id)
  const folders = useMediaList({ folder: 'all', type: 'All', status: 'All', sort: 'newest', q: '' })
  const accounts = useAccounts()
  const m = q.data
  const [name, setName] = useState('')
  const [alt, setAlt] = useState('')
  const [tags, setTags] = useState('')
  const [folderId, setFolderId] = useState('')
  const [channelIds, setChannelIds] = useState<string[]>([])
  const replaceInput = useRef<HTMLInputElement>(null)
  const blobUrl = useBlobUrl(m?.blobId)
  const save = useAction(media.updateMedia, { success: 'Details saved.' })
  const rev = useAction(media.reviewMedia, { success: (_n) => 'Review recorded.' })
  const trash = useAction(media.trashMedia, { success: 'Moved to the trash. You can restore it.' })
  const restore = useAction(media.restoreMedia, { success: 'Restored.' })
  const replace = useAction(media.replaceMedia, { success: (v) => `Replaced. This is version ${v}. It needs review again.` })

  useEffect(() => {
    if (m) {
      setName(m.name)
      setAlt(m.alt)
      setTags(m.tags.join(', '))
      setFolderId(m.folderId ?? '')
      setChannelIds(m.channelIds)
    }
    // Reset the form when a different file opens or after a save changes it.
  }, [m?.id, m?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = folders.data
  const dirty = !!m && (name !== m.name || alt !== m.alt || tags !== m.tags.join(', ') || folderId !== (m.folderId ?? '') || channelIds.join() !== m.channelIds.join())
  const trashed = !!m?.trashedAt

  return (
    <Dialog
      open={!!id}
      onOpenChange={(o) => !o && onClose()}
      title={m?.name ?? 'Media'}
      description={m ? `${m.mime} · ${sizeText(m.bytes)}${m.width && m.height ? ` · ${m.width}×${m.height}` : ''}` : undefined}
      className="max-w-3xl"
      footer={
        m && (
          <>
            {trashed ? (
              <Button className="mr-auto" onClick={() => restore.mutate([[m.id]], { onSuccess: onClose })}>
                <RotateCcw /> Restore from trash
              </Button>
            ) : (
              list?.canManage && (
                <Button variant="ghost" className="mr-auto" onClick={() => trash.mutate([[m.id]], { onSuccess: onClose })}>
                  <Trash2 /> Move to trash
                </Button>
              )
            )}
            {!trashed && list?.canReview && m.status !== 'Approved' && (
              <Button onClick={() => rev.mutate([[m.id], 'Approved'])}>
                <Check /> Approve
              </Button>
            )}
            {!trashed && list?.canReview && m.status !== 'Rejected' && (
              <Button onClick={() => rev.mutate([[m.id], 'Rejected'])}>
                <X /> Reject
              </Button>
            )}
            {!trashed && list?.canManage && (
              <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate([m.id, { name, alt, tags: tags.split(','), folderId: folderId || null, channelIds }])}>
                Save details
              </Button>
            )}
          </>
        )
      }
    >
      {q.error ? (
        <p className="text-sm text-muted">{(q.error as Error).message}</p>
      ) : !m ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,260px)_1fr]">
          <div className="space-y-3">
            <Thumb m={m} width={600} className="aspect-square w-full rounded-lg" />
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
              {m.reviewedBy && <span className="text-xs text-muted">by {m.reviewedBy}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {m.source === 'sample' && m.photo !== null ? (
              <a className="inline-flex items-center gap-1.5 text-sm text-accent-strong underline-offset-2 hover:underline" href={SAMPLE_PHOTOS[m.photo].source} target="_blank" rel="noreferrer">
                <Download className="size-4" /> Open source on Unsplash ({SAMPLE_PHOTOS[m.photo].author})
              </a>
            ) : (
              blobUrl && (
                <a className="inline-flex items-center gap-1.5 text-sm text-accent-strong underline-offset-2 hover:underline" href={blobUrl} download={m.name}>
                  <Download className="size-4" /> Download
                </a>
              )
            )}
            </div>
            {!trashed && list?.canManage && (
              <>
                <Button size="sm" onClick={() => replaceInput.current?.click()}>
                  <Undo2 /> Replace file
                </Button>
                <input
                  ref={replaceInput}
                  type="file"
                  accept={media.ALLOWED_TYPES.join(',')}
                  className="hidden"
                  aria-label="Replace file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const dims = await inspect(f)
                    replace.mutate([m.id, { name: f.name, mime: f.type, bytes: f.size, width: dims.width, height: dims.height, blob: f }])
                    e.target.value = ''
                  }}
                />
                <p className="text-xs text-muted">Replacing sends the asset back to review. The old file is kept as a version.</p>
              </>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <Field label="Name">{(fid) => <Input id={fid} value={name} disabled={trashed || !list?.canManage} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label="ALT text" hint={kindOf(m) === 'image' ? 'Required before an image can be approved. Changing it sends an approved image back to review.' : 'ALT text applies to images.'}>
              {(fid) => <Textarea id={fid} rows={3} value={alt} disabled={trashed || !list?.canManage} onChange={(e) => setAlt(e.target.value)} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tags" hint="Comma separated.">
                {(fid) => <Input id={fid} value={tags} disabled={trashed || !list?.canManage} onChange={(e) => setTags(e.target.value)} />}
              </Field>
              <Field label="Folder">
                {(fid) => (
                  <Select id={fid} value={folderId} disabled={trashed || !list?.canManage} onChange={(e) => setFolderId(e.target.value)}>
                    <option value="">Unfiled</option>
                    {list?.folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <details className="rounded-lg border border-border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Channel access · {channelIds.length ? `${channelIds.length} channel(s)` : 'any channel you can access'}</summary>
              <div className="space-y-1 border-t border-border p-3">
                <p className="mb-2 text-xs text-muted">Limit this file to the people who can access at least one selected channel. Leave empty for everyone who can use Media Storage.</p>
                {accounts.data?.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--accent-strong)]" disabled={trashed || !list?.canManage} checked={channelIds.includes(a.id)} onChange={(e) => setChannelIds((x) => (e.target.checked ? [...x, a.id] : x.filter((y) => y !== a.id)))} />
                    {a.name} <span className="text-muted">· {a.network}</span>
                  </label>
                ))}
              </div>
            </details>

            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Owner</dt>
              <dd>{m.ownerName}</dd>
              <dt className="text-muted">Updated</dt>
              <dd>{formatDateTime(m.updatedAt)}</dd>
              <dt className="text-muted">Used in</dt>
              <dd>{m.usedIn.length ? m.usedIn.map((p) => `${p.title} (${p.status})`).join(', ') : 'No posts you can see'}</dd>
            </dl>

            {m.versions.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">Earlier versions</h3>
                <ul className="space-y-1 text-sm">
                  {m.versions.map((v, i) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-1.5">
                      <span>
                        Version {m.versions.length - i} · {v.name}
                      </span>
                      <span className="text-xs text-muted">
                        {sizeText(v.bytes)} · {formatDateTime(v.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
