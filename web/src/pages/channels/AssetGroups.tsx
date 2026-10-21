import { useNavigate, useSearch } from '@tanstack/react-router'
import { FolderKanban, Link2, Lock, Pencil, Plus, Trash2, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAction, useGroup, useGroups } from '@/api/hooks'
import { ChannelAvatar, ConnectionBadge } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Skeleton, Textarea } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import * as assets from '@/mock/api-assets'
import { BrandDirection } from './BrandDirection'
import { BrandVoices } from './BrandVoices'
import { GroupPeople } from './GroupPeople'

type Tab = 'channels' | 'people' | 'brand' | 'voices'
const TABS: [Tab, string][] = [
  ['channels', 'Channels'],
  ['people', 'People & access'],
  ['brand', 'Brand direction'],
  ['voices', 'Brand voices'],
]

export function AssetGroupsPage() {
  const search = useSearch({ from: '/$page' })
  const navigate = useNavigate()
  const groups = useGroups()
  const [creating, setCreating] = useState(false)
  const list = groups.data?.groups
  const selected = list?.some((g) => g.id === search.group) ? search.group! : (list?.[0]?.id ?? null)
  const tab = (TABS.some(([t]) => t === search.tab) ? search.tab : 'channels') as Tab
  const go = (group: string | null, t: Tab = tab) => navigate({ to: '/$page', params: { page: 'assets' }, search: { group: group ?? undefined, tab: t }, replace: true })

  if (groups.error) {
    return (
      <>
        <PageHeader title="Asset Groups" />
        <EmptyState title="Not available" icon={<FolderKanban />}>
          {(groups.error as Error).message}
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Asset Groups"
        description="Group channels under a shared brand direction. Linking channels or creating a group grants nobody access."
        actions={
          groups.data?.canCreate && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus /> New group
            </Button>
          )
        }
      />
      {!list ? (
        <Skeleton className="h-96" />
      ) : !list.length ? (
        <EmptyState title="No Asset Groups in your scope" icon={<FolderKanban />}>
          {groups.data!.archived ? `${groups.data!.archived} deleted group(s) are archived. ` : ''}Your independent social channels are still available in Social Channels.
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <nav aria-label="Asset Groups" className="space-y-2">
            {list.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => go(g.id)}
                aria-current={g.id === selected ? 'true' : undefined}
                className={cn('flex w-full items-start gap-3 rounded-xl border bg-surface p-3.5 text-left hover:border-border-strong', g.id === selected ? 'border-accent-strong ring-1 ring-accent-strong' : 'border-border')}
              >
                <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: g.color }} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">{g.name}</span>
                  <span className="tabular mt-1 block text-[0.8125rem] text-muted">
                    {g.channelCount} channels · {g.people} people · {g.reviewedSets}/{g.totalSets} guidelines reviewed
                  </span>
                </span>
              </button>
            ))}
            {groups.data!.archived > 0 && <p className="px-1 text-xs text-muted">{groups.data!.archived} deleted group(s) archived. Restore is not available yet.</p>}
          </nav>
          {selected && <GroupDetailView id={selected} tab={tab} setTab={(t) => go(selected, t)} onDeleted={() => go(null, 'channels')} />}
        </div>
      )}
      <GroupFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => go(id, 'channels')} />
    </>
  )
}

function GroupDetailView({ id, tab, setTab, onDeleted }: { id: string; tab: Tab; setTab: (t: Tab) => void; onDeleted: () => void }) {
  const q = useGroup(id)
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const d = q.data
  if (q.error) return <EmptyState title="Not available">{(q.error as Error).message}</EmptyState>
  if (!d) return <Skeleton className="h-[32rem]" />
  const g = d.group

  return (
    <section className="min-w-0" aria-label={g.name}>
      <Card className="mb-4">
        <div className="flex flex-wrap items-start gap-4">
          <span className="mt-1 size-10 shrink-0 rounded-lg" style={{ background: g.color }} aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{g.name}</h2>
            <p className="text-sm text-muted">{g.description || 'No description.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.canEdit && (
              <>
                <Button size="sm" onClick={() => setEditing(true)}>
                  <Pencil /> Edit details
                </Button>
                <Button size="sm" onClick={() => setLinking(true)}>
                  <Link2 /> Link channels
                </Button>
              </>
            )}
            {d.canDelete && (
              <Button size="sm" variant="danger" onClick={() => setDeleting(true)}>
                <Trash2 /> Delete group
              </Button>
            )}
          </div>
        </div>
        {!d.canEdit && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-text-2">
            <Lock className="size-4" /> Read only. Editing needs "Manage asset groups" and access to every linked channel.
          </p>
        )}
      </Card>

      <div role="tablist" aria-label="Group sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium', tab === t ? 'border-accent-strong text-text' : 'border-transparent text-muted hover:text-text')}
          >
            {label}
            {t === 'channels' && <span className="tabular ml-1.5 text-muted">{d.channels.length}</span>}
            {t === 'people' && <span className="tabular ml-1.5 text-muted">{d.people.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'channels' && <GroupChannels d={d} onLink={() => setLinking(true)} />}
      {tab === 'people' && <GroupPeople d={d} />}
      {tab === 'brand' && <BrandDirection d={d} />}
      {tab === 'voices' && <BrandVoices d={d} />}

      <GroupFormDialog open={editing} onOpenChange={setEditing} group={g} />
      <LinkDialog open={linking} onOpenChange={setLinking} d={d} />
      <DeleteDialog open={deleting} onOpenChange={setDeleting} d={d} onDeleted={onDeleted} />
    </section>
  )
}

