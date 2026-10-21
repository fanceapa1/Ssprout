# ADR 0010 — E2E runs against the production build via `vite preview`

- Status: accepted
- Date: 2026-10-21

## Context
Playwright needs a server. Options: the Vite dev server, or `vite build` + `vite preview`.
Several agents may run e2e at the same time from different checkouts.

## Decision
- `playwright.config.ts` `webServer` runs `npm run build && vite preview --host 127.0.0.1
  --port $E2E_PORT --strictPort` (default port 4173) and tests use
  `baseURL = http://127.0.0.1:<port>/Ssprout/`.
- `reuseExistingServer` is **off** unless `E2E_REUSE=1`, so a stale server from another
  checkout is never silently tested; a busy port fails loudly. Parallel checkouts set a
  different `E2E_PORT`.
- `npm run shots` instead starts a Vite **dev** server programmatically on a free port (no build
  needed, fast iteration) and closes it afterwards; `--url` targets an existing server.
- A shared fixture (`tests/e2e/fixtures.ts`) fails any test that logs a console error or an
  uncaught page error.

## Why
Testing the built bundle catches base-path (`/Ssprout/`), asset and multi-page build problems
that only appear on GitHub Pages. The build takes well under a second at this size.

## Consequences
`npm run e2e` always rebuilds. For quick local loops: `npm run build && npx vite preview` in one
terminal and `E2E_REUSE=1 npm run e2e` in another.
