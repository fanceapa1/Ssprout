# Study Sprout

A study timer that grows a watercolour Japanese garden. Every session you finish blooms a new
plant; over time the garden fills and wildlife quietly moves in.

**Live:** https://fanceapa1.github.io/Ssprout/ · Studio (art review): https://fanceapa1.github.io/Ssprout/studio.html

Everything you see is painted in code at runtime — no image assets.

## Run locally
Requires Node 22+.

```sh
npm install
npm run dev          # http://localhost:5173/Ssprout/
```

| Command | What |
|---|---|
| `npm run dev` | dev server (`?dev` enables the debug API, `?dev&speed=60` runs time 60× faster) |
| `npm run build` / `npm run preview` | production build / serve it |
| `npm run typecheck` | TypeScript |
| `npm test` | unit tests (Vitest) |
| `npm run e2e` | browser tests (Playwright, Chromium; first run `npx playwright install chromium`) |
| `npm run shots` | screenshots into `artifacts/shots/` |

## Docs
[Spec](docs/SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Art direction](docs/ART_DIRECTION.md) ·
[Roadmap](docs/ROADMAP.md) · [Decisions](docs/adr/)
