import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Check, Image as ImageIcon, Plus, Save, Send, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAction, useBatch, useComposerContext, useUsableMedia } from '@/api/hooks'
import { PostImage, PostPreview } from '@/components/post/PostPreview'
import { ChannelAvatar, ConnectionBadge, PhotoCredit } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, SimBadge, Skeleton, Textarea } from '@/components/ui/primitives'
import type { Network, PostFormat } from '@/domain/types'
import { FORMAT_HELP, NETWORK_FORMATS, NETWORK_LIMITS } from '@/lib/networks'
import { cn } from '@/lib/utils'
import * as content from '@/mock/api-content'
import { useSessionContext } from '@/session'

interface Variant {
  text: string
  comment: string
  format: PostFormat
}

interface MediaRef {
  id: string
  name: string
  photo: number | null
  blobId: string | null
}

interface Draft {
  batchId: string | null
  channelIds: string[]
  title: string
  customize: boolean
  shared: { text: string; comment: string }
  variants: Partial<Record<Network, Variant>>
  photo: number
  media: MediaRef | null
  alt: string
  assetGroupId: string | null
  guidelineId: string | null
}

const EMPTY: Draft = { batchId: null, channelIds: [], title: '', customize: false, shared: { text: '', comment: '' }, variants: {}, photo: 0, media: null, alt: '', assetGroupId: null, guidelineId: null }

const storeKey = (actor: string) => `ngyn-soc-web:composer:${actor}`

