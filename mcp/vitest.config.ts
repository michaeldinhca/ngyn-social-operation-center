import path from 'node:path'
import { defineConfig } from 'vitest/config'

// The mock API under ../web/src imports with the web app's '@/' alias.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '../web/src') } },
  test: { environment: 'node' },
})
