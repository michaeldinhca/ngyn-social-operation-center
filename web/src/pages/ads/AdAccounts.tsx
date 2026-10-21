import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAction } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, EmptyState, Field, Input, Select, SimBadge } from '@/components/ui/primitives'
import { money } from '@/domain/ads'
import { AD_NETWORKS, type AdNetwork } from '@/domain/types'
import * as adsApi from '@/mock/api-ads'

export function AdAccounts({ d }: { d: adsApi.AdsOverview }) {
  const [adding, setAdding] = useState(false)
  const [limit, setLimit] = useState<adsApi.AccountRow | null>(null)
  const link = useAction(adsApi.setAdAccountGroup, { success: 'Group link saved. No one gained access.' })
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-text-2">
          Mock ad accounts. None has a payment method or a real connection. Adding or linking one grants nobody access: people get access through a direct assignment in Users & Access, or through an ad-manager role in the Asset Group that selects the account.
        </p>
        {d.canManageAccounts && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus /> Add ad account
          </Button>
        )}
      </div>
      {d.accounts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.accounts.map((a) => (
            <Card key={a.id}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{a.name}</h3>
                  <p className="text-[0.8125rem] text-muted">
                    {a.network} · {a.campaigns} campaign{a.campaigns === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <SimBadge>Mock account</SimBadge>
                  <Badge>No payment method</Badge>
                </div>
              </div>
              <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted">Simulated limit</dt>
                <dd className="tabular">{money(a.limitCents)}</dd>
                <dt className="text-muted">Committed</dt>
                <dd className="tabular">{money(a.committedCents)} in review or approved</dd>
                <dt className="text-muted">Spent</dt>
                <dd className="tabular font-medium">$0.00</dd>
                <dt className="text-muted">Asset Group</dt>
                <dd>
                  {d.canManageAccounts ? (
                    <Select aria-label={`Asset Group for ${a.name}`} className="h-9 max-w-xs" value={a.assetGroupId ?? ''} onChange={(e) => link.mutate([a.id, e.target.value || null])}>
                      <option value="">Unlinked</option>
                      {d.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    (a.groupName ?? 'Unlinked')
                  )}
                </dd>
              </dl>
              <details className="mt-3 rounded-lg border border-border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Who has access · {a.access.length}</summary>
                <ul className="divide-y divide-border border-t border-border text-sm">
                  {a.access.length ? (
                    a.access.map((x, i) => (
                      <li key={x.name + i} className="flex items-center justify-between gap-2 px-3 py-1.5">
                        <span>{x.name}</span>
                        <Badge tone={x.via.startsWith('Group') ? 'info' : 'neutral'}>{x.via}</Badge>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-muted">Nobody except administrators.</li>
                  )}
                </ul>
              </details>
              {d.canManageAccounts && (
                <Button size="sm" className="mt-3" onClick={() => setLimit(a)}>
                  Change simulated limit
                </Button>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No ad accounts in your scope">An administrator assigns ad accounts in Users & Access or through an Asset Group ad-manager role.</EmptyState>
      )}
      <AddDialog open={adding} onOpenChange={setAdding} />
      <LimitDialog account={limit} onClose={() => setLimit(null)} />
    </>
  )
}

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState('')
  const [network, setNetwork] = useState<AdNetwork>('Meta')
  const [limit, setLimit] = useState('1000')
  const create = useAction(adsApi.createAdAccount, { success: 'Mock ad account added: unlinked, no access granted, no payment method.' })
  useEffect(() => {
    if (open) {
      setName('')
      setNetwork('Meta')
      setLimit('1000')
    }
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add mock ad account"
      description="Creates a mock record. No ad platform is contacted and no payment method is stored."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate([{ name, network, limitDollars: Number(limit) }], { onSuccess: () => onOpenChange(false) })}>
            Add ad account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Account name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Harbourview Recreation Ads" />}</Field>
        <Field label="Ad network">
          {(id) => (
            <Select id={id} value={network} onChange={(e) => setNetwork(e.target.value as AdNetwork)}>
              {AD_NETWORKS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Simulated limit (CAD)" hint="A planning ceiling for the demo. Not a platform or bank limit.">
          {(id) => <Input id={id} type="number" min={100} step={100} value={limit} onChange={(e) => setLimit(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  )
}

function LimitDialog({ account, onClose }: { account: adsApi.AccountRow | null; onClose: () => void }) {
  const [limit, setLimit] = useState('')
  const save = useAction(adsApi.setAdAccountLimit, { success: 'Simulated limit saved.' })
  useEffect(() => {
    if (account) setLimit(String(account.limitCents / 100))
  }, [account])
  return (
    <Dialog
      open={!!account}
      onOpenChange={(o) => !o && onClose()}
      title={`Simulated limit for ${account?.name ?? ''}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate([account!.id, Number(limit)], { onSuccess: onClose })}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Simulated limit (CAD)" hint="Campaigns already approved are re-checked against this when someone approves another.">
        {(id) => <Input id={id} type="number" min={100} step={100} value={limit} onChange={(e) => setLimit(e.target.value)} />}
      </Field>
    </Dialog>
  )
}
