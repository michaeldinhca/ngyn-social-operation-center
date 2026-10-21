import type { DemoState } from '@/domain/types'
import { createSeed } from './seed'

// Browser-local demo store. Everything lives in this browser only; nothing reaches a server.
const KEY = 'ngyn-soc-web:v1'

let memory: DemoState | null = null

function read(): DemoState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoState
    return parsed.version === 1 ? parsed : null
  } catch {
    return null
  }
}

export function db(): DemoState {
  if (!memory) {
    memory = read() ?? createSeed()
    persist()
  }
  return memory
}

export function persist() {
  if (!memory) return
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    // Private windows or blocked storage: keep working in memory for this session.
  }
}

export function resetDemo() {
  memory = createSeed()
  persist()
}
