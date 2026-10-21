# 01 — Foundation

## What
- Repo, Vite 8 + TypeScript 7 (strict, ES2022, `noUncheckedIndexedAccess`), Vitest 5, Playwright
  (Chromium). `base: '/Ssprout/'`. Fonts installed: `@fontsource/shippori-mincho`,
  `@fontsource/cormorant-garamond` (studio uses Cormorant; the app does not import them yet).
- Contracts as code: `core/clock.ts`, `core/rng.ts`, `core/events.ts`, `core/state.ts` (types,
  `Action` union, reducer **skeleton**, `createStore`), `plants/types.ts` + auto-discovering
  `plants/registry.ts` + `placeholder-sprout` species, `paint/index.ts` (minimal `Painter`),
  `scene/geometry.ts` (placeholder layout, 11 slots), `render/` (types, viewport, renderer),
  placeholder background system, `main.ts` bootstrap, `dev/debug.ts` (`window.sprout`).
- Studio page (`studio.html`) with auto-discovered `*.studio.ts` sections.
- Tests: 60+ unit tests; e2e smoke + studio specs with a console-error guard.
- `npm run shots` (garden at 3 viewports, studio, single entries).
- CI (typecheck, unit, build, e2e) and Pages deployment workflows; public repo
  `fanceapa1/Ssprout`, live at https://fanceapa1.github.io/Ssprout/.

## Why (non-obvious)
ADRs 0010 (e2e against preview build), 0011 (store), 0012 (rng forks), 0013 (studio).

## Left for others
- Core logic: implement `reducer` cases, `persistence.ts` (replace the minimal read in
  `main.ts`, wire `onChange` saving), session/rewards/unlocks/tips.
- Paint: expand `Painter` (keep `ctx/w/h`), replace placeholder visuals.
- Scene: replace `placeholderScene` values and `placeholder-background.ts`; may move slots to
  `scene/slots.ts`.
- Dev API: `reset`, `seed`, `completeSession`, `addPlants`, `setTime`, `setWeather` via
  `extendDebug`.
- Delete `plants/species/placeholder-sprout.ts` once real tier-1 species exist (the registry
  test needs at least one species).
