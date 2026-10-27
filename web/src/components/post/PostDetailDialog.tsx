import { useNavigate } from '@tanstack/react-router'
import { CalendarClock, Check, CornerUpLeft, Pencil, Send, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAction, usePost } from '@/api/hooks'
import { PostPreview } from '@/components/post/PostPreview'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Field, Input, SimBadge, Skeleton, Textarea } from '@/components/ui/primitives'
import type { PostStatus } from '@/domain/types'
import { formatDateTime, relativeTime } from '@/lib/utils'
import { halifaxToISO, toHalifaxInput } from '@/lib/time'
import * as content from '@/mock/api-content'

export const STATUS_TONE: Record<PostStatus, 'neutral' | 'warn' | 'info' | 'good' | 'bad' | 'accent'> = {
  Draft: 'neutral',
  'In review': 'warn',
  Approved: 'accent',
  Scheduled: 'info',
  Published: 'good',
  Failed: 'bad',
}

const defaultSlot = () => {
  const d = new Date(Date.now() + 24 * 3600_000)
  return toHalifaxInput(d.toISOString()).slice(0, 11) + '10:00'
}

/** Full post view with the approval workflow. Every action is checked per channel in the API. */
export function PostDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = usePost(id)
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [slot, setSlot] = useState(defaultSlot())
  const [mode, setMode] = useState<'none' | 'return' | 'schedule'>('none')
  const transition = useAction(content.transitionPost)
  const del = useAction(content.deletePost, { success: 'Draft deleted.' })
  const d = q.data
  const p = d?.post

  useEffect(() => {
    setMode('none')
    setNote('')
    if (p?.scheduledFor) setSlot(toHalifaxInput(p.scheduledFor))
    else setSlot(defaultSlot())
    // Reset the inline forms only when a different post opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id])

  const run = (action: Parameters<typeof content.transitionPost>[2], opts: content.TransitionOpts = {}, done?: string) =>
    transition.mutate([p!.id, action, opts], {
      onSuccess: (r) => {
        setMode('none')
        setNote('')
        toast.success(done ?? `Post is now ${r.status}.`)
        if (r.warning) toast.warning(r.warning)
      },
    })

  const can = (a: content.PostRow['actions'][number]) => !!p?.actions.includes(a)

  return (
    <Dialog
      open={!!id}
      onOpenChange={(o) => !o && onClose()}
      title={p?.title ?? 'Post'}
      description={p ? `${p.account.name} · ${p.account.network} · ${p.format}` : undefined}
      className="max-w-4xl"
      footer={
        p && (
          <>
            {can('delete') && (
              <Button variant="ghost" className="mr-auto" onClick={() => del.mutate([p.id], { onSuccess: onClose })}>
                <Trash2 /> Delete draft
              </Button>
            )}
            {can('edit') && (
              <Button
                onClick={() => {
                  onClose()
                  navigate({ to: '/$page', params: { page: 'composer' }, search: { batch: p.batchId } })
                }}
              >
                <Pencil /> Edit in composer
              </Button>
            )}
            {can('submit') && (
              <Button variant="primary" disabled={transition.isPending} onClick={() => run('submit', {}, 'Submitted for approval.')}>
                <Send /> Submit for approval
              </Button>
            )}
            {can('approve') && (
              <Button variant="primary" disabled={transition.isPending} onClick={() => run('approve', {}, 'Approved. It can now be scheduled.')}>
                <Check /> Approve
              </Button>
            )}
            {can('return') && mode !== 'return' && (
              <Button onClick={() => setMode('return')}>
                <CornerUpLeft /> Return to draft
              </Button>
            )}
            {(can('schedule') || can('reschedule')) && mode !== 'schedule' && (
              <Button variant={can('schedule') ? 'primary' : 'secondary'} onClick={() => setMode('schedule')} disabled={d?.paused}>
                <CalendarClock /> {can('schedule') ? 'Schedule' : p.status === 'Failed' ? 'Retry at…' : 'Reschedule'}
              </Button>
            )}
            {can('unschedule') && (
              <Button onClick={() => run('unschedule', {}, 'Removed from the queue. It stays approved.')}>
                <Undo2 /> Unschedule
              </Button>
            )}
          </>
        )
      }
    >
      {q.error ? (
        <p className="text-sm text-muted">{(q.error as Error).message}</p>
      ) : !d || !p ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
          <div>
            <PostPreview account={p.account} text={p.text} comment={p.comment} image={{ photo: p.media?.photo ?? p.photo, blobId: p.media?.blobId }} alt={p.alt} format={p.format} />
            <p className="mt-2 text-xs text-muted">Approximate {p.account.network} layout. Mock preview.</p>
          </div>
          <div className="min-w-0 space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
              <span className="text-muted">{p.id}</span>
              {p.status === 'Scheduled' && <span className="text-text-2">Scheduled for {formatDateTime(p.scheduledFor)} (America/Halifax)</span>}
              {p.status === 'Published' && p.publishedAt && <span className="text-text-2">Published (simulated) {relativeTime(p.publishedAt)}</span>}
              <SimBadge>Nothing is sent externally</SimBadge>
            </div>
            {p.failureReason && <p className="rounded-lg bg-bad-soft px-3 py-2 text-bad">Failed: {p.failureReason}. No platform was called.</p>}
            {p.reviewNote && p.status === 'Draft' && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">
                <strong>Returned with a note:</strong> {p.reviewNote}
              </p>
            )}
            {p.isOwn && p.status === 'In review' && <p className="rounded-lg bg-surface-2 px-3 py-2 text-text-2">You wrote this post, so another approver has to review it.</p>}
            {d.paused && (p.status === 'Approved' || p.status === 'Scheduled') && <p className="rounded-lg bg-bad-soft px-3 py-2 text-bad">Emergency pause is active. Scheduling and rescheduling are locked.</p>}
            {p.account.connection.status === 'Expired' && p.status !== 'Published' && <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">{p.account.name} has an expired connection. The demo queue blocks this post until the channel is reconnected.</p>}

            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-muted">Author</dt>
              <dd>{p.authorName}</dd>
              <dt className="text-muted">Brand context</dt>
              <dd>{d.guideline ? `${d.guideline.name}${d.guideline.reviewed ? '' : ' (not reviewed)'}` : 'None'}</dd>
              <dt className="text-muted">ALT text</dt>
              <dd>{p.alt || <span className="text-bad">Missing</span>}</dd>
              {p.comment && (
                <>
                  <dt className="text-muted">Follow-up</dt>
                  <dd>{p.comment}</dd>
                </>
              )}
              {p.media && (
                <>
                  <dt className="text-muted">Media</dt>
                  <dd>
                    {p.media.name} <Badge tone={p.media.status === 'Approved' ? 'good' : 'warn'}>{p.media.status}</Badge>
                  </dd>
                </>
              )}
            </dl>

            {d.siblings.length > 0 && (
              <div>
                <h3 className="mb-1.5 font-semibold">Same post on other channels</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {d.siblings.map((s) => (
                    <li key={s.id}>
                      <Badge tone={STATUS_TONE[s.status]}>
                        {s.network} · {s.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted">Each channel is approved and scheduled on its own.</p>
              </div>
            )}

            {mode === 'return' && (
              <div className="rounded-lg border border-border p-3">
                <Field label="Note for the author (required)">{(fid) => <Textarea id={fid} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change before this can be approved?" />}</Field>
                <div className="mt-2 flex gap-2">
                  <Button variant="primary" disabled={!note.trim() || transition.isPending} onClick={() => run('return', { note }, 'Returned to draft with your note.')}>
                    Return to draft
                  </Button>
                  <Button onClick={() => setMode('none')}>Cancel</Button>
                </div>
              </div>
            )}
            {mode === 'schedule' && (
              <div className="rounded-lg border border-border p-3">
                <Field label="Publish at (America/Halifax)" hint="At least 5 minutes from now. The demo queue publishes it; nothing is sent to a platform.">
                  {(fid) => <Input id={fid} type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} className="w-64" />}
                </Field>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="primary"
                    disabled={!slot || transition.isPending}
                    onClick={() => {
                      let iso: string
                      try {
                        iso = halifaxToISO(slot)
                      } catch (e) {
                        return void toast.error((e as Error).message)
                      }
                      run(can('schedule') ? 'schedule' : 'reschedule', { scheduledFor: iso }, `Scheduled for ${formatDateTime(iso)}.`)
                    }}
                  >
                    Confirm
                  </Button>
                  <Button onClick={() => setMode('none')}>Cancel</Button>
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-1.5 font-semibold">History</h3>
              <ol className="space-y-1.5 border-l border-border pl-4">
                {[...p.history].reverse().map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-border-strong" aria-hidden />
                    <span className="font-medium">{e.action}</span> <span className="text-muted">by {e.actor} · {formatDateTime(e.at)}</span>
                    {e.note && <span className="block text-[0.8125rem] text-text-2">{e.note}</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
