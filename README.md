# NGYN Social Operation Center

Standalone municipal social media management platform (original product, not a Postiz fork).

Current state: buildless HTML/CSS/JS interactive prototype with browser-local mock data. No real auth, social APIs, AI or backend.

- Product source of truth: `NGYN_Municipal_Social_Platform_Codex_Build_Brief.md`
- Handoff, rules and known gaps: `CLAUDE_HANDOFF.md`
- Run: `node serve.cjs` then open http://127.0.0.1:4173/
- Source: `source/dist/` (load order matters), tests: `cd source && node --test tests/*.test.cjs`
