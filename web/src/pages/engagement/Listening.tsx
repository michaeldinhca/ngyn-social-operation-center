import { useNavigate, useSearch } from '@tanstack/react-router'
import { AudioLines, Bell, BellOff, ExternalLink, Plus, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAction, useTopic, useTopics } from '@/api/hooks'
import { BarChart, DataTable, SentimentBar } from '@/components/charts/charts'
import { NetworkMark } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Segmented, Select, SimBadge, Skeleton } from '@/components/ui/primitives'
import type { ListeningAlert, MentionSource, Network } from '@/domain/types'
import { cn, relativeTime, signed } from '@/lib/utils'
import * as api from '@/mock/api'

const SOURCES: (MentionSource | 'All')[] = ['All', 'Owned comment', 'Public post', 'News', 'Forum', 'Blog']

export function ListeningPage() {
  const search = useSearch({ from: '/$page' })
  const navigate = useNavigate()
  const topics = useTopics()
  const [source, setSource] = useState<string>('All')
  const [newTopic, setNewTopic] = useState(false)
  const selected = search.topic ?? topics.data?.[0]?.id ?? null
  const detail = useTopic(selected, source)
  const choose = (id: string) => navigate({ to: '/$page', params: { page: 'listening' }, search: { topic: id }, replace: true })

  if (topics.error) {
    return (
      <>
        <PageHeader title="Social Listening" />
        <EmptyState title="Listening not available" icon={<AudioLines />}>
          {(topics.error as Error).message}
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Social Listening"
        description="Track topics, keywords and hashtags across sources, with configurable alerts."
        actions={
          <>
            <SimBadge>Sample mentions · no provider connected</SimBadge>
            <Button variant="primary" onClick={() => setNewTopic(true)}>
              <Plus /> New topic
            </Button>
          </>
        }
      />
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" />
        <p className="text-text-2">
          <strong className="text-text">Coverage is not universal.</strong> Comments on Harbourview’s own accounts can come from the social API. Public posts, news, forums and blogs need a separately licensed listening provider, which is
          not chosen yet. Every mention below is fictional.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <section aria-label="Topics" className="space-y-2">
          {!topics.data ? (
            <Skeleton className="h-72" />
          ) : (
            topics.data.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t.id)}
                aria-current={t.id === selected ? 'true' : undefined}
                className={cn('w-full rounded-xl border bg-surface p-4 text-left transition-colors hover:border-border-strong', t.id === selected ? 'border-accent-strong ring-1 ring-accent-strong' : 'border-border')}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-snug">{t.name}</span>
                  {t.alertTriggered && (
                    <Badge tone="bad">
                      <Bell /> Alert
                    </Badge>
                  )}
                </span>
                <span className="mt-1 block truncate text-[0.8125rem] text-muted">{t.keywords.join(' · ')}</span>
                <span className="tabular mt-2 flex gap-4 text-[0.8125rem] text-text-2">
                  <span>{t.mentions7d} mentions · 7d</span>
                  <span>{t.negativeShare}% negative</span>
                </span>
              </button>
            ))
          )}
        </section>

        <section aria-label="Topic detail" className="min-w-0">
          {!selected ? (
            <EmptyState title="No topics yet" icon={<AudioLines />}>
              Create a topic to start tracking keywords.
            </EmptyState>
          ) : !detail.data ? (
            <Skeleton className="h-[40rem]" />
          ) : (
            <TopicDetailView detail={detail.data} source={source} setSource={setSource} />
          )}
        </section>
      </div>
      <NewTopicDialog open={newTopic} onOpenChange={setNewTopic} onCreated={choose} />
    </>
  )
}

