import { Plus, Search, UserMinus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAction } from '@/api/hooks'
import { ChannelAvatar } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, Field, Input } from '@/components/ui/primitives'
import type { GroupRole } from '@/domain/types'
import { cn } from '@/lib/utils'
import * as assets from '@/mock/api-assets'

const ROLES: { role: GroupRole; label: string; description: string }[] = [
  { role: 'creator', label: 'Content creators', description: 'Create and submit drafts for the selected channels.' },
  { role: 'approver', label: 'Content approvers', description: 'Review and approve content for the selected channels.' },
  { role: 'ads', label: 'Ad managers', description: 'Recorded for later. No ad accounts exist yet, so this role grants no ad account scope and no spend authority.' },
]

export function GroupPeople({ d }: { d: assets.GroupDetail }) {
  const [adding, setAdding] = useState<GroupRole | null>(null)
  const [editing, setEditing] = useState<{ userId: string; role: GroupRole; channelIds: string[] } | null>(null)
  const remove = useAction(assets.removeGroupRole, { success: 'Group role removed. Direct permissions in Users & Access are unchanged.' })
  const channelName = (id: string) => d.channels.find((c) => c.id === id)?.name ?? 'Unlinked channel'

  return (
    <>
      <p className="mb-4 text-sm text-text-2">
        Roles here apply only inside <strong>{d.group.name}</strong> and only to the channels selected for each person. Being a creator here and an approver in another group gives no approval rights here. Newly linked channels are not added to
        existing roles.
      </p>
      <div className="grid gap-4 xl:grid-cols-3">
        {ROLES.map((r) => {
          const people = d.people.filter((p) => p.role === r.role)
          return (
            <Card key={r.role} className="flex flex-col">
              <div className="mb-3">
                <h3 className="font-semibold">{r.label}</h3>
                <p className="text-[0.8125rem] text-muted">{r.description}</p>
              </div>
              {people.length ? (
                <ul className="mb-3 flex-1 divide-y divide-border">
                  {people.map((p) => (
                    <li key={p.userId} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex-1">
                          <span className="block text-sm font-medium">{p.name}</span>
                          <span className="block text-xs text-muted">{p.staffRole}</span>
                        </span>
                        {d.canEdit && r.role !== 'ads' && (
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ userId: p.userId, role: p.role, channelIds: p.channelIds })}>
                            Channels
                          </Button>
                        )}
                        {d.canEdit && (
                          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${p.name} from ${r.label}`} onClick={() => remove.mutate([d.group.id, p.userId, p.role])}>
                            <UserMinus />
                          </Button>
                        )}
                      </div>
                      {r.role !== 'ads' && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {p.channelIds.map((c) => (
                            <Badge key={c}>{channelName(c)}</Badge>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 flex-1 text-sm text-muted">Nobody assigned.</p>
              )}
              {d.canEdit && (
                <Button size="sm" onClick={() => setAdding(r.role)} disabled={r.role !== 'ads' && !d.channels.length} title={r.role !== 'ads' && !d.channels.length ? 'Link a channel first' : undefined}>
                  <Plus /> Add {r.label.toLowerCase()}
                </Button>
              )}
            </Card>
          )
        })}
      </div>
      <AssignDialog role={adding} onClose={() => setAdding(null)} d={d} />
      <EditChannelsDialog editing={editing} onClose={() => setEditing(null)} d={d} />
    </>
  )
}

function ChannelChecklist({ d, chosen, setChosen }: { d: assets.GroupDetail; chosen: string[]; setChosen: (x: string[]) => void }) {
  return (
    <ul className="space-y-1.5">
      {d.channels.map((c) => (
        <li key={c.id}>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-surface-2">
            <input type="checkbox" className="size-4 accent-[var(--accent-strong)]" checked={chosen.includes(c.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, c.id] : chosen.filter((y) => y !== c.id))} />
            <ChannelAvatar account={c} size={28} />
            <span className="text-sm">
              {c.name} <span className="text-muted">· {c.network}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}

function AssignDialog({ role, onClose, d }: { role: GroupRole | null; onClose: () => void; d: assets.GroupDetail }) {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const assign = useAction(assets.assignGroupRole, { success: 'Role assigned inside this group only.' })
  useEffect(() => {
    if (role) {
      setQ('')
      setUsers([])
      setChannels([])
    }
  }, [role])
  const def = ROLES.find((r) => r.role === role)
  const staff = d.staff.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Dialog
      open={!!role}
      onOpenChange={(o) => !o && onClose()}
      title={def ? `Add ${def.label.toLowerCase()}` : ''}
      description={`${d.group.name}. Select people, then explicitly select the channels this role covers. Nothing is selected by default.`}
      className="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!users.length || (role !== 'ads' && !channels.length) || assign.isPending} onClick={() => assign.mutate([d.group.id, role!, users, channels], { onSuccess: onClose })}>
            Assign {users.length ? `${users.length} ` : ''}
            {users.length === 1 ? 'person' : 'people'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Field label="Staff">
            {(id) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name" className="pl-9" />
              </div>
            )}
          </Field>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
            {staff.map((s) => (
              <li key={s.id}>
                <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2', users.includes(s.id) && 'bg-surface-2')}>
                  <input type="checkbox" className="size-4 accent-[var(--accent-strong)]" checked={users.includes(s.id)} onChange={(e) => setUsers((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id)))} />
                  <span className="text-sm">
                    {s.name}
                    <span className="block text-xs text-muted">
                      {s.role} · {s.department}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-[0.8125rem] font-medium text-text-2">Channels covered</p>
          {role === 'ads' ? (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">No ad accounts exist yet. The role is recorded but grants no ad account scope or spend authority.</p>
          ) : (
            <ChannelChecklist d={d} chosen={channels} setChosen={setChannels} />
          )}
        </div>
      </div>
    </Dialog>
  )
}

function EditChannelsDialog({ editing, onClose, d }: { editing: { userId: string; role: GroupRole; channelIds: string[] } | null; onClose: () => void; d: assets.GroupDetail }) {
  const [chosen, setChosen] = useState<string[]>([])
  const save = useAction(assets.updateGroupRole, { success: 'Channels for this role updated.' })
  useEffect(() => {
    if (editing) setChosen(editing.channelIds.filter((c) => d.channels.some((x) => x.id === c)))
  }, [editing, d.channels])
  const person = d.people.find((p) => p.userId === editing?.userId && p.role === editing?.role)
  return (
    <Dialog
      open={!!editing}
      onOpenChange={(o) => !o && onClose()}
      title={`Channels for ${person?.name ?? ''}`}
      description={`${editing?.role === 'creator' ? 'Content creator' : 'Content approver'} in ${d.group.name}.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!chosen.length || save.isPending} onClick={() => save.mutate([d.group.id, editing!.userId, editing!.role, chosen], { onSuccess: onClose })}>
            Save channels
          </Button>
        </>
      }
    >
      <ChannelChecklist d={d} chosen={chosen} setChosen={setChosen} />
    </Dialog>
  )
}
