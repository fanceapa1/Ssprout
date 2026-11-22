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

Suggested `order` ranges: 0–99 paint primitives (60–62: the camera and the landscape's close
views), 100–199 scene, 200–299 plants, 300–399 fauna, 400–499 ambience/lighting, 500–599
UI/widget, 600+ audio.

Every species gets a section automatically (`src/plants/species.studio.ts`): `species-<id>`,
titled `T<tier> · <name>`, order `200 + tier`, all growth stages `0.1 / 0.3 / 0.55 / 0.8 / 1`
plus an animated grow loop. Species files themselves must not be named `*.studio.ts` inside
`species/` (the registry ignores them).

The family boards and the flora line-ups are generated from the registry (ADR 0251):
`plants-a-review` takes tiers 1 and 2, `shrubs-b` tier 3 and `plants-trees` tier 4, in id order;
`flora/<sceneryId>` lines up each garden's species by tier at one world scale (×0.5, growth 1). It
lists every species until F1's `floraOf` lands (a marked one-line hook in `flora.studio.ts`). A new
species shows up in all of them without editing a studio file.

Where the sections live today:

| File | Sections (`order`) |
|---|---|
| `src/paint/paint.studio.ts` | `paint`, `paint-recipes`, `paint-vignettes` (10–30) |
| `src/render/camera.studio.ts` | `camera` (60) |
| `src/scene/camera-detail.studio.ts` | `camera-detail` (61) |
| `src/scene/close-view.studio.ts` | `close-view` (62) |
| `src/scene/scene.studio.ts` | `scene` (100) |
| `src/scenery/waterfall/map.studio.ts` | `waterfall-map` (103) |
| `src/scene/daylight.studio.ts` | `daylight` (105) |
| `src/plants/species.studio.ts` | `species-<id>` (200 + tier) |
| `src/plants/lib/small-review.studio.ts`, `tree-review.studio.ts` | `plants-a-review`, `plants-trees` (205) |
| `src/plants/flora.studio.ts` | `flora` (206): one entry per scenery, its species by tier |
| `src/plants/plants.studio.ts` | `plants-watering`, `plants-wither`, `plants-growth`, `plants-reflection` (250–253) |
| `src/plants/close-view.studio.ts` | `close-view-plants` (262) |
| `src/plants/lib/shrub-gallery.studio.ts` | `shrubs-b` (290) |
| `src/fauna/fauna.studio.ts` | `fauna-garden` (300), `fauna-<kind>` (310+) |
| `src/fauna/close-view.studio.ts` | `close-view-fauna` (362) |
| `src/ambience/ambience.studio.ts` | `ambience-weather`, `ambience-motes`, `ambience-lighting` (400–402) |
| `src/widget/widget.studio.ts` | `widget` (510) |
| `src/ui/ui.studio.ts` | `ui` (520) |
| `src/ui/shell.studio.ts` | `ui-shell` (521) |
| `src/ui/stage-camera.studio.ts` | `ui-camera` (522) |
| `src/ui/calendar.studio.ts`, `wayfinding.studio.ts` | `calendar`, `ui-wayfinding` (523) |
| `src/audio/audio.studio.ts` | `audio` (650) |

## Lazy painting (ADR 0006)
Cards paint only when they near the screen, a few per frame within a 10 ms budget (on-screen
first); cards about three screens away release their pixels and repaint on return. Animated
entries animate only while on screen. Entry `render` functions are unchanged — but anything that
reads studio pixels (tests, scripts) must `await window.studio.settle()` first.

## What an entry costs (devlog 221)
An entry that paints a crop of a garden (`paintSceneSync` with a `rect`, a fauna `Stage` on the
oasis or the coast) pays for that garden's **whole** painting: the paint job runs every mark of
every step and only the canvas is cropped. The cost is the marks, not the pixels: measured on
2026-11-22, a 280 × 100 crop of the oasis at 4 px a unit took 2.4 s and the whole oasis at 0.5 px
a unit 2.7 s; the coast takes 0.5–1.8 s a paint. Such paints were three quarters of the studio
smoke test's time (171 paints, about 174 s of 233 s). Rules for authors:
- Paint a garden once per entry at most, cached by seed, rect and scale (as `Stage` and
  `coast/motion.studio.ts` do), so later frames and a `frame === 0` reset never repaint it.
- Painting at a smaller scale saves almost nothing; show fewer crops instead of smaller ones.
- Keep a section under about 10 s in the smoke test (about six oasis crops or a dozen coast
  crops); split a bigger one into two sections. The heaviest section sets the slowest part.

## Page controls
Seed + **Reseed**, **Play/Pause**, speed 0.25×–4×, background paper/white/dark, scale 1×/2×.
Errors thrown by an entry are shown on its card and logged to the console.

URL: `#<section>` (only that section) · `?entry=<section>/<entry>` (single entry, large; a bare
entry id works when unique) · `?seed=n` (default 1) · `?t=seconds` (start paused at t) · `?scale=2` ·
`?bg=dark`.

`window.studio` (for tests/scripts): `{ ready, entries, errors, renders(), pause(), setT(t), settle(), pending() }`.
`settle()` paints every shown card and keeps it painted; `pending()` counts cards still to paint.

## Screenshots
```
npm run shots -- --studio                         # whole studio, full page
npm run shots -- --studio species-white-clover
npm run shots -- --entry scene/full --seed 7 --t 2.5
```

## Tests
`tests/e2e/studio.spec.ts`: the nav lists every section (scene and species included); every
entry renders without errors and paints something, split into 30 parts (section *i* in part
*i* % 30) that show one `#section` at a time; reseed re-renders; `#section` and `?entry` views work; the whole studio paints only cards near the screen and the rest on scroll (lazy painting); `?seed`/`?t` start
paused, Play animates, Pause holds the frame; speed, background and scale controls; the plant
view's round window (`ui-shell/plant-view-window`) is round with a pooled rim and lost at the
bottom (ADR 0184).
`src/studio/registry.test.ts`: discovery, ordering, id validation, entry lookup.
