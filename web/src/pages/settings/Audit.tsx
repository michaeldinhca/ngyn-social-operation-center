import { ChevronLeft, ChevronRight, ScrollText, Search } from 'lucide-react'
import { useState } from 'react'
import { useAudit } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, SimBadge, Skeleton } from '@/components/ui/primitives'
import { formatDateTime, relativeTime } from '@/lib/utils'
import { AUDIT_CATEGORIES, type AuditCategory } from '@/mock/api-users'

const TONE: Record<AuditCategory, 'neutral' | 'warn' | 'bad' | 'info' | 'good' | 'accent'> = {
  Access: 'warn',
  Content: 'info',
  Engagement: 'neutral',
  'Channels and groups': 'accent',
  Media: 'neutral',
  Advertising: 'accent',
  Emergency: 'bad',
  Reports: 'good',
  System: 'neutral',
}

export function AuditPage() {
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('All')
  const [category, setCategory] = useState<AuditCategory | 'All'>('All')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const log = useAudit({ q, actor, category, from, to, page })
  const d = log.data
  const reset = (fn: () => void) => {
    fn()
    setPage(1)
  }

  if (log.error) {
    return (
      <>
        <PageHeader title="Activity Log" />
        <EmptyState title="Not available" icon={<ScrollText />}>
          {(log.error as Error).message}
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Activity Log"
        description="Who did what, and when: permission changes, approvals, publishing, pauses and exports."
        actions={<SimBadge>Browser-local demo data</SimBadge>}
      />
      <p className="mb-4 text-[0.8125rem] text-muted">A production log is append-only, stored on the server and tamper-evident. This demo log lives in your browser and can be reset.</p>

      <Card className="mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
        <Field label="Search" className="col-span-2 md:col-span-1">
          {(id) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input id={id} value={q} onChange={(e) => reset(() => setQ(e.target.value))} placeholder="Action or detail" className="pl-9" />
            </div>
          )}
        </Field>
        <Field label="Who">
          {(id) => (
            <Select id={id} value={actor} onChange={(e) => reset(() => setActor(e.target.value))}>
              <option value="All">Anyone</option>
              {d?.actors.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Category">
          {(id) => (
            <Select id={id} value={category} onChange={(e) => reset(() => setCategory(e.target.value as AuditCategory | 'All'))}>
              <option value="All">All</option>
              {AUDIT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} />}</Field>
        <Field label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} />}</Field>
      </Card>

      {!d ? (
        <Skeleton className="h-96" />
      ) : !d.rows.length ? (
        <EmptyState title="No activity matches" icon={<ScrollText />}>
          Try clearing a filter.
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted" aria-live="polite">
            {d.total} event{d.total === 1 ? '' : 's'} · page {d.page} of {d.pages}
          </p>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {d.rows.map((e) => (
                <li key={e.id} className="grid gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[11rem_9rem_1fr]">
                  <span className="text-sm text-text-2">
                    <span className="block">{formatDateTime(e.at)}</span>
                    <span className="block text-xs text-muted">{relativeTime(e.at)}</span>
                  </span>
                  <span className="text-sm font-medium">{e.actor}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.action}</span>
                      <Badge tone={TONE[e.category]}>{e.category}</Badge>
                    </span>
                    <span className="block break-words text-[0.8125rem] text-muted">{e.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-2">
            <Button disabled={d.page <= 1} onClick={() => setPage(d.page - 1)} aria-label="Previous page">
              <ChevronLeft /> Previous
            </Button>
            <span className="tabular px-2 text-sm text-muted">
              {d.page} / {d.pages}
            </span>
            <Button disabled={d.page >= d.pages} onClick={() => setPage(d.page + 1)} aria-label="Next page">
              Next <ChevronRight />
            </Button>
          </nav>
        </>
      )}
    </>
  )
}
