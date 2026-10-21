import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ChevronDown, Menu, Moon, OctagonAlert, PanelLeftClose, PanelLeftOpen, RotateCcw, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useUsers } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/tooltip'
import { ADMIN_ID } from '@/domain/types'
import { cn, formatDateTime } from '@/lib/utils'
import * as api from '@/mock/api'
import { useSession, useSessionContext } from '@/session'
import { NAV, navItem } from './nav'

function readNav(key: string): { collapsed: boolean; closed: string[] } {
  try {
    return { collapsed: false, closed: [], ...JSON.parse(localStorage.getItem(key) ?? '{}') }
  } catch {
    return { collapsed: false, closed: [] }
  }
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="select-none text-[1.6rem] font-extrabold leading-none tracking-tight text-text" aria-label="NGYN">
      {compact ? 'n' : 'ngyn'}
      <span className="ml-0.5 italic text-accent-strong">//</span>
    </span>
  )
}

export function Shell() {
  const { actorId, setActorId, prefs, setPrefs } = useSessionContext()
  const session = useSession()
  const users = useUsers()
  const qc = useQueryClient()
  const navKey = `ngyn-soc-web:nav:${actorId}`
  const [nav, setNav] = useState(() => readNav(navKey))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const pageId = pathname.split('/')[1] || 'soc'
  const current = navItem(pageId === 'composer' ? 'content' : pageId)
  const pageTitle = pageId === 'composer' ? 'Create post' : (current?.title ?? 'Social Operation Center')

  useEffect(() => setNav(readNav(navKey)), [navKey])
  useEffect(() => setMobileOpen(false), [pathname])

  const saveNav = (next: typeof nav) => {
    setNav(next)
    try {
      localStorage.setItem(navKey, JSON.stringify(next))
    } catch {
      // storage unavailable
    }
  }

  const s = session.data
  const collapsed = nav.collapsed && !mobileOpen
  const emergency = s?.emergency

  const sidebar = (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      <div className={cn('flex items-center gap-2 px-5 pb-3 pt-5', collapsed && 'flex-col px-2')}>
        <Link to="/$page" params={{ page: 'soc' }} className="rounded-md">
          <Logo compact={collapsed} />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button className="hidden rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text lg:inline-flex" onClick={() => saveNav({ ...nav, collapsed: !nav.collapsed })} aria-label={nav.collapsed ? 'Expand navigation' : 'Collapse navigation'}>
            {nav.collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
          <button className="rounded-md p-1.5 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X className="size-5" />
          </button>
        </div>
      </div>
      {!collapsed && <p className="px-5 pb-3 text-[0.8125rem] text-muted">Harbourview · fictional demo</p>}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {s &&
          NAV.map((section) => {
            const items = section.items.filter((i) => i.allowed(s))
            if (!items.length) return null
            const closed = nav.closed.includes(section.title) && !collapsed
            return (
              <div key={section.title} className="mt-4 first:mt-1">
                {collapsed ? (
                  <div className="mx-auto mb-2 h-px w-8 bg-border" aria-hidden />
                ) : (
                  <button
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted hover:text-text"
                    aria-expanded={!closed}
                    onClick={() => saveNav({ ...nav, closed: closed ? nav.closed.filter((t) => t !== section.title) : [...nav.closed, section.title] })}
                  >
                    {section.title}
                    <ChevronDown className={cn('size-3.5 transition-transform', closed && '-rotate-90')} />
                  </button>
                )}
                {!closed && (
                  <ul className="mt-1 space-y-0.5">
                    {items.map((item) => {
                      const active = current?.id === item.id
                      const Icon = item.icon
                      return (
                        <li key={item.id}>
                          <Tooltip content={item.label} disabled={!collapsed}>
                            <Link
                              to="/$page"
                              params={{ page: item.id }}
                              aria-current={active ? 'page' : undefined}
                              aria-label={collapsed ? item.label : undefined}
                              className={cn(
                                'flex h-10 items-center gap-3 rounded-lg px-3 text-[0.9375rem] transition-colors',
                                collapsed && 'justify-center px-0',
                                active ? 'bg-accent font-semibold text-accent-ink' : 'text-text-2 hover:bg-surface-2 hover:text-text',
                              )}
                            >
                              <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                              {!collapsed && <span className="truncate">{item.label}</span>}
                              {!collapsed && !item.built && <span className={cn('ml-auto text-[0.625rem] font-semibold uppercase tracking-wide', active ? 'text-accent-ink/70' : 'text-muted')}>Next</span>}
                            </Link>
                          </Tooltip>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
      </nav>
      <div className={cn('border-t border-border px-4 py-3 text-xs text-muted', collapsed && 'px-2 text-center')}>
        {collapsed ? (
          <Tooltip content="Reset demo data">
            <button className="rounded-md p-2 hover:bg-surface-2 hover:text-text" onClick={() => setResetOpen(true)} aria-label="Reset demo data">
              <RotateCcw className="size-4" />
            </button>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span>Simulated APIs · browser demo store</span>
            <button className="rounded-md p-1.5 hover:bg-surface-2 hover:text-text" onClick={() => setResetOpen(true)} aria-label="Reset demo data" title="Reset demo data">
              <RotateCcw className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">
        Skip to main content
      </a>
      <div className="hidden lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/55" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-border bg-bg px-4 py-2 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">Municipality of Harbourview · Fictional</p>
            <p className="truncate text-[0.9375rem] font-semibold">{pageTitle}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="hidden sm:inline">View as</span>
            <Select aria-label="View as user" value={actorId} onChange={(e) => setActorId(e.target.value)} className="h-9 w-[min(15rem,46vw)]">
              <option value={ADMIN_ID}>Demo administrator</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                  {u.status !== 'Active' ? ` (${u.status})` : ''}
                </option>
              ))}
            </Select>
          </label>
          <Tooltip content={prefs.theme === 'dark' ? 'Light theme' : 'Dark theme'} side="bottom">
            <Button variant="secondary" size="icon" aria-label={prefs.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setPrefs({ ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' })}>
              {prefs.theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
          </Tooltip>
        </header>
        {emergency?.paused && (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-danger px-4 py-2.5 text-sm text-white sm:px-6">
            <OctagonAlert className="size-5 shrink-0" />
            <strong>Emergency pause active. All scheduled publishing is blocked.</strong>
            <span className="opacity-90">
              {emergency.reason} · {emergency.changedBy} · {formatDateTime(emergency.changedAt)}
            </span>
          </div>
        )}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto px-4 py-6 outline-none sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <Outlet />
          </div>
          <footer className="mx-auto mt-10 max-w-[1440px] border-t border-border pt-4 text-xs text-muted">
            Fictional demo data. Publishing, replies and advertising spend are disabled. No social platform, AI model or listening provider is connected.
          </footer>
        </main>
      </div>
      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset demo data?"
        description="Restores the fictional Harbourview baseline in this browser. Changes you made in this demo are discarded."
        footer={
          <>
            <Button onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api.resetDemo()
                await qc.invalidateQueries()
                setResetOpen(false)
                toast.success('Demo data reset in this browser.')
              }}
            >
              Reset demo
            </Button>
          </>
        }
      />
    </div>
  )
}
