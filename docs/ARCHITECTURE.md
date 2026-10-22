# Architecture

> Source of truth for module boundaries and shared contracts. If you change a contract,
> update this file in the same commit and add an ADR.

## Stack
- Vite + TypeScript (strict, ES2022, no framework). `npm run dev | build | preview | typecheck | test |
  test:watch | e2e | shots`. Testing layers and conventions: `docs/TESTING.md`.
- Canvas 2D for the garden; plain DOM (+ CSS) for UI overlays.
- Vitest (`src/**/*.test.ts`, jsdom where DOM needed), Playwright (`tests/e2e/*.spec.ts`, Chromium).
- Vite `base: '/Ssprout/'` for GitHub Pages.

## Directory layout
```
src/
  main.ts                 bootstrap: load state, create renderer + systems + UI
  core/                   pure, framework-free, fully unit-tested logic (no DOM, no canvas)
    clock.ts              Clock interface; real clock + dev speed clock (?dev&speed=N)
    rng.ts                seeded RNG (mulberry32) + helpers; string seeds hashed
    events.ts             typed event bus
    state.ts              GardenState types, defaults, createReducer(world)/actions, store
    persistence.ts        localStorage load/save, schema version + migrations, export/import validation
    session.ts            session phases (idle/focus/break/paused), timeline + growth maths, goal clamp, weather
    rewards.ts            tier from minutes, selectable species per total
    plans.ts              study plans: recommendPlans(total), plan validation
    placement.ts          slot compatibility (habitat + size class), swap candidates
    fauna-unlocks.ts      which creatures are unlocked for a given state
    tips.ts               tooltip registry + seen/retired logic
    controller.ts         session controller: the single API the UI/widget call (no DOM)
    testing.ts            unit-test helpers (fixtures for states and sessions)
  paint/                  watercolour engine (pure canvas drawing utilities) — see docs/systems/paint.md
  scene/                  the static painted landscape, scene geometry, slots — docs/systems/scene.md
  plants/
    types.ts              SpeciesDef contract (below)
    registry.ts           auto-discovers species via import.meta.glob('./species/*.ts') (not *.test/*.studio)
    species/<id>.ts       one file per species, default export SpeciesDef (25 real species)
    lib/                  shared species helpers (small-*, shrub-*, tree-*)
    sprites.ts            renders + caches plant sprites per instance & growth step (workers, LRU)
    sprite-worker.ts      the module worker that paints sprites
    system.ts             PlantSystem: garden drawables, growth, sway, bloom, wither, watering, reflections
    draw.ts · watering.ts · wither.ts · reflection.ts · highlight.ts · bounds.ts · wind-adapter.ts
    view.ts               renderPlantView (widget, previews) — docs/systems/plants.md
    debug.ts              ?dev hooks (window.sprout.plants, plantsReady)
  fauna/                  creatures (one file each) + FaunaSystem — docs/systems/fauna.md
  ambience/               session weather (sun/rain/mist), motes, wind field, the daylight (sun times,
                          four phases, the shared source, light plates) — docs/systems/daylight.md
  render/                 Renderer, layers, viewport (world↔screen), System interface, frame loop
  ui/                     the page: garden stage overlay (pill, corner tools, markers, labels), dock of
                          sections (session controls, your plant, tools), planting sheet, tips, herbarium,
                          smooth scroll + scrollbar
  widget/                 Document PiP widget, title/favicon fallback, notifications, timer worker
  audio/                  procedural Web Audio ambience + chime
  dev/                    ?dev debug API (window.sprout) used by e2e tests; fixture species (fx-*,
                          placeholder-sprout for unit tests); fill-garden (addPlants)
  studio/                 studio.html page: discovers every *.studio.ts and shows all sprites/animations
tests/e2e/                Playwright specs + helpers (fixtures.ts, ui-helpers.ts) — docs/TESTING.md
scripts/                  shots.ts — capture screenshots to artifacts/ (gitignored) for review
public/sw.js              notifications-only service worker (ADR 0092)
studio.html               second Vite entry (deployed at /Ssprout/studio.html)
docs/                     SPEC, ARCHITECTURE, ART_DIRECTION, ROADMAP, adr/, systems/, devlog/
```

## World coordinates & viewport
- Logical world is **1600 × 1000** units (`WORLD_W`, `WORLD_H` in `src/render/viewport.ts`).
  All scene geometry, slots and creature positions are in world units.