function TopicDetailView({ detail, source, setSource }: { detail: api.TopicDetail; source: string; setSource: (s: string) => void }) {
  const [alertOpen, setAlertOpen] = useState(false)
  const toggle = useAction(api.toggleAlert)
  const { topic } = detail
  const total = detail.days.reduce((a, d) => a + d.count, 0)

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{topic.name}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topic.keywords.map((k) => (
                <Badge key={k} tone="accent">
                  {k}
                </Badge>
              ))}
            </div>
          </div>
          <Button onClick={() => setAlertOpen(true)}>
            <Bell /> Add alert
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
          {[
            ['Mentions · 7 days', String(topic.mentions7d)],
            ['Average per day', (topic.mentions7d / 7).toFixed(1)],
            ['Negative share', `${topic.negativeShare}%`],
          ].map(([l, v]) => (
            <div key={l} className="bg-surface p-4">
              <p className="text-[0.8125rem] text-text-2">{l}</p>
              <p className="tabular mt-1 text-2xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Mention volume" description="Sample mentions per day, last 7 days" />
          {total ? (
            <>
              <BarChart ariaLabel="Sample mentions per day. A data table follows." points={detail.days.map((d) => ({ label: d.label, value: d.count }))} valueLabel={(v) => `${v ?? 0} mentions`} />
              <details className="mt-2 rounded-lg border border-border">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-text-2 hover:text-text">View daily values</summary>
                <DataTable caption="Mentions per day" columns={['Date', 'Mentions', 'Source']} rows={detail.days.map((d) => [d.date, d.count, 'Sample data'])} />
              </details>
            </>
          ) : (
            <p className="text-sm text-muted">No sample mentions yet. In production, mentions appear once the provider indexes this topic.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Sentiment" description="Simulated score buckets: ≤ −25 negative, ≥ +25 positive" />
          <SentimentBar {...detail.sentiment} />
          <h3 className="mb-2 mt-6 text-[0.9375rem] font-semibold">Source coverage</h3>
          {detail.sources.length ? (
            <ul className="divide-y divide-border text-sm">
              {detail.sources.map((s) => (
                <li key={s.source + s.network} className="flex items-center gap-2 py-2">
                  {s.network !== 'Web' ? <NetworkMark network={s.network as Network} /> : <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-surface-3 text-[9px] font-bold">W</span>}
                  <span className="flex-1">
                    {s.source} · {s.network}
                  </span>
                  <span className="tabular text-muted">{s.count}</span>
                  <Badge tone={s.coverage === 'Owned account' ? 'good' : 'warn'}>{s.coverage === 'Owned account' ? 'Owned account' : 'Licence needed'}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No sources yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Alerts" description="Checked against sample data when saved. In production, staff verify each alert before acting." />
        {detail.alerts.length ? (
          <ul className="divide-y divide-border">
            {detail.alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex-1 text-sm">
                  {a.kind === 'volume' ? `${a.threshold}+ mentions per day` : `${a.threshold}%+ negative mentions`}
                  <span className="block text-[0.8125rem] text-muted">{a.triggeredAt ? `Triggered ${relativeTime(a.triggeredAt)} (sample)` : 'Not triggered'}</span>
                </span>
                {a.enabled && a.triggeredAt && <Badge tone="bad">Triggered</Badge>}
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate([a.id, !a.enabled])} aria-pressed={a.enabled}>
                  {a.enabled ? <Bell /> : <BellOff />}
                  {a.enabled ? 'On' : 'Muted'}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No alerts for this topic.</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Mentions"
          description="Newest first · all fictional, links go to a placeholder domain"
          action={
            <Select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} className="h-9 w-44">
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All sources' : s}
                </option>
              ))}
            </Select>
          }
        />
        {detail.mentions.length ? (
          <ul className="divide-y divide-border">
            {detail.mentions.slice(0, 25).map((m) => (
              <li key={m.id} className="flex gap-3 py-3">
                <span className={cn('tabular w-12 shrink-0 pt-0.5 text-right text-sm font-semibold', m.sentiment <= -25 ? 'text-bad' : m.sentiment >= 25 ? 'text-good' : 'text-muted')}>{signed(m.sentiment)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{m.text}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-muted">
                    <span>{m.author}</span>·<span>{m.source}</span>·<span>{m.network}</span>·<span>{relativeTime(m.at)}</span>·
                    <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-text">
                      Source <ExternalLink className="size-3" />
                    </a>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No mentions from this source.</p>
        )}
        {detail.mentions.length > 25 && <p className="mt-2 text-[0.8125rem] text-muted">Showing 25 of {detail.mentions.length}.</p>}
      </Card>
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen} topicId={topic.id} />
    </div>
  )
}

function AlertDialog({ open, onOpenChange, topicId }: { open: boolean; onOpenChange: (o: boolean) => void; topicId: string }) {
  const [kind, setKind] = useState<ListeningAlert['kind']>('negative')
  const [threshold, setThreshold] = useState('50')
  const save = useAction(api.saveAlert, { success: (triggered) => (triggered ? 'Alert saved. It is already triggered by the sample data.' : 'Alert saved. Not triggered by the sample data.') })
  useEffect(() => {
    if (open) {
      setKind('negative')
      setThreshold('50')
    }
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add listening alert"
      description="Alerts notify staff for review. They never publish or reply."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate([topicId, kind, Number(threshold)], { onSuccess: () => onOpenChange(false) })}>
            Save alert
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          label="Alert type"
          value={kind}
          onChange={setKind}
          options={[
            ['negative', 'Negative share'],
            ['volume', 'Volume spike'],
          ]}
        />
        <Field label={kind === 'negative' ? 'Alert when negative mentions reach (%)' : 'Alert when mentions per day reach'}>
          {(id) => <Input id={id} type="number" min={1} max={kind === 'negative' ? 100 : undefined} value={threshold} onChange={(e) => setThreshold(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  )
}

function NewTopicDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const create = useAction(api.createTopic, { success: 'Topic created. Sample data has no mentions for it yet.' })
  useEffect(() => {
    if (open) {
      setName('')
      setKeywords('')
    }
  }, [open])
  const list = keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New listening topic"
      description="Track keywords, hashtags or phrases. Matching is simulated in this demo."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !list.length || create.isPending}
            onClick={() =>
              create.mutate([name, list], {
                onSuccess: (id) => {
                  onOpenChange(false)
                  onCreated(id)
                },
              })
            }
          >
            Create topic
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Topic name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Library renovation" />}</Field>
        <Field label="Keywords and hashtags" hint="Separate with commas.">
          {(id) => <Input id={id} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="library, renovation, #hvlibrary" />}
        </Field>
        {list.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {list.map((k) => (
              <Badge key={k} tone="accent">
                {k}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  )
}
