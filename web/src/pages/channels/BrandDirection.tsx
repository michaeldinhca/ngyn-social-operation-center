import { CheckCircle2, CircleAlert, Download, FileText, ImagePlus, Plus, ShieldAlert, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAction, useBrief } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Card, CardHeader, Field, Input, Segmented, SimBadge, Skeleton, Textarea } from '@/components/ui/primitives'
import { isCompletePackage, masterChanged, packageProblems, validPalette } from '@/domain/brand'
import { CANVASES, type GuidelineSet, type MasterDirection, type VisualReference } from '@/domain/types'
import { cn, formatDateTime } from '@/lib/utils'
import * as assets from '@/mock/api-assets'
import { photoUrl, SAMPLE_PHOTOS } from '@/mock/photos'

const lines = (s: string) => s.split('\n')
const joinLines = (xs: string[]) => xs.join('\n')

export function BrandDirection({ d }: { d: assets.GroupDetail }) {
  const [mode, setMode] = useState<'master' | 'sets'>('master')
  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-accent-strong/40 bg-accent-soft px-4 py-3 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent-strong" />
        <p className="text-text-2">
          <strong className="text-text">The master direction governs every guideline.</strong> Guideline sets can add detail. They cannot remove or replace the master DO and DON’T rules. Changing master rules sends every reviewed set and voice back
          to review.
        </p>
      </div>
      <div className="mb-4">
        <Segmented
          label="Brand direction"
          value={mode}
          onChange={setMode}
          options={[
            ['master', 'Master direction'],
            ['sets', `Guideline sets (${d.group.brand.sets.length})`],
          ]}
        />
      </div>
      {mode === 'master' ? <MasterEditor d={d} /> : <GuidelineSets d={d} />}
    </>
  )
}

