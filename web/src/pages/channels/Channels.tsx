import { Info, Link2, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAction, useChannel, useChannels } from '@/api/hooks'
import { ChannelAvatar, ConnectionBadge, NetworkMark } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, EmptyState, Field, Input, PageHeader, Segmented, Select, SimBadge, Skeleton } from '@/components/ui/primitives'
import { NETWORKS, type Network } from '@/domain/types'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'
import * as assets from '@/mock/api-assets'
import { useSession } from '@/session'

const LEVEL_TONE: Record<assets.CapabilityLevel, 'good' | 'warn' | 'bad' | 'neutral'> = { Listed: 'good', Partial: 'warn', 'Not available': 'bad', Unknown: 'neutral' }

export function ChannelsPage() {
  const channels = useChannels()
  const session = useSession()
  const [view, setView] = useState<'connections' | 'capabilities'>('connections')
  const [network, setNetwork] = useState<Network | 'All'>('All')
  const [group, setGroup] = useState('All')
  const [status, setStatus] = useState('All')
  const [q, setQ] = useState('')
  const [manage, setManage] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const rows = channels.data
  const groups = useMemo(() => [...new Set((rows ?? []).map((r) => r.groupName).filter(Boolean) as string[])].sort(), [rows])
  const filtered = (rows ?? []).filter(
    (r) =>
      (network === 'All' || r.network === network) &&
      (group === 'All' || (group === 'Unlinked' ? !r.groupName : r.groupName === group)) &&
      (status === 'All' || r.connection.status === status) &&
      (r.name + ' ' + r.handle).toLowerCase().includes(q.toLowerCase()),
  )
  const count = (s: string) => (rows ?? []).filter((r) => r.connection.status === s).length

  if (channels.error) {
    return (
      <>
        <PageHeader title="Social Channels" />
        <EmptyState title="Not available" icon={<Link2 />}>
          {(channels.error as Error).message}
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Social Channels"
        description="Independent connections. Create a channel first, then link it to an Asset Group."
        actions={
          <>
            <SimBadge>Mock connections · no OAuth</SimBadge>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus /> Add social channel
            </Button>
          </>
        }
      />
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" />
        <p>
          <strong className="text-text">Creating or linking a channel grants nobody access.</strong> Each channel keeps its own connection health and token expiry. Staff get access only through an explicit assignment in Users & Access or a
          group role that names the channel.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            ['connections', 'Connections'],
            ['capabilities', 'Platform capabilities'],
          ]}
        />
        {view === 'connections' && rows && (
          <div className="tabular flex flex-wrap gap-2 text-[0.8125rem]">
            <Badge tone="good">{count('Healthy')} connected</Badge>
            <Badge tone="warn">{count('Expiring')} expiring</Badge>
            <Badge tone="bad">{count('Expired')} expired</Badge>
            <Badge>{rows.filter((r) => !r.groupName).length} unlinked</Badge>
          </div>
        )}
      </div>

      {view === 'capabilities' ? (
        <Capabilities />
      ) : (
        <>
          <Card className="mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            <Field label="Network">
              {(id) => (
                <Select id={id} value={network} onChange={(e) => setNetwork(e.target.value as Network | 'All')}>
                  <option value="All">All</option>
                  {NETWORKS.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Asset Group">
              {(id) => (
                <Select id={id} value={group} onChange={(e) => setGroup(e.target.value)}>
                  <option value="All">All</option>
                  <option value="Unlinked">Unlinked</option>
                  {groups.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Connection">
              {(id) => (
                <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="All">All</option>
                  <option value="Healthy">Connected</option>
                  <option value="Expiring">Expiring soon</option>
                  <option value="Expired">Token expired</option>
                </Select>
              )}
            </Field>
            <Field label="Search">
              {(id) => (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or handle" className="pl-9" />
                </div>
              )}
            </Field>
          </Card>

          {!rows ? (
            <Skeleton className="h-96" />
          ) : !filtered.length ? (
            <EmptyState title="No channels match" icon={<Link2 />}>
              {rows.length ? 'Try clearing a filter.' : 'No channels are assigned to you yet.'}
            </EmptyState>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="hidden grid-cols-[minmax(220px,2fr)_1.3fr_1fr_1fr_0.7fr_auto] gap-4 border-b border-border px-5 py-2.5 text-[0.8125rem] font-medium text-muted md:grid">
                <span>Channel</span>
                <span>Asset Group</span>
                <span>Connection · demo</span>
                <span>Token expiry · demo</span>
                <span>Access</span>
                <span className="w-20" />
              </div>
              <ul className="divide-y divide-border">
                {filtered.map((r) => (
                  <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 md:grid-cols-[minmax(220px,2fr)_1.3fr_1fr_1fr_0.7fr_auto]">
                    <span className="flex min-w-0 items-center gap-3">
                      <ChannelAvatar account={r} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block truncate text-[0.8125rem] text-muted">
                          {r.network} · {r.handle}
                        </span>
                      </span>
                    </span>
                    <Button size="sm" className="md:order-last" onClick={() => setManage(r.id)}>
                      Manage
                    </Button>
                    <span className="text-sm text-text-2">{r.groupName ?? <span className="text-muted">Unlinked</span>}</span>
                    <span>
                      <ConnectionBadge status={r.connection.status} />
                    </span>
                    <span className="tabular text-sm text-text-2">{new Date(r.connection.expiresAt).toLocaleDateString('en-CA')}</span>
                    <span className="tabular text-sm text-text-2">{r.accessCount} people</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
      <ManageDialog id={manage} onClose={() => setManage(null)} />
      <AddChannelDialog open={adding} onOpenChange={setAdding} isAdmin={!!session.data?.isAdmin} />
    </>
  )
}

function Capabilities() {
  return (
    <>
      <p className="mb-4 flex items-start gap-2 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" />
        From the unified social API provider’s public documentation (Zernio), checked 2026-10-21. Not yet tested by NGYN. The evidence log is in the repository’s platform capability matrix.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {NETWORKS.map((n) => (
          <Card key={n}>
            <div className="mb-3 flex items-center gap-2">
              <NetworkMark network={n} className="size-6 text-[11px] ring-0" />
              <h2 className="font-semibold">{n}</h2>
              {n === 'X' && <Badge tone="warn">Optional · paid API</Badge>}
            </div>
            <ul className="space-y-2 text-sm">
              {assets.CAPABILITIES[n].map((c) => (
                <li key={c.label} className="flex items-start justify-between gap-3">
                  <span className="text-text-2">
                    {c.label}
                    {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                  </span>
                  <Badge tone={LEVEL_TONE[c.level]} className="shrink-0">
                    {c.level}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}

function ManageDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useChannel(id)
  const [date, setDate] = useState('')
  const save = useAction(assets.setTokenExpiry, { success: (s) => `Simulated expiry saved. Status: ${s}.` })
  const reauth = useAction(assets.reauthorizeChannel, { success: 'Mock reconnect done: expiry extended 60 days. No real token was obtained.' })
  const d = q.data
  useEffect(() => {
    if (d) setDate(d.account.connection.expiresAt.slice(0, 10))
  }, [d])

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()} title={d?.account.name ?? 'Channel'} description={d ? `${d.account.network} · ${d.account.handle}` : undefined} className="max-w-2xl">
      {!d ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <ChannelAvatar account={d.account} size={48} />
            <ConnectionBadge status={d.account.connection.status} />
            <span className="text-sm text-muted">
              Asset Group: {d.groupName ?? 'Unlinked'} · last sync {relativeTime(d.account.connection.lastSync)}
            </span>
          </div>
          <section>
            <h3 className="mb-2 font-semibold">Connection · simulated</h3>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Token expiry date" className="w-48">
                {(fid) => <Input id={fid} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <Button onClick={() => save.mutate([d.account.id, date])} disabled={!date || save.isPending}>
                Save expiry
              </Button>
              <Button variant="primary" onClick={() => reauth.mutate([d.account.id])} disabled={reauth.isPending}>
                <RefreshCw /> Mock reconnect
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">Expires {formatDateTime(d.account.connection.expiresAt)}. Expired channels block the demo publishing queue. No real OAuth flow runs and no token is stored.</p>
          </section>
          <section>
            <h3 className="mb-1 font-semibold">Who has access</h3>
            <p className="mb-2 text-[0.8125rem] text-muted">Direct assignments and group roles are listed separately. Admins always have access.</p>
            {d.access.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {d.access.map((a, i) => (
                  <li key={a.userId + i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted">{a.role}</span>
                    <Badge tone={a.via.startsWith('Group') ? 'info' : 'neutral'}>{a.via}</Badge>
                    <span className="ml-auto text-xs text-muted">{a.functions.length ? a.functions.join(', ') : 'View only'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nobody except administrators. Assign people in Users & Access or through a group role.</p>
            )}
          </section>
          <section>
            <h3 className="mb-2 font-semibold">{d.account.network} capabilities · from provider docs, unverified</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {d.capabilities.map((c) => (
                <li key={c.label} className="flex items-start justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span>
                    {c.label}
                    {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                  </span>
                  <Badge tone={LEVEL_TONE[c.level]}>{c.level}</Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Dialog>
  )
}

function AddChannelDialog({ open, onOpenChange, isAdmin }: { open: boolean; onOpenChange: (o: boolean) => void; isAdmin: boolean }) {
  const [network, setNetwork] = useState<Network | null>(null)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [expires, setExpires] = useState('')
  const create = useAction(assets.createChannel, {
    success: (r) => (r.visibleToCreator ? 'Channel created, unlinked and with no user access. Link it to a group when ready.' : 'Channel created. You will see it once an administrator assigns it to you.'),
  })
  useEffect(() => {
    if (open) {
      setNetwork(null)
      setName('')
      setHandle('')
      setExpires(new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10))
    }
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={network ? `Add ${network} channel` : 'Add social channel'}
      description="Creates an independent mock connection with no Asset Group and no user access. No OAuth, credentials or API calls."
      footer={
        network ? (
          <>
            <Button onClick={() => setNetwork(null)}>Back</Button>
            <Button variant="primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate([{ network, name, handle, expiresOn: expires }], { onSuccess: () => onOpenChange(false) })}>
              Create channel
            </Button>
          </>
        ) : undefined
      }
    >
      {!network ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NETWORKS.map((n) => (
            <button key={n} type="button" onClick={() => setNetwork(n)} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-4 text-sm font-medium hover:border-border-strong">
              <NetworkMark network={n} className="size-8 text-xs ring-0" />
              {n}
              {n === 'X' && <span className="text-xs font-normal text-muted">Optional</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Account display name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Harbourview Community News" />}</Field>
          <Field label="Handle or page URL" hint="Optional. Fictional values only in this demo.">
            {(id) => <Input id={id} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@hvcommunity" />}
          </Field>
          <Field label="Simulated token expiry">{(id) => <Input id={id} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={cn('w-48')} />}</Field>
          {!isAdmin && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">New channels are not assigned to anyone, including you. An administrator must assign it before you can see it.</p>}
        </div>
      )}
    </Dialog>
  )
}
