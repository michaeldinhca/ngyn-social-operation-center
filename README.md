# NGYN Social Operation Center

A municipal social media management product: publishing with approvals, a resident inbox, a social operations dashboard, media, brand direction and an emergency publishing pause. It's an original product, not a Postiz fork.

**Current state:** interactive UI mockup (buildless HTML/CSS/JS, fictional "Harbourview" data, browser-local storage). It has no real login, social APIs, AI or backend. Every simulation is labelled in the UI.

Agents: start with [AI.md](AI.md).

## Run

```sh
npm install          # only needed for the browser dry-run (Playwright)
npm start            # http://127.0.0.1:4173/
npm test             # unit tests
npm run build        # rebuild NGYN_Municipal_Social_Platform.html from source/dist
npm run dry-run      # Playwright walk-through; screenshots in .dry-run/
```

`NGYN_Municipal_Social_Platform.html` also opens directly from disk, but serving it keeps localStorage, IndexedDB and the clipboard predictable.

## Docs

- [AI.md](AI.md): agent rules and workflow
- [NEXT-WORK.md](NEXT-WORK.md): active task and queue
- [REQUIREMENTS.md](REQUIREMENTS.md): requirements and mockup status
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): prototype internals and target architecture
- [docs/adr/0001-tech-stack-and-zernio.md](docs/adr/0001-tech-stack-and-zernio.md): proposed stack
- [docs/PLATFORM_CAPABILITY_MATRIX.md](docs/PLATFORM_CAPABILITY_MATRIX.md): per-platform capability evidence
- [docs/dry-runs/](docs/dry-runs/): browser test reports
- [docs/handoff/](docs/handoff/): original Codex handoff and build brief
