# Architecture

> Source of truth for module boundaries and shared contracts. If you change a contract,
> update this file in the same commit and add an ADR.

## Stack
- Vite + TypeScript (strict, ES2022, no framework). `npm run dev | build | test | e2e | shots`.
- Canvas 2D for the garden; plain DOM (+ CSS) for UI overlays.
- Vitest (`src/**/*.test.ts`, jsdom where DOM needed), Playwright (`tests/e2e/*.spec.ts`, Chromium).
- Vite `base: '/Ssprout/'` for GitHub Pages.

## Directory layout
```
src/
  main.ts                 bootstrap: load state, create renderer + systems + UI
  core/                   pure, framework-free, fully unit-tested logic (no DOM, no canvas)
    clock.ts              Clock interface; real clock + dev speed clock (?speed=N)
    rng.ts                seeded RNG (mulberry32) + helpers; string seeds hashed
    events.ts             typed event bus
    state.ts              GardenState types, defaults, reducers/actions
    persistence.ts        localStorage load/save, schema version + migrations, export/import validation
    session.ts            session state machine (idle/running/paused/completed), elapsed maths
    rewards.ts            tier from minutes, offer generation (3 species, prefer unowned)
    fauna-unlocks.ts      which creatures are unlocked for a given state
    tips.ts               tooltip registry + seen/retired logic
  paint/                  watercolour engine (pure canvas drawing utilities) — see docs/systems/paint.md
  scene/                  the static painted landscape, scene geometry, slots — docs/systems/scene.md
  plants/
    types.ts              SpeciesDef contract (below)
    registry.ts           auto-discovers species via import.meta.glob('./species/*.ts')
    species/<id>.ts       one file per species, default export SpeciesDef
    sprites.ts            renders + caches plant sprites per instance & growth stage
  fauna/                  creatures (one file each) + FaunaSystem — docs/systems/fauna.md
  ambience/               session weather (sun/rain/mist), motes, time-of-day lighting
  render/                 Renderer, layers, viewport (world↔screen), System interface, frame loop
  ui/                     DOM components: timer panel, reward picker, placement, menu, tips, herbarium
  widget/                 Document PiP widget, title/favicon fallback, notifications, timer worker
  audio/                  procedural Web Audio ambience + chime
  dev/                    ?dev debug API (window.sprout) used by e2e tests
tests/e2e/                Playwright specs
tests/visual/             screenshot specs (tolerant thresholds)
scripts/                  e.g. shots.ts — capture screenshots to artifacts/ (gitignored) for review
docs/                     SPEC, ARCHITECTURE, ART_DIRECTION, ROADMAP, adr/, systems/, devlog/
```

## World coordinates & viewport
- Logical world is **1600 × 1000** units (`WORLD_W`, `WORLD_H` in `src/render/viewport.ts`).
  All scene geometry, slots and creature positions are in world units.
- Viewport uses **cover** scaling with a focus point (pond centre) so portrait screens crop the
  sides rather than squash. `viewport.worldToScreen(p)`, `screenToWorld(p)`, `scale`.
- Device pixel ratio capped at 2. Static layers are re-rendered on resize (debounced 200 ms).

## Rendering pipeline (back → front)
| # | Layer | Contents | Redraw |
|---|---|---|---|
| 0 | `background` | sky, hills, far trees, pavilion, banks, pond base, path | once per resize (cached canvas) |
| 1 | `underwater` | koi, pond depth shimmer — clipped to pond shape | per frame |
| 2 | `waterSurface` | reflections (trees, rocks, plants near shore), ripples, lily pads' reflections | per frame (reflections cached) |
| 3 | `entities` | depth-sorted (by base y): foreground rocks/tufts from scene, plants, ground fauna (birds on rocks, frog, heron) | per frame (sprites cached) |
| 4 | `air` | bees, butterflies, dragonflies, flying birds, drifting petals | per frame |
| 5 | `ambience` | sun shafts, rain strokes, mist, light motes | per frame |
| 6 | `lighting` | time-of-day colour grade (multiply/soft-light washes), lantern glow | throttled (every few s) |
| 7 | `paper` | static washi grain + vignette over everything (multiply) | once per resize |

Slot markers, the reward picker and all controls are **DOM** above the canvas (accessible,
e2e-clickable: `[data-slot-id="..."]`).

### System contract (`src/render/types.ts`)
```ts
export type LayerId = 'background'|'underwater'|'waterSurface'|'entities'|'air'|'ambience'|'lighting'|'paper';
export interface FrameInfo { t: number; dt: number; /* seconds */ now: number; /* epoch ms via Clock */ }
export interface Drawable { depth: number; draw(ctx: CanvasRenderingContext2D, f: FrameInfo): void; }
export interface System {
  id: string;
  /** called once and on every resize; may prerender caches at viewport.scale */
  init?(ctx: SystemContext): void | Promise<void>;
  update?(f: FrameInfo): void;
  /** draw directly into a layer (ctx already transformed to world units) */
  draw?(layer: LayerId, ctx: CanvasRenderingContext2D, f: FrameInfo): void;
  /** contribute depth-sorted drawables to the `entities` layer */
  entities?(f: FrameInfo): Drawable[];
  dispose?(): void;
}
export interface SystemContext { viewport: Viewport; store: Store; bus: EventBus; clock: Clock; scene: SceneGeometry; reducedMotion: boolean; }
```
The renderer sets `ctx` to world units before calling `draw`. Systems never touch the DOM.

