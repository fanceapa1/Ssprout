# Studio

`studio.html` + `src/studio/` — a dev page that shows every sprite, creature, effect and paint
primitive in one place. Local: `npm run dev` → <http://localhost:5173/Ssprout/studio.html>.
Deployed: <https://fanceapa1.github.io/Ssprout/studio.html>.

## Adding entries
Create a colocated `*.studio.ts` anywhere under `src/` that default-exports a `StudioSection`
(or an array). It is discovered automatically (`import.meta.glob('/src/**/*.studio.ts')`).

```ts
import { createRng } from '../core/rng';
import type { StudioSection } from '../studio/types';

const section: StudioSection = {
  id: 'fauna-koi',
  title: 'Fauna · koi',
  order: 300,
  entries: [
    {
      id: 'swim',
      label: 'swimming loop',
      w: 320,
      h: 200,
      animated: true,
      render(canvas, { t, seed, pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio); // draw in logical w×h units
        const rng = createRng(seed);
        // ...
      },
    },
  ],
};
export default section;
```

Contract: fill `canvas.width × canvas.height` pixels; the studio resets the transform and
clears to transparent before every call. Use `seed` for all randomness so **Reseed** shows
variety. `t`/`dt` are scaled by the speed slider; `frame` counts renders since the last reset.

Suggested `order` ranges: 0–99 paint primitives, 100–199 scene, 200–299 plants,
300–399 fauna, 400–499 ambience/lighting, 500+ UI/widget.

Every species gets a section automatically (`src/plants/species.studio.ts`): all growth stages
`0.1 / 0.3 / 0.55 / 0.8 / 1` plus an animated grow loop. Species files themselves must not be
named `*.studio.ts` inside `species/` (the registry ignores them).

## Page controls
Seed + **Reseed**, **Play/Pause**, speed 0.25×–4×, background paper/white/dark, scale 1×/2×.
Errors thrown by an entry are shown on its card and logged to the console.

URL: `#<section>` (only that section) · `?entry=<section>/<entry>` (single entry, large; a bare
entry id works when unique) · `?seed=n` (default 1) · `?t=seconds` (start paused at t) · `?scale=2` ·
`?bg=dark`.

`window.studio` (for tests/scripts): `{ ready, entries, errors, renders(), pause(), setT(t) }`.

## Screenshots
```
npm run shots -- --studio                         # whole studio, full page
npm run shots -- --studio species-white-clover
npm run shots -- --entry scene/full --seed 7 --t 2.5
```

## Tests
`tests/e2e/studio.spec.ts`: the nav lists every section (scene and species included); every
entry renders without errors and paints something, split into 4 parallel shards that show one
`#section` at a time; reseed re-renders; `#section` and `?entry` views work; `?seed`/`?t` start
paused, Play animates, Pause holds the frame; speed, background and scale controls.
`src/studio/registry.test.ts`: discovery, ordering, id validation, entry lookup.
