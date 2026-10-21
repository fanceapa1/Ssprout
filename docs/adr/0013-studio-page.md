# ADR 0013 — Studio page with auto-discovered `*.studio.ts` sections

- Status: accepted
- Date: 2026-10-21
- Requested by: project owner

## Context
The art is procedural and seeded. Reviewing it only inside the garden makes it hard to see every
growth stage, rare variants or a creature's full animation, and parallel agents need a shared
place to show their work.

## Decision
- A second Vite entry `studio.html` (multi-page build; deployed at `/Ssprout/studio.html`).
- Discovery via `import.meta.glob('/src/**/*.studio.ts', { eager: true })`; each file
  default-exports a `StudioSection` **or an array of sections** (the array form lets
  `src/plants/species.studio.ts` generate one section per registered species).
- Entry ids are unique per section and addressed as `<section>/<entry>`; `StudioRenderContext`
  carries `pixelRatio` in addition to `t, dt, seed, frame` so entries can draw in logical units.
- URL options (`#section`, `?entry`, `?seed`, `?t`, `?scale`, `?bg`) make every view
  reproducible for `npm run shots`.
- Rule (AGENTS.md): every sprite, creature, effect and paint primitive gets a studio entry.
- Vite 8 is used, so the multi-page input is configured with `build.rolldownOptions.input`
  (`rollupOptions` is a deprecated alias there).

## Consequences
The studio ships to production (harmless, `noindex`). Studio modules are only imported by the
studio bundle, never by the app.
