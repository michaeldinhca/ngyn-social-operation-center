import { ArrowLeft, CheckCircle2, CircleAlert, CornerUpLeft, Lock, Rocket, Save, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAction, useAds, useCampaign, useCampaignForm } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, CardHeader, Field, Input, PageHeader, Select, SimBadge, Skeleton, Textarea } from '@/components/ui/primitives'
import { campaignDays, committedCents, estimate, guardCheck, LAUNCH_BLOCKED, money, totalBudgetCents } from '@/domain/ads'
import { OBJECTIVES, type AdAccount, type AdCampaign } from '@/domain/types'
import { addDays } from '@/lib/calendar'
import { dayKeyHalifax } from '@/lib/time'
import { formatDateTime } from '@/lib/utils'
import * as adsApi from '@/mock/api-ads'
import { CAMPAIGN_TONE, SpendGuardBanner } from './Ads'

const today = () => dayKeyHalifax(new Date())

interface Form {
  name: string
  adAccountId: string
  objective: AdCampaign['objective']
  headline: string
  body: string
  postId: string
  area: string
  ageMin: number
  ageMax: number
  language: AdCampaign['audience']['language']
  interests: string
  startDay: string
  endDay: string
  dailyDollars: string
}

const blank = (accountId: string): Form => ({ name: '', adAccountId: accountId, objective: 'Awareness', headline: '', body: '', postId: '', area: 'Harbourview', ageMin: 18, ageMax: 65, language: 'English', interests: '', startDay: addDays(today(), 7), endDay: addDays(today(), 13), dailyDollars: '25' })

const fromCampaign = (c: AdCampaign): Form => ({ name: c.name, adAccountId: c.adAccountId, objective: c.objective, headline: c.headline, body: c.body, postId: c.postId ?? '', area: c.audience.area, ageMin: c.audience.ageMin, ageMax: c.audience.ageMax, language: c.audience.language, interests: c.audience.interests.join(', '), startDay: c.startDay, endDay: c.endDay, dailyDollars: String(c.dailyBudgetCents / 100) })