## Core contracts

### Species (`src/plants/types.ts`)
```ts
export type Tier = 1 | 2 | 3 | 4;
export type Habitat = 'water' | 'shore' | 'meadow' | 'path' | 'back' | 'rock';
export type SizeClass = 'small' | 'medium' | 'large' | 'tree';
export interface SpeciesDef {
  id: string;                 // kebab-case, equals file name
  name: string;               // "Japanese Iris"
  nativeName?: string;        // "Hanashōbu"
  tier: Tier;
  habitats: Habitat[];
  sizeClass: SizeClass;
  /** sprite box in world units at slot scale 1; anchor = base point as fraction of box */
  size: { w: number; h: number };
  anchor: { x: number; y: number };
  description: string;        // one short poetic line for the reward card
  bloomColor: string;         // hex, for UI swatch, petals, bee targeting
  pollinators: boolean;       // attracts bees/butterflies
  reflect?: boolean;          // default true when habitat includes shore/water
  /** paint the plant into p's canvas (w×h px); base at anchor; growth 0..1 (0 = seedling, 1 = full bloom) */
  draw(p: Painter, rng: Rng, opts: { w: number; h: number; growth: number }): void;
}
```
`sprites.ts` renders each placed plant at growth stages `[0.1, 0.3, 0.55, 0.8, 1]` (cached per
instance seed + viewport scale) and cross-fades during the bloom animation.
Runtime sway = tiny horizontal skew of the sprite about its base, driven by a wind noise field.

### Scene geometry & slots (`src/scene/geometry.ts`, `src/scene/slots.ts`)
```ts
export interface Slot { id: string; x: number; y: number; habitat: Habitat; maxSize: SizeClass; scale: number; /* perspective, ~0.55 far … 1.15 near */ }
export interface SceneGeometry {
  pond: Pt[];                 // closed polygon, world units
  waterline: number;          // y used for reflection mirroring (per point: reflect about local shore y)
  rocks: { id: string; x: number; y: number; w: number; h: number; perch: boolean }[];
  path: { x: number; y: number; rx: number; ry: number }[]; // stepping stones
  pavilion: { x: number; y: number; w: number; h: number; lantern: Pt };
  slots: Slot[];
  skyBand: { top: number; bottom: number }; // where flying creatures travel
}
```

### State (`src/core/state.ts`)
```ts
export interface PlantInstance { id: string; speciesId: string; slotId: string; seed: number; plantedAt: number; sessionMinutes: number; }
export interface PressedFlower { speciesId: string; seed: number; plantedAt: number; removedAt: number; }
export type Weather = 'sun' | 'rain' | 'mist';
export interface ActiveSession { id: string; goalMs: number; startedAt: number; pausedAt: number | null; pausedTotalMs: number; weather: Weather; }
export interface PendingReward { sessionId: string; goalMinutes: number; tier: Tier; options: string[]; chosen: string | null; completedAt: number; }
export interface GardenState {
  version: 1;
  createdAt: number;
  plants: PlantInstance[];
  pressed: PressedFlower[];
  session: ActiveSession | null;
  pendingReward: PendingReward | null;
  stats: { totalMinutes: number; completed: number; cancelled: number };
  faunaSeen: string[];        // creature ids already announced
  tips: Record<string, 'seen'>; // retired tips
  settings: { muted: boolean; lastGoalMinutes: number; notifications: 'unasked' | 'granted' | 'denied' };
}
```
`Store` = `{ get(): GardenState; dispatch(action): void; subscribe(fn): unsub }`. Every
dispatch persists (debounced). Reducers are pure and live in `core/`.

### Session maths (`src/core/session.ts`)
`elapsedMs(s, now) = (s.pausedAt ?? now) - s.startedAt - s.pausedTotalMs`; complete when
`elapsedMs >= goalMs`. All time comes from the injected `Clock` — never `Date.now()` directly.

### Events (`src/core/events.ts`)
`session:start | session:pause | session:resume | session:cancel | session:complete |
reward:chosen | plant:placed | plant:swapped | fauna:arrived | tip:retired | settings:changed`.

## Dev / test hooks (`src/dev/`)
Enabled by `?dev` query param. `?speed=60` → clock runs 60× (also `window.sprout.setSpeed`).
`window.sprout` exposes: `state()`, `reset()`, `seed(n)`, `completeSession()`,
`addPlants(n, tier?)`, `setTime('morning'|'noon'|'evening'|'night'|null)`,
`setWeather(w)`, `freeze()` (stop animation for stable screenshots).
E2E tests must use these instead of sleeping.

## Conventions
- Pure logic in `core/` must have unit tests. Rendering code is verified with screenshots.
- No `Date.now()`/`Math.random()` outside `core/clock.ts`/`core/rng.ts` — everything seeded.
- Each system documents itself in `docs/systems/<name>.md`.
