# NGYN SOC web (mockup v1)

The rebuilt UI mockup: React 19 + TypeScript + Vite, Tailwind CSS v4, Radix primitives, Lucide icons, TanStack Router (hash history) and TanStack Query. All data is fictional and lives in the browser.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (permission rules)
npm run build      # typecheck + static build to dist/ (portable: base './')
npm run dry-run    # Playwright walk-through of dist/; screenshots in ../.dry-run/web/
```

## Layout

| Path | Purpose |
| --- | --- |
| `src/domain/` | Types and permission rules (`permissions.ts`, unit tested) |
| `src/mock/` | Seed data, browser store and the mock API. The API enforces permissions at each action, like a real backend would |
| `src/api/hooks.ts` | TanStack Query hooks. Screens only talk to these |
| `src/components/` | UI primitives, shell, charts, social widgets |
| `src/pages/` | Screens, one folder per menu section |
| `e2e/dry-run.cjs` | Browser dry-run of the built app |

To connect a real backend later, replace `src/mock/api.ts` with an HTTP client exposing the same functions. Screens don't change.

## Rules

- Everything simulated is labelled with `SimBadge` or explicit copy.
- Never call a network, social platform or AI service from the mockup.
- Charts: one series per chart, one axis, crosshair tooltip, and a data table.
- Browser storage key: `ngyn-soc-web:v1` (bump the version and reseed if the shape changes).
