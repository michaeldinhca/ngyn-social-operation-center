import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, Inbox as InboxIcon, Info, MessageSquare, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAction, useConversation, useConversations, useUsers } from '@/api/hooks'
import { ChannelAvatar } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, SimBadge, Skeleton, Textarea } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/tooltip'
import { CATEGORIES, NETWORKS, type Category, type Network, type Sentiment } from '@/domain/types'
import { cn, formatDateTime, relativeTime, signed } from '@/lib/utils'
import * as api from '@/mock/api'
import { useSessionContext } from '@/session'

const SENTIMENTS: Sentiment[] = ['Negative', 'Concerned', 'Neutral', 'Positive']

// What each network allows for owned-account conversations, per Zernio's public docs.
// Not verified by NGYN: see docs/PLATFORM_CAPABILITY_MATRIX.md.
const CAPABILITY: Record<Network, string> = {
  Facebook: 'Comments and DMs: read and reply listed by provider docs. Not yet verified.',
  Instagram: 'Comments and DMs: read and reply listed by provider docs. Not yet verified.',
  Bluesky: 'Comments and DMs listed; DM attachments not supported. Not yet verified.',
  LinkedIn: 'Comment replies are public only. DMs are not available through the provider.',
  YouTube: 'Comment replies are public only. YouTube has no DMs.',
  X: 'Comments need provider polling enabled; DMs need extra scopes and paid API access.',
}

const sentimentTone = (s: Sentiment) => (s === 'Negative' ? 'bad' : s === 'Concerned' ? 'warn' : s === 'Positive' ? 'good' : 'neutral')

