import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, GripVertical, Lock, Plus } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { useAction, usePosts } from '@/api/hooks'
import { PostDetailDialog, STATUS_TONE } from '@/components/post/PostDetailDialog'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, EmptyState, Field, PageHeader, Segmented, Select, SimBadge, Skeleton } from '@/components/ui/primitives'
import { NETWORKS, type Network, type PostStatus } from '@/domain/types'
import { addDays, addMonths, dayLabel, monthGrid, monthLabel, weekGrid, WEEKDAYS } from '@/lib/calendar'
import { dayKeyHalifax, halifaxToISO, moveToDay, toHalifaxInput } from '@/lib/time'
import { cn, formatDateTime } from '@/lib/utils'
import * as content from '@/mock/api-content'

type View = 'month' | 'week' | 'list'
const STATUSES: PostStatus[] = ['Draft', 'In review', 'Approved', 'Scheduled', 'Published', 'Failed']
const BORDER: Record<PostStatus, string> = {
  Draft: 'border-l-border-strong',
  'In review': 'border-l-warn',
  Approved: 'border-l-accent-strong',
  Scheduled: 'border-l-info',
  Published: 'border-l-good',
  Failed: 'border-l-bad',
}

const whenOf = (p: content.PostRow) => p.scheduledFor ?? p.publishedAt
const timeOf = (p: content.PostRow) => toHalifaxInput(whenOf(p)).slice(11)

