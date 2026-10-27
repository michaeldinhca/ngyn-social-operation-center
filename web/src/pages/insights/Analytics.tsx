import { BarChart3, Download, FileSpreadsheet, FileText, Info } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAction, useAnalytics } from '@/api/hooks'
import { DataTable, LineChart } from '@/components/charts/charts'
import { NetworkMark } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Segmented, Select, SimBadge, Skeleton } from '@/components/ui/primitives'
import { addDays } from '@/lib/calendar'
import { dayKeyHalifax } from '@/lib/time'
import { AVAILABILITY, DATA_STARTS, METRICS, RANGES, UNAVAILABLE_REASON, validateCustom, type MetricKey, type RangeId } from '@/domain/analytics'
import { NETWORKS, type Department, type Network } from '@/domain/types'
import { csvFilename } from './filenames'
import { download, toCsv } from '@/lib/csv'
import { buildPdf } from '@/lib/pdf'
import { cn, formatDateTime, shortNumber, signed } from '@/lib/utils'
import * as api from '@/mock/api-analytics'

type ChartMetric = MetricKey | 'sentiment'

const pct = (v: number | null, digits = 1) => (v === null ? 'Unavailable' : `${(v * 100).toFixed(digits)}%`)
const num = (v: number | null) => (v === null ? 'Unavailable' : v.toLocaleString('en-CA'))

function Delta({ change }: { change: number | null }) {
  if (change === null) return <span className="text-muted">No comparison</span>
  const up = change > 0
  return (
    <span className={cn('tabular font-medium', change === 0 ? 'text-muted' : up ? 'text-good' : 'text-bad')}>
      <span aria-hidden>{change === 0 ? '→' : up ? '▲' : '▼'}</span> {Math.abs(change)}% <span className="sr-only">{up ? 'up' : change < 0 ? 'down' : 'unchanged'}</span>
      <span className="ml-1 font-normal text-muted">vs previous period</span>
    </span>
  )
}