function readLocal(actor: string): Draft {
  try {
    const raw = localStorage.getItem(storeKey(actor))
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

export function ComposerPage() {
  const search = useSearch({ from: '/$page' })
  const navigate = useNavigate()
  const { actorId } = useSessionContext()
  const ctx = useComposerContext()
  const batch = useBatch(search.batch ?? null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [tab, setTab] = useState<'shared' | Network>('shared')
  const [preview, setPreview] = useState<string | null>(null)
  const [chooser, setChooser] = useState(false)
  const [mediaPicker, setMediaPicker] = useState(false)
  const [topic, setTopic] = useState('')
  const [basis, setBasis] = useState<string[] | null>(null)
  const [locked, setLocked] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const editing = !!search.batch
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const save = useAction(content.saveComposer)
  const ai = useAction(content.aiDraft)

  // Load: an existing batch from the server, or this user's local working draft.
  useEffect(() => {
    if (draft) return
    if (editing) {
      if (!batch.data) return
      const rows = batch.data
      const first = rows[0]
      const variants: Draft['variants'] = {}
      for (const r of rows) variants[r.account.network] = { text: r.text, comment: r.comment, format: r.format }
      const texts = new Set(rows.map((r) => r.text))
      setLocked(rows.filter((r) => r.status !== 'Draft' && r.status !== 'Failed').map((r) => `${r.account.name} (${r.status})`))
      setDraft({
        batchId: first.batchId,
        channelIds: rows.map((r) => r.accountId),
        title: first.title,
        customize: texts.size > 1,
        shared: { text: first.text, comment: first.comment },
        variants,
        photo: first.media?.photo ?? first.photo,
        media: first.media ? { id: first.media.id, name: first.media.name, photo: first.media.photo, blobId: first.media.blobId } : null,
        alt: first.alt,
        assetGroupId: first.assetGroupId,
        guidelineId: first.guidelineId,
      })
    } else {
      setDraft(readLocal(actorId))
    }
  }, [draft, editing, batch.data, actorId])

  // Autosave the working draft in this browser (not for edits of saved posts).
  useEffect(() => {
    if (!draft || editing) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(storeKey(actorId), JSON.stringify(draft))
      } catch {
        // storage blocked: keep working in memory
      }
    }, 400)
    return () => clearTimeout(timer.current)
  }, [draft, editing, actorId])

  const channels = ctx.data?.channels ?? []
  const selected = useMemo(() => (draft ? draft.channelIds.map((id) => channels.find((c) => c.id === id)).filter(Boolean) as typeof channels : []), [draft, channels])
  const networks = useMemo(() => [...new Set(selected.map((c) => c.network))], [selected])

  // If the active tab's network is deselected, fall back to shared content.
  useEffect(() => {
    if (tab !== 'shared' && !networks.includes(tab)) setTab('shared')
  }, [networks, tab])
  useEffect(() => {
    if (!selected.length) setPreview(null)
    else if (!selected.some((c) => c.id === preview)) setPreview(selected[0].id)
  }, [selected, preview])

  if (ctx.error || batch.error) {
    return (
      <>
        <PageHeader title="Create post" />
        <EmptyState title="Not available">{((ctx.error ?? batch.error) as Error).message}</EmptyState>
      </>
    )
  }
  if (!draft || !ctx.data) return <Skeleton className="h-[70vh]" />
  if (!ctx.data.channels.length) {
    return (
      <>
        <PageHeader title="Create post" />
        <EmptyState title="No channels you can post to">Posting needs the content creation function and an assigned channel. An administrator grants both in Users & Access.</EmptyState>
      </>
    )
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const variantFor = (n: Network): Variant => {
    const v = draft.variants[n]
    const format = v?.format ?? NETWORK_FORMATS[n][0]
    return draft.customize ? { text: v?.text ?? draft.shared.text, comment: v?.comment ?? draft.shared.comment, format } : { text: draft.shared.text, comment: draft.shared.comment, format }
  }
  const setVariant = (n: Network, patch: Partial<Variant>) => set({ variants: { ...draft.variants, [n]: { ...variantFor(n), ...patch } } })

  const activeNetwork = tab === 'shared' ? null : tab
  const text = activeNetwork ? variantFor(activeNetwork).text : draft.shared.text
  const comment = activeNetwork ? variantFor(activeNetwork).comment : draft.shared.comment
  const setText = (v: string) => (activeNetwork ? setVariant(activeNetwork, { text: v }) : set({ shared: { ...draft.shared, text: v } }))
  const setComment = (v: string) => (activeNetwork ? setVariant(activeNetwork, { comment: v }) : set({ shared: { ...draft.shared, comment: v } }))
  const limit = activeNetwork ? NETWORK_LIMITS[activeNetwork] : networks.length ? Math.min(...networks.map((n) => NETWORK_LIMITS[n])) : null
  const overLimit = networks.filter((n) => variantFor(n).text.length > NETWORK_LIMITS[n])

  const groupsAvailable = ctx.data.groups.filter((g) => selected.some((c) => c.assetGroupId === g.id))
  const guidelines = ctx.data.groups.find((g) => g.id === draft.assetGroupId)?.guidelines ?? []

  const chooseChannels = (ids: string[]) => {
    const chosen = ids.map((id) => channels.find((c) => c.id === id)!)
    const groupIds = [...new Set(chosen.map((c) => c.assetGroupId))]
    // Brand context follows the channels: a single shared group is selected automatically; a stale one is cleared.
    const assetGroupId = groupIds.length === 1 && groupIds[0] ? groupIds[0] : groupIds.includes(draft.assetGroupId) && groupIds.length === 1 ? draft.assetGroupId : null
    set({ channelIds: ids, assetGroupId, guidelineId: assetGroupId === draft.assetGroupId ? draft.guidelineId : null })
  }

  // What is still missing before this can go to an approver. Mirrors the API's rules so the editor sees it at the fields.
  const needs: { key: string; text: string }[] = []
  if (!draft.title.trim()) needs.push({ key: 'title', text: 'Add an internal title.' })
  for (const n of networks) {
    const len = variantFor(n).text.trim().length
    if (!len) needs.push({ key: `text-${n}`, text: `Write the ${n} caption.` })
    else if (len > NETWORK_LIMITS[n]) needs.push({ key: `limit-${n}`, text: `Shorten the ${n} caption to ${NETWORK_LIMITS[n]} characters or fewer.` })
  }
  if (!draft.alt.trim()) needs.push({ key: 'alt', text: 'Add ALT text for the image.' })
  const missing = (key: string) => needs.some((n) => n.key === key)
  const showNeeds = tried && needs.length > 0

  const submit = (doSubmit: boolean) => {
    if (doSubmit && needs.length) {
      setTried(true)
      // The list renders on the next paint, so scroll after it exists.
      setTimeout(() => document.getElementById('submit-needs')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50)
      return
    }
    const variants: content.ComposerInput['variants'] = {}
    for (const c of selected) variants[c.id] = variantFor(c.network)
    save.mutate(
      [{ batchId: draft.batchId, channelIds: draft.channelIds, title: draft.title, variants, photo: draft.media?.photo ?? draft.photo, mediaId: draft.media?.id ?? null, alt: draft.alt, assetGroupId: draft.assetGroupId, guidelineId: draft.guidelineId, submit: doSubmit }],
      {
        onSuccess: (r) => {
          set({ batchId: r.batchId })
          const parts = [`${r.created} created`, `${r.updated} updated`]
          if (doSubmit) toast.success(`Submitted for approval: ${r.submitted} post${r.submitted === 1 ? '' : 's'}. An approver reviews each channel.`)
          else toast.success(`Draft saved (${parts.join(', ')}). Nothing was sent.`)
          if (r.removedDrafts) toast.info(`${r.removedDrafts} stale draft(s) for deselected channels were removed. Posts already in review or later were left untouched.`)
          if (r.keptLocked.length) toast.warning(`Left unchanged because they are past draft: ${r.keptLocked.join(', ')}.`)
          if (doSubmit) {
            if (!editing) {
              try {
                localStorage.removeItem(storeKey(actorId))
              } catch {
                // ignore
              }
            }
            navigate({ to: '/$page', params: { page: 'content' }, search: {} })
          }
        },
      },
    )
  }

  const previewChannel = selected.find((c) => c.id === preview) ?? selected[0]
  const image = { photo: draft.media?.photo ?? draft.photo, blobId: draft.media?.blobId }

  return (
    <>
      <PageHeader
        title={editing ? 'Edit post' : 'Create post'}
        description="One post becomes linked per-channel variations. A person approves each one before it can be scheduled."
        actions={
          <>
            <SimBadge>Nothing is sent externally</SimBadge>
            <Button onClick={() => navigate({ to: '/$page', params: { page: 'content' }, search: {} })}>
              <ArrowLeft /> All Content
            </Button>
          </>
        }
      />
      {ctx.data.paused && <p className="mb-4 rounded-lg bg-bad-soft px-4 py-2.5 text-sm text-bad">Emergency pause is active. You can still write and submit drafts. Scheduling is locked until publishing resumes.</p>}
      {locked.length > 0 && <p className="mb-4 rounded-lg bg-warn-soft px-4 py-2.5 text-sm text-warn">These channels are already past draft and won't change here: {locked.join(', ')}.</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title="Destinations"
              description="Only channels where you can create content are listed. Expired channels can receive drafts but are blocked in the demo queue."
              action={
                <Button size="sm" onClick={() => setChooser(true)}>
                  <Plus /> Choose channels
                </Button>
              }
            />
            {selected.length ? (
              <ul className="flex flex-wrap gap-2">
                {selected.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 py-1.5 pl-1.5 pr-2">
                    <ChannelAvatar account={c} size={28} />
                    <span className="text-sm">{c.name}</span>
                    {c.connection.status === 'Expired' && <Badge tone="bad">Expired</Badge>}
                    <button type="button" aria-label={`Remove ${c.name}`} className="rounded p-0.5 text-muted hover:text-text" onClick={() => chooseChannels(draft.channelIds.filter((x) => x !== c.id))}>
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No destination yet. Choose at least one channel.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Content" description="Write once, or customize each network." />
            <div className="grid gap-4">
              <Field label="Internal title" hint="Only staff see this.">
                {(id) => <Input id={id} value={draft.title} maxLength={120} aria-invalid={tried && missing('title') ? true : undefined} className={tried && missing('title') ? 'border-bad' : undefined} onChange={(e) => set({ title: e.target.value })} placeholder="For example: Winter parking ban reminder" />}
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-medium">Customize for each network</p>
                  <p className="text-xs text-muted">Off: one caption for every channel. Turning it off keeps your network versions saved.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.customize}
                  aria-label="Customize for each network"
                  onClick={() => {
                    set({ customize: !draft.customize })
                    if (draft.customize) setTab('shared')
                  }}
                  className={cn('relative h-6 w-11 rounded-full transition-colors', draft.customize ? 'bg-accent-strong' : 'bg-surface-3')}
                >
                  <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', draft.customize ? 'left-[1.375rem]' : 'left-0.5')} />
                </button>
              </div>

              {draft.customize && (
                <div role="tablist" aria-label="Network versions" className="flex flex-wrap gap-1 border-b border-border">
                  {(['shared', ...networks] as ('shared' | Network)[]).map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === t ? 'border-accent-strong text-text' : 'border-transparent text-muted hover:text-text')}>
                      {t === 'shared' ? 'Shared starting text' : t}
                      {t !== 'shared' && variantFor(t).text.length > NETWORK_LIMITS[t] && <span className="ml-1.5 text-bad">!</span>}
                    </button>
                  ))}
                </div>
              )}

              <Field label={activeNetwork ? `${activeNetwork} caption` : draft.customize ? 'Shared starting text' : 'Caption'}>
                {(id) => <Textarea id={id} rows={6} value={text} aria-invalid={tried && networks.some((n) => missing(`text-${n}`)) ? true : undefined} className={tried && networks.some((n) => missing(`text-${n}`)) ? 'border-bad' : undefined} onChange={(e) => setText(e.target.value)} placeholder="Write the post. Plain language, with a clear next step." />}
              </Field>
              <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span id="char-count" className={cn('tabular', limit !== null && text.length > limit && 'font-semibold text-bad')}>
                  {text.length}
                  {limit !== null ? ` / ${limit}` : ''} characters{limit !== null && !activeNetwork && networks.length > 1 ? ' (shortest limit)' : ''}
                </span>
                <span>Character limits are planning values, not verified platform rules.</span>
              </div>
              {overLimit.length > 0 && <p className="text-sm text-bad">Over the planning limit on: {overLimit.map((n) => `${n} (${NETWORK_LIMITS[n]})`).join(', ')}.</p>}

              <Field label="Follow-up comment (optional)" hint="Staff post it after publishing, where the network allows.">
                {(id) => <Textarea id={id} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />}
              </Field>

              {activeNetwork && (
                <Field label={`${activeNetwork} format (planning label)`} hint={FORMAT_HELP[variantFor(activeNetwork).format]}>
                  {(id) => (
                    <Select id={id} value={variantFor(activeNetwork).format} onChange={(e) => setVariant(activeNetwork, { format: e.target.value as PostFormat })} className="max-w-xs">
                      {NETWORK_FORMATS[activeNetwork].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}

              <div className="rounded-lg border border-dashed border-border-strong p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="size-4 text-accent-strong" />
                  <p className="text-sm font-semibold">Mock AI draft</p>
                  <SimBadge>No model called</SimBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input aria-label="What is the post about" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="For example: Route 8 detour starts Monday on Alder Street" className="min-w-64 flex-1" />
                  <Button
                    disabled={!topic.trim() || ai.isPending}
                    onClick={() =>
                      ai.mutate([{ topic, assetGroupId: draft.assetGroupId, guidelineId: draft.guidelineId, networks }], {
                        onSuccess: (r) => {
                          setBasis(r.basis)
                          if (draft.customize) {
                            const next = { ...draft.variants }
                            for (const n of networks) next[n] = { ...variantFor(n), text: r.perNetwork[n] ?? r.text }
                            set({ variants: next, shared: { ...draft.shared, text: r.text } })
                          } else set({ shared: { ...draft.shared, text: r.text } })
                          toast.success('Mock draft inserted. Edit it and verify every fact.')
                        },
                      })
                    }
                  >
                    <Sparkles /> Draft
                  </Button>
                </div>
                {basis && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted">
                    {basis.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Image" description="Choose approved media from Media Storage. ALT text is required." />
            <div className="flex flex-wrap items-start gap-4">
              <PostImage image={image} alt={draft.alt || 'Selected image'} width={400} className="aspect-[1.91/1] w-56 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm">
                  {draft.media ? (
                    <>
                      <span className="font-medium">{draft.media.name}</span> <Badge tone="good">Approved media</Badge>
                    </>
                  ) : (
                    <>
                      Sample photo {draft.photo + 1} <Badge tone="warn">Placeholder, choose your own</Badge>
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setMediaPicker(true)}>
                    <ImageIcon /> Choose from Media Storage
                  </Button>
                  {draft.media && (
                    <Button size="sm" variant="ghost" onClick={() => set({ media: null, photo: 0 })}>
                      Use sample photo
                    </Button>
                  )}
                </div>
                {!draft.media && <PhotoCredit index={draft.photo} />}
                <p className="text-xs text-muted">Video upload isn't built in this mockup.</p>
              </div>
            </div>
            <Field label="ALT text (required)" className="mt-4" hint="Describe the image for people who can't see it.">
              {(id) => <Textarea id={id} rows={2} value={draft.alt} aria-invalid={tried && missing('alt') ? true : undefined} className={tried && missing('alt') ? 'border-bad' : undefined} onChange={(e) => set({ alt: e.target.value })} placeholder="For example: A snow plow clearing a residential street at dawn." />}
            </Field>
          </Card>

          <Card>
            <CardHeader title="Brand context" description="Master rules and the chosen guideline inform the mock draft. Selecting a brand never grants channel access." />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Asset Group">
                {(id) => (
                  <Select id={id} value={draft.assetGroupId ?? ''} onChange={(e) => set({ assetGroupId: e.target.value || null, guidelineId: null })}>
                    <option value="">No brand context</option>
                    {groupsAvailable.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Guideline set" hint={draft.assetGroupId && !guidelines.length ? 'This group has no guideline sets.' : 'Only reviewed, complete guidelines can be used.'}>
                {(id) => (
                  <Select id={id} value={draft.guidelineId ?? ''} disabled={!draft.assetGroupId} onChange={(e) => set({ guidelineId: e.target.value || null })}>
                    <option value="">Choose a guideline</option>
                    {guidelines.map((g) => (
                      <option key={g.id} value={g.id} disabled={!g.reviewed || !g.complete}>
                        {g.name}
                        {!g.complete ? ' (incomplete)' : !g.reviewed ? ' (needs review)' : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Card>

          {showNeeds && (
            <div id="submit-needs" role="alert" className="rounded-lg border border-bad bg-bad-soft px-4 py-3 text-sm text-bad">
              <p className="font-semibold">Before you can submit for approval:</p>
              <ul className="mt-1 list-disc pl-5">
                {needs.map((n) => (
                  <li key={n.key}>{n.text}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs">Applies to {selected.map((c) => c.name).join(', ')}. You can still save a draft.</p>
            </div>
          )}

          <div className="sticky bottom-0 z-10 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.4)] sm:gap-3 sm:px-4 sm:py-3">
            <p className="mr-auto hidden whitespace-nowrap text-[0.8125rem] text-muted lg:block">{editing ? 'Saving updates the draft posts only.' : 'Draft kept in this browser. Nothing is sent.'}</p>
            {!editing && (
              <Button
                variant="ghost"
                aria-label="Discard draft"
                onClick={() => {
                  setDraft(EMPTY)
                  try {
                    localStorage.removeItem(storeKey(actorId))
                  } catch {
                    // ignore
                  }
                }}
              >
                <Trash2 /> <span className="hidden sm:inline">Discard</span>
              </Button>
            )}
            <Button className="ml-auto sm:ml-0" onClick={() => submit(false)} disabled={save.isPending || !selected.length}>
              <Save /> Save draft
            </Button>
            <Button variant="primary" onClick={() => submit(true)} disabled={save.isPending || !selected.length} title={!selected.length ? 'Choose at least one channel first' : undefined}>
              <Send /> Submit for approval
            </Button>
          </div>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start" aria-label="Previews">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Preview</h2>
              <Badge>Approximate layouts</Badge>
            </div>
            {previewChannel ? (
              <>
                <div role="tablist" aria-label="Preview channel" className="mb-3 flex flex-wrap gap-1">
                  {selected.map((c) => (
                    <button key={c.id} role="tab" aria-selected={c.id === previewChannel.id} onClick={() => setPreview(c.id)} className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs', c.id === previewChannel.id ? 'border-accent-strong bg-accent-soft' : 'border-border text-muted hover:text-text')}>
                      <ChannelAvatar account={c} size={20} />
                      <span className="max-w-32 truncate">{networks.length === selected.length ? c.network : c.name}</span>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl bg-[#e9ebee] p-3">
                  <PostPreview account={previewChannel} text={variantFor(previewChannel.network).text} comment={variantFor(previewChannel.network).comment} image={image} alt={draft.alt} format={variantFor(previewChannel.network).format} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {previewChannel.name} · <ConnectionBadge status={previewChannel.connection.status} />
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">Select channels to preview. Your caption, image and network versions update here as you edit.</p>
            )}
          </Card>
        </aside>
      </div>

      <ChannelChooser open={chooser} onOpenChange={setChooser} channels={channels} value={draft.channelIds} onApply={chooseChannels} />
      <MediaPicker
        open={mediaPicker}
        onOpenChange={setMediaPicker}
        onPick={(m) => {
          set({ media: { id: m.id, name: m.name, photo: m.photo, blobId: m.blobId }, photo: m.photo ?? 0, alt: draft.alt || m.alt })
          setMediaPicker(false)
        }}
      />
    </>
  )
}

function ChannelChooser({ open, onOpenChange, channels, value, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; channels: content.ComposerContext['channels']; value: string[]; onApply: (ids: string[]) => void }) {
  const [chosen, setChosen] = useState<string[]>(value)
  useEffect(() => {
    if (open) setChosen(value)
  }, [open, value])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Post to channels"
      description="Channels where you can create content."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!chosen.length}
            onClick={() => {
              onApply(channels.filter((c) => chosen.includes(c.id)).map((c) => c.id))
              onOpenChange(false)
            }}
          >
            <Check /> Apply {chosen.length} channel{chosen.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <ul className="space-y-1.5">
        {channels.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-surface-2">
              <input type="checkbox" name="composer-destination" className="size-4 accent-[var(--accent-strong)]" checked={chosen.includes(c.id)} onChange={(e) => setChosen((x) => (e.target.checked ? [...x, c.id] : x.filter((y) => y !== c.id)))} />
              <ChannelAvatar account={c} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted">
                  {c.network} · {c.groupName ?? 'No Asset Group'}
                </span>
              </span>
              <ConnectionBadge status={c.connection.status} />
            </label>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

function MediaPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (m: { id: string; name: string; photo: number | null; blobId: string | null; alt: string }) => void }) {
  const q = useUsableMedia(open)
  const [term, setTerm] = useState('')
  const rows = (q.data ?? []).filter((m) => !term.trim() || (m.name + ' ' + m.tags.join(' ')).toLowerCase().includes(term.toLowerCase()))
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Choose approved media" description="Only approved images appear here. Review pending files in Media Storage." className="max-w-3xl">
      <Input aria-label="Search media" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name or tag" className="mb-3" />
      {!q.data ? (
        <Skeleton className="h-56" />
      ) : rows.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {rows.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} className="w-full overflow-hidden rounded-lg border border-border text-left hover:border-accent-strong">
                <PostImage image={{ photo: m.photo, blobId: m.blobId }} alt={m.alt || m.name} width={300} className="aspect-square w-full" />
                <span className="block truncate px-2 py-1.5 text-xs">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No approved images match.</p>
      )}
    </Dialog>
  )
}
