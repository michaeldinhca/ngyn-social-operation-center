import { useNavigate, useSearch } from '@tanstack/react-router'
import { CircleAlert, Mail, Plus, Search, ShieldAlert, ShieldCheck, Users as UsersIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAction, useStaff, useStaffMember } from '@/api/hooks'
import { NetworkMark } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, SimBadge, Skeleton } from '@/components/ui/primitives'
import { FUNCTION_AREAS, FUNCTION_CATALOG, inertFunctions, isAdminUser, ROLE_FUNCTIONS, STAFF_ROLES } from '@/domain/roles'
import type { Department, Network, StaffRole, User } from '@/domain/types'
import { cn } from '@/lib/utils'
import * as users from '@/mock/api-users'

const DEPARTMENTS: Department[] = ['Communications', 'Public Works', 'Transit', 'Recreation', 'Customer Service', 'IT']
const STATUS_TONE: Record<User['status'], 'good' | 'warn' | 'bad'> = { Active: 'good', Invited: 'warn', Suspended: 'bad' }
type Tab = 'profile' | 'functions' | 'accounts' | 'effective'

export function UsersPage() {
  const search = useSearch({ from: '/$page' })
  const navigate = useNavigate()
  const staff = useStaff()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<StaffRole | 'All'>('All')
  const [dept, setDept] = useState<Department | 'All'>('All')
  const [status, setStatus] = useState<User['status'] | 'All'>('All')
  const [adding, setAdding] = useState(false)
  const open = search.c ?? null
  const rows = (staff.data ?? []).filter((u) => (role === 'All' || u.role === role) && (dept === 'All' || u.department === dept) && (status === 'All' || u.status === status) && (!q.trim() || (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase())))
  const counts = useMemo(() => {
    const all = staff.data ?? []
    return { total: all.length, active: all.filter((u) => u.status === 'Active').length, invited: all.filter((u) => u.status === 'Invited').length, suspended: all.filter((u) => u.status === 'Suspended').length, noAccess: all.filter((u) => u.status === 'Active' && u.role !== 'Administrator' && u.effectiveChannels === 0).length }
  }, [staff.data])
  const go = (id?: string) => navigate({ to: '/$page', params: { page: 'users' }, search: id ? { c: id } : {}, replace: true })

  if (staff.error) {
    return (
      <>
        <PageHeader title="Users & Access" />
        <EmptyState title="Not available" icon={<UsersIcon />}>
          {(staff.error as Error).message}
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Users & Access"
        description="People, the functions they hold, and the channels and ad accounts they are assigned. These are separate on purpose."
        actions={
          <>
            <SimBadge>Demo access checks, not server security</SimBadge>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus /> Add person
            </Button>
          </>
        }
      />
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" />
        <p>
          <strong className="text-text">A function grant alone never reveals a channel or ad account.</strong> Someone can create content only on channels they are also assigned, directly here or through an Asset Group role. New people start with no account
          access.
        </p>
      </div>

      <Card className="mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        <Field label="Search" className="col-span-2 md:col-span-1">
          {(id) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" className="pl-9" />
            </div>
          )}
        </Field>
        <Field label="Role">
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as StaffRole | 'All')}>
              <option value="All">All roles</option>
              {STAFF_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Department">
          {(id) => (
            <Select id={id} value={dept} onChange={(e) => setDept(e.target.value as Department | 'All')}>
              <option value="All">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as User['status'] | 'All')}>
              <option value="All">All</option>
              {['Active', 'Invited', 'Suspended'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
      </Card>
      <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-live="polite">
        <span className="font-medium text-text-2">{rows.length} of {counts.total} people</span>
        <span>{counts.active} active</span>
        <span>{counts.invited} invited</span>
        <span>{counts.suspended} suspended</span>
        <span>{counts.noAccess} active with no channel access</span>
      </p>

      {!staff.data ? (
        <Skeleton className="h-96" />
      ) : !rows.length ? (
        <EmptyState title="No people match" icon={<UsersIcon />}>
          Try clearing a filter.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[minmax(220px,2fr)_1fr_1.2fr_0.7fr_0.7fr_0.8fr] gap-4 border-b border-border px-5 py-2.5 text-[0.8125rem] font-medium text-muted md:grid">
            <span>Person</span>
            <span>Role</span>
            <span>Department</span>
            <span>Functions</span>
            <span>Channels</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => go(u.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 text-left hover:bg-surface-2 md:grid-cols-[minmax(220px,2fr)_1fr_1.2fr_0.7fr_0.7fr_0.8fr]">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold" aria-hidden>
                      {u.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                    </span>
                  </span>
                  <span className="hidden text-sm text-text-2 md:block">{u.role}</span>
                  <span className="hidden text-sm text-text-2 md:block">{u.department}</span>
                  <span className="tabular hidden text-sm text-text-2 md:block">{u.functions.length}</span>
                  <span className={cn('tabular hidden text-sm md:block', !isAdminUser(u) && u.status === 'Active' && u.effectiveChannels === 0 ? 'text-warn' : 'text-text-2')}>{isAdminUser(u) ? 'All' : u.effectiveChannels}</span>
                  <span className="self-start md:self-auto">
                    <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                  </span>
                  <span className="col-span-2 text-[0.8125rem] text-muted md:hidden">
                    {u.role} · {u.department} · {u.functions.length} function{u.functions.length === 1 ? '' : 's'} · {isAdminUser(u) ? 'all channels' : `${u.effectiveChannels} channel${u.effectiveChannels === 1 ? '' : 's'}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PersonDialog id={open} onClose={() => go()} />
      <AddDialog open={adding} onOpenChange={setAdding} onCreated={(id) => go(id)} />
    </>
  )
}

function PersonDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useStaffMember(id)
  const d = q.data
  const [tab, setTab] = useState<Tab>('profile')
  const [f, setF] = useState<users.StaffPatch | null>(null)
  const [confirmAdmin, setConfirmAdmin] = useState(false)
  const save = useAction(users.updateStaff, { success: (n) => (n ? `Saved. ${n} change(s) recorded in the activity log.` : 'No changes to save.') })
  const invite = useAction(users.recordInvitation, { success: 'Invitation recorded (simulated). No email was sent.' })
  const accept = useAction(users.acceptInvitation, { success: 'Marked as accepted for the demo.' })

  useEffect(() => {
    if (d) {
      const u = d.user
      setF({ name: u.name, email: u.email, department: u.department, role: u.role, status: u.status, functions: [...u.functions], channels: [...u.channels], adAccounts: [...u.adAccounts] })
    } else setF(null)
  }, [d])
  useEffect(() => setTab('profile'), [id])

  const dirty = !!d && !!f && JSON.stringify([f.name, f.email, f.department, f.role, f.status, [...f.functions].sort(), [...f.channels].sort(), [...f.adAccounts].sort()]) !== JSON.stringify([d.user.name, d.user.email, d.user.department, d.user.role, d.user.status, [...d.user.functions].sort(), [...d.user.channels].sort(), [...d.user.adAccounts].sort()])
  const makesAdmin = !!d && !!f && isAdminUser({ status: f.status, functions: f.functions }) && !isAdminUser(d.user)
  // Access also comes from Asset Group roles, so count those before calling a function inert.
  const viaGroupChannels = !!d?.groupRoles.some((g) => g.role !== 'ads' && g.channels.length > 0)
  const viaGroupAds = !!d?.groupRoles.some((g) => g.role === 'ads' && g.adAccounts.length > 0)
  const inert = f ? inertFunctions(f.functions, f.channels.length > 0 || viaGroupChannels ? 1 : 0, f.adAccounts.length > 0 || viaGroupAds ? 1 : 0) : []
  const toggle = <K extends 'functions' | 'channels' | 'adAccounts'>(key: K, value: string, on: boolean) => setF((x) => (x ? { ...x, [key]: on ? [...(x[key] as string[]), value] : (x[key] as string[]).filter((v) => v !== value) } : x))

  const commit = () => save.mutate([id!, f!], { onSuccess: () => setConfirmAdmin(false) })

  return (
    <>
      <Dialog
        open={!!id}
        onOpenChange={(o) => !o && onClose()}
        title={d?.user.name ?? 'Person'}
        description={d ? `${d.user.email} · ${d.user.role} · ${d.user.department}` : undefined}
        className="max-w-3xl"
        footer={
          d &&
          f && (
            <>
              <p className="mr-auto text-xs text-muted">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</p>
              <Button onClick={onClose}>Close</Button>
              <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => (makesAdmin ? setConfirmAdmin(true) : commit())}>
                Save changes
              </Button>
            </>
          )
        }
      >
        {q.error ? (
          <p className="text-sm text-muted">{(q.error as Error).message}</p>
        ) : !d || !f ? (
          <Skeleton className="h-80" />
        ) : (
          <>
            <div role="tablist" aria-label="Person sections" className="-mt-1 mb-4 flex gap-1 overflow-x-auto border-b border-border">
              {(
                [
                  ['profile', 'Profile'],
                  ['functions', `Functions (${f.functions.length})`],
                  ['accounts', `Direct access (${f.channels.length + f.adAccounts.length})`],
                  ['effective', 'Effective access'],
                ] as [Tab, string][]
              ).map(([t, label]) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === t ? 'border-accent-strong text-text' : 'border-transparent text-muted hover:text-text')}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'profile' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">{(fid) => <Input id={fid} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
                <Field label="Login email">{(fid) => <Input id={fid} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
                <Field label="Department">
                  {(fid) => (
                    <Select id={fid} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value as Department })}>
                      {DEPARTMENTS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Role" hint="A label only. Full access comes from the Administrator access function.">
                  {(fid) => (
                    <Select id={fid} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as StaffRole })}>
                      {STAFF_ROLES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Status">
                  {(fid) => (
                    <Select id={fid} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as User['status'] })}>
                      {['Active', 'Invited', 'Suspended'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                {isAdminUser({ status: f.status, functions: f.functions }) && (
                  <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn sm:col-span-2">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" /> This person holds Administrator access: every channel and ad account, and the power to change anyone’s access.
                  </p>
                )}
                {d.user.status !== 'Active' && (
                  <div className="rounded-lg border border-border p-3 sm:col-span-2">
                    <p className="mb-2 text-sm font-medium">Invitation (simulated)</p>
                    <p className="mb-3 text-[0.8125rem] text-muted">No email is ever sent from this demo. Recording an invitation only writes to the activity log.</p>
                    <div className="flex flex-wrap gap-2">
                      {d.user.status === 'Invited' && (
                        <>
                          <Button size="sm" onClick={() => invite.mutate([d.user.id])}>
                            <Mail /> Record invitation
                          </Button>
                          <Button size="sm" onClick={() => accept.mutate([d.user.id])}>
                            Mark as accepted (demo)
                          </Button>
                        </>
                      )}
                      {d.user.status === 'Suspended' && <span className="text-sm text-muted">Suspended people can't sign in. Set the status to Active to restore them.</span>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'functions' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-text-2">What this person may do. Channel and ad account functions also need an assignment.</p>
                  <Button size="sm" onClick={() => setF({ ...f, functions: [...ROLE_FUNCTIONS[f.role]] })}>
                    Apply usual functions for {f.role}
                  </Button>
                </div>
                {inert.length > 0 && (
                  <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" />
                    <span>
                      No channel or ad account access yet, so these have no effect: {inert.map((x) => x.label).join(', ')}. Assign accounts under Direct access, or through an Asset Group role.
                    </span>
                  </p>
                )}
                {FUNCTION_AREAS.map((area) => (
                  <fieldset key={area}>
                    <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{area}</legend>
                    <ul className="space-y-1">
                      {FUNCTION_CATALOG.filter((x) => x.area === area).map((x) => (
                        <li key={x.id}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2 hover:bg-surface-2">
                            <input type="checkbox" name="function" value={x.id} className="mt-1 size-4 accent-[var(--accent-strong)]" checked={f.functions.includes(x.id)} onChange={(e) => toggle('functions', x.id, e.target.checked)} />
                            <span className="text-sm">
                              <span className="font-medium">{x.label}</span>
                              {x.scoped && <span className="ml-2 text-xs text-muted">needs {x.scoped === 'channels' ? 'channel' : 'ad account'} access</span>}
                              <span className="block text-[0.8125rem] text-muted">{x.description}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                ))}
              </div>
            )}

            {tab === 'accounts' && (
              <div className="space-y-6">
                <p className="text-sm text-text-2">Direct assignments only. Asset Group roles are shown under Effective access and are managed in Asset Groups. Nothing is selected for new people.</p>
                <fieldset>
                  <legend className="mb-1.5 font-semibold">Channels ({f.channels.length})</legend>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {d.allChannels.map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
                          <input type="checkbox" name="channel" value={c.id} className="size-4 accent-[var(--accent-strong)]" checked={f.channels.includes(c.id)} onChange={(e) => toggle('channels', c.id, e.target.checked)} />
                          <NetworkMark network={c.network as Network} />
                          <span className="min-w-0 truncate">{c.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
                <fieldset>
                  <legend className="mb-1.5 font-semibold">Ad accounts ({f.adAccounts.length})</legend>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {d.allAdAccounts.map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
                          <input type="checkbox" name="ad-account" value={c.id} className="size-4 accent-[var(--accent-strong)]" checked={f.adAccounts.includes(c.id)} onChange={(e) => toggle('adAccounts', c.id, e.target.checked)} />
                          <span className="min-w-0 truncate">
                            {c.name} <span className="text-muted">· {c.network}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              </div>
            )}

            {tab === 'effective' && (
              <div className="space-y-5 text-sm">
                {d.isAdminRole ? (
                  <p className="rounded-lg bg-accent-soft px-3 py-2">Active administrator: full access to every channel, ad account and setting.</p>
                ) : (
                  <p className="text-muted">What this person can actually see and do right now, as saved. Save your edits first to see them reflected.</p>
                )}
                <section>
                  <h3 className="mb-1.5 font-semibold">Channels ({d.effective.channels.length})</h3>
                  {d.effective.channels.length ? (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {d.effective.channels.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                          <NetworkMark network={c.network as Network} />
                          <span className="font-medium">{c.name}</span>
                          {c.via.map((v) => (
                            <Badge key={v} tone={v.startsWith('Group') ? 'info' : 'neutral'}>
                              {v}
                            </Badge>
                          ))}
                          <span className="ml-auto text-xs text-muted">{c.functions.length ? c.functions.join(', ') : 'View only'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No channel access.</p>
                  )}
                </section>
                <section>
                  <h3 className="mb-1.5 font-semibold">Ad accounts ({d.effective.adAccounts.length})</h3>
                  {d.effective.adAccounts.length ? (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {d.effective.adAccounts.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                          <span className="font-medium">{c.name}</span>
                          {c.via.map((v) => (
                            <Badge key={v} tone={v.startsWith('Group') ? 'info' : 'neutral'}>
                              {v}
                            </Badge>
                          ))}
                          <span className="ml-auto text-xs text-muted">{c.functions.join(', ') || 'View only'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No ad account access.</p>
                  )}
                </section>
                {d.groupRoles.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 font-semibold">Asset Group roles</h3>
                    <ul className="space-y-1.5">
                      {d.groupRoles.map((g, i) => (
                        <li key={g.groupId + g.role + i} className="rounded-lg bg-surface-2 px-3 py-2">
                          <span className="font-medium">{g.groupName}</span> · {g.role === 'creator' ? 'content creator' : g.role === 'approver' ? 'content approver' : 'ad manager'}
                          <span className="block text-xs text-muted">{(g.role === 'ads' ? g.adAccounts : g.channels).join(', ') || 'Nothing selected'}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </Dialog>
      <Dialog
        open={confirmAdmin}
        onOpenChange={setConfirmAdmin}
        title="Give this person Administrator access?"
        description="Administrators see every channel and ad account, can change anyone's permissions and can pause publishing."
        footer={
          <>
            <Button onClick={() => setConfirmAdmin(false)}>Cancel</Button>
            <Button variant="danger" onClick={commit} disabled={save.isPending}>
              Give Administrator access
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-2">This is recorded in the activity log.</p>
      </Dialog>
    </>
  )
}

function AddDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState<Department>('Communications')
  const [role, setRole] = useState<StaffRole>('Editor')
  const [roleFunctions, setRoleFunctions] = useState(true)
  const [invite, setInvite] = useState(true)
  const create = useAction(users.createStaff, { success: 'Person added with no channel or ad account access.' })
  useEffect(() => {
    if (open) {
      setName('')
      setEmail('')
      setDepartment('Communications')
      setRole('Editor')
      setRoleFunctions(true)
      setInvite(true)
    }
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add person"
      description="Create the person with a name and login email. They start with no channel or ad account access."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !email.trim() || create.isPending}
            onClick={() =>
              create.mutate([{ name, email, department, role, roleFunctions, invite }], {
                onSuccess: (id) => {
                  onOpenChange(false)
                  onCreated(id)
                  if (invite) toast.info('Invitation recorded (simulated). No email was sent.')
                },
              })
            }
          >
            Add person
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Ellis" />}</Field>
        <Field label="Login email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jordan.ellis@harbourview.example" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department">
            {(id) => (
              <Select id={id} value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Role">
            {(id) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                {STAFF_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent-strong)]" checked={roleFunctions} onChange={(e) => setRoleFunctions(e.target.checked)} />
          <span>
            Start with the usual functions for this role
            <span className="block text-xs text-muted">Channel access is never granted here.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent-strong)]" checked={invite} onChange={(e) => setInvite(e.target.checked)} />
          <span>
            Record a simulated invitation
            <span className="block text-xs text-muted">No email is sent. The person is marked Invited.</span>
          </span>
        </label>
      </div>
    </Dialog>
  )
}
