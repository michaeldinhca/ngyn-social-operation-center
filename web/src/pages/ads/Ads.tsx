import { useNavigate, useSearch } from '@tanstack/react-router'
import { Megaphone, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useAds } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, PageHeader, Segmented, SimBadge, Skeleton } from '@/components/ui/primitives'
import { money } from '@/domain/ads'
import type { CampaignStatus } from '@/domain/types'
import { cn, formatDateTime } from '@/lib/utils'
import type { CampaignRow } from '@/mock/api-ads'
import { dayLabel } from '@/lib/calendar'
import { AdAccounts } from './AdAccounts'
import { CampaignEditor } from './CampaignEditor'

export const CAMPAIGN_TONE: Record<CampaignStatus, 'neutral' | 'warn' | 'good'> = { Draft: 'neutral', 'In review': 'warn', Approved: 'good' }

export function SpendGuardBanner({ spentCents = 0 }: { spentCents?: number }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-accent-strong/40 bg-accent-soft px-4 py-3 text-sm">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" />
      <p className="text-text-2">
        <strong className="text-text">No-spend guard: nothing can be purchased from this mockup.</strong> Budgets are simulated planning numbers against a simulated limit. Campaigns stop at "Approved", and approval never authorizes spend. Spent so far:{' '}
        <strong className="tabular text-text">{money(spentCents)}</strong>.
      </p>
    </div>
  )
}

export function AdsPage() {
  const search = useSearch({ from: '/$page' })
  const navigate = useNavigate()
  const ads = useAds()
  const [tab, setTab] = useState<'campaigns' | 'accounts'>('campaigns')
  const [status, setStatus] = useState<CampaignStatus | 'All'>('All')
  const d = ads.data
  const open = search.c ?? null
  const go = (c?: string) => navigate({ to: '/$page', params: { page: 'ads' }, search: c ? { c } : {}, replace: false })

  if (ads.error) {
    return (
      <>
        <PageHeader title="Campaigns" />
        <EmptyState title="Not available" icon={<Megaphone />}>
          {(ads.error as Error).message}
        </EmptyState>
      </>
    )
  }
  if (!d) return <Skeleton className="h-96" />
  if (open) return <CampaignEditor id={open} onBack={() => go()} />

  const rows = d.campaigns.filter((c) => status === 'All' || c.status === status)
  const needs = d.campaigns.filter((c) => c.actions.includes('approve')).length
  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Paid social campaign drafts with simulated budgets. Review the plan, submit it for approval and track it. Nothing is ever purchased."
        actions={
          <>
            <SimBadge>Simulated budgets · no spend</SimBadge>
            {d.canCreate && (
              <Button variant="primary" onClick={() => go('new')}>
                <Plus /> New campaign
              </Button>
            )}
          </>
        }
      />
      <SpendGuardBanner spentCents={d.campaigns.reduce((a, c) => a + c.spentCents, 0)} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Advertising section"
          value={tab}
          onChange={setTab}
          options={[
            ['campaigns', `Campaigns (${d.campaigns.length})`],
            ['accounts', `Ad accounts (${d.accounts.length})`],
          ]}
        />
        {tab === 'campaigns' && (
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {(['All', 'Draft', 'In review', 'Approved'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={cn('rounded-full border px-3 py-1 text-[0.8125rem] font-medium', status === s ? 'border-accent-strong bg-accent-soft' : 'border-border text-text-2 hover:bg-surface-2')}>
                {s}
                {s === 'In review' && needs > 0 && <span className="tabular ml-1.5 text-warn">{needs} need you</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === 'accounts' ? (
        <AdAccounts d={d} />
      ) : rows.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <CampaignCard c={c} onOpen={() => go(c.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No campaigns" icon={<Megaphone />}>
          {d.canCreate ? 'Create a campaign draft to plan a simulated budget.' : 'No campaigns on the ad accounts you can access.'}
        </EmptyState>
      )}
    </>
  )
}

function CampaignCard({ c, onOpen }: { c: CampaignRow; onOpen: () => void }) {
  const needs = c.actions.includes('approve')
  return (
    <button type="button" onClick={onOpen} className="flex h-full w-full flex-col rounded-xl border border-border bg-surface p-4 text-left hover:border-border-strong">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{c.name}</h3>
        <Badge tone={CAMPAIGN_TONE[c.status]}>{c.status}</Badge>
      </div>
      <p className="text-[0.8125rem] text-muted">
        {c.account.name} · {c.account.network} · {c.objective}
      </p>
      <p className="mt-3 line-clamp-2 text-sm text-text-2">{c.headline || 'No headline yet.'}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
        <dt className="text-muted">Runs</dt>
        <dd className="tabular">
          {c.startDay ? `${dayLabel(c.startDay)} to ${dayLabel(c.endDay)}` : 'Dates not set'}
        </dd>
        <dt className="text-muted">Daily budget</dt>
        <dd className="tabular">{money(c.dailyBudgetCents)} · simulated</dd>
        <dt className="text-muted">Total planned</dt>
        <dd className="tabular">{money(c.totalCents)} · simulated</dd>
        <dt className="text-muted">Spent</dt>
        <dd className="tabular font-medium">{money(c.spentCents)}</dd>
      </dl>
      <p className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs text-muted">
        <span>Created {formatDateTime(c.createdAt)} by {c.createdByName}</span>
        {needs && <Badge tone="accent">Needs your approval</Badge>}
        {c.status === 'Draft' && c.reviewNote && <Badge tone="warn">Returned</Badge>}
      </p>
    </button>
  )
}