function MasterEditor({ d }: { d: assets.GroupDetail }) {
  const saved = d.group.brand.master
  const [m, setM] = useState<MasterDirection>(saved)
  const [dos, setDos] = useState(joinLines(saved.dos))
  const [donts, setDonts] = useState(joinLines(saved.donts))
  const fileRef = useRef<HTMLInputElement>(null)
  const save = useAction(assets.saveMaster, { success: (r) => (r.changed ? `Master saved. ${r.invalidated} reviewed item(s) now need review again.` : 'Master saved. No rule changes.') })
  useEffect(() => {
    setM(saved)
    setDos(joinLines(saved.dos))
    setDonts(joinLines(saved.donts))
  }, [saved])
  const draft = { ...m, dos: lines(dos).map((x) => x.trim()).filter(Boolean), donts: lines(donts).map((x) => x.trim()).filter(Boolean) }
  const dirty = masterChanged(saved, draft)
  const reviewedCount = d.group.brand.sets.filter((x) => x.reviewed).length + d.group.brand.voices.filter((x) => x.reviewed).length
  const ro = !d.canEdit

  const addLogos = async (files: FileList | null) => {
    if (!files) return
    const next = [...m.logos]
    for (const file of Array.from(files)) {
      if (next.length >= 8) {
        toast.error('Use up to 8 logo versions in this demo.')
        break
      }
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type) || file.size > 600 * 1024) {
        toast.error(`Skipped ${file.name}: use PNG, JPEG, WebP or SVG under 600 KB.`)
        continue
      }
      const image = await new Promise<string | null>((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => resolve(null)
        r.readAsDataURL(file)
      })
      if (image) next.push({ id: `logo-${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, ''), image })
    }
    setM({ ...m, logos: next })
    if (fileRef.current) fileRef.current.value = ''
  }

  const setColor = (i: number, v: string) => setM({ ...m, palette: m.palette.map((c, j) => (j === i ? v : c)) })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Identity" description={`Last saved by ${saved.updatedBy}, ${formatDateTime(saved.updatedAt)}`} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Brand name">{(id) => <Input id={id} value={m.name} disabled={ro} onChange={(e) => setM({ ...m, name: e.target.value })} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Heading typeface">{(id) => <Input id={id} value={m.headingFont} disabled={ro} onChange={(e) => setM({ ...m, headingFont: e.target.value })} />}</Field>
            <Field label="Body typeface">{(id) => <Input id={id} value={m.bodyFont} disabled={ro} onChange={(e) => setM({ ...m, bodyFont: e.target.value })} />}</Field>
          </div>
        </div>

        <h3 className="mb-1 mt-6 font-semibold">Logo versions</h3>
        <p className="mb-3 text-[0.8125rem] text-muted">Primary, reversed, monochrome and compact versions. Name each one so a brief can pick the right variant. Uploads stay in this browser.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {m.logos.map((l, i) => (
            <div key={l.id} className="rounded-lg border border-border p-2.5">
              <div className="flex h-20 items-center justify-center rounded-md bg-[repeating-conic-gradient(#d9ddd2_0_25%,#eef0ea_0_50%)] bg-[length:16px_16px] p-2">
                <img src={l.image} alt={`${l.name} logo`} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Input aria-label="Logo version name" value={l.name} disabled={ro} onChange={(e) => setM({ ...m, logos: m.logos.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className="h-8 text-[0.8125rem]" />
                {!ro && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${l.name}`} disabled={m.logos.length === 1} onClick={() => setM({ ...m, logos: m.logos.filter((_, j) => j !== i) })}>
                    <X />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!ro && m.logos.length < 8 && (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-[8.5rem] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-sm text-muted hover:text-text">
              <Upload className="size-5" />
              Add logo version
              <span className="text-xs">PNG, JPEG, WebP, SVG · 600 KB</span>
            </button>
          )}
          <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" aria-label="Upload logo versions" onChange={(e) => addLogos(e.target.files)} />
        </div>

        <h3 className="mb-1 mt-6 font-semibold">Colour palette</h3>
        <p className="mb-3 text-[0.8125rem] text-muted">Exactly two or three colours.</p>
        <div className="flex flex-wrap items-end gap-4">
          {m.palette.map((c, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={['Primary', 'Secondary', 'Accent'][i]}>
                {(id) => (
                  <div className="flex items-center gap-2">
                    <input type="color" aria-label={`${['Primary', 'Secondary', 'Accent'][i]} colour picker`} value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000'} disabled={ro} onChange={(e) => setColor(i, e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface-2" />
                    <Input id={id} value={c} disabled={ro} onChange={(e) => setColor(i, e.target.value)} className="tabular w-28" />
                  </div>
                )}
              </Field>
              {!ro && i === 2 && (
                <Button size="icon-sm" variant="ghost" aria-label="Remove accent colour" onClick={() => setM({ ...m, palette: m.palette.slice(0, 2) })}>
                  <X />
                </Button>
              )}
            </div>
          ))}
          {!ro && m.palette.length < 3 && (
            <Button size="sm" onClick={() => setM({ ...m, palette: [...m.palette, '#2a78d6'] })}>
              <Plus /> Accent colour
            </Button>
          )}
        </div>
        {!validPalette(m.palette) && <p className="mt-2 text-sm text-bad">Use two or three six-digit hex colours, like #D0FC70.</p>}
      </Card>

      <Card>
        <CardHeader title="Voice and non-negotiable rules" description="Every guideline set and Brand Voice inherits these." />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Voice">{(id) => <Textarea id={id} rows={3} value={m.voice} disabled={ro} onChange={(e) => setM({ ...m, voice: e.target.value })} />}</Field>
          <Field label="Mood">{(id) => <Textarea id={id} rows={3} value={m.mood} disabled={ro} onChange={(e) => setM({ ...m, mood: e.target.value })} />}</Field>
          <Field label="Tone">{(id) => <Textarea id={id} rows={3} value={m.tone} disabled={ro} onChange={(e) => setM({ ...m, tone: e.target.value })} />}</Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="DO (one rule per line)">{(id) => <Textarea id={id} rows={5} value={dos} disabled={ro} onChange={(e) => setDos(e.target.value)} />}</Field>
          <Field label="DON’T (one rule per line)">{(id) => <Textarea id={id} rows={5} value={donts} disabled={ro} onChange={(e) => setDonts(e.target.value)} />}</Field>
        </div>
      </Card>

      {!ro && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-surface/95 px-4 py-3 backdrop-blur">
          {dirty && reviewedCount > 0 && (
            <p className="mr-auto flex items-center gap-2 text-sm text-warn">
              <CircleAlert className="size-4" /> Saving sends {reviewedCount} reviewed item(s) back to review.
            </p>
          )}
          <Button
            onClick={() => {
              setM(saved)
              setDos(joinLines(saved.dos))
              setDonts(joinLines(saved.donts))
            }}
            disabled={!dirty}
          >
            Discard
          </Button>
          <Button variant="primary" disabled={!dirty || !validPalette(m.palette) || save.isPending} onClick={() => save.mutate([d.group.id, draft])}>
            Save master direction
          </Button>
        </div>
      )}
    </div>
  )
}

