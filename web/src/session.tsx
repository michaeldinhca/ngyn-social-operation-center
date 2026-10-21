import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ADMIN_ID } from '@/domain/types'
import * as api from '@/mock/api'

// "View as user" is deliberate impersonation for demo testing. It is not authentication.

const VIEW_KEY = 'ngyn-soc-web:view-as'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore: storage unavailable
  }
}

export interface Preferences {
  theme: 'dark' | 'light'
  size: 'standard' | 'large' | 'extra-large'
  contrast: boolean
  motion: boolean
  focus: boolean
}

const DEFAULT_PREFS: Preferences = { theme: 'dark', size: 'standard', contrast: false, motion: false, focus: true }

interface SessionValue {
  actorId: string
  setActorId: (id: string) => void
  prefs: Preferences
  setPrefs: (p: Preferences) => void
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [actorId, setActor] = useState(() => readStorage(VIEW_KEY) ?? ADMIN_ID)
  const prefKey = `ngyn-soc-web:prefs:${actorId}`
  const [prefs, setPrefsState] = useState<Preferences>(DEFAULT_PREFS)
  const qc = useQueryClient()

  useEffect(() => {
    try {
      setPrefsState({ ...DEFAULT_PREFS, ...(JSON.parse(readStorage(prefKey) ?? 'null') ?? {}) })
    } catch {
      setPrefsState(DEFAULT_PREFS)
    }
  }, [prefKey])

  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = prefs.theme
    el.dataset.textSize = prefs.size
    el.classList.toggle('high-contrast', prefs.contrast)
    el.classList.toggle('reduce-motion', prefs.motion)
    el.classList.toggle('strong-focus', prefs.focus)
  }, [prefs])

  const setActorId = useCallback(
    (id: string) => {
      writeStorage(VIEW_KEY, id)
      setActor(id)
      qc.invalidateQueries()
    },
    [qc],
  )

  const setPrefs = useCallback(
    (p: Preferences) => {
      writeStorage(prefKey, JSON.stringify(p))
      setPrefsState(p)
    },
    [prefKey],
  )

  const value = useMemo(() => ({ actorId, setActorId, prefs, setPrefs }), [actorId, setActorId, prefs, setPrefs])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSessionContext() {
  const v = useContext(Ctx)
  if (!v) throw new Error('SessionProvider missing')
  return v
}

/** Server-style session info for the current "View as" identity. */
export function useSession() {
  const { actorId } = useSessionContext()
  return useQuery({ queryKey: ['session', actorId], queryFn: () => api.getSession(actorId) })
}
