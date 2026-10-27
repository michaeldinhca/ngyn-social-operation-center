// The mock API in web/src/mock keeps its demo store in localStorage. Node has none by default, so
// this gives it a small file-backed one before the mock API loads. Import this module first.
//
// The MCP server's demo store is its own Harbourview copy: changes made through ChatGPT show up
// here, not in a browser's mockup. A real backend replaces both with one database.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function installFileStorage(file: string | null) {
  let data: Record<string, string> = {}
  if (file && existsSync(file)) {
    try {
      data = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      data = {}
    }
  }
  const save = () => {
    if (!file) return
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(data))
  }
  const storage: Storage = {
    get length() {
      return Object.keys(data).length
    },
    key: (i) => Object.keys(data)[i] ?? null,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
      save()
    },
    removeItem: (k) => {
      delete data[k]
      save()
    },
    clear: () => {
      data = {}
      save()
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
}