function statusOf(set: GuidelineSet) {
  if (set.reviewed) return { label: 'Reviewed', tone: 'good' as const }
  if (!isCompletePackage(set)) return { label: 'Incomplete', tone: 'bad' as const }
  return { label: 'Needs review', tone: 'warn' as const }
}

function GuidelineSets({ d }: { d: assets.GroupDetail }) {
  const sets = d.group.brand.sets
  const [selected, setSelected] = useState<string | null>(sets[0]?.id ?? null)
  const add = useAction(assets.addGuidelineSet, { success: 'Guideline set added.' })
  // Fall back to the first set without overwriting the choice, so a just-added set is
  // selected as soon as the refetch includes it.
  const set = sets.find((s) => s.id === selected) ?? sets[0]
  return (
    <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        {sets.map((s) => {
          const st = statusOf(s)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              aria-current={s.id === set?.id ? 'true' : undefined}
              className={cn('w-full rounded-xl border bg-surface p-3 text-left hover:border-border-strong', s.id === set?.id ? 'border-accent-strong ring-1 ring-accent-strong' : 'border-border')}
            >
              <span className="block font-medium">{s.name}</span>
              <span className="mt-1.5 flex items-center gap-2">
                <Badge tone={st.tone}>{st.label}</Badge>
                <span className="text-xs text-muted">{s.visuals.length} visuals</span>
              </span>
            </button>
          )
        })}
        {!sets.length && <p className="text-sm text-muted">No guideline sets yet.</p>}
        {d.canEdit && (
          <Button className="w-full" onClick={() => add.mutate([d.group.id], { onSuccess: (id) => setSelected(id) })}>
            <Plus /> Add guideline set
          </Button>
        )}
      </div>
      {set ? <SetEditor key={set.id} d={d} set={set} /> : <Card className="text-sm text-muted">Add a guideline set to combine written guidance with its own visual references.</Card>}
    </div>
  )
}

