import { useNavigate, useSearch } from '@tanstack/react-router'
import { CalendarDays, FileText, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePosts } from '@/api/hooks'
import { PostImage } from '@/components/post/PostPreview'
import { PostDetailDialog, STATUS_TONE } from '@/components/post/PostDetailDialog'
import { ChannelAvatar } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, Field, Input, PageHeader, Select, SimBadge, Skeleton } from '@/components/ui/primitives'
import { NETWORKS, type Network, type PostStatus } from '@/domain/types'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'
import type { PostRow } from '@/mock/api-content'

const STATUSES: PostStatus[] = ['Draft', 'In review', 'Approved', 'Scheduled', 'Published', 'Failed']
const PAGE = 12

type Focus = 'all' | 'approve' | 'schedule' | 'returned'

export function ContentPage() {
  const search = useSearch({ from: '/$page' })
  const navigate = useNavigate()
  const [network, setNetwork] = useState<Network | 'All'>((NETWORKS as string[]).includes(search.network ?? '') ? (search.network as Network) : 'All')
  const [status, setStatus] = useState<PostStatus | 'All'>((STATUSES as string[]).includes(search.status ?? '') ? (search.status as PostStatus) : 'All')
  const [group, setGroup] = useState('All')
  const [q, setQ] = useState(search.q ?? '')
  const [focus, setFocus] = useState<Focus>('all')
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(search.c ?? null)
  const posts = usePosts({ network, status, group, q })
  const all = posts.data?.rows

  // Group choices come from the posts the user can see, so the filter never names a group they can't.
  const groups = useMemo(() => {
    const m = new Map<string, string>()
    ;(all ?? []).forEach((r) => r.assetGroupId && r.groupName && m.set(r.assetGroupId, r.groupName))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [all])

  const rows = (all ?? []).filter((r) => (focus === 'all' ? true : focus === 'approve' ? r.actions.includes('approve') : focus === 'schedule' ? r.actions.includes('schedule') : !!r.reviewNote && r.status === 'Draft'))
  const counts = {
    approve: (all ?? []).filter((r) => r.actions.includes('approve')).length,
    schedule: (all ?? []).filter((r) => r.actions.includes('schedule')).length,
    returned: (all ?? []).filter((r) => !!r.reviewNote && r.status === 'Draft').length,
  }
  const reset = (fn: () => void) => {
    fn()
    setShown(PAGE)
  }

  if (posts.error) {
    return (
      <>
        <PageHeader title="All Content" />
        <EmptyState title="Not available" icon={<FileText />}>
          {(posts.error as Error).message}
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="All Content"
        description="Every post across the channels you can access. Posts move from draft to review to approved, then are scheduled separately."
        actions={
          <>
            <SimBadge>Fictional posts · nothing is sent</SimBadge>
            <Button onClick={() => navigate({ to: '/$page', params: { page: 'calendar' } })}>
              <CalendarDays /> Calendar
            </Button>
            {posts.data?.canCreate && (
              <Button variant="primary" onClick={() => navigate({ to: '/$page', params: { page: 'composer' }, search: {} })}>
                <Plus /> Create content
              </Button>
            )}
          </>
        }
      />

      {all && (counts.approve > 0 || counts.schedule > 0 || counts.returned > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Needs your attention">
          <span className="text-sm text-muted">Needs you:</span>
          {([
            ['all', 'Everything', null],
            ['approve', 'Awaiting your approval', counts.approve],
            ['schedule', 'Ready to schedule', counts.schedule],
            ['returned', 'Returned to draft', counts.returned],
          ] as [Focus, string, number | null][]).map(([k, label, n]) =>
            n === 0 ? null : (
              <button
                key={k}
                type="button"
                aria-pressed={focus === k}
                onClick={() => reset(() => setFocus(k))}
                className={cn('rounded-full border px-3 py-1 text-[0.8125rem] font-medium', focus === k ? 'border-accent-strong bg-accent-soft text-text' : 'border-border text-text-2 hover:bg-surface-2')}
              >
                {label}
                {n !== null && <span className="tabular ml-1.5 text-muted">{n}</span>}
              </button>
            ),
          )}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-4">
        <Field label="Network">
          {(id) => (
            <Select id={id} value={network} onChange={(e) => reset(() => setNetwork(e.target.value as Network | 'All'))}>
              <option value="All">All</option>
              {NETWORKS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => reset(() => setStatus(e.target.value as PostStatus | 'All'))}>
              <option value="All">All</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Asset Group">
          {(id) => (
            <Select id={id} value={group} onChange={(e) => reset(() => setGroup(e.target.value))}>
              <option value="All">All</option>
              {groups.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Search">
          {(id) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input id={id} value={q} onChange={(e) => reset(() => setQ(e.target.value))} placeholder="Title, caption or ID" className="pl-9" />
            </div>
          )}
        </Field>
      </div>

      {!all ? (
        <Skeleton className="h-96" />
      ) : posts.data && !posts.data.hasChannels ? (
        <EmptyState title="No channel access yet" icon={<FileText />}>
          You have a content permission, but no channel is assigned to you. An administrator must assign channels before you can see posts.
        </EmptyState>
      ) : !rows.length ? (
        <EmptyState title="No posts match" icon={<FileText />}>
          Try clearing a filter{posts.data?.canCreate ? ', or create new content.' : '.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {rows.length} post{rows.length === 1 ? '' : 's'}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.slice(0, shown).map((r) => (
              <li key={r.id}>
                <PostCard row={r} onOpen={() => setOpen(r.id)} />
              </li>
            ))}
          </ul>
          {rows.length > shown && (
            <div className="mt-6 text-center">
              <Button onClick={() => setShown((n) => n + PAGE)}>
                Load {Math.min(PAGE, rows.length - shown)} more <span className="text-muted">({rows.length - shown} left)</span>
              </Button>
            </div>
          )}
        </>
      )}
      <PostDetailDialog id={open} onClose={() => setOpen(null)} />
    </>
  )
}

function PostCard({ row: r, onOpen }: { row: PostRow; onOpen: () => void }) {
  const needs = r.actions.includes('approve') ? 'Needs your approval' : r.actions.includes('schedule') ? 'Ready to schedule' : r.status === 'Draft' && r.reviewNote ? 'Returned with a note' : null
  return (
    <button type="button" onClick={onOpen} className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition-colors hover:border-border-strong">
      <div className="flex items-center gap-2.5 p-3.5">
        <ChannelAvatar account={r.account} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">{r.account.name}</span>
          <span className="block truncate text-xs text-muted">
            {r.account.network} · {r.format} · {r.authorName}
          </span>
        </span>
        <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
      </div>
      <p className="line-clamp-3 px-3.5 text-[0.9375rem] leading-snug">{r.text}</p>
      <PostImage image={{ photo: r.media?.photo ?? r.photo, blobId: r.media?.blobId }} alt={r.alt} width={600} className="mt-3 aspect-[1.91/1] w-full transition-transform group-hover:scale-[1.01]" />
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3 text-[0.8125rem] text-muted">
        <span className="font-medium text-text-2">{r.title}</span>
        <span className="ml-auto">
          {r.status === 'Scheduled' ? formatDateTime(r.scheduledFor) : r.status === 'Published' && r.publishedAt ? relativeTime(r.publishedAt) : r.status === 'Failed' ? 'Delivery failed' : `Created ${relativeTime(r.createdAt)}`}
        </span>
        {needs && <Badge tone="accent">{needs}</Badge>}
      </div>
    </button>
  )
}