export function CalendarPage() {
  const navigate = useNavigate()
  // Phones get the list view: a seven-column grid is too tight there.
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'list' : 'month'))
  const [cursor, setCursor] = useState(dayKeyHalifax(new Date()))
  const [network, setNetwork] = useState<Network | 'All'>('All')
  const [status, setStatus] = useState<PostStatus | 'All'>('All')
  const [open, setOpen] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropDay, setDropDay] = useState<string | null>(null)

  const cells = useMemo(() => (view === 'week' ? weekGrid(cursor) : monthGrid(cursor)), [view, cursor])
  const from = halifaxToISO(`${cells[0].key}T00:00`)
  const to = halifaxToISO(`${addDays(cells[cells.length - 1].key, 1)}T00:00`)
  const posts = usePosts({ network, status, group: 'All', q: '', from, to })
  const approved = usePosts({ network, status: 'Approved', group: 'All', q: '' })
  const move = useAction(content.transitionPost)
  const rows = posts.data?.rows ?? []
  const paused = posts.data?.paused ?? false
  const today = dayKeyHalifax(new Date())

  const byDay = useMemo(() => {
    const m = new Map<string, content.PostRow[]>()
    for (const r of rows) {
      const k = dayKeyHalifax(whenOf(r)!)
      m.set(k, [...(m.get(k) ?? []), r].sort((a, b) => whenOf(a)!.localeCompare(whenOf(b)!)))
    }
    return m
  }, [rows])

  const needsScheduling = (approved.data?.rows ?? []).filter((r) => r.actions.includes('schedule'))
  const all = [...rows, ...(approved.data?.rows ?? [])]
  const movable = (r: content.PostRow) => !paused && (r.actions.includes('reschedule') || r.actions.includes('schedule'))

  const drop = (dayKey: string) => {
    const r = all.find((x) => x.id === dragId)
    setDragId(null)
    setDropDay(null)
    if (!r) return
    if (paused) return void toast.error('Emergency pause is active. Scheduling is locked until publishing resumes.')
    const action = r.actions.includes('schedule') ? 'schedule' : r.actions.includes('reschedule') ? 'reschedule' : null
    if (!action) return void toast.error('You can only move posts you are allowed to schedule.')
    let iso: string
    try {
      iso = moveToDay(r.status === 'Approved' ? null : whenOf(r), dayKey, '10:00')
    } catch (e) {
      return void toast.error((e as Error).message)
    }
    move.mutate([r.id, action, { scheduledFor: iso }], {
      onSuccess: (res) => {
        toast.success(`${r.title} ${action === 'schedule' ? 'scheduled' : 'moved'} to ${formatDateTime(iso)}.`)
        if (res.warning) toast.warning(res.warning)
      },
    })
  }

  const dragProps = (r: content.PostRow) =>
    movable(r)
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            setDragId(r.id)
            e.dataTransfer.setData('text/plain', r.id)
            e.dataTransfer.effectAllowed = 'move'
          },
          onDragEnd: () => {
            setDragId(null)
            setDropDay(null)
          },
        }
      : {}

  const cellProps = (k: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!dragId) return
      e.preventDefault()
      setDropDay(k)
    },
    onDragLeave: () => setDropDay((d) => (d === k ? null : d)),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      drop(k)
    },
  })

  const step = (n: number) => setCursor(view === 'week' ? addDays(cursor, 7 * n) : addMonths(cursor, n))
  const label = view === 'week' ? `${dayLabel(cells[0].key)} to ${dayLabel(cells[6].key)}` : monthLabel(cursor)

  const chip = (r: content.PostRow, compact?: boolean) => (
    <button
      key={r.id}
      type="button"
      onClick={() => setOpen(r.id)}
      title={`${r.title} · ${r.account.name} · ${r.status}${movable(r) ? ' · drag to reschedule' : ''}`}
      {...dragProps(r)}
      className={cn('group flex w-full items-center gap-1.5 rounded-md border border-border border-l-4 bg-surface-2 px-1.5 py-1 text-left text-xs hover:bg-surface-3', BORDER[r.status], dragId === r.id && 'opacity-40', compact && 'py-0.5')}
    >
      {movable(r) && <GripVertical className="size-3 shrink-0 text-muted opacity-0 group-hover:opacity-100" aria-hidden />}
      {timeOf(r) && <span className="tabular shrink-0 text-muted">{timeOf(r)}</span>}
      <span className="truncate font-medium">{r.title}</span>
    </button>
  )

  if (posts.error) {
    return (
      <>
        <PageHeader title="Publishing Calendar" />
        <EmptyState title="Not available">{(posts.error as Error).message}</EmptyState>
      </>
    )
  }

  const dayPosts = day ? (byDay.get(day) ?? []) : []

  return (
    <>
      <PageHeader
        title="Publishing Calendar"
        description="Scheduled and published posts across your channels, in America/Halifax time. Drag a post to another day to reschedule it."
        actions={
          <>
            <SimBadge>Demo queue · nothing is sent</SimBadge>
            {posts.data?.canCreate && (
              <Button variant="primary" onClick={() => navigate({ to: '/$page', params: { page: 'composer' }, search: {} })}>
                <Plus /> Create content
              </Button>
            )}
          </>
        }
      />
      {paused && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-bad-soft px-4 py-2.5 text-sm text-bad">
          <Lock className="size-4" /> Emergency pause is active. Scheduling and rescheduling are locked until an administrator resumes publishing.
        </p>
      )}

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-1">
          <Button size="icon" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <Button size="icon" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => step(1)}>
            <ChevronRight />
          </Button>
          <Button onClick={() => setCursor(today)}>Today</Button>
        </div>
        <h2 className="min-w-44 text-lg font-semibold" aria-live="polite">
          {label}
        </h2>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <Field label="Network" className="w-36">
            {(id) => (
              <Select id={id} value={network} onChange={(e) => setNetwork(e.target.value as Network | 'All')} className="h-9">
                <option value="All">All</option>
                {NETWORKS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status" className="w-36">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as PostStatus | 'All')} className="h-9">
                <option value="All">All</option>
                {STATUSES.filter((s) => s !== 'Draft' && s !== 'In review' && s !== 'Approved').map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
          <Segmented
            label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              ['month', 'Month'],
              ['week', 'Week'],
              ['list', 'List'],
            ]}
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {!posts.data ? (
            <Skeleton className="h-[34rem]" />
          ) : view === 'list' ? (
            <ListView byDay={byDay} cells={cells} onOpen={setOpen} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <div className={cn('grid min-w-[44rem]', 'grid-cols-7')} role="grid" aria-label={label}>
                {WEEKDAYS.map((d) => (
                  <div key={d} role="columnheader" className="border-b border-border px-2 py-2 text-xs font-medium text-muted">
                    {d}
                  </div>
                ))}
                {cells.map((c) => {
                  const list = byDay.get(c.key) ?? []
                  const max = view === 'week' ? 50 : 3
                  return (
                    <div
                      key={c.key}
                      role="gridcell"
                      aria-label={`${dayLabel(c.key, { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} post${list.length === 1 ? '' : 's'}`}
                      data-day={c.key}
                      {...cellProps(c.key)}
                      className={cn('border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0', view === 'week' ? 'min-h-[22rem]' : 'min-h-[7.5rem]', !c.inMonth && 'bg-surface-2/50 text-muted', dropDay === c.key && 'bg-accent-soft outline outline-2 -outline-offset-2 outline-accent-strong')}
                    >
                      <p className={cn('mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular', c.key === today ? 'bg-accent font-bold text-accent-ink' : 'text-text-2')}>{Number(c.key.slice(8))}</p>
                      <div className="space-y-1">
                        {list.slice(0, max).map((r) => (
                          chip(r, true)
                        ))}
                        {list.length > max && (
                          <button type="button" onClick={() => setDay(c.key)} className="w-full rounded px-1.5 py-0.5 text-left text-xs font-medium text-accent-strong hover:underline">
                            +{list.length - max} more
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
            {(['Approved', 'Scheduled', 'Published', 'Failed'] as PostStatus[]).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className={cn('inline-block h-3.5 w-1 rounded-sm', BORDER[s].replace('border-l-', 'bg-'))} aria-hidden />
                {s}
              </li>
            ))}
            <li>Posts without a date (drafts, in review) are in All Content.</li>
          </ul>
        </div>

        <aside aria-label="Needs scheduling">
          <Card className="p-4">
            <h2 className="font-semibold">Needs scheduling</h2>
            <p className="mb-3 text-[0.8125rem] text-muted">Approved posts. Drag one onto a day to schedule it at 10:00, or open it to pick a time.</p>
            {!approved.data ? (
              <Skeleton className="h-24" />
            ) : needsScheduling.length ? (
              <ul className="space-y-2">
                {needsScheduling.map((r) => (
                  <li key={r.id}>
                    <div className="space-y-1">
                      {chip(r)}
                      <p className="px-1 text-[0.6875rem] text-muted">
                        {r.account.name} · {r.account.network}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{(approved.data.rows.length ? 'Approved posts exist, but you cannot schedule them.' : 'Nothing is waiting to be scheduled.')}</p>
            )}
          </Card>
        </aside>
      </div>

      <PostDetailDialog id={open} onClose={() => setOpen(null)} />
      <Dialog open={!!day} onOpenChange={(o) => !o && setDay(null)} title={day ? dayLabel(day, { weekday: 'long', month: 'long', day: 'numeric' }) : ''} description={`${dayPosts.length} posts`}>
        <ul className="space-y-1.5">
          {dayPosts.map((r) => (
            <li key={r.id}>
              {chip(r)}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  )
}

function ListView({ byDay, cells, onOpen }: { byDay: Map<string, content.PostRow[]>; cells: { key: string; inMonth: boolean }[]; onOpen: (id: string) => void }) {
  const days = cells.filter((c) => c.inMonth && byDay.has(c.key))
  if (!days.length) return <EmptyState title="Nothing scheduled or published in this range">Try another month, or clear a filter.</EmptyState>
  return (
    <Card className="p-0">
      {days.map((c) => (
        <section key={c.key} className="border-b border-border last:border-0">
          <h3 className="bg-surface-2 px-4 py-2 text-sm font-semibold">{dayLabel(c.key, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          <ul className="divide-y divide-border">
            {byDay.get(c.key)!.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left hover:bg-surface-2">
                  <span className="tabular w-14 text-sm text-muted">{timeOf(r)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block truncate text-[0.8125rem] text-muted">
                      {r.account.name} · {r.account.network}
                    </span>
                  </span>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Card>
  )
}
