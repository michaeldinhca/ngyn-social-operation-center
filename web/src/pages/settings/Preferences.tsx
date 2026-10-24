import { Moon, RotateCcw, Sun } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { useSession, useSessionContext, type Preferences } from '@/session'

const DEFAULTS: Preferences = { theme: 'dark', size: 'standard', contrast: false, motion: false, focus: true }

function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium" id={id}>
          {label}
        </p>
        <p className="text-[0.8125rem] text-muted">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} onClick={() => onChange(!checked)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-accent-strong' : 'bg-surface-3')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[1.375rem]' : 'left-0.5')} />
      </button>
    </div>
  )
}

export function PreferencesPage() {
  const { prefs, setPrefs } = useSessionContext()
  const session = useSession()
  const set = (patch: Partial<Preferences>) => setPrefs({ ...prefs, ...patch })
  const same = JSON.stringify(prefs) === JSON.stringify(DEFAULTS)

  return (
    <>
      <PageHeader
        title="My Preferences"
        description={`Display and accessibility settings for ${session.data?.name ?? 'you'} only. Changes apply immediately and are saved in this browser.`}
        actions={
          <Button onClick={() => setPrefs(DEFAULTS)} disabled={same}>
            <RotateCcw /> Reset to defaults
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Appearance" />
            <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['dark', 'Dark', <Moon key="m" />],
                  ['light', 'Light', <Sun key="s" />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={prefs.theme === id}
                  onClick={() => set({ theme: id })}
                  className={cn('flex items-center gap-3 rounded-xl border p-4 text-left [&_svg]:size-5', prefs.theme === id ? 'border-accent-strong bg-accent-soft' : 'border-border hover:bg-surface-2')}
                >
                  {icon}
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="block text-[0.8125rem] text-muted">{id === 'dark' ? 'Charcoal with lime accents (default)' : 'Light surfaces with a darker green accent'}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Accessibility support" description="Personal display adjustments. These controls don't establish AODA or WCAG compliance." />
            <div className="space-y-3">
              <div role="radiogroup" aria-label="Text size" className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ['standard', 'Standard', '15 px'],
                    ['large', 'Large', '16.5 px'],
                    ['extra-large', 'Extra large', '18 px'],
                  ] as const
                ).map(([id, label, px]) => (
                  <button key={id} type="button" role="radio" aria-checked={prefs.size === id} onClick={() => set({ size: id })} className={cn('rounded-lg border px-4 py-3 text-left', prefs.size === id ? 'border-accent-strong bg-accent-soft' : 'border-border hover:bg-surface-2')}>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{px} body text</span>
                  </button>
                ))}
              </div>
              <Switch checked={prefs.contrast} onChange={(v) => set({ contrast: v })} label="Higher contrast" description="Stronger borders and secondary text." />
              <Switch checked={prefs.motion} onChange={(v) => set({ motion: v })} label="Reduce motion" description="Removes transitions and turns off the timed demo updates on the SOC." />
              <Switch checked={prefs.focus} onChange={(v) => set({ focus: v })} label="Stronger keyboard focus" description="A thicker outline with a halo around the focused control." />
            </div>
          </Card>
          <p className="text-xs text-muted">Saved separately for each person under "View as". There is no workspace-wide accessibility configuration.</p>
        </div>

        <aside aria-label="Preview">
          <Card className="xl:sticky xl:top-4">
            <CardHeader title="Preview" description="How text and controls look with your settings" />
            <p className="text-[1.0625rem] font-semibold">Winter parking ban starts December 1</p>
            <p className="mt-1 text-text-2">Move your car by 1 a.m. so plows can clear the street. Details are on the municipal website.</p>
            <p className="mt-2 text-sm text-muted">Posted by Harbourview Public Works · 2 hours ago</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary">Approve</Button>
              <Button>Return to draft</Button>
              <Badge tone="good">Published</Badge>
              <Badge tone="warn">In review</Badge>
            </div>
            <div className="mt-4 rounded-lg border border-border p-3 text-sm">
              <label htmlFor="preview-field" className="mb-1.5 block text-[0.8125rem] font-medium text-text-2">
                Try keyboard focus
              </label>
              <input id="preview-field" className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3" placeholder="Press Tab to move here" />
            </div>
          </Card>
        </aside>
      </div>
    </>
  )
}