export function CampaignEditor({ id, onBack }: { id: string; onBack: (open?: string) => void }) {
  const isNew = id === 'new'
  const existing = useCampaign(isNew ? null : id)
  const ctxForm = useCampaignForm()
  const overview = useAds()
  const row = existing.data?.campaign
  const adAccounts: AdAccount[] = isNew ? (ctxForm.data?.adAccounts ?? []) : (existing.data?.adAccounts ?? [])
  const posts = (isNew ? ctxForm.data?.posts : existing.data?.posts) ?? []
  const [f, setF] = useState<Form | null>(null)
  const [note, setNote] = useState('')
  const [returning, setReturning] = useState(false)
  const [launch, setLaunch] = useState<string | null>(null)
  const save = useAction(adsApi.saveCampaign)
  const transition = useAction(adsApi.transitionCampaign)
  const del = useAction(adsApi.deleteCampaign, { success: 'Draft deleted.' })
  const request = useAction(adsApi.requestLaunch)

  useEffect(() => {
    if (f) return
    if (isNew && ctxForm.data) setF(blank(ctxForm.data.adAccounts[0]?.id ?? ''))
    if (!isNew && row) setF(fromCampaign(row))
  }, [f, isNew, ctxForm.data, row])

  // After a save or transition the server copy changes; refresh the form from it.
  useEffect(() => {
    if (row && f) setF(fromCampaign(row))
    // Only when the saved campaign itself changes, never on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.history.length, row?.status])

  const account = useMemo(() => (f ? (adAccounts.find((a) => a.id === f.adAccountId) ?? row?.account ?? null) : null), [f, adAccounts, row])
  const err = (existing.error ?? ctxForm.error) as Error | null
  if (err) {
    return (
      <>
        <PageHeader title="Campaign" />
        <Button onClick={() => onBack()}>
          <ArrowLeft /> Campaigns
        </Button>
        <p className="mt-4 text-sm text-muted">{err.message}</p>
      </>
    )
  }
  if (!f || (!isNew && !row) || !overview.data) return <Skeleton className="h-[40rem]" />
  if (isNew && !adAccounts.length) {
    return (
      <>
        <PageHeader title="New campaign" />
        <Button onClick={() => onBack()}>
          <ArrowLeft /> Campaigns
        </Button>
        <p className="mt-4 text-sm text-muted">You need the advertising creation function on an ad account to draft a campaign.</p>
      </>
    )
  }

  const editable = isNew || !!row?.actions.includes('edit')
  const set = (patch: Partial<Form>) => setF((x) => (x ? { ...x, ...patch } : x))
  const dailyCents = Math.round(Number(f.dailyDollars || 0) * 100)
  const input: adsApi.CampaignInput = {
    name: f.name,
    adAccountId: f.adAccountId,
    objective: f.objective,
    headline: f.headline,
    body: f.body,
    postId: f.postId || null,
    audience: { area: f.area, ageMin: Number(f.ageMin), ageMax: Number(f.ageMax), language: f.language, interests: f.interests.split(',') },
    startDay: f.startDay,
    endDay: f.endDay,
    dailyBudgetCents: dailyCents,
  }
  const draft = { ...(row ?? ({ id: 'new', status: 'Draft', reviewNote: null, spentCents: 0, history: [], createdBy: '', createdAt: '', postId: null } as unknown as AdCampaign)), ...input, audience: { ...input.audience, interests: input.audience.interests.map((x) => x.trim()).filter(Boolean) } } as AdCampaign
  const limit = account?.limitCents ?? 0
  const guard = guardCheck(draft, overview.data.campaigns, limit)
  const days = campaignDays(f.startDay, f.endDay)
  const total = totalBudgetCents(draft)
  const committed = committedCents(overview.data.campaigns, f.adAccountId, isNew ? undefined : id)
  const est = account ? estimate(account.network, total) : null
  const used = limit ? Math.min(100, ((committed + total) / limit) * 100) : 0
  const committedPct = limit ? Math.min(100, (committed / limit) * 100) : 0
  const over = committed + total > limit
  const pending = save.isPending || transition.isPending

  const doSave = (then?: (id: string) => void) =>
    save.mutate([isNew ? null : id, input], {
      onSuccess: (savedId) => {
        if (then) return then(savedId)
        toast.success('Draft saved. Simulated budget only.')
        if (isNew) onBack(savedId)
      },
    })
  const submit = () =>
    doSave((savedId) =>
      transition.mutate([savedId, 'submit'], {
        onSuccess: () => {
          toast.success('Submitted for approval. Approval never authorizes spend.')
          onBack()
        },
      }),
    )

  const can = (a: adsApi.CampaignAction) => !!row?.actions.includes(a)

  return (
    <>
      <PageHeader
        eyebrow={isNew ? 'New campaign' : `Campaign · ${row!.id}`}
        title={f.name.trim() || 'Untitled campaign'}
        description="Plan the audience, schedule and a simulated budget. Nothing is purchased."
        actions={
          <>
            {row && <Badge tone={CAMPAIGN_TONE[row.status]}>{row.status}</Badge>}
            <SimBadge>Simulated budget</SimBadge>
            <Button onClick={() => onBack()}>
              <ArrowLeft /> Campaigns
            </Button>
          </>
        }
      />
      <SpendGuardBanner spentCents={row?.spentCents ?? 0} />
      {row?.isOwn && row.status === 'In review' && <p className="mb-4 rounded-lg bg-surface-2 px-4 py-2.5 text-sm text-text-2">You wrote this campaign, so another ad manager has to review it.</p>}
      {row?.reviewNote && row.status === 'Draft' && (
        <p className="mb-4 rounded-lg bg-warn-soft px-4 py-2.5 text-sm text-warn">
          <strong>Returned with a note:</strong> {row.reviewNote}
        </p>
      )}
      {!editable && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2.5 text-sm text-text-2">
          <Lock className="size-4" /> {row?.status === 'Draft' ? 'Read only: editing needs the advertising creation function on this ad account.' : `${row?.status} campaigns can't be edited. Return it to draft first.`}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Basics" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Campaign name" className="md:col-span-2">
                {(fid) => <Input id={fid} value={f.name} disabled={!editable} maxLength={100} onChange={(e) => set({ name: e.target.value })} placeholder="Winter parking ban awareness" />}
              </Field>
              <Field label="Ad account" hint={account ? `${account.network} · simulated limit ${money(account.limitCents)}` : undefined}>
                {(fid) => (
                  <Select id={fid} value={f.adAccountId} disabled={!editable || !isNew} onChange={(e) => set({ adAccountId: e.target.value })}>
                    {(isNew ? adAccounts : [account!]).filter(Boolean).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.network})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Objective">
                {(fid) => (
                  <Select id={fid} value={f.objective} disabled={!editable} onChange={(e) => set({ objective: e.target.value as AdCampaign['objective'] })}>
                    {OBJECTIVES.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Creative" description="Use plain language. A person approves every ad before anything could run." />
            <div className="grid gap-4">
              <Field label="Headline" hint={`${f.headline.length} characters. Planning guide: keep it under 40.`}>
                {(fid) => <Input id={fid} value={f.headline} disabled={!editable} maxLength={120} onChange={(e) => set({ headline: e.target.value })} />}
              </Field>
              <Field label="Ad text" hint={`${f.body.length} characters. Planning guide: keep it under 125.`}>
                {(fid) => <Textarea id={fid} rows={3} value={f.body} disabled={!editable} maxLength={500} onChange={(e) => set({ body: e.target.value })} />}
              </Field>
              <Field label="Based on a post (optional)" hint="Approved, scheduled or published posts you can access.">
                {(fid) => (
                  <Select id={fid} value={f.postId} disabled={!editable} onChange={(e) => set({ postId: e.target.value })}>
                    <option value="">No post</option>
                    {posts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.network})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Audience" description="Planning inputs only. No platform audience is queried." />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Target area" className="md:col-span-2">
                {(fid) => <Input id={fid} value={f.area} disabled={!editable} onChange={(e) => set({ area: e.target.value })} />}
              </Field>
              <Field label="Age from">{(fid) => <Input id={fid} type="number" min={13} max={65} value={f.ageMin} disabled={!editable} onChange={(e) => set({ ageMin: Number(e.target.value) })} />}</Field>
              <Field label="Age to">{(fid) => <Input id={fid} type="number" min={13} max={65} value={f.ageMax} disabled={!editable} onChange={(e) => set({ ageMax: Number(e.target.value) })} />}</Field>
              <Field label="Language">
                {(fid) => (
                  <Select id={fid} value={f.language} disabled={!editable} onChange={(e) => set({ language: e.target.value as Form['language'] })}>
                    {['English', 'French', 'Bilingual'].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Interests (optional)" hint="Comma separated.">
                {(fid) => <Input id={fid} value={f.interests} disabled={!editable} onChange={(e) => set({ interests: e.target.value })} />}
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Schedule and simulated budget" />
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Start day">{(fid) => <Input id={fid} type="date" min={today()} value={f.startDay} disabled={!editable} onChange={(e) => set({ startDay: e.target.value })} />}</Field>
              <Field label="End day">{(fid) => <Input id={fid} type="date" min={f.startDay || today()} value={f.endDay} disabled={!editable} onChange={(e) => set({ endDay: e.target.value })} />}</Field>
              <Field label="Daily budget (CAD, simulated)" hint="At least $5.">
                {(fid) => <Input id={fid} type="number" min={5} step={1} value={f.dailyDollars} disabled={!editable} onChange={(e) => set({ dailyDollars: e.target.value })} />}
              </Field>
            </div>
          </Card>

          {row && (
            <Card>
              <CardHeader title="History" />
              <ol className="space-y-1.5 border-l border-border pl-4 text-sm">
                {[...row.history].reverse().map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-border-strong" aria-hidden />
                    <span className="font-medium">{e.action}</span> <span className="text-muted">by {e.actor} · {formatDateTime(e.at)}</span>
                    {e.note && <span className="block text-[0.8125rem] text-text-2">{e.note}</span>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start" aria-label="Budget review">
          <Card>
            <CardHeader title="Budget review" description="Simulated planning numbers" />
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted">Days</dt>
              <dd className="tabular">{days || 'Not set'}</dd>
              <dt className="text-muted">Daily budget</dt>
              <dd className="tabular">{money(dailyCents)}</dd>
              <dt className="font-medium">Total planned</dt>
              <dd className="tabular text-lg font-semibold">{money(total)}</dd>
            </dl>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>Simulated account limit</span>
                <span className="tabular">
                  {money(committed + total)} of {money(limit)}
                </span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded bg-surface-3" role="img" aria-label={`${Math.round(used)} percent of the simulated limit planned`}>
                <div style={{ width: `${committedPct}%` }} className="bg-border-strong" />
                <div style={{ width: `${Math.max(0, used - committedPct)}%` }} className={over ? 'bg-bad' : 'bg-accent-strong'} />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Already committed by other campaigns in review or approved: <span className="tabular">{money(committed)}</span>.
              </p>
            </div>
            {est && total > 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-border-strong p-3 text-sm">
                <p className="mb-1 flex items-center gap-2 font-medium">
                  Estimate <SimBadge>Synthetic</SimBadge>
                </p>
                <p className="tabular text-text-2">
                  {est.impressions[0].toLocaleString('en-CA')} to {est.impressions[1].toLocaleString('en-CA')} impressions
                </p>
                <p className="tabular text-text-2">
                  {est.clicks[0].toLocaleString('en-CA')} to {est.clicks[1].toLocaleString('en-CA')} clicks
                </p>
                <p className="mt-1 text-xs text-muted">{est.label}.</p>
              </div>
            )}
            <div className="mt-4">
              {!editable ? (
                <p className="text-sm text-muted">{row?.status === 'Approved' ? 'Approved. Approval does not authorize spend.' : 'Waiting for review. Editing is locked.'}</p>
              ) : guard.ok ? (
                <p className="flex items-center gap-2 text-sm text-good">
                  <CheckCircle2 className="size-4" /> Ready to submit for approval.
                </p>
              ) : (
                <ul className="space-y-1 text-sm text-warn">
                  {guard.problems.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="border-accent-strong/40">
            <CardHeader title="Spend guard" />
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted">Spent</dt>
              <dd className="tabular font-semibold">{money(row?.spentCents ?? 0)}</dd>
              <dt className="text-muted">Payment method</dt>
              <dd>None connected</dd>
              <dt className="text-muted">Spend authorization</dt>
              <dd>Not available</dd>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled title="Spending is disabled in this mockup">
                <Lock /> Authorize spend
              </Button>
              {can('launch') && (
                <Button
                  onClick={() =>
                    request.mutate([id], {
                      onSuccess: (r) => setLaunch(r.message),
                    })
                  }
                >
                  <Rocket /> Request launch
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">Requesting a launch is recorded in the activity log and always refused.</p>
          </Card>

          {(editable || can('submit') || can('approve') || can('return') || can('delete')) && (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur xl:static xl:border-0 xl:bg-transparent xl:p-0">
              {editable && (
                <Button onClick={() => doSave()} disabled={pending || !f.name.trim()}>
                  <Save /> Save draft
                </Button>
              )}
              {editable && (
                <Button variant="primary" onClick={submit} disabled={pending || !guard.ok}>
                  <Send /> Submit for approval
                </Button>
              )}
              {can('approve') && (
                <Button
                  variant="primary"
                  disabled={pending}
                  onClick={() =>
                    transition.mutate([id, 'approve'], {
                      onSuccess: () => toast.success('Approved. It stays unlaunched: approval never authorizes spend.'),
                    })
                  }
                >
                  <CheckCircle2 /> Approve
                </Button>
              )}
              {can('return') && (
                <Button onClick={() => setReturning(true)}>
                  <CornerUpLeft /> Return to draft
                </Button>
              )}
              {can('delete') && (
                <Button variant="ghost" onClick={() => del.mutate([id], { onSuccess: () => onBack() })}>
                  <Trash2 /> Delete
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>

      <Dialog
        open={returning}
        onOpenChange={setReturning}
        title="Return to draft"
        footer={
          <>
            <Button onClick={() => setReturning(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!note.trim() || transition.isPending}
              onClick={() =>
                transition.mutate([id, 'return', note], {
                  onSuccess: () => {
                    setReturning(false)
                    setNote('')
                    toast.success('Returned to draft with your note.')
                  },
                })
              }
            >
              Return to draft
            </Button>
          </>
        }
      >
        <Field label="Note for the author (required)">{(fid) => <Textarea id={fid} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </Dialog>
      <Dialog open={!!launch} onOpenChange={(o) => !o && setLaunch(null)} title="Launch blocked by the no-spend guard" footer={<Button onClick={() => setLaunch(null)}>Close</Button>}>
        <p className="text-sm text-text-2">{launch ?? LAUNCH_BLOCKED}</p>
        <p className="mt-3 text-sm text-muted">The attempt was recorded in the activity log. Spent remains $0.00.</p>
      </Dialog>
    </>
  )
}