function GroupChannels({ d, onLink }: { d: assets.GroupDetail; onLink: () => void }) {
  const unlink = useAction(assets.setGroupChannels, { success: 'Channel unlinked. Its connection, posts and direct user grants are unchanged.' })
  return (
    <Card>
      <CardHeader
        title="Linked channels"
        description="One group per channel. Unlink a channel here before moving it to another group."
        action={
          d.canEdit && (
            <Button size="sm" onClick={onLink}>
              <Link2 /> Link channels
            </Button>
          )
        }
      />
      {d.channels.length ? (
        <ul className="divide-y divide-border">
          {d.channels.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <ChannelAvatar account={c} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{c.name}</span>
                <span className="block text-[0.8125rem] text-muted">
                  {c.network} · {c.handle}
                </span>
              </span>
              <ConnectionBadge status={c.connection.status} />
              {d.canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    unlink.mutate([
                      d.group.id,
                      d.channels.filter((x) => x.id !== c.id).map((x) => x.id),
                    ])
                  }
                >
                  <Unlink /> Unlink
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No channels linked. Deleting a group earlier, or unlinking, never deletes a channel.</p>
      )}
    </Card>
  )
}

function LinkDialog({ open, onOpenChange, d }: { open: boolean; onOpenChange: (o: boolean) => void; d: assets.GroupDetail }) {
  const [chosen, setChosen] = useState<string[]>([])
  const save = useAction(assets.setGroupChannels, { success: (r) => `${r.linked} linked, ${r.unlinked} unlinked. No one gained access.` })
  useEffect(() => {
    if (open) setChosen(d.channels.map((c) => c.id))
  }, [open, d.channels])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Link channels to ${d.group.name}`}
      description="Unchecking a channel unlinks it. Its connection and posts are unchanged, and it is removed from this group's roles. Newly linked channels are not added to anyone's role."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate([d.group.id, chosen], { onSuccess: () => onOpenChange(false) })}>
            Save links
          </Button>
        </>
      }
    >
      <ul className="space-y-1.5">
        {d.linkable.map((c) => {
          const disabled = !!c.otherGroup
          return (
            <li key={c.id}>
              <label className={cn('flex items-center gap-3 rounded-lg border border-border px-3 py-2', disabled ? 'opacity-55' : 'cursor-pointer hover:bg-surface-2')}>
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent-strong)]"
                  disabled={disabled}
                  checked={chosen.includes(c.id)}
                  onChange={(e) => setChosen((x) => (e.target.checked ? [...x, c.id] : x.filter((y) => y !== c.id)))}
                />
                <ChannelAvatar account={c} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-muted">
                    {c.network}
                    {c.otherGroup ? ` · in ${c.otherGroup}, unlink there first` : c.assetGroupId ? '' : ' · unlinked'}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}

function GroupFormDialog({ open, onOpenChange, group, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; group?: assets.GroupDetail['group']; onSaved?: (id: string) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#9fcabf')
  const [description, setDescription] = useState('')
  const create = useAction(assets.createGroup, { success: 'Group created. Link channels and assign people next.' })
  const update = useAction(assets.updateGroup, { success: 'Group details saved.' })
  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
      setColor(group?.color ?? '#9fcabf')
      setDescription(group?.description ?? '')
    }
  }, [open, group])
  const pending = create.isPending || update.isPending
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={group ? 'Edit group details' : 'New Asset Group'}
      description={group ? undefined : 'Starts with no channels, no people and a basic master direction.'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || pending}
            onClick={() =>
              group
                ? update.mutate([group.id, { name, color, description }], { onSuccess: () => onOpenChange(false) })
                : create.mutate([{ name, color, description }], {
                    onSuccess: (id) => {
                      onOpenChange(false)
                      onSaved?.(id)
                    },
                  })
            }
          >
            {group ? 'Save' : 'Create group'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Group name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Harbourview Libraries" />}</Field>
        <Field label="Group colour">
          {(id) => (
            <div className="flex items-center gap-3">
              <input id={id} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface-2" />
              <span className="tabular text-sm text-text-2">{color}</span>
            </div>
          )}
        </Field>
        <Field label="Description">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      </div>
    </Dialog>
  )
}

function DeleteDialog({ open, onOpenChange, d, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; d: assets.GroupDetail; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState('')
  const del = useAction(assets.deleteGroup, { success: (n) => `Group deleted and archived. ${n} channel(s) unlinked and kept.` })
  useEffect(() => {
    if (open) setConfirm('')
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${d.group.name}?`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={confirm !== 'DELETE' || del.isPending}
            onClick={() =>
              del.mutate([d.group.id, confirm], {
                onSuccess: () => {
                  onOpenChange(false)
                  onDeleted()
                },
              })
            }
          >
            Delete group
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          <strong>{d.channels.length} channel(s)</strong> become unlinked. Their connections, token expiry, posts, conversations and everyone’s direct permissions stay exactly as they are.
        </p>
        <p>
          <strong>{d.people.length} group role(s)</strong> end with the group. The group and its brand direction are archived in this demo; there is no restore screen yet.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {d.channels.map((c) => (
            <Badge key={c.id}>{c.name}</Badge>
          ))}
        </div>
        <Field label='Type "DELETE" to confirm'>{(id) => <Input id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}</Field>
      </div>
    </Dialog>
  )
}