export function InboxPage() {
  const search = useSearch({ from: '/$page' })
  const navigate = useNavigate()
  const users = useUsers()
  const [filters, setFilters] = useState<api.InboxFilters>(() => ({
    network: 'All',
    kind: 'All',
    sentiment: (SENTIMENTS as string[]).includes(search.sentiment ?? '') ? (search.sentiment as Sentiment) : 'All',
    category: 'All',
    owner: 'All',
    status: search.c ? 'All' : 'Open',
    search: search.q ?? '',
    sort: 'negative',
  }))
  const [selected, setSelected] = useState<string | null>(search.c ?? null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mobileDetail, setMobileDetail] = useState(!!search.c)
  const list = useConversations(filters)
  const rows = list.data?.rows

  useEffect(() => {
    if (search.q !== undefined) setFilters((f) => ({ ...f, search: search.q ?? '' }))
  }, [search.q])

  useEffect(() => {
    if (rows && rows.length && !rows.some((r) => r.id === selected)) setSelected(rows[0].id)
  }, [rows, selected])

  const set = <K extends keyof api.InboxFilters>(k: K, v: api.InboxFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))
  const select = (id: string) => {
    setSelected(id)
    setMobileDetail(true)
    navigate({ to: '/$page', params: { page: 'inbox' }, search: { c: id }, replace: true })
  }

  const counts = useMemo(() => {
    const r = rows ?? []
    return { total: r.length, unassigned: r.filter((x) => !x.ownerId && x.status === 'Open').length, negative: r.filter((x) => x.sentiment === 'Negative' && x.status === 'Open').length }
  }, [rows])

  if (list.error) {
    return (
      <>
        <PageHeader title="Inbox & Comments" />
        <EmptyState title="Inbox not available" icon={<InboxIcon />}>
          {(list.error as Error).message}
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Inbox & Comments"
        description="Comments and direct messages on your assigned channels. Sentiment is a derived signal; a named staff member owns every response."
        actions={<SimBadge>Fictional conversations · no replies sent</SimBadge>}
      />

      <div className="mb-3 flex items-center gap-2 md:hidden">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search conversations" value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder="Text, author or ID" className="pl-9" />
        </div>
        <Button aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
          <SlidersHorizontal /> Filters
        </Button>
      </div>
      <Card className={cn('mb-4 grid grid-cols-2 gap-3 p-4 md:grid md:grid-cols-4 xl:grid-cols-5', !filtersOpen && 'hidden')}>
        <Field label="Network">
          {(id) => (
            <Select id={id} value={filters.network} onChange={(e) => set('network', e.target.value as Network | 'All')}>
              <option value="All">All</option>
              {NETWORKS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Type">
          {(id) => (
            <Select id={id} value={filters.kind} onChange={(e) => set('kind', e.target.value as api.InboxFilters['kind'])}>
              <option value="All">All</option>
              <option value="Comment">Comments</option>
              <option value="Message">Direct messages</option>
            </Select>
          )}
        </Field>
        <Field label="Sentiment">
          {(id) => (
            <Select id={id} value={filters.sentiment} onChange={(e) => set('sentiment', e.target.value as Sentiment | 'All')}>
              <option value="All">All</option>
              {SENTIMENTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Category">
          {(id) => (
            <Select id={id} value={filters.category} onChange={(e) => set('category', e.target.value as Category | 'All')}>
              <option value="All">All</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Owner">
          {(id) => (
            <Select id={id} value={filters.owner} onChange={(e) => set('owner', e.target.value)}>
              <option value="All">Anyone</option>
              <option value="Unassigned">Unassigned</option>
              {users.data
                ?.filter((u) => u.status === 'Active')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={filters.status} onChange={(e) => set('status', e.target.value as api.InboxFilters['status'])}>
              <option value="Open">Open</option>
              <option value="Resolved">Resolved</option>
              <option value="All">All</option>
            </Select>
          )}
        </Field>
        <Field label="Sort">
          {(id) => (
            <Select id={id} value={filters.sort} onChange={(e) => set('sort', e.target.value as api.InboxFilters['sort'])}>
              <option value="negative">Most negative first</option>
              <option value="newest">Newest first</option>
            </Select>
          )}
        </Field>
        <Field label="Search" className="col-span-2 hidden md:col-span-4 md:block xl:col-span-2">
          {(id) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input id={id} value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder="Text, author or ID" className="pl-9" />
            </div>
          )}
        </Field>
      </Card>

      {list.data && !list.data.hasChannels ? (
        <EmptyState title="No channel access yet" icon={<InboxIcon />}>
          You have inbox permission, but no channel is assigned to you. An administrator must assign channels before you can read conversations.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <section className={cn('min-w-0', mobileDetail && 'hidden lg:block')} aria-label="Conversations">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[0.8125rem] text-muted">
              <span className="font-medium text-text-2">{counts.total} conversations</span>
              <span>{counts.unassigned} unassigned</span>
              <span>{counts.negative} negative</span>
            </div>
            {!rows ? (
              <Skeleton className="h-96" />
            ) : rows.length ? (
              <ul className="max-h-[calc(100dvh-20rem)] space-y-2 overflow-y-auto pr-1 lg:min-h-[28rem]">
                {rows.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => select(x.id)}
                      aria-current={x.id === selected ? 'true' : undefined}
                      className={cn('w-full rounded-xl border bg-surface p-3.5 text-left transition-colors hover:border-border-strong', x.id === selected ? 'border-accent-strong ring-1 ring-accent-strong' : 'border-border')}
                    >
                      <span className="flex items-center gap-2">
                        <ChannelAvatar account={x.account} size={30} />
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-muted">
                          {x.author} · {x.kind === 'Message' ? 'DM' : 'Comment'}
                        </span>
                        <span className="shrink-0 text-xs text-muted">{relativeTime(x.createdAt)}</span>
                      </span>
                      <span className="mt-2 line-clamp-2 block text-[0.9375rem] leading-snug">{x.thread[x.thread.length - 1].text}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone={sentimentTone(x.sentiment)}>{x.sentiment}</Badge>
                        <Badge>{x.category}</Badge>
                        {x.status === 'Resolved' && <Badge tone="good">Resolved</Badge>}
                        <span className="ml-auto truncate text-xs text-muted">{x.ownerName ?? 'Unassigned'}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No conversations match">Try clearing a filter.</EmptyState>
            )}
          </section>
          <section className={cn('min-w-0', !mobileDetail && 'hidden lg:block')} aria-label="Conversation detail">
            <Button variant="ghost" size="sm" className="mb-2 lg:hidden" onClick={() => setMobileDetail(false)}>
              <ArrowLeft /> All conversations
            </Button>
            {selected && rows?.some((r) => r.id === selected) ? <ConversationPanel id={selected} /> : <EmptyState title="Select a conversation" icon={<MessageSquare />} />}
          </section>
        </div>
      )}
    </>
  )
}

function ConversationPanel({ id }: { id: string }) {
  const q = useConversation(id)
  const { actorId } = useSessionContext()
  const [routing, setRouting] = useState<{ ownerId: string | null; sentiment: Sentiment; category: Category } | null>(null)
  const [note, setNote] = useState('')
  const [reply, setReply] = useState('')
  const [suggestion, setSuggestion] = useState<{ confidence: number; basis: string } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const saveRouting = useAction(api.updateRouting, { success: (n) => (n ? 'Owner and classification saved.' : 'No changes to save.') })
  const addNote = useAction(api.addNote, { success: 'Internal note saved. Only staff can see it.' })
  const saveDraft = useAction(api.saveReplyDraft, { success: 'Draft saved. Nothing was sent.' })
  const resolve = useAction(api.resolveConversation, { success: 'Resolved after human review. No external reply was sent.' })
  const reopen = useAction(api.reopenConversation, { success: 'Conversation reopened.' })
  const suggest = useAction(api.suggestReply)

  const c = q.data?.conversation
  useEffect(() => {
    if (!c) return
    setRouting({ ownerId: c.ownerId, sentiment: c.sentiment, category: c.category })
    setReply(c.replyDraft)
    setSuggestion(null)
    setNote('')
    // Reset local edits only when switching conversations.
  }, [c?.id])

  if (!q.data || !c || !routing) return <Skeleton className="h-[36rem]" />
  const { post, eligibleOwners } = q.data
  const canClaim = eligibleOwners.some((o) => o.id === actorId && o.eligible)
  const dirty = routing.ownerId !== c.ownerId || routing.sentiment !== c.sentiment || routing.category !== c.category
  const resolved = c.status === 'Resolved'

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start gap-3 border-b border-border p-5">
        <ChannelAvatar account={c.account} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug">
            {c.id} · {c.kind === 'Message' ? 'Direct message' : 'Comment'}
          </h2>
          <p className="text-sm text-muted">
            {c.account.name} · {c.account.network} · synced {relativeTime(c.account.connection.lastSync)} (simulated)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={resolved ? 'good' : 'info'}>{c.status}</Badge>
          <Tooltip content="Demo only: the original platform link is not available" side="bottom">
            <span>
              <Button size="sm" disabled aria-disabled>
                <ExternalLink /> Open on {c.account.network}
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="grid gap-0 2xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5 p-5">
          {post && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-[0.8125rem] text-text-2">
              On post: <span className="font-medium text-text">{post.title}</span>
            </p>
          )}
          <ol className="space-y-3" aria-label="Conversation thread">
            {c.thread.map((m) => (
              <li key={m.id} className={cn('max-w-[85%] rounded-xl px-4 py-3', m.from === 'resident' ? 'bg-surface-2' : 'ml-auto bg-accent-soft')}>
                <p className="text-[0.8125rem] font-semibold">{m.author}</p>
                <p className="mt-1 leading-relaxed">{m.text}</p>
                <p className="mt-1.5 text-xs text-muted">{formatDateTime(m.at)}</p>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-2 text-[0.8125rem] text-muted">
            <Info className="mt-0.5 size-4 shrink-0" /> {CAPABILITY[c.account.network]}
          </p>

          <div>
            <h3 className="mb-2 font-semibold">Reply</h3>
            <Field label="Human-reviewed response" hint={resolved ? 'Reopen the conversation to reply again.' : 'Replies are reviewed by the response owner. The demo never sends a reply to a platform.'}>
              {(fid) => <Textarea id={fid} rows={5} value={reply} onChange={(e) => setReply(e.target.value)} disabled={resolved} placeholder="Write a reply, or insert a mock suggestion to edit." />}
            </Field>
            {suggestion && (
              <p className="mt-2 rounded-lg border border-dashed border-border-strong px-3 py-2 text-[0.8125rem] text-text-2">
                <Sparkles className="mr-1 inline size-4 text-accent-strong" /> Mock suggestion inserted · {suggestion.confidence}% demo confidence. {suggestion.basis} Edit and verify before use.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={resolved || suggest.isPending}
                onClick={() =>
                  suggest.mutate([c.id], {
                    onSuccess: (r) => {
                      setReply(r.text)
                      setSuggestion({ confidence: r.confidence, basis: r.basis })
                    },
                  })
                }
              >
                <Sparkles /> Mock AI suggestion
              </Button>
              <Button disabled={resolved || saveDraft.isPending} onClick={() => saveDraft.mutate([c.id, reply])}>
                Save draft
              </Button>
              {resolved ? (
                <Button variant="primary" onClick={() => reopen.mutate([c.id])}>
                  Reopen
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!reply.trim()) return toast.error('Write a reply before review.')
                    if (c.ownerId) return setReviewOpen(true)
                    // No owner yet: claim it for the person resolving, when they are allowed to own it.
                    if (!canClaim) return toast.error('This needs a response owner, and you can’t own it. Choose someone with channel access under Response owner.')
                    saveRouting.mutate([c.id, { ownerId: actorId, sentiment: routing.sentiment, category: routing.category }], { onSuccess: () => setReviewOpen(true) })
                  }}
                >
                  Review & resolve
                </Button>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Internal notes</h3>
            {c.notes.length ? (
              <ul className="mb-3 space-y-2">
                {c.notes.map((n) => (
                  <li key={n.id} className="rounded-lg border-l-2 border-warn bg-warn-soft/50 px-3 py-2">
                    <p className="text-[0.8125rem] font-semibold">{n.author}</p>
                    <p className="text-sm">{n.text}</p>
                    <p className="text-xs text-muted">{formatDateTime(n.at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-muted">No notes yet.</p>
            )}
            <Field label="New internal note" hint="Only staff can see notes.">
              {(fid) => <Textarea id={fid} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
            <Button className="mt-2" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate([c.id, note], { onSuccess: () => setNote('') })}>
              Save note
            </Button>
          </div>
        </div>

        <aside className="space-y-5 border-t border-border p-5 2xl:border-l 2xl:border-t-0" aria-label="Routing and classification">
          <div className="rounded-lg border border-border p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[0.8125rem] font-semibold">Classifier signal</p>
              <SimBadge>Simulated</SimBadge>
            </div>
            <p className={cn('tabular text-2xl font-semibold', c.ai.score !== null && c.ai.score <= -50 ? 'text-bad' : c.ai.score !== null && c.ai.score >= 25 ? 'text-good' : '')}>{c.ai.score === null ? 'Unavailable' : signed(c.ai.score)}</p>
            <p className="text-[0.8125rem] text-muted">
              {c.ai.score === null ? 'No score for this sample. Not treated as neutral.' : `${Math.round(c.ai.confidence * 100)}% demo confidence · suggests ${c.ai.category}`}
            </p>
            <p className="mt-2 text-xs text-muted">{c.ai.source}. Uncertain; staff decide.</p>
          </div>

          <Field label="Response owner" hint="Only people with inbox permission on this channel can own it. Resolving claims it for you if it has no owner.">
            {(fid) => (
              <Select id={fid} value={routing.ownerId ?? ''} onChange={(e) => setRouting({ ...routing, ownerId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {eligibleOwners.map((o) => (
                  <option key={o.id} value={o.id} disabled={!o.eligible && o.id !== c.ownerId}>
                    {o.name}
                    {o.eligible ? '' : ' · needs channel access'}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {canClaim && c.ownerId !== actorId && !resolved && (
            <Button className="w-full" disabled={saveRouting.isPending} onClick={() => saveRouting.mutate([c.id, { ownerId: actorId, sentiment: routing.sentiment, category: routing.category }])}>
              Assign to me
            </Button>
          )}
          <Field label="Sentiment (staff override)">
            {(fid) => (
              <Select id={fid} value={routing.sentiment} onChange={(e) => setRouting({ ...routing, sentiment: e.target.value as Sentiment })}>
                {SENTIMENTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Category">
            {(fid) => (
              <Select id={fid} value={routing.category} onChange={(e) => setRouting({ ...routing, category: e.target.value as Category })}>
                {CATEGORIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
          <Button variant={dirty ? 'primary' : 'secondary'} className="w-full" disabled={!dirty || saveRouting.isPending} onClick={() => saveRouting.mutate([c.id, routing])}>
            Save owner & sentiment
          </Button>
        </aside>
      </div>

      <Dialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title={`Review & resolve ${c.id}`}
        description={`Response owner: ${c.ownerName ?? 'Unassigned'}`}
        footer={
          <>
            <Button onClick={() => setReviewOpen(false)}>Keep editing</Button>
            <Button variant="primary" disabled={resolve.isPending} onClick={() => resolve.mutate([c.id, reply], { onSuccess: () => setReviewOpen(false) })}>
              Confirm demo resolution
            </Button>
          </>
        }
      >
        <blockquote className="rounded-lg bg-surface-2 px-4 py-3 leading-relaxed">{reply}</blockquote>
        <p className="mt-3 text-sm text-muted">This resolves the demo conversation and records the reply in the thread. Nothing is sent to {c.account.network}.</p>
      </Dialog>
    </Card>
  )
}