export function AnalyticsPage() {
  const [range, setRange] = useState<RangeId>('30d')
  const [network, setNetwork] = useState<Network | 'All'>('All')
  const [department, setDepartment] = useState<Department | 'All'>('All')
  const [metric, setMetric] = useState<ChartMetric>('impressions')
  const [sort, setSort] = useState<'impressions' | 'engagements' | 'engagementRate' | 'followers' | 'sentiment'>('impressions')
  const [exporting, setExporting] = useState(false)
  const today = dayKeyHalifax(new Date())
  const [from, setFrom] = useState(addDays(today, -29))
  const [to, setTo] = useState(today)
  const customError = range === 'custom' ? validateCustom(from, to, today) : null
  // Keep showing the last valid report while the dates being typed are not valid yet.
  const [applied, setApplied] = useState({ from, to })
  useEffect(() => {
    if (!customError) setApplied({ from, to })
  }, [from, to, customError])
  const q = useAnalytics({ range, network, department, ...(range === 'custom' ? applied : {}) })
  const record = useAction(api.recordExport)
  const r = q.data

  // A filter chosen for someone else (after "View as") may not exist for this person: fall back to All.
  useEffect(() => {
    if (!r) return
    if (department !== 'All' && !r.options.departments.includes(department)) setDepartment('All')
    if (network !== 'All' && !r.options.networks.includes(network)) setNetwork('All')
  }, [r, department, network])

  const accounts = useMemo(() => {
    if (!r) return []
    return [...r.accounts].sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity))
  }, [r, sort])

  if (q.error) {
    return (
      <>
        <PageHeader title="Analytics & Reports" />
        <EmptyState title="Not available" icon={<BarChart3 />}>
          {(q.error as Error).message}
        </EmptyState>
      </>
    )
  }
  if (!r) return <Skeleton className="h-[70vh]" />

  const maxImpr = Math.max(1, ...accounts.map((a) => a.impressions ?? 0))
  const series = r.points.map((p) => ({ label: p.label, value: p[metric], detail: metric === 'sentiment' ? (p.sentimentSamples ? `${p.sentimentSamples} scored samples` : 'No samples') : `${p.start === p.end ? p.start : `${p.start} to ${p.end}`}` }))
  const metricTotal = metric === 'sentiment' ? r.totals.sentiment.value : r.totals[metric].value
  const label = metric === 'sentiment' ? 'Average sentiment' : METRICS.find((m) => m.key === metric)!.label

  const tiles: { label: string; value: string; delta: React.ReactNode; note?: string }[] = [
    ...METRICS.map((m) => {
      const t = r.totals[m.key]
      return {
        label: m.label,
        value: t.value === null ? 'Unavailable' : shortNumber(t.value),
        delta: t.value === null ? <span className="text-muted">No selected channel reports this</span> : <Delta change={t.change} />,
        note: t.value !== null && t.reporting < t.of ? `${t.reporting} of ${t.of} channels report this` : undefined,
      }
    }),
    { label: 'Engagement rate', value: pct(r.totals.engagementRate.value), delta: <Delta change={r.totals.engagementRate.change} />, note: 'Engagements per impression, channels reporting both' },
    {
      label: 'Average sentiment',
      value: r.canReadSentiment ? signed(r.totals.sentiment.value) : 'Unavailable',
      delta: <span className="text-muted">{r.canReadSentiment ? `${r.totals.sentiment.samples} scored sample conversations` : 'Needs inbox permission on these channels'}</span>,
      note: 'Simulated classifier, uncertain',
    },
  ]

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const summary = `${r.rangeLabel}, ${network}, ${department}`

  const exportSeries = () => {
    const csv = toCsv(['period', 'period_start', 'period_end', 'impressions', 'reach', 'engagements', 'followers_gained', 'avg_sentiment', 'sentiment_samples', 'data_status'], r.points.map((p) => [p.label, p.start, p.end, p.impressions, p.reach, p.engagements, p.followers, p.sentiment, p.sentimentSamples, 'SAMPLE']))
    download(csvFilename('series', r.range, stamp), csv, 'text/csv;charset=utf-8')
    record.mutate(['CSV time series', summary], { onSuccess: () => toast.success('CSV downloaded. Every row is marked SAMPLE.') })
  }
  const exportAccounts = () => {
    const csv = toCsv(['account', 'network', 'department', 'impressions', 'reach', 'engagements', 'engagement_rate_pct', 'followers_gained', 'avg_sentiment', 'data_status'], r.accounts.map((a) => [a.name, a.network, a.department, a.impressions, a.reach, a.engagements, a.engagementRate === null ? null : Number((a.engagementRate * 100).toFixed(2)), a.followers, a.sentiment, 'SAMPLE']))
    download(csvFilename('accounts', r.range, stamp), csv, 'text/csv;charset=utf-8')
    record.mutate(['CSV account comparison', summary], { onSuccess: () => toast.success('CSV downloaded. Every row is marked SAMPLE.') })
  }
  const exportPdf = () => {
    const pdf = buildPdf({
      title: 'NGYN Social Operation Center sample report',
      watermark: 'SAMPLE',
      footer: 'Synthetic sample data. Not for reporting.',
      blocks: [
        { type: 'h1', text: 'Analytics report (SAMPLE)' },
        { type: 'note', text: r.source },
        { type: 'space' },
        {
          type: 'kv',
          rows: [
            ['Period', `${r.rangeLabel} (${r.granularity.toLowerCase()})`],
            ['Window', `${r.window.startDay} to ${r.window.endDay} (America/Halifax)`],
            ['Network', r.filters.network],
            ['Department', r.filters.department],
            ['Channels', String(r.accountCount)],
            ['Data refreshed', formatDateTime(r.refreshedAt)],
            ['Generated', formatDateTime(new Date().toISOString())],
          ],
        },
        { type: 'h2', text: 'Totals and change versus the previous period' },
        {
          type: 'table',
          columns: [
            { title: 'Metric', width: 150 },
            { title: 'Value', width: 90, align: 'right' },
            { title: 'Previous', width: 90, align: 'right' },
            { title: 'Change', width: 70, align: 'right' },
            { title: 'Channels reporting', width: 100, align: 'right' },
          ],
          rows: METRICS.map((m) => {
            const t = r.totals[m.key]
            return [m.label, num(t.value), num(t.previous), t.change === null ? 'n/a' : `${t.change}%`, `${t.reporting} of ${t.of}`]
          }),
        },
        { type: 'p', text: `Engagement rate: ${pct(r.totals.engagementRate.value)}. Average sentiment: ${r.canReadSentiment ? signed(r.totals.sentiment.value) : 'unavailable'} (simulated).` },
        ...(r.unavailable.length ? [{ type: 'h2' as const, text: 'Unavailable metrics' }, ...r.unavailable.map((t) => ({ type: 'p' as const, text: t }))] : []),
        { type: 'h2', text: 'By department' },
        {
          type: 'table',
          columns: [
            { title: 'Department', width: 130 },
            { title: 'Channels', width: 60, align: 'right' },
            { title: 'Impressions', width: 90, align: 'right' },
            { title: 'Engagements', width: 90, align: 'right' },
            { title: 'Rate', width: 60, align: 'right' },
            { title: 'Followers', width: 60, align: 'right' },
          ],
          rows: r.departments.map((d) => [d.department, String(d.accounts), num(d.impressions), num(d.engagements), pct(d.engagementRate), num(d.followers)]),
        },
        { type: 'h2', text: 'By channel' },
        {
          type: 'table',
          columns: [
            { title: 'Channel', width: 170 },
            { title: 'Network', width: 60 },
            { title: 'Impressions', width: 75, align: 'right' },
            { title: 'Engagements', width: 75, align: 'right' },
            { title: 'Rate', width: 55, align: 'right' },
            { title: 'Followers', width: 55, align: 'right' },
          ],
          rows: r.accounts.map((a) => [a.name, a.network, num(a.impressions), num(a.engagements), pct(a.engagementRate), num(a.followers)]),
        },
        { type: 'note', text: 'Unavailable means the network does not provide that metric. It is never shown as zero.' },
      ],
    })
    download(`sample-report-${r.range}-${stamp}.pdf`, pdf as unknown as BlobPart, 'application/pdf')
    record.mutate(['PDF report', summary], { onSuccess: () => toast.success('PDF downloaded. Every page carries the SAMPLE watermark.') })
  }

  return (
    <>
      <PageHeader
        title="Analytics & Reports"
        description="Reach, engagement, audience growth and sentiment across the channels you can access, with comparisons to the previous period."
        actions={
          <>
            <SimBadge>Synthetic sample data</SimBadge>
            <Button variant="primary" onClick={() => setExporting(true)}>
              <Download /> Export
            </Button>
          </>
        }
      />

      <Card className="mb-3 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <Field label="Reporting period">
          {(id) => (
            <Select id={id} value={range} onChange={(e) => setRange(e.target.value as RangeId)}>
              {RANGES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label} ({x.granularity.toLowerCase()})
                </option>
              ))}
            </Select>
          )}
        </Field>
        {range === 'custom' && (
          <div className="order-last grid gap-3 sm:col-span-3 sm:grid-cols-2">
            <Field label="From" hint={`Sample data starts ${DATA_STARTS}.`}>{(id) => <Input id={id} type="date" min={DATA_STARTS} max={today} value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
            <Field label="To" hint="Up to today. At most 3 years in total.">{(id) => <Input id={id} type="date" min={DATA_STARTS} max={today} value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
            {customError && (
              <p role="alert" className="text-sm text-bad sm:col-span-2">
                {customError} Showing the last valid range.
              </p>
            )}
          </div>
        )}
        <Field label="Network">
          {(id) => (
            <Select id={id} value={network} onChange={(e) => setNetwork(e.target.value as Network | 'All')}>
              <option value="All">All networks</option>
              {NETWORKS.filter((n) => r.options.networks.includes(n)).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Department">
          {(id) => (
            <Select id={id} value={department} onChange={(e) => setDepartment(e.target.value as Department | 'All')}>
              <option value="All">All departments</option>
              {r.options.departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          )}
        </Field>
      </Card>
      <p className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
        <span className="flex items-start gap-1.5">
          <Info className="mt-0.5 size-4 shrink-0" /> {r.source}
        </span>
        <span>
          Data refreshed {formatDateTime(r.refreshedAt)} · {r.accountCount} channel{r.accountCount === 1 ? '' : 's'} · {r.window.startDay} to {r.window.endDay} (America/Halifax)
        </span>
      </p>

      {r.accountCount === 0 ? (
        <EmptyState title="No channels match" icon={<BarChart3 />}>
          Change the network or department filter. Reports only include channels you can access.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="bg-surface p-5">
                <p className="text-sm text-text-2">{t.label}</p>
                <p className={cn('tabular mt-2 font-semibold leading-none tracking-tight', t.value === 'Unavailable' ? 'text-[1.5rem] text-muted' : 'text-[2.25rem]')}>{t.value}</p>
                <p className="mt-2 text-[0.8125rem]">{t.delta}</p>
                {t.note && <p className="mt-0.5 text-xs text-muted">{t.note}</p>}
              </div>
            ))}
          </div>

          {r.unavailable.length > 0 && (
            <div className="mb-5 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
              <p className="mb-1 font-semibold text-warn">Some metrics are unavailable for part of this selection</p>
              <ul className="list-disc space-y-0.5 pl-5 text-text-2">
                {r.unavailable.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted">Unavailable values are left out of totals. They are never shown as zero. Support per network is from provider documentation and not yet verified.</p>
            </div>
          )}

          <Card className="mb-5">
            <CardHeader
              title={`${label} over time`}
              description={`${r.rangeLabel} · ${r.granularity.toLowerCase()} · synthetic samples`}
              action={
                <Segmented
                  label="Chart metric"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    ['impressions', 'Impressions'],
                    ['reach', 'Reach'],
                    ['engagements', 'Engagements'],
                    ['followers', 'Followers'],
                    ['sentiment', 'Sentiment'],
                  ]}
                />
              }
            />
            {metricTotal === null && !series.some((p) => p.value !== null) ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                {metric === 'sentiment' ? (r.canReadSentiment ? 'No scored conversations in this period.' : 'Sentiment needs inbox permission on these channels.') : `${label} is unavailable for the selected channels.`}
              </p>
            ) : (
              <LineChart
                ariaLabel={`${label} for ${r.rangeLabel}, synthetic sample. A data table follows.`}
                points={series}
                domain={metric === 'sentiment' ? [-100, 100] : undefined}
                zeroLine={metric === 'sentiment' || metric === 'followers'}
                valueLabel={(v) => (v === null ? 'No data' : metric === 'sentiment' ? `Sentiment ${signed(v)}` : `${v.toLocaleString('en-CA')} ${label.toLowerCase()}`)}
              />
            )}
            <details className="mt-3 rounded-lg border border-border">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-text-2 hover:text-text">View all values and source</summary>
              <DataTable
                caption="All reported values by period"
                columns={['Period', 'Impressions', 'Reach', 'Engagements', 'Followers', 'Sentiment', 'Source']}
                rows={r.points.map((p) => [p.label, num(p.impressions), num(p.reach), num(p.engagements), num(p.followers), p.sentiment === null ? 'No samples' : signed(p.sentiment), 'Synthetic sample'])}
              />
            </details>
          </Card>

          <div className="mb-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader title="By department" description="Department comparison for the selected period and filters" />
              <DataTable
                caption="Department comparison"
                columns={['Department', 'Channels', 'Impressions', 'Engagements', 'Rate', 'Followers', 'Sentiment']}
                rows={r.departments.map((d) => [d.department, d.accounts, num(d.impressions), num(d.engagements), pct(d.engagementRate), num(d.followers), d.sentiment === null ? 'No samples' : signed(d.sentiment)])}
              />
            </Card>
            <Card>
              <CardHeader title="What each network can report" description="Demo assumptions from provider docs, unverified" />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[0.8125rem]">
                  <caption className="sr-only">Metric availability by network</caption>
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th scope="col" className="px-2 py-2 font-medium">
                        Network
                      </th>
                      {METRICS.map((m) => (
                        <th key={m.key} scope="col" className="px-2 py-2 text-center font-medium">
                          {m.label.replace(' gained', '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NETWORKS.map((n) => (
                      <tr key={n} className="border-b border-border/60 last:border-0">
                        <th scope="row" className="flex items-center gap-2 px-2 py-2 font-medium">
                          <NetworkMark network={n} /> {n}
                        </th>
                        {METRICS.map((m) => (
                          <td key={m.key} className="px-2 py-2 text-center" title={UNAVAILABLE_REASON[n][m.key]}>
                            {AVAILABILITY[n][m.key] ? <span className="text-good">Yes</span> : <span className="text-muted">Unavailable</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="By channel"
              description="Cross-account comparison. Bars compare impressions; unavailable stays unavailable."
              action={
                <Select aria-label="Sort channels by" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 w-48">
                  <option value="impressions">Sort: impressions</option>
                  <option value="engagements">Sort: engagements</option>
                  <option value="engagementRate">Sort: engagement rate</option>
                  <option value="followers">Sort: followers gained</option>
                  <option value="sentiment">Sort: sentiment</option>
                </Select>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[0.8125rem]">
                <caption className="sr-only">Channel comparison</caption>
                <thead>
                  <tr className="border-b border-border text-muted">
                    {['Channel', 'Impressions', 'Reach', 'Engagements', 'Rate', 'Followers', 'Sentiment'].map((h, i) => (
                      <th key={h} scope="col" className={cn('px-2 py-2 font-medium', i > 0 && 'text-right')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="min-w-52 px-2 py-2 text-left font-medium">
                        <span className="flex items-center gap-2">
                          <NetworkMark network={a.network} />
                          <span className="min-w-0">
                            <span className="block truncate">{a.name}</span>
                            <span className="block text-xs font-normal text-muted">{a.department}</span>
                          </span>
                        </span>
                      </th>
                      <td className="tabular px-2 py-2 text-right">
                        <span className="block">{num(a.impressions)}</span>
                        {a.impressions !== null && (
                          <span className="mt-1 ml-auto block h-1.5 w-24 overflow-hidden rounded bg-surface-3" aria-hidden>
                            <span className="block h-full rounded bg-[var(--chart-line)]" style={{ width: `${(a.impressions / maxImpr) * 100}%` }} />
                          </span>
                        )}
                      </td>
                      <td className="tabular px-2 py-2 text-right">{a.reach === null ? <span className="text-muted">Unavailable</span> : num(a.reach)}</td>
                      <td className="tabular px-2 py-2 text-right">{num(a.engagements)}</td>
                      <td className="tabular px-2 py-2 text-right">{a.engagementRate === null ? <span className="text-muted">Unavailable</span> : pct(a.engagementRate)}</td>
                      <td className="tabular px-2 py-2 text-right">{num(a.followers)}</td>
                      <td className="tabular px-2 py-2 text-right">{a.sentiment === null ? <span className="text-muted">No samples</span> : signed(a.sentiment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Dialog
        open={exporting}
        onOpenChange={setExporting}
        title="Export report"
        description="Files use the filters on screen. Every file is watermarked SAMPLE because the data is synthetic."
        footer={<Button onClick={() => setExporting(false)}>Close</Button>}
      >
        <ul className="space-y-2">
          {[
            { icon: <FileSpreadsheet />, title: 'Time series (CSV)', text: `${r.points.length} ${r.granularity.toLowerCase()} periods. Empty cells mean unavailable. Each row has data_status = SAMPLE.`, run: exportSeries },
            { icon: <FileSpreadsheet />, title: 'Channel comparison (CSV)', text: `${r.accounts.length} channels with rates and sentiment. Each row has data_status = SAMPLE.`, run: exportAccounts },
            { icon: <FileText />, title: 'Report (PDF)', text: 'Totals, previous-period change, unavailable notes, departments and channels. SAMPLE watermark on every page.', run: exportPdf },
          ].map((o) => (
            <li key={o.title}>
              <button type="button" onClick={o.run} disabled={r.accountCount === 0} className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-surface-2 disabled:opacity-50 [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:text-accent-strong">
                {o.icon}
                <span>
                  <span className="block font-medium">{o.title}</span>
                  <span className="block text-[0.8125rem] text-muted">{o.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Badge>Audited</Badge> Each export is recorded in the activity log.
        </p>
      </Dialog>
    </>
  )
}