function SetEditor({ d, set }: { d: assets.GroupDetail; set: GuidelineSet }) {
  const [s, setS] = useState(set)
  const [dos, setDos] = useState(joinLines(set.dos))
  const [donts, setDonts] = useState(joinLines(set.donts))
  const [attest, setAttest] = useState(!!set.reviewed)
  const [addingVisual, setAddingVisual] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const save = useAction(assets.saveGuidelineSet, { success: (r) => (r ? 'Saved and marked reviewed against the master rules.' : 'Saved. This set needs review before use.') })
  const del = useAction(assets.deleteGuidelineSet, { success: 'Guideline set removed.' })
  useEffect(() => {
    setS(set)
    setDos(joinLines(set.dos))
    setDonts(joinLines(set.donts))
    setAttest(!!set.reviewed)
  }, [set])
  const draft: GuidelineSet = { ...s, dos: lines(dos).map((x) => x.trim()).filter(Boolean), donts: lines(donts).map((x) => x.trim()).filter(Boolean) }
  const problems = packageProblems(draft)
  const ro = !d.canEdit
  const voice = d.group.brand.voices.find((v) => v.id === s.voiceId)
  const st = statusOf(set)
  const master = d.group.brand.master

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          {set.reviewed && (
            <span className="text-[0.8125rem] text-muted">
              by {set.reviewed.by}, {formatDateTime(set.reviewed.at)}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => setBriefOpen(true)}>
              <FileText /> Brief preview
            </Button>
            {!ro && (
              <Button size="sm" variant="ghost" onClick={() => del.mutate([d.group.id, set.id])} aria-label="Remove guideline set">
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Guideline name">{(id) => <Input id={id} value={s.name} disabled={ro} onChange={(e) => setS({ ...s, name: e.target.value })} />}</Field>
          <Field label="Voice additions" hint={voice ? `From Brand Voice "${voice.name}". Edit freely.` : 'Optional. Apply a reviewed Brand Voice from the Brand voices tab.'}>
            {(id) => <Input id={id} value={s.voice} disabled={ro} onChange={(e) => setS({ ...s, voice: e.target.value })} />}
          </Field>
        </div>
        <Field label="Purpose and direction (required)" className="mt-4">
          {(id) => <Textarea id={id} rows={3} value={s.purpose} disabled={ro} onChange={(e) => setS({ ...s, purpose: e.target.value })} placeholder="What this guideline is for, and how posts should feel." />}
        </Field>
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-[0.8125rem]">
          <p className="mb-1 font-semibold text-text">Inherited master rules (always apply first)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ul className="list-disc pl-4 text-text-2">
              {master.dos.map((x) => (
                <li key={x}>DO: {x}</li>
              ))}
            </ul>
            <ul className="list-disc pl-4 text-text-2">
              {master.donts.map((x) => (
                <li key={x}>DON’T: {x}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Additional DO (one per line)">{(id) => <Textarea id={id} rows={3} value={dos} disabled={ro} onChange={(e) => setDos(e.target.value)} />}</Field>
          <Field label="Additional DON’T (one per line)">{(id) => <Textarea id={id} rows={3} value={donts} disabled={ro} onChange={(e) => setDonts(e.target.value)} />}</Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Visual references for this guideline"
          description="These visuals belong to this set. Canvases are sample working sizes, not verified platform requirements."
          action={
            !ro && (
              <Button size="sm" onClick={() => setAddingVisual(true)}>
                <ImagePlus /> Add visual
              </Button>
            )
          }
        />
        {s.visuals.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {s.visuals.map((v) => (
              <figure key={v.id} className="rounded-lg border border-border p-2">
                <div className="flex h-44 items-center justify-center rounded-md bg-surface-2">
                  <img src={photoUrl(v.photo, 360, Math.round((360 * v.height) / v.width))} alt={`${v.canvas} reference: ${SAMPLE_PHOTOS[v.photo].alt}`} loading="lazy" referrerPolicy="no-referrer" className="max-h-full max-w-full rounded object-cover" style={{ aspectRatio: `${v.width}/${v.height}` }} />
                </div>
                <figcaption className="mt-2 flex items-start justify-between gap-1 text-[0.8125rem]">
                  <span>
                    <span className="block font-medium">{v.canvas}</span>
                    <span className="tabular block text-xs text-muted">
                      {v.width}×{v.height}
                      {v.note ? ` · ${v.note}` : ''}
                    </span>
                  </span>
                  {!ro && (
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${v.canvas} visual`} onClick={() => setS({ ...s, visuals: s.visuals.filter((x) => x.id !== v.id) })}>
                      <X />
                    </Button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No visual references yet. Add at least one before review.</p>
        )}
      </Card>

      {!ro && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <label className={cn('mr-auto flex items-start gap-2 text-sm', problems.length && 'opacity-60')}>
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent-strong)]" checked={attest && !problems.length} disabled={!!problems.length} onChange={(e) => setAttest(e.target.checked)} />
            <span>
              I reviewed this guideline against the master rules
              {problems.length > 0 && <span className="block text-xs text-bad">{problems.join(' ')}</span>}
            </span>
          </label>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate([d.group.id, draft, attest && !problems.length])}>
            {attest && !problems.length ? (
              <>
                <CheckCircle2 /> Save as reviewed
              </>
            ) : (
              'Save draft'
            )}
          </Button>
        </div>
      )}
      <VisualDialog open={addingVisual} onOpenChange={setAddingVisual} onAdd={(v) => setS({ ...s, visuals: [...s.visuals, v] })} />
      <BriefDialog open={briefOpen} onOpenChange={setBriefOpen} groupId={d.group.id} setId={set.id} />
    </div>
  )
}

function VisualDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (v: VisualReference) => void }) {
  const [canvas, setCanvas] = useState(CANVASES[0].label)
  const [photo, setPhoto] = useState(0)
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setCanvas(CANVASES[0].label)
      setPhoto(0)
      setNote('')
    }
  }, [open])
  const c = CANVASES.find((x) => x.label === canvas)!
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add visual reference"
      description="Pick a working canvas and a sample photo. Save the guideline to keep it."
      className="max-w-2xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onAdd({ id: `vis-${crypto.randomUUID()}`, canvas: c.label, width: c.width, height: c.height, photo, note: note.trim() })
              onOpenChange(false)
            }}
          >
            Add to guideline
          </Button>
        </>
      }
    >
      <p className="mb-2 text-[0.8125rem] font-medium text-text-2">Canvas</p>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {CANVASES.map((x) => (
          <button key={x.label} type="button" onClick={() => setCanvas(x.label)} aria-pressed={canvas === x.label} className={cn('flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs', canvas === x.label ? 'border-accent-strong bg-accent-soft' : 'border-border hover:bg-surface-2')}>
            <span className="flex h-12 items-center">
              <span className="block border-2 border-current" style={{ width: (x.width / Math.max(x.width, x.height)) * 40, height: (x.height / Math.max(x.width, x.height)) * 40 }} />
            </span>
            <span className="font-medium">{x.label}</span>
            <span className="tabular text-muted">
              {x.width}×{x.height}
            </span>
          </button>
        ))}
      </div>
      <p className="mb-2 text-[0.8125rem] font-medium text-text-2">Sample photo (Unsplash, illustrative location)</p>
      <div className="mb-4 grid grid-cols-5 gap-2">
        {SAMPLE_PHOTOS.map((p, i) => (
          <button key={p.image} type="button" onClick={() => setPhoto(i)} aria-pressed={photo === i} aria-label={p.alt} className={cn('overflow-hidden rounded-lg border-2', photo === i ? 'border-accent-strong' : 'border-transparent')}>
            <img src={photoUrl(i, 200, 200)} alt="" className="aspect-square w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          </button>
        ))}
      </div>
      <Field label="Note">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: story cover, keep text in the top third" />}</Field>
    </Dialog>
  )
}

function BriefDialog({ open, onOpenChange, groupId, setId }: { open: boolean; onOpenChange: (o: boolean) => void; groupId: string; setId: string }) {
  const q = useBrief(groupId, open ? setId : null)
  const json = useMemo(() => (q.data ? JSON.stringify(q.data.brief, null, 2) : ''), [q.data])
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `brief-${q.data!.brief.guideline.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const b = q.data?.brief
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Compiled brief preview"
      description="What a future AI drafting step would receive. Master rules come first. No AI call is made."
      className="max-w-2xl"
      footer={
        <>
          {q.data && !q.data.exportable && <p className="mr-auto text-sm text-warn">{q.data.reason}</p>}
          <Button variant="primary" disabled={!q.data?.exportable} onClick={download}>
            <Download /> Download brief (JSON)
          </Button>
        </>
      }
    >
      {!b ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="space-y-4 text-sm">
          <SimBadge>{b.mode}</SimBadge>
          <ol className="list-decimal space-y-0.5 pl-5 text-text-2">
            {b.precedence.map((p) => (
              <li key={p}>{p.replace(/^\d\.\s*/, '')}</li>
            ))}
          </ol>
          <section className="rounded-lg border border-border p-3">
            <h3 className="mb-1 font-semibold">1 · Master · {b.master.name}</h3>
            <p className="text-text-2">
              Voice: {b.master.voice} Mood: {b.master.mood}. Tone: {b.master.tone}.
            </p>
            <p className="mt-1 text-text-2">Palette: {b.master.palette.join(', ')} · Type: {b.master.typography.join(' / ')} · Logos: {b.master.logos.join(', ')}</p>
            <ul className="mt-2 list-disc pl-4">
              {b.master.mandatoryDos.map((x) => (
                <li key={x}>DO (mandatory): {x}</li>
              ))}
              {b.master.mandatoryDonts.map((x) => (
                <li key={x}>DON’T (mandatory): {x}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-border p-3">
            <h3 className="mb-1 font-semibold">2 · Guideline · {b.guideline.name}</h3>
            <p className="text-text-2">{b.guideline.purpose || 'No purpose written yet.'}</p>
            {b.guideline.voice && <p className="mt-1 text-text-2">Voice additions: {b.guideline.voice}</p>}
            <ul className="mt-2 list-disc pl-4">
              {b.guideline.additionalDos.map((x) => (
                <li key={x}>DO: {x}</li>
              ))}
              {b.guideline.additionalDonts.map((x) => (
                <li key={x}>DON’T: {x}</li>
              ))}
            </ul>
          </section>
          {b.voiceProfile && (
            <section className="rounded-lg border border-border p-3">
              <h3 className="mb-1 font-semibold">3 · Voice profile · {b.voiceProfile.name}</h3>
              <p className="text-text-2">
                {b.voiceProfile.voice} Audience: {b.voiceProfile.audience}.
              </p>
            </section>
          )}
          <section className="rounded-lg border border-border p-3">
            <h3 className="mb-1 font-semibold">Visual references</h3>
            <ul className="list-disc pl-4 text-text-2">
              {b.visualReferences.map((v, i) => (
                <li key={i}>
                  {v.canvas} {v.size}
                  {v.note ? ` · ${v.note}` : ''} · {v.status}
                </li>
              ))}
            </ul>
          </section>
          <p className="text-xs text-muted">Human review required before any use. External publishing: off. Automated checks that a model follows these rules are not implemented.</p>
        </div>
      )}
    </Dialog>
  )
}
