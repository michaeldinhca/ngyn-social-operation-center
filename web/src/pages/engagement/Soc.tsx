import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, OctagonAlert, Pause, Play, Send, SkipForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAction, useSoc } from '@/api/hooks'
import { DataTable, LineChart } from '@/components/charts/charts'
import { ChannelAvatar } from '@/components/social'
import { PostDetailDialog } from '@/components/post/PostDetailDialog'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader, Segmented, Select, SimBadge, Skeleton, Textarea } from '@/components/ui/primitives'
import { NETWORKS, type Network, type Post, type SocialAccount } from '@/domain/types'
import { cn, formatDateTime, relativeTime, shortNumber, signed } from '@/lib/utils'
import * as api from '@/mock/api'
import { photoUrl } from '@/mock/photos'
import { useSession, useSessionContext } from '@/session'

type Metric = 'impressions' | 'engagements' | 'sentiment'
const STREAM_MS = 12_000

export function SocPage() {
  const session = useSession()
  const { prefs } = useSessionContext()
  const [network, setNetwork] = useState<Network | 'All'>('All')
  const [kind, setKind] = useState<'All' | 'Comment' | 'Message'>('All')
  const [metric, setMetric] = useState<Metric>('impressions')
  const [pauseOpen, setPauseOpen] = useState(false)
  const [openPost, setOpenPost] = useState<(Post & { account: SocialAccount }) | null>(null)
  const [streaming, setStreaming] = useState(false)
  const soc = useSoc(network, kind)
  const navigate = useNavigate()
  const next = useAction(api.nextDemoUpdate)
  const process = useAction(api.processNextPublication, { success: (m) => m })
  const nextRef = useRef(next.mutate)
  nextRef.current = next.mutate

  const isAdmin = !!session.data?.isAdmin
  const canPublish = !!session.data?.functions['content.publish']
  const canInbox = !!session.data?.functions['inbox.respond']

  useEffect(() => {
    if (!streaming) return
    const t = setInterval(() => nextRef.current([]), STREAM_MS)
    return () => clearInterval(t)
  }, [streaming])
  useEffect(() => {
    if (prefs.motion) setStreaming(false)
  }, [prefs.motion])

  const d = soc.data
  if (!d) return <Skeleton className="h-[70vh]" />
  const paused = d.emergency.paused
  const noScope = session.data && !session.data.isAdmin && session.data.visibleAccountIds.length === 0

  return (
    <>
      <PageHeader
        eyebrow="Harbourview / demo workspace"
        title="Social Operation Center"
        description="Publishing health, audience conversations and channel performance."
        actions={
          <>
            <SimBadge>Simulated social data</SimBadge>
            {isAdmin && (
              <>
                <Button
                  onClick={() => {
                    if (prefs.motion && !streaming) {
                      toast.info('Timed updates are off because Reduce motion is on in your preferences. Use Next update instead.')
                      return
                    }
                    setStreaming((v) => !v)
                  }}
                  aria-pressed={streaming}
                >
                  {streaming ? <Pause /> : <Play />}
                  {streaming ? 'Pause demo updates' : 'Play demo updates'}
                </Button>
                <Button variant="primary" onClick={() => next.mutate([])} disabled={next.isPending}>
                  Next update <SkipForward />
                </Button>
              </>
            )}
          </>
        }
      />

      <Card className="mb-3 flex flex-wrap items-end gap-4 p-4">
        <Field label="Network" className="w-44">
          {(id) => (
            <Select id={id} value={network} onChange={(e) => setNetwork(e.target.value as Network | 'All')}>
              <option value="All">All networks</option>
              {NETWORKS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          )}
        </Field>
        <p className="min-w-56 flex-1 pb-2 text-sm text-muted">Last 7 days · sample snapshots · sentiment from −100 (negative) to +100 (positive)</p>
        <div className="flex flex-wrap items-center gap-3 pb-0.5">
          <Badge tone={paused ? 'bad' : 'good'} className="py-1 text-[0.8125rem]">
            {paused ? <OctagonAlert /> : null}
            {paused ? 'Publishing paused' : 'Publishing available'}
          </Badge>
          {isAdmin && (
            <Button variant={paused ? 'primary' : 'danger'} onClick={() => setPauseOpen(true)}>
              {paused ? 'Authorize resume' : 'Emergency pause'}
            </Button>
          )}
        </div>
      </Card>
      <p className="mb-5 text-[0.8125rem] text-muted">
        All metrics, delivery checks and AI sentiment scores here are mocked. Counts use only the demo records your user can access. No platform analytics or live model is connected.
      </p>

      {noScope && (
        <div className="mb-5">
          <EmptyState title="No channel access yet">An administrator must assign a channel before you can see its posts, conversations or performance.</EmptyState>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border xl:grid-cols-4">
        {[
          ['Total impressions', shortNumber(d.totals.impressions), '7-day sample total'],
          ['Total engagement', shortNumber(d.totals.engagements), 'Reactions, comments and shares · sample'],
          ['Average sentiment', signed(d.totals.sentiment), d.canReadMessages ? `${d.totals.scored} scored sample conversations` : 'Needs inbox permission'],
          ['Publishing health', d.totals.attempts ? `${d.totals.healthy}/${d.totals.attempts}` : 'Unavailable', `Healthy among last ${d.totals.attempts} aired attempts`],
        ].map(([label, value, caption]) => (
          <div key={label} className="bg-surface p-5">
            <p className="text-sm text-text-2">{label}</p>
            <p className="tabular mt-2 text-[2.25rem] font-semibold leading-none tracking-tight">{value}</p>
            <p className="mt-2 text-[0.8125rem] text-muted">{caption}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Last 5 posts · air status"
            description="Published and failed delivery attempts"
            action={<span className="text-sm text-muted">Most recent first</span>}
          />
          <PostRows posts={d.recent} empty="No published or failed posts in your account scope yet." onOpen={setOpenPost} paused={false} />
        </Card>
        <Card>
          <CardHeader title="Next 5 posts" description="Ordered by requested publish time" action={<span className="text-sm text-muted">America/Halifax</span>} />
          <PostRows posts={d.next} upcoming empty="No scheduled posts in your account scope." onOpen={setOpenPost} paused={paused} />
          {paused && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">Emergency pause blocks every pending publication.</p>}
          {canPublish && (
            <Button className="mt-4" onClick={() => process.mutate([])} disabled={process.isPending || paused}>
              <Send /> Process next demo publication
            </Button>
          )}
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Last 7 days · performance"
          description="Simulated daily distribution, not production analytics"
          action={
            <Segmented
              label="Chart metric"
              value={metric}
              onChange={setMetric}
              options={[
                ['impressions', 'Impressions'],
                ['engagements', 'Engagement'],
                ['sentiment', 'Sentiment'],
              ]}
            />
          }
        />
        <LineChart
          ariaLabel={`${metric} across the last seven days, simulated values. A data table follows.`}
          points={d.days.map((day) => ({
            label: day.label,
            value: metric === 'sentiment' ? day.sentiment : day[metric],
            detail: metric === 'sentiment' ? (day.sentimentSamples ? `${day.sentimentSamples} scored samples` : 'No samples') : day.date,
          }))}
          domain={metric === 'sentiment' ? [-100, 100] : undefined}
          zeroLine={metric === 'sentiment'}
          valueLabel={(v) => (metric === 'sentiment' ? (v === null ? 'No samples' : `Sentiment ${signed(v)}`) : `${(v ?? 0).toLocaleString('en-CA')} ${metric === 'impressions' ? 'impressions' : 'engagements'}`)}
        />
        <details className="mt-3 rounded-lg border border-border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-text-2 hover:text-text">View daily values and source</summary>
          <DataTable
            caption="Daily sample values"
            columns={['Date', 'Impressions', 'Engagements', 'Average sentiment', 'Source']}
            rows={d.days.map((day) => [day.date, day.impressions.toLocaleString('en-CA'), day.engagements.toLocaleString('en-CA'), day.sentiment === null ? 'No samples' : signed(day.sentiment), 'Simulated snapshot'])}
          />
        </details>
      </Card>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Angry and negative conversations"
            description="Simulated score of −50 or lower · uncertain, staff review required"
            action={
              <Select aria-label="Conversation type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-9 w-40">
                <option value="All">All types</option>
                <option value="Comment">Comments</option>
                <option value="Message">Direct messages</option>
              </Select>
            }
          />
          {!d.canReadMessages ? (
            <p className="text-sm text-muted">Inbox permission and channel access are required to view conversation text.</p>
          ) : d.negative.length ? (
            <ul className="divide-y divide-border">
              {d.negative.map((c) => (
                <li key={c.id}>
                  <Link to="/$page" params={{ page: 'inbox' }} search={{ c: c.id }} className="flex gap-4 rounded-lg px-2 py-3 hover:bg-surface-2">
                    <span className="w-16 shrink-0 text-center">
                      <span className="tabular block text-xl font-semibold text-bad">{signed(c.ai.score)}</span>
                      <span className="block text-[0.6875rem] leading-tight text-muted">{Math.round(c.ai.confidence * 100)}% demo confidence</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{c.thread[0].text}</span>
                      <span className="mt-1 block text-[0.8125rem] text-muted">
                        {c.account.network} · {c.kind === 'Message' ? 'Direct message' : 'Comment'} · {c.author}
                      </span>
                      <span className="block text-[0.8125rem] text-muted">Responding: {c.ownerName ?? 'Not assigned'}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No open conversations at or below −50 in your account scope.</p>
          )}
          {d.canReadMessages && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted">{d.negativeTotal} matching open conversations</span>
              {canInbox && (
                <Link to="/$page" params={{ page: 'inbox' }} search={{ sentiment: 'Negative' }} className="inline-flex items-center gap-1 font-medium text-accent-strong hover:underline">
                  Open Inbox & Comments <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Highlight keywords" description="Most frequent terms in posts and conversations you can access" />
          {d.keywords.length ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              {d.keywords.map(([word, count], i) => (
                <button
                  key={word}
                  type="button"
                  title={canInbox ? `${count} records · search Inbox & Comments` : `${count} records`}
                  disabled={!canInbox}
                  onClick={() => navigate({ to: '/$page', params: { page: 'inbox' }, search: { q: word } })}
                  className="rounded-md px-1.5 py-0.5 font-medium text-text-2 hover:bg-surface-2 hover:text-text disabled:cursor-default disabled:hover:bg-transparent"
                  style={{ fontSize: `${Math.max(0.875, 1.75 - i * 0.045)}rem` }}
                >
                  {word}
                  <sup className="tabular ml-0.5 text-[0.6875rem] text-muted">{count}</sup>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No keywords in your account scope.</p>
          )}
          <p className="mt-4 text-[0.8125rem] text-muted">Frequency comes from demo text, not a listening provider. Select a word to search the inbox.</p>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader title="Trending posts" description="Published posts you can access, ranked by simulated engagement" action={<SimBadge>Sample ranking</SimBadge>} />
        {d.trending.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {d.trending.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setOpenPost(p)} className="group overflow-hidden rounded-lg border border-border text-left hover:border-border-strong">
                <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
                  <img src={photoUrl(p.photo, 500)} alt={p.alt} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
                  <span className="absolute left-2 top-2 rounded-md bg-[#151813]/85 px-2 py-0.5 text-xs font-semibold text-white">#{i + 1}</span>
                </div>
                <div className="p-3">
                  <p className="font-medium leading-snug">{p.title}</p>
                  <p className="mt-1 text-[0.8125rem] text-muted">
                    {p.account.network} · {shortNumber(p.metrics!.engagements)} engagement
                  </p>
                  <p className="tabular mt-1 text-[0.8125rem] font-medium text-accent-strong">↑ {p.metrics!.trend}% sample growth</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No published posts in your account scope.</p>
        )}
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader
            title="Social update feed"
            description="Mock audience activity, delivery status and engagement changes"
            action={<Badge tone={streaming ? 'accent' : 'neutral'}>{streaming ? 'Playing · every 12 seconds' : 'Paused · advance manually'}</Badge>}
          />
          {d.feed.length ? (
            <ul className="divide-y divide-border">
              {d.feed.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <Badge tone={e.kind === 'failure' || e.kind === 'blocked' ? 'bad' : e.kind === 'conversation' ? 'warn' : e.kind === 'engagement' ? 'accent' : 'good'}>Demo</Badge>
                  <div className="min-w-0">
                    <p className="font-medium">{e.title}</p>
                    <p className="text-[0.8125rem] text-muted">
                      {e.detail} · {relativeTime(e.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Select Next update to simulate a social-channel event. Each update changes real demo records.</p>
          )}
        </Card>
      )}

      <PauseDialog open={pauseOpen} onOpenChange={setPauseOpen} paused={paused} />
      <PostDetailDialog id={openPost?.id ?? null} onClose={() => setOpenPost(null)} />
    </>
  )
}

function PostRows({ posts, upcoming, empty, onOpen, paused }: { posts: (Post & { account: SocialAccount })[]; upcoming?: boolean; empty: string; onOpen: (p: Post & { account: SocialAccount }) => void; paused: boolean }) {
  if (!posts.length) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-border">
      {posts.map((p) => {
        const expired = p.account.connection.status === 'Expired'
        const status = upcoming ? (paused ? 'Paused' : expired ? 'Token expired' : 'Scheduled') : p.status === 'Failed' ? 'Failed' : 'Healthy'
        const tone = status === 'Healthy' ? 'good' : status === 'Failed' || status === 'Token expired' || status === 'Paused' ? 'bad' : 'info'
        return (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen(p)} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-2">
              <ChannelAvatar account={p.account} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.title}</span>
                <span className="block truncate text-[0.8125rem] text-muted">
                  {p.account.name} · {p.account.network}
                </span>
                <span className="block text-[0.8125rem] text-muted">
                  {upcoming ? formatDateTime(p.scheduledFor) : p.status === 'Failed' ? `${p.failureReason ?? 'Delivery failed'} · ${relativeTime(p.publishedAt!)}` : `Last sample check ${relativeTime(p.metrics?.observedAt ?? p.publishedAt!)}`}
                </span>
              </span>
              <Badge tone={tone} className={cn('shrink-0')}>
                {status}
              </Badge>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function PauseDialog({ open, onOpenChange, paused }: { open: boolean; onOpenChange: (o: boolean) => void; paused: boolean }) {
  const [reason, setReason] = useState('')
  const action = useAction(api.setEmergencyPause, { success: paused ? 'Publishing resumed in the demo queue.' : 'Emergency pause activated. Scheduled publishing is blocked.' })
  useEffect(() => {
    if (open) setReason('')
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={paused ? 'Authorize publishing resume' : 'Pause all scheduled publishing'}
      description={paused ? 'Releases the demo queue only. External transmission stays disabled.' : 'Every pending scheduled demo job is blocked until an administrator resumes. The reason is recorded in the activity log.'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={paused ? 'primary' : 'danger'}
            disabled={!reason.trim() || action.isPending}
            onClick={() => action.mutate([!paused, reason], { onSuccess: () => onOpenChange(false) })}
          >
            {paused ? 'Confirm resume' : 'Confirm pause'}
          </Button>
        </>
      }
    >
      <Field label="Reason (required)">{(id) => <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={paused ? 'For example: storm warning lifted, comms lead approved' : 'For example: severe weather warning, hold routine posts'} />}</Field>
    </Dialog>
  )
}