- Viewport uses **cover** scaling with a focus point (pond centre) so portrait screens crop the
  sides rather than squash, but never shows less than `MIN_VISIBLE_W` = 600 world units of width:
  tall phones get paper above and below instead (ADR 0123). `viewport.worldToScreen(p)`,
  `screenToWorld(p)`, `scale`, `visible` (the world rect on screen).
- Device pixel ratio capped at 2. Static layers are re-rendered on resize (debounced 200 ms).
- **The viewport is the stage, not the window** (ADR 0130): the canvas fills `#stage` (~88 % of
  the window's height under a small margin) and the renderer measures the canvas's own box
  (`getBoundingClientRect`, observed with a `ResizeObserver`). Viewport CSS pixels are stage
  pixels; client (window) coordinates = viewport coordinates + the canvas's client rect, whatever
  the page's scroll.

## Rendering pipeline (back → front)
| # | Layer | Contents | Redraw |
|---|---|---|---|
| 0 | `background` | sky, hills, far trees, pavilion, banks, pond base, path; then the daylight sky plate multiplied over it, sun and moon left as paper (ADR 0145) | once per resize and when the sky moves (cached canvas) |
| 1 | `underwater` | koi — clipped to pond shape | per frame |
| 2 | `waterSurface` | the mirrored daylight sky, water shimmer and glints, reflections (trees, rocks, plants near shore), rain rings, eave drips, water striders, floating leaves | per frame (reflections cached) |
| 3 | `entities` | depth-sorted (by base y): foreground rocks/tufts from scene (+ rim light), plants (cast shadow, plant, rim light — ADR 0146), ground fauna (birds on rocks, frog, heron) | per frame (sprites cached) |
| 4 | `air` | bees, butterflies, dragonflies, flying birds, swallows, falling leaves, the watering can | per frame |
| 5 | `ambience` | sun shafts, rain strokes, mist, light motes | per frame |
| 6 | `lighting` | the daylight light plate: the blended phase plates (grade wash, shadows, crown lights, lamp light) with the moving lights lifted out, a night desaturation glaze (ADRs 0082, 0147); the `?dev&slots` overlay | composite rebuilt when the light moves; one blit per frame |
| 7 | `paper` | static washi grain + vignette over everything (multiply) | once per resize |

The renderer (`createRenderer` in `src/render/renderer.ts`) owns the frame loop, the cached
`background`/`paper` canvases (paper is composited with `multiply`) and the depth sort; its API
(`add`, `remove`, `start`, `freeze`, `renderOnce`, `invalidate`, `whenReady`, …) is documented
in `docs/systems/render.md`.

Scene systems (`src/scene/system.ts`, docs/systems/scene.md): `createPaperSystem()` draws the
`paper` layer (ADR 0040); `createSceneSystem({ invalidate: renderer.invalidate, showSlots?, daylight? })` paints the
cached `background` (repainted only when the scale changes > 10 %, cross-faded, ADR 0041),
animates `waterSurface` and contributes the boulders and foreground tufts to `entities` with
depth = base y (ADR 0042). With the shared `daylight` it multiplies the phase's painted sky over the
cached painting, lays the mirrored sky on the pond and rims the boulders (ADRs 0145, 0146).

Slot markers, the timer pill, the corner tools and all other controls are **DOM** (accessible,
e2e-clickable: `[data-slot-id="..."]`): on the painting inside the stage overlay, the rest in the
dock below the garden (see Page, stage and dock).

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
`sprites.ts` renders each placed plant at growth steps `k / 24` (`GROWTH_STEPS`; finished plants only
step 24), cached per instance seed + step + pixel size (`size × plantScale(slot) × resolution bucket`), painted
in module workers; the garden cross-fades (and morphs) between the two nearest steps, so live growth is
continuous (ADRs 0110–0112). `draw` must be deterministic per (seed, growth, w, h), stay inside its box
and not touch the DOM (it runs in a worker). Runtime sway = horizontal skew (a bend for large plants
and trees) about the base, driven by the garden wind (ADR 0113). Details: `docs/systems/plants.md`.

### Plant view (`src/plants/view.ts`, ADRs 0003, 0094)
One species at an arbitrary growth, optionally mid-watering or wilting — used by the widget card,
the planting-sheet previews and the studio (the garden draws through the plant system, with the
same growth steps, watering and wither):
```ts
export interface PlantViewOptions { speciesId: string; seed: number; growth: number; watering: number | null /* 0..1 */; wilt?: number /* 0..1 */ }
export function renderPlantView(canvas: HTMLCanvasElement | OffscreenCanvas, opts: PlantViewOptions): boolean; // false: unknown species
```
Clears the canvas, contains the species with its base at the bottom centre (`plantLayout`) over a soft
ground wash, and draws the same cached growth steps as the garden (`GROWTH_STEPS = 24`, morphing
cross-fade), the painted watering animation (jōro, droplets, damp soil, leaves lift) and the wither
(ADR 0118). `setPlantViewSpecies(fn)` adds species the registry lacks (main passes its `getSpecies`, so
`?fixtures` render). Keep the signature.

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

The garden instance is `gardenScene` (`geometry.ts`): 52 slots, 11 rocks, 6 stepping stones
(the engawa stands on the bank, the path winds up to the water — ADR 0122).
Every slot's `scale` is `perspectiveScale(y)` (0.55 at y 400 → 1.15 at y 960) and
`PLANT_SIZES` gives the canonical plant box per size class at scale 1 — small 86×86 (tier-1
plants draw in a 70-unit design box scaled up, ADR 0125), medium 120×160, large 200×220,
tree 380×460 (`slots.ts`, ADR 0043). **Garden plants are drawn `GARDEN_PLANT_SCALE` (1.25) larger**:
a plant's box is `size × plantScale(slot)` (`plantScale(slot) = slot.scale × 1.25`, ADR 0148) —
`plantWorldBounds` (`src/plants/bounds.ts`) is the one place that computes it; `slot.scale` itself
stays the ground's perspective (fauna uses it for creatures).

### State (`src/core/state.ts`, ADR 0003, ADR 0036)
Each session is one plant, chosen at start, growing live in its slot.
```ts
export type PlanBlock = { kind: 'focus' | 'break'; minutes: number };
export interface StudyPlan { id: string; name: string; blocks: PlanBlock[] } // core/plans.ts
export interface PlantInstance { id: string /* = session id */; speciesId: string; slotId: string; seed: number;
  plantedAt: number /* session start */; sessionMinutes: number /* total */; taskName: string; completedAt: number; }
export interface PressedFlower { speciesId: string; seed: number; plantedAt: number; removedAt: number; taskName: string; }
export type Weather = 'sun' | 'rain' | 'mist';
export interface ActiveSession { id: string; taskName: string; goalMs: number /* total incl. breaks */; plan: StudyPlan;
  speciesId: string; slotId: string; seed: number; displacedPlantId: string | null;
  startedAt: number; pausedAt: number | null; pausedTotalMs: number; skippedMs: number; weather: Weather;
  waterings: number[] /* watered break block indexes */; }
export interface GardenState {
  version: 1;
  createdAt: number;
  plants: PlantInstance[];      // finished plants only
  pressed: PressedFlower[];
  session: ActiveSession | null;
  stats: { totalMinutes: number /* focused */; completed: number; cancelled: number };
  faunaSeen: string[];          // creature ids already announced
  tips: Record<string, 'seen'>; // retired tips
  settings: { muted: boolean; lastGoalMinutes: number; notifications: 'unasked' | 'granted' | 'denied' };
}
```
`Store` = `{ get(): GardenState; dispatch(action): void; subscribe(fn): unsub }` where
`fn(state, prev, action)`. `createStore(initial, reducer, onChange?)`: `onChange` runs on every
state change before subscribers (the persistence hook — every dispatch persists, debounced).
A reducer returning the same reference means "no change" (no notifications). Dispatches made
from inside a listener are queued and applied after the current delivery (ADR 0011).
Reducers are pure and live in `core/`.

The app reducer is `createReducer(world)` with
`ReducerWorld = { getSpecies(id): { habitats, sizeClass, tier } | undefined; getSlot(id): { id, habitat, maxSize } | undefined }`
so `session/start` can enforce the earned tier and slot compatibility; `reducer` is
`createReducer()` (no world: any species/slot accepted). **Invalid actions are no-ops returning the
same reference** (ADR 0030). Every rule is listed in `docs/systems/core.md`.

#### Actions
Every impure input (time, ids, seeds, weather) is carried in the action, so reducers stay pure and
deterministic. `type Action =`

| type | payload | meaning |
|---|---|---|
| `session/start` | `id, taskName, goalMinutes, plan, speciesId, slotId, seed, now, weather` | plant a seedling and start (plan sums to the total; species tier ≤ earned; compatible slot; an occupant becomes `displacedPlantId`; sets `settings.lastGoalMinutes`) |
| `session/pause` | `now` | pause (focus or break) |
| `session/resume` | `now` | resume; adds the paused span to `pausedTotalMs` |
| `session/water` | `blockIndex, now` | water the current break (once) |
| `session/skipBreak` | `now` | skip the rest of the current break (`skippedMs +=` remainder) |
| `session/cancel` | `now` | seedling withers, displaced plant stays (`stats.cancelled++`) |
| `session/complete` | `now` | plan finished → finished plant (id = session id), displaced plant → `pressed` |
| `tip/retire` | `id` | mark a tip as seen |
| `settings/update` | `patch: Partial<Settings>` | merge settings |
| `fauna/seen` | `id` | creature announced |
| `state/replace` | `state` | import / load a whole state |
| `state/reset` | `now` | fresh default state |

Types exported alongside: `Settings`, `GardenStats`, `Action`, `ActionType`, `Reducer<S, A>`,
`Listener<S, A>`, `Store`, `createStore`, `createDefaultState(now)`, `STATE_VERSION`,
`DEFAULT_GOAL_MINUTES`, `createReducer`, `reducer`, `ReducerWorld`, `mergeSettings`.

### Study plans (`src/core/plans.ts`, ADR 0036)
`recommendPlans(totalMinutes): StudyPlan[]` — 2–4 plans (only `unbroken` below 30 min), each summing
exactly to the total and ending with focus; `unbroken` always first; plans with the same blocks are
offered once. Ids: `unbroken`, `pomodoro`, `long-focus`, `deep-work`, `two-deep`. Also `findPlan`,
`planProblem` (sum, ends with focus, positive blocks), `focusMinutes`, `planMinutes`, `hasBreaks`,
`unbrokenPlan`.

### Session maths (`src/core/session.ts`)
Session time `elapsedMs(s, now) = max(0, (pausedAt ?? now) − startedAt − pausedTotalMs)`; plan
position `planPositionMs = min(goalMs, elapsed + skippedMs)`; complete when `elapsed + skippedMs ≥
goalMs`. All time comes from the injected `Clock` — never `Date.now()` directly.
```ts
export interface SessionTimeline { elapsedMs: number /* plan position */; blockIndex: number; block: PlanBlock;
  blockElapsedMs: number; blockRemainingMs: number; totalRemainingMs: number; focusDoneMs: number;
  focusTotalMs: number; growth: number /* focusDone ÷ focusTotal */; progress: number; watered: boolean; complete: boolean }
export function sessionTimeline(s: ActiveSession, now: number): SessionTimeline;
```
Also: `sessionPhase(state, now)` → `'idle' | 'focus' | 'break' | 'paused'`, `remainingMs`, `progress`,
`growth`, `pausedFor`, `isLongPause` (≥ 30 min), `completionTime`, `blockStartMs`, `clampGoalMinutes`
(10–180, step 5), `normalizeTaskName` (≤ 40 chars, empty → "Study session"), `pickWeather(rng)`
(sun .6 / rain .25 / mist .15), `formatClock(ms)`. Tiers: `tierForMinutes`, `selectableSpecies`
(`core/rewards.ts`).

### Session controller (`src/core/controller.ts`, ADRs 0032, 0036)
`createSessionController({ store, clock, bus, species, slots?, ticker?, seed? })` is the **single
API the UI and widget use**: `start({ taskName, goalMinutes, planId?, speciesId, slotId }) => boolean`,
`pause()`, `resume()`, `water()`, `skipBreak()`, `cancel()`, `check()`, `recommendPlans(min)`,
`selectableSpecies(min) => { species, locked, requiredMinutes, earned }[]`,
`placementOptions(speciesId) => { slot, occupiedBy? }[]`, `retireTip(id)`, `updateSettings(patch)`,
`announceFauna(id)`, `status() => { phase, session, timeline, pausedForMs, longPause }`, `onTick(fn)`,
`setTicker(t)`, `setSeed(s)`, `dispose()`. The action methods (`pause` … `announceFauna`) return
`boolean` (false = nothing changed). It supplies time/ids/seeds/weather, emits the bus events
(including block transitions), completes due sessions on every tick and once at creation
(closed-app completion), and retires tips automatically. It ticks **only while a session exists**.
`Ticker = { start(tick): stop }` (default `createIntervalTicker`, 1 s). Full table in
`docs/systems/core.md`.

### Persistence (`src/core/persistence.ts`, ADRs 0033–0034)
Key `studysprout:v1` (stable; the document's `version` drives `MIGRATIONS`). `loadState(storage,
now, opts)` never throws (`fresh | loaded | migrated | recovered | unavailable`; corrupt data is
copied to `studysprout:corrupt:<ts>`). `createSaver(storage)` debounces saves (300 ms; `main.ts`
flushes on `pagehide` and when the page becomes hidden). `exportState`/`exportFileName`/`importState` (typed errors; unknown species
kept and flagged).

### Events (`src/core/events.ts`)
`session:start | session:pause | session:resume | session:cancel | session:break | session:focus |
session:water | session:complete | plant:placed | plant:swapped | fauna:arrived | tip:retired |
settings:changed`. Payloads are typed in `EventMap`: `'session:break' | 'session:focus' |
'session:water': { blockIndex }`, `'session:start': { session }`, `'session:pause' | 'session:resume' |
'session:cancel': { sessionId, at }`, `'session:complete': { sessionId, plant }`, `'plant:placed': { plant }`
and `'plant:swapped': { plant, removed }` (both on completion; swapped first), `'fauna:arrived': { id }`,
`'tip:retired': { id }`, `'settings:changed': { settings }`. `fauna:arrived` is emitted by the fauna
system the first time a newly unlocked creature is actually in view (ADR 0120); the UI's quiet line
announces it and records it with `controller.announceFauna(id)`.
`createEventBus()` → `{ on, once, off, emit, clear }`; `on` returns an unsubscribe function;
delivery is synchronous to a snapshot of handlers; a throwing handler does not stop the others.

### Clock & Rng (`src/core/clock.ts`, `src/core/rng.ts`)
`Clock = { now(): number }`; `realClock`; `createSpeedClock(speed, base?)` (anchored at
creation, `setSpeed(n)` without jumps, `advance(ms)` dev jump — ADR 0035); `createManualClock(t)` for tests.
`createRng(seed: number | string)` → `{ seed, next, range, int, pick, shuffle, gaussian, chance,
fork(label) }`. `int` is inclusive; `shuffle` returns a copy; `fork` derives from the stream's
*seed* + label, not its position (ADR 0012).

### Wind field (`src/ambience/wind.ts`, ADR 0083)
```ts
export function wind(t: number, x: number, y: number, boost?: number /* 0..1 */): { sway: number /* -1..1, + = toward +x */; gust: number /* 0..1 */ };
export function windBoost(phase: SessionPhase): number; // focus 1, break 0.5, else 0
```
Pure, fixed seed (`createWind(seed)` for others); gust fronts travel toward +x. Plants use `sway`
for their skew; fauna could use both (not wired). Ambience/lighting dev hooks and internals:
`docs/systems/ambience.md` (`setTime`, `setWeather`, `settleAmbience()`, `ambience()`).

### Ambience system (`src/ambience/system.ts`, ADRs 0080–0084, 0121, 0147)
`addAmbience(renderer, { dev, daylight })` registers the system and returns it. Besides the
`System` hooks it has `setTime(v)` (sets the shared daylight's override), `setWeather(w)`,
`settle()`, `debug()`, `daylight` (the source it paints with), `now()` (last frame's clock time),
`onLight(fn)` (the blended phase grade, each time the light recomposes) and
`revealLightAfter(promise)` (the lighting is drawn at alpha 0 until the promise resolves, then eases
in over 1.4 s, at once under reduced motion or on a frozen frame). `main.ts` passes
`renderer.whenReady()`, so the light never lies on bare paper.

### Daylight (`src/ambience/daylight*.ts`, `solar.ts`, `zones.ts`, `sky-layout.ts`; ADRs 0140–0143)
Four phases (`sunrise | midday | sunset | night`) on the real sun at a location guessed from the
time zone, blended over 40 min around civil dawn, sunrise + 60 min, sunset − 60 min and civil dusk.
```ts
export type DayPhase = 'sunrise' | 'midday' | 'sunset' | 'night';
export interface DaylightState { weights: Record<DayPhase, number> /* sum 1 */; phase: DayPhase;
  blend: { from: DayPhase; to: DayPhase; t: number } | null; sunAltitude: number; sunRising: boolean;
  moonProgress: number /* 0 dusk … 1 dawn */; moonPhase: number; times: SunTimes | null; night: number }
export interface DaylightSource { at(now: number): DaylightState; setOverride(v: TimeOverride): void;
  override(): ParsedOverride | null; location(now: number): Location; setLocation(p: GeoPoint | null): void;
  readonly version: number /* bumps on every change */ }
export type TimeOverride = DayPhase | 'morning' | 'noon' | 'evening' | 'dusk' | 'dawn' | number | { from: DayPhase; to: DayPhase; t: number } | null;
```
`main.ts` creates **one** `createDaylightSource()` and passes it as the `daylight` option to
`createSceneSystem`, `createPlantSystem`, `createFauna` and `addAmbience` (each falls back to a
pinned midday, or the ambience to its own source, without it). Where the light falls — sun and
moon discs, stars, cast shadow, rim light — comes from `sky-layout.ts`, so every painted thing
agrees. Time enters only as the frame's `now`. Details: `docs/systems/daylight.md`.

### Audio (`src/audio/`, ADRs 0100–0103)
`createGardenAudio({ bus, getState, clock })` → `{ unlock(), setMuted(), isMuted(), setWeather(),
setActivity(), setFauna(), setTimeOfDay(), playBloom(), playComplete(), dispose() }`. Muted by
default; it follows `settings:changed` and the session/plant/fauna events on the bus. The UI calls
`unlock()` inside a user gesture. Details: `docs/systems/audio.md`.

### Shared helpers
`Pt` lives in `src/render/viewport.ts` (re-exported from `scene/geometry.ts`).
`src/plants/types.ts` also exports `SpeciesDrawOptions`, `TIERS`, `HABITATS`, `SIZE_CLASSES`, `fitsSize()`, `reflects()`.

## Dev / test hooks (`src/dev/`)
Enabled by the `?dev` query param (without it `window.sprout` does not exist). `?dev&speed=60` runs
the app clock 60× (also `window.sprout.setSpeed`). E2E tests and screenshots use these hooks
instead of sleeping (docs/TESTING.md). Modules add methods with `extendDebug({...})` from
`src/dev/debug.ts` and augment the `SproutDebug` interface via declaration merging.

Foundation (`src/dev/debug.ts`): `state()`, `ready()` (resolves when all systems are initialised),
`freeze()` (async; resolves after a stable frame is drawn), `unfreeze()`, `setSpeed(n)`, `now()`,
`frameStats()` (`{ frames, workAvg, workP95, workMax, intervalAvg, intervalP95 }`: renderer main-thread
ms per frame and rAF intervals over the last 600 frames), `resetFrameStats()`.

Core logic (`src/dev/core-debug.ts`): `reset()`, `seed(n)`, `start(min?, { taskName?, planId?,
speciesId?, slotId? })` (`min` defaults to `settings.lastGoalMinutes`; returns the session or null),
`pause()`, `resume()`, `water()`, `skipBreak()`, `cancel()`, `toBreak()`, `skipToBlock(i)`,
`completeSession()` (these jump the dev clock), `plans(min)`, `selectableSpecies(min)`,
`placementOptions(speciesId?)`, `addPlants(n, tier?)` (finished plants with task names),
`setState(partial)` (validated), `status()`, `flush()`, `exportState()`, `importState(json)`.

Scene (`src/scene/debug.ts`): `slots()`, `sceneStats()` (paints, rescales, per-step timings),
`scenePainted()` (resolves when no background repaint is pending), `skyStats()` (daylight sky plates painted,
composites, paint ms). `?dev&slots` draws the slot
overlay.

Plants (`src/plants/debug.ts`): `plantsReady()` (resolves once the plant system has picked up the
latest store change, every sprite the garden needs is
painted and new plants have faded in, without snapping growth or blooms — use before screenshots,
ADR 0149) and `window.sprout.plants` —
`state()` (each finished plant with `shown` 0…1), `settle()` (snap growth/fades and resolve once their sprites are painted), `whenIdle()`,
`bounds(plantId)`, `boundsFor(speciesId, slotId)`, `toDevice(rect)`, `perf()`, `resetPerf()`,
`ambienceWind()`.

Ambience (`src/ambience/dev.ts`): `setTime('sunrise'|'midday'|'sunset'|'night'|{ from, to, t }|hour|null)`
(v1 names `morning`, `noon`, `evening`, `dusk`, `dawn` kept as aliases), `daylight()` (phase weights, sun,
moon, shadow, rim, location, sun times),
`setWeather('sun'|'rain'|'mist'|null)` (preview without a session), `settleAmbience()` (jump
transitions to steady state), `ambience()` (phase, levels, daylight phase and weights, particle counts, ms/frame).
`setTime` moves the shared daylight: sky, light, shadows, rims and fauna's night (`fauna.setHour` still pins an
hour for fauna; audio keeps the real clock).

Fauna (`src/fauna/dev.ts`, installed by `createFauna({ debug })`): `window.sprout.fauna` —
`kinds()`, `spawn(id, count?)` (returns creature ids), `list()`, `clear()`, `step(seconds, dt?)`,
`setHour(h)`, `night()`, `roster()`, `schedule()`, `pond()`, `view()`, `targets()`, `bench(frames?)`
(docs/systems/fauna.md).

Widget (`src/widget/dev.ts`, `installWidgetDebug`): `window.sprout.widget` — `supported()`,
`isOpen()`, `open()`, `close()`, `tickerMode()`, `title()`, `favicon()`, `bloomed()`,
`lastNotification()`, `mountHarness()` (the floating card in `iframe#sprout-widget-harness`),
`closeHarness()`, `harnessMode()`, `harnessWatering()`.

UI (`src/dev/ui-debug.ts`): `window.sprout.ui` — `state()` (mode, panel view, pill view, plantView,
confirm, resting, dialogs, tips, markers, line, plantLabel, draft), `refresh()`, `setTimeScale(n)`,
`placement()`, `showPlantLabel(world)`, `slotScreen(id)` (client pixels: stage offset and scroll
included), `scroll()`, `scrollTo(y | sectionId, { instant? })`, `dock()`, `dockReady()`,
`waterPlantView()`, `onZoomGesture(fn)`, `widget` (fake only); `window.sprout.advance(ms)`.
Query flags: `?fixtures` (dev `fx-*` species, ADR 0055), `?uitime=0.05` (UI delays),
`?widget=fake`.

## UI (`src/ui/`, ADRs 0050–0055, 0121, 0124, 0130–0136)
`createUI({ root, stage?, controller, store, bus, clock, getSpecies, slots, viewport, audio?, widget?,
notifications?, isKnownSpecies?, reducedMotion?, timeScale? })` → `{ dock, stage, scroll, plantView,
placement: { current(), subscribe(fn) }, state(), refresh(), setTimeScale(), showPlantLabel(),
dispose() }`. DOM only, drives the app through the controller. `root` is the page (`#ui`), `stage`
the element holding the canvas (default: `root`'s `.stage`). `viewport` is a function returning the
renderer's current `Viewport`. `widget` is the `WidgetIntegration` (`{ supported, open(), isOpen(), onChange?() }`,
satisfied by `surfaces.widget`). `main.ts` passes no `notifications`: the widget surfaces ask for
permission inside `session:start`.
`ui.placement.subscribe` gives the placement markers (world units); `main.ts` connects it to the
plant system (`plants.connectPlacement(ui.placement)`) for the in-canvas highlight (ADR 0117).
Plant labels hit-test with `plantWorldBounds` (`src/plants/bounds.ts`). The DOM slips follow the
garden's light: `main.ts` subscribes `applyUiLight` to `ambience.onLight` once the painting is ready
(ADR 0121). Details: `docs/systems/ui.md`.

## Page, stage and dock (`src/ui/`, ADRs 0130–0135)
The page scrolls as a document. `index.html`: `#ui` > `section#stage` > `canvas#garden`; `createUI`
adds the stage overlay and puts the dock after the stage.

**Stage** — `ui.stage = { el, onZoomGesture(fn) => unsubscribe }`. Things on the painting live in
`.stage-ui` (absolute, viewport CSS pixels). ctrl/⌘ + wheel over the stage (trackpad pinch arrives
so) never scrolls the page; with a zoom handler registered it gets the event (default prevented),
otherwise the browser zooms the page as usual. One-finger touch scrolls the page natively
(`touch-action: manipulation` on the canvas); a camera that pans or pinches must change that.
The canvas edge dissolves into the page's paper through a CSS mask (ADR 0132).

**Dock** — `ui.dock` (`src/ui/dock.ts`), the contract for features below the garden:
```ts
interface DockSectionDef { id: string /* kebab-case, unique */; title: string; order?: number /* default 100 */;
  span?: 'half' | 'full' /* wide screens; phones: one column */; mount?(body: HTMLElement, section: DockSection): void | (() => void) }
interface DockSection { id; el /* <section data-section=id> */; body; heading /* h2#dock-<id>, tabindex -1 */; setTitle(t); setHidden(b) }
interface Dock { el; addSection(def): DockSection /* throws on duplicate/malformed id */; fill(id, mount): DockSection;
  removeSection(id); get(id): DockSection | null; sections(): { id, title, order, span, filled, visible }[]; onChange(fn): () => void }
```
Order: by `order`, then registration. A section without `mount` is a hidden placeholder until
`fill`. Registered by the UI: `session` "Study" (10), `plant` "Your plant" (20), `calendar`
"Calendar" (30, full, **placeholder**), `tools` "Garden tools" (90, full). Wide screens: two
columns (`half` sections side by side); under 860 px one column.

**Scroll** — `ui.scroll = { state(): { y, max, target, animating, smooth }, to(y | sectionId, { instant? }) }`
(ADR 0131). Wheel and arrow keys ease, page keys/Home/End/jumps glide, touch is native, reduced
motion lands at once; native scrolls are adopted. The custom scrollbar is `aria-hidden` decoration.

**Plant view** — `ui.plantView = { water(): boolean, state() }` (ADR 0134). It also plays on every
`session:water` bus event; the automatic focus watering (phase 7) emits that event.

## Timer surfaces (`src/widget/`, ADRs 0090–0094)
`createTimerSurfaces({ controller, store, bus, clock, win?, notificationEnv?, openHost? })` →
`{ widget: { supported, open(), isOpen(), close(), onChange(fn), dispose() },
requestPermissionFromGesture(), dispose(), internals }` (`internals` = ticker, tab, notifier, widget
for the dev hooks). It installs a Web Worker
`Ticker` on the controller (`setTicker`), keeps the tab title/favicon in sync, sends break / focus /
bloom notifications (service worker `public/sw.js` → `${BASE_URL}sw.js`) and opens the Document
Picture-in-Picture card. It reads the controller through the structural `WidgetController`
(`src/widget/contract.ts`), which `SessionController` satisfies (type-checked in a test). Wiring
and policies: `docs/systems/widget.md`.

## Studio (`studio.html`, `src/studio/`)
A dev page (also deployed at `/Ssprout/studio.html`) showing **every sprite, creature, effect
and paint primitive** for visual review. Any `src/**/*.studio.ts` is discovered with
`import.meta.glob('/src/**/*.studio.ts', { eager: true })` and default-exports a
`StudioSection` **or an array of them** (`src/studio/types.ts`):
```ts
export interface StudioSection { id: string; title: string; order?: number; entries: StudioEntry[] }
export interface StudioEntry {
  id: string; label: string; w: number; h: number; animated?: boolean;
  render(canvas: HTMLCanvasElement, ctx: { t: number; dt: number; seed: number; frame: number; pixelRatio: number }): void;
}
```
`render` fills `canvas.width × canvas.height` pixels (the studio clears the canvas and resets
the transform before each call; `pixelRatio = canvas.width / w`). Animated entries render every
frame, static ones once per seed/scale. Section ids are unique; entry ids are unique per section
and addressed as `<section>/<entry>`; sections sort by `order` (default 100), then title. URL:
`#<section>`, `?entry=<id>` (a bare entry id works when unique), `?seed=n` (default 1), `?t=sec`
(start paused), `?scale=2`, `?bg=paper|white|dark`. `window.studio` = `{ ready, entries, errors,
renders(), pause(), setT(t) }` for tests and screenshots. All species automatically get a section
(growth stages + grow loop) from `src/plants/species.studio.ts`. See `docs/systems/studio.md`.

## Conventions
- Pure logic in `core/` must have unit tests. Rendering code is verified with screenshots.
- No `Date.now()`/`Math.random()` outside `core/clock.ts`/`core/rng.ts` — everything seeded.
- Each system documents itself in `docs/systems/<name>.md`.
- Every sprite, creature, effect and paint primitive has a studio entry in a colocated `*.studio.ts`.
