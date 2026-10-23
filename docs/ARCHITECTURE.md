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
    session.ts            session phases (idle/focus/break/paused), timeline + growth maths, goal clamp, weather,
                          the automatic focus-watering schedule
    session-log.ts        history queries (day/week/month, local calendar) and the v1 back-fill
    schedule.ts           scheduled sessions: the rule + notes model, local-calendar recurrence expansion,
                          due / missed / done status, the start prefill (ADRs 0170–0173)
    schedule-reducer.ts   schedule/* reducers; "only this one" / "this and following" edits as actions
    schedule-controller.ts the scheduler: the API for schedules, the due tick, `schedule:due`
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
    hit-test.ts · notes.ts  painted-pixel hit-test (alpha masks); a note per species for the plant card
    sprite-worker.ts      the module worker that paints sprites
    system.ts             PlantSystem: garden drawables, growth, sway, bloom, wither, watering, reflections
    draw.ts · watering.ts · wither.ts · reflection.ts · highlight.ts · bounds.ts · wind-adapter.ts
    view.ts               renderPlantView (widget, previews) — docs/systems/plants.md
    debug.ts              ?dev hooks (window.sprout.plants, plantsReady)
  fauna/                  creatures (one file each) + FaunaSystem — docs/systems/fauna.md
  ambience/               session weather (sun/rain/mist), motes, wind field, the daylight (sun times,
                          four phases, the shared source, light plates) — docs/systems/daylight.md
  render/                 Renderer, layers, viewport (world↔screen), camera (zoom/pan over it), System interface, frame loop
  ui/                     the page: garden stage overlay (pill, corner tools, markers, labels, zoom chips,
                          plant card), the dock of sections (Study, Your plant, Calendar, Garden tools) and
                          its guiding path, the planting and schedule sheets, tips, herbarium, smooth
                          scroll + scrollbar — docs/systems/ui.md, docs/systems/calendar.md
  widget/                 Document PiP widget, title/favicon fallback, notifications, timer worker
  audio/                  procedural Web Audio ambience + chime
  dev/                    ?dev debug API (window.sprout) used by e2e tests: debug.ts (base), core-,
                          camera-, schedule- and ui-debug.ts; fixture species (fx-*, placeholder-sprout
                          for unit tests); fill-garden (addPlants), fill-history (past sessions),
                          local-time (advanceTo)
  studio/                 studio.html page: discovers every *.studio.ts and paints the cards lazily (ADR 0006)
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

### Camera (`src/render/camera.ts`, ADRs 0160–0168; docs/systems/camera.md)
The cover viewport is the **overview** (zoom 1). The renderer owns a camera — a pose `{ zoom 1–3,
x, y }` (the world point at the stage's centre) — and `composeView(base, pose)` is an ordinary
`Viewport`. **`renderer.viewport` is the camera's view** (DOM overlays and pointer mapping follow
it); `renderer.baseViewport` the overview; `renderer.camera` the controller (`pose()`, `state()`,
`base()`, `setBase`, `update(dt)`, `glideTo`, `focusRect`, `overview`, `zoomTo`, `zoomBy`, `panBy`,
`settle` (jump to the glide's end), `interrupt`, `setInset`, `onChange`, plus the `CameraView`
below). The pose maths is pure and exported: `overviewPose`, `reachRect`, `clampPose`,
`composeView`, `zoomAbout`, `panBy`, `framePose`, `glidePath`, `easeGlide`, `glideSeconds`
(`MIN_ZOOM` 1, `MAX_ZOOM` 3). Views stay inside `reachRect`: the overview's
rect at zoom 1, widening to it ∪ the world by 1.25×. Glides follow van Wijk & Nuij's zoom-and-pan
path with a breathing ease (cuts under reduced motion); gestures follow their target (τ 75 ms).
```ts
interface CameraView { view(): Viewport; detailView(): Viewport /* glide destination, else the view at rest */;
  readonly detailVersion: number; moving(): boolean; isOverview(): boolean }
```
`SystemContext.viewport` stays the overview (camera moves never re-init a system);
`SystemContext.camera?: CameraView` is live; `FrameInfo.view?` is the view a draw is for. Systems
that keep resolution-dependent caches watch `detailVersion` and repaint for the resting view
(scene, sky, light plate, plant sprites — ADRs 0163, 0165).

## Rendering pipeline (back → front)
| # | Layer | Contents | Redraw |
|---|---|---|---|
| 0 | `background` | sky, hills, far trees, pavilion, banks, pond base, path; then the daylight sky plate multiplied over it, sun and moon left as paper (ADR 0145); zoomed in and at rest, the scene's detail painting and the sky's detail plate (ADR 0163) | cached twice (ADR 0161): at the overview (blitted as a sub-rect while the camera moves) and at the resting view; rebuilt per resize, when the sky moves, when detail fades in |
| 1 | `underwater` | koi — clipped to pond shape | per frame |
| 2 | `waterSurface` | the mirrored daylight sky, water shimmer and glints, reflections (trees, rocks, plants near shore), rain rings, eave drips, water striders, floating leaves | per frame (reflections cached) |
| 3 | `entities` | depth-sorted (by base y): foreground rocks/tufts from scene (+ rim light), plants (cast shadow, plant, rim light — ADR 0146), ground fauna (birds on rocks, frog, heron) | per frame (sprites cached) |
| 4 | `air` | bees, butterflies, dragonflies, flying birds, swallows, falling leaves, the watering can | per frame |
| 5 | `ambience` | the sun's lifted glaze and leaf glints, rain strokes, mist, light motes | per frame |
| 6 | `lighting` | the daylight light plate: the blended phase plates (grade wash, shadows, crown lights, lamp light) with the moving lights lifted out, a night desaturation glaze (ADRs 0082, 0147); zoomed in, a detail plate with the marks repainted for the view (ADR 0163); the `?dev&slots` overlay | composite rebuilt when the light moves; one blit per frame |
| 7 | `paper` | static washi grain + vignette over everything (multiply); **screen-fixed**, it does not follow the camera | once per resize |

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
export interface FrameInfo { t: number; dt: number; /* seconds */ now: number; /* epoch ms via Clock */ view?: Viewport /* the view this draw is for */ }
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
export interface SystemContext { viewport: Viewport /* the overview */; camera?: CameraView /* live */; store: Store; bus: EventBus; clock: Clock; scene: SceneGeometry; reducedMotion: boolean; }
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
export interface PlantViewOptions { speciesId: string; seed: number; growth: number; watering: number | null /* 0..1 */; wilt?: number /* 0..1 */; framing?: 'species' | 'growth' }
export function renderPlantView(canvas: HTMLCanvasElement | OffscreenCanvas, opts: PlantViewOptions): boolean; // false: unknown species
```
Clears the canvas, contains the species with its base at the bottom centre (`plantLayout`) over a soft
ground wash (`framing: 'growth'` frames what has grown instead, up to 8× larger (`MAX_GROWTH_ZOOM`, devlog 25): small thumbnails,
ADR 0189), and draws the same cached growth steps as the garden (`GROWTH_STEPS = 24`, morphing
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

### State (`src/core/state.ts`, ADR 0003, ADR 0036, ADRs 0150–0154, 0170)
Each session is one plant, chosen at start, growing live in its slot. Up to three sessions are in
progress: `session` is the **active** one (the timer, weather, motes, audio and widget follow it),
`waiting` holds the others, all paused, in the order they were left (ADR 0150). Ended sessions go
into the append-only `log` (ADR 0151).
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
  waterings: number[] /* watered break block indexes */; focusWaterings: number /* automatic ones done (ADR 0153) */; }
export interface SessionLogEntry { id: string; outcome: 'completed' | 'cancelled'; taskName: string; speciesId: string;
  slotId: string; seed: number; plan: StudyPlan | null /* null: back-filled */; goalMinutes: number; focusedMinutes: number;
  startedAt: number; endedAt: number /* wall clock */; backfilled?: true; }
export interface GardenState {
  version: 2;
  createdAt: number;
  plants: PlantInstance[];      // finished plants only
  pressed: PressedFlower[];
  session: ActiveSession | null; // the active session
  waiting: ActiveSession[];     // other sessions in progress, all paused (≤ MAX_SESSIONS − 1)
  log: SessionLogEntry[];       // ended sessions, oldest first
  schedules: Schedule[];        // scheduled sessions (core/schedule.ts, ADR 0170); absent in older v2 docs → []
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
| `session/start` | `id, taskName, goalMinutes, plan, speciesId, slotId, seed, now, weather` | plant a seedling and make it the active session (fewer than 3 in progress; plan sums to the total; species tier ≤ earned; compatible slot not held by another session; an occupant becomes `displacedPlantId`; sets `settings.lastGoalMinutes`); the previous active one moves to `waiting`, paused at `now` |
| `session/switch` | `id, now` | the waiting session `id` becomes active and resumes (its wait goes into `pausedTotalMs`); the active one waits, paused |
| `session/pause` | `now` | pause the active session (focus or break) |
| `session/resume` | `now` | resume it; adds the paused span to `pausedTotalMs` |
| `session/water` | `blockIndex, now` | water the active session's current break (once) |
| `session/focusWater` | `now` | record the automatic focus waterings now due (`focusWaterings = dueFocusWaterings`) |
| `session/skipBreak` | `now` | skip the rest of the current break (`skippedMs +=` remainder) |
| `session/cancel` | `now, id?` | (default: the active session) seedling withers, displaced plant stays, `stats.cancelled++`, a `cancelled` log entry; the others untouched |
| `session/complete` | `now, id?` | plan finished → finished plant (id = session id), displaced plant → `pressed`, a `completed` log entry; nothing else resumes |
| `tip/retire` | `id` | mark a tip as seen |
| `settings/update` | `patch: Partial<Settings>` | merge settings |
| `fauna/seen` | `id` | creature announced |
| `state/replace` | `state` | import / load a whole state |
| `state/reset` | `now` | fresh default state |
| `schedule/add` | `schedule` | add a validated schedule (new id) — ADR 0170 |
| `schedule/update` | `id, patch` | edit the whole rule (notes on dates it no longer has are dropped) |
| `schedule/remove` | `id` | remove a schedule |
| `schedule/note` | `id, date, note \| null` | replace one occurrence's note (skip, let pass, linked session, overrides) |
| `schedule/split` | `id, date, newId, now, patch` | "this and following": end the series before `date`, a new one from it — ADR 0171 |

Types exported alongside: `Settings`, `GardenStats`, `Action`, `ActionType`, `Reducer<S, A>`,
`Listener<S, A>`, `Store`, `createStore`, `createDefaultState(now)`, `STATE_VERSION` (2),
`DEFAULT_GOAL_MINUTES`, `MAX_SESSIONS` (3), `createReducer`, `reducer`, `ReducerWorld`, `mergeSettings`,
`logEntry`, and the selectors `inProgressSessions(state)` (oldest start first), `canStartSession`,
`lastLeftSession`, `heldSlotIds`.

### Session log (`src/core/session-log.ts`, ADR 0151)
`state.log` is the history for the calendar: append-only, oldest first, written by the reducer on
complete and cancel. Pure queries over it: `entriesBetween(log, { from, to }, { outcome? })`
(half-open ranges; an entry is in a range when its `[startedAt, endedAt)` span overlaps it),
`dayRange(t)`, `weekRange(t, weekStartsOn = 1)`, `monthRange(t)` (local calendar),
`entriesOnDay | entriesInWeek | entriesInMonth(log, t, q?)`, `dayKey(t)` (`YYYY-MM-DD`),
`groupByDay(entries)` (by start day), `focusedMinutes(entries, q?)`, `backfillLog(plants)`.

### Scheduled sessions (`src/core/schedule*.ts`, ADRs 0170–0174)
A schedule is **a rule plus per-occurrence notes**; occurrences are never stored.
```ts
type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';
interface OccurrenceNote { skipped?: true; dismissed?: true; sessionId?: string; name?: string; time?: string;
  lengthMinutes?: number | null; planId?: string | null }
interface Schedule { id; name /* ≤ 40 */; date /* local YYYY-MM-DD, first occurrence */; time /* local HH:MM */;
  lengthMinutes: number | null /* null: chosen at start */; planId: string | null /* needs a length */;
  repeat: Repeat; until: string | null /* exclusive */; notes: Record<string /* date */, OccurrenceNote>; createdAt }
interface Occurrence { key /* scheduleId@date */; scheduleId; date; at; end; name; time; lengthMinutes; planId; repeat;
  first: boolean; note: OccurrenceNote | null }
type OccurrenceStatus = 'upcoming' | 'due' | 'missed' | 'dismissed' | 'started' | 'done' | 'ended';
```
**Recurrence contract** (pure, `schedule.ts`): `occursOn(rule, date)`, `occurrenceOn(s, date)` (notes
applied; null when skipped), `expandSchedule(s, range)` / `expandSchedules(list, range)` (occurrences
whose `[at, end)` overlaps the half-open range, by start; local wall time, calendar-day steps, DST-safe),
`occurrenceStatus(o, { now, inProgress, log })` (derived, never stored), `dueUntil(o)` (= `at` +
length (30 when open) + 30 min, ADR 0172), `viewOccurrences`, `dueOccurrences`, `nextOccurrence`,
`startPrefill(o)` (ADR 0173), validation (`scheduleProblem`, `noteProblem`, `lengthPlanProblem`,
`makeSchedule`), local-calendar helpers (`parseDate`, `localTime`, `addDays`, `weekdayOf`, `daysBetween`,
`timeOfDay`). Edits: `planEdit(s, date, edit, 'this' | 'following', ids)` and `planRemove(s, date, scope)`
return the `schedule/*` actions (`schedule-reducer.ts`, table in ADR 0171).

**Scheduler** (`createScheduler({ store, clock, bus, ticker?, seed? })`, `schedule-controller.ts`) — the
API the calendar, the waiting card and `?dev` use: `add(input) => Schedule | null`, `edit(ref, edit, scope)`,
`remove(ref, scope)`, `dismiss(ref)`, `link(ref, sessionId)`, `get(ref)`, `occurrences(range)`, `due()`,
`next()`, `check()`, `onChange(fn)` (the due set changed with time), `onTick(fn)`, `setTicker`, `setSeed`,
`dispose()` (`ref = { scheduleId, date }`). It ticks while any schedule exists (main gives it the widget's
Web Worker ticker) and emits `schedule:due` once per occurrence per page.

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
Automatic focus watering (ADR 0153): `focusWateringTimes(seed, focusTotalMs)` (focused-time offsets,
seeded 4–10 min apart, none in the last minute), `dueFocusWaterings(s, now)`, `nextFocusWateringIn(s, now)`.
Also: `sessionPhase(state, now)` (of the active session) → `'idle' | 'focus' | 'break' | 'paused'`, `remainingMs`, `progress`,
`growth`, `pausedFor`, `isLongPause` (≥ 30 min), `completionTime`, `blockStartMs`, `clampGoalMinutes`
(10–180, step 5), `normalizeTaskName` (≤ 40 chars, empty → "Study session"), `pickWeather(rng)`
(sun .6 / rain .25 / mist .15), `formatClock(ms)`. Tiers: `tierForMinutes`, `selectableSpecies`
(`core/rewards.ts`).

### Session controller (`src/core/controller.ts`, ADRs 0032, 0036, 0150–0153)
`createSessionController({ store, clock, bus, species, slots?, ticker?, seed? })` is the **single
API the UI and widget use**: `start({ taskName, goalMinutes, planId?, speciesId, slotId }) => boolean`
(the new session becomes active; the active one waits), `pause()`, `resume()`, `switchTo(id)`,
`water()`, `skipBreak()`, `cancel(id?)`, `check()`, `nextFocusWatering()`, `recommendPlans(min)`,
`selectableSpecies(min) => { species, locked, requiredMinutes, earned }[]`,
`placementOptions(speciesId) => { slot, occupiedBy? }[]` (held slots left out), `retireTip(id)`,
`updateSettings(patch)`, `announceFauna(id)`,
`status() => { phase, session, timeline, pausedForMs, longPause, sessions, canStart, maxSessions }`
(`sessions`: every session in progress, oldest first, as `{ session, timeline, active, running,
pausedForMs, lastLeft }`; `phase`/`session`/`timeline`/`longPause` are the active session's),
`onTick(fn)`, `setTicker(t)`, `setSeed(s)`, `dispose()`. The action methods (`pause` … `announceFauna`)
return `boolean` (false = nothing changed). It supplies time/ids/seeds/weather, emits the bus events
(including block transitions of the active session and the automatic focus watering), completes due
sessions on every tick and once at creation (closed-app completion), and retires tips automatically.
It ticks **only while an active session exists** (waiting ones are paused).
`Ticker = { start(tick): stop }` (default `createIntervalTicker`, 1 s). Full table in
`docs/systems/core.md`.

### Persistence (`src/core/persistence.ts`, ADRs 0033–0034, 0154)
Key `studysprout:v1` (stable; the document's `version` drives `MIGRATIONS`). Schema v2;
`MIGRATIONS = { 1: migrateV1toV2 }` (the v1 session stays the active one, `waiting: []`, `log`
back-filled from the plants). `loadState(storage,
now, opts)` never throws (`fresh | loaded | migrated | recovered | unavailable`; corrupt data is
copied to `studysprout:corrupt:<ts>`). `createSaver(storage)` debounces saves (300 ms; `main.ts`
flushes on `pagehide` and when the page becomes hidden). `exportState`/`exportFileName`/`importState` (typed errors; unknown species
kept and flagged).

### Events (`src/core/events.ts`)
`session:start | session:pause | session:resume | session:switch | session:cancel | session:break |
session:focus | session:water | session:complete | plant:placed | plant:swapped | fauna:arrived |
tip:retired | settings:changed | schedule:due`. Payloads are typed in `EventMap`: `'session:break' | 'session:focus':
{ blockIndex, sessionId }`, `'session:water': { blockIndex, sessionId, auto }` (`auto`: the automatic
focus watering, ADR 0153), `'session:start': { session, pausedId? }` (`pausedId`: the session that now
waits), `'session:pause': { sessionId, at, reason? }` (`'user'` or `'switch'`), `'session:resume' |
'session:cancel': { sessionId, at }`, `'session:switch': { from, to, at }` (after the pause/resume it
implies; `from` null when nothing was active), `'session:complete': { sessionId, plant }`, `'plant:placed': { plant }`
and `'plant:swapped': { plant, removed }` (both on completion; swapped first), `'fauna:arrived': { id }`,
`'tip:retired': { id }`, `'settings:changed': { settings }`, `'schedule:due': { occurrence }` (an
`OccurrenceView` whose time has come, from the scheduler's tick, ADR 0172). `fauna:arrived` is emitted by the fauna
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
ms per frame and rAF intervals over the last 600 frames), `resetFrameStats()`, `mute({ systemId: layers[] | '*' })`
(leave out what systems draw, to isolate a layer in a probe or a pixel test; `mute({})` restores).

Core logic (`src/dev/core-debug.ts`): `reset()`, `seed(n)`, `start(min?, { taskName?, planId?,
speciesId?, slotId? })` (`min` defaults to `settings.lastGoalMinutes`; returns the session or null;
with others in progress the new one becomes active, null at the limit), `startSessions(n, min?, gapMs?)`
(ids), `sessions()` (every session in progress: id, task, species, slot, active, running, elapsedMs,
totalRemainingMs, growth, pausedAt, focusWaterings), `switchTo(id)`, `log()`, `nextFocusWatering()`,
`focusWater()` (jump to the next automatic watering and play it),
`pause()`, `resume()`, `water()`, `skipBreak()`, `cancel(id?)`, `toBreak()`, `skipToBlock(i)`,
`completeSession()` (these jump the dev clock), `plans(min)`, `selectableSpecies(min)`,
`placementOptions(speciesId?)`, `addPlants(n, tier?)` (finished plants with task names),
`setState(partial)` (validated), `status()`, `flush()`, `exportState()`, `importState(json)`.

Scene (`src/scene/debug.ts`): `slots()`, `sceneStats()` (paints, rescales, per-step timings),
`scenePainted()` (resolves when no background repaint is pending), `skyStats()` (daylight sky plates painted,
composites, paint ms, the detail composite), `sceneDetail()` (the camera's detail painting: view,
painting, fade, extension). `?dev&slots` draws the slot overlay.

Plants (`src/plants/debug.ts`): `plantsReady()` (resolves once the plant system has picked up the
latest store change, every sprite the garden needs is
painted and new plants have faded in, without snapping growth or blooms — use before screenshots,
ADR 0149) and `window.sprout.plants` —
`state()` (each finished plant with `shown` 0…1), `settle()` (snap growth/fades and resolve once their sprites are painted), `whenIdle()`,
`bounds(plantId)`, `boundsFor(speciesId, slotId)`, `toDevice(rect)` (the camera's view), `hitTest(world,
tolerance?)` (front-most painted plant), `perf()`, `resetPerf()`, `ambienceWind()`.

Camera (`src/dev/camera-debug.ts`): `window.sprout.camera` — `state()`, `focusSlot(id)`,
`focusPlant(id)`, `zoomTo(z, about?)`, `glideTo(pose)`, `overview()` (each `{ animate: false }` to
cut), `settle()` (finish the glide and wait for the resting view's detail), `autoFocus(on)` (follow
session starts/switches; tests that read the overview pin it), `toClient(world)`, `openCard(id)`,
`closeCard()`.

Ambience (`src/ambience/dev.ts`): `setTime('sunrise'|'midday'|'sunset'|'night'|{ from, to, t }|hour|null)`
(v1 names `morning`, `noon`, `evening`, `dusk`, `dawn` kept as aliases), `daylight()` (phase weights, sun,
moon, shadow, rim, location, sun times),
`setWeather('sun'|'rain'|'mist'|null)` (preview without a session), `settleAmbience()` (jump
transitions to steady state), `ambience()` (phase, levels, daylight phase and weights, particle counts, ms/frame),
`lightDetail()` (the light plate's detail for the camera's resting view: rect, scale, ready).
`setTime` moves the shared daylight: sky, light, shadows, rims and fauna's night (`fauna.setHour` still pins an
hour for fauna; audio keeps the real clock).

Fauna (`src/fauna/dev.ts`, installed by `createFauna({ debug })`): `window.sprout.fauna` —
`kinds()`, `spawn(id, count?)` (returns creature ids), `list()`, `clear()`, `step(seconds, dt?)`,
`setHour(h)`, `night()`, `roster()`, `schedule()`, `pond()`, `view()`, `targets()`, `bench(frames?)`,
`art()` (parts' resolution, parts waiting to be painted sharper, parts painted), `settleArt()` (paint them
now) (docs/systems/fauna.md).

Schedules (`src/dev/schedule-debug.ts`): `window.sprout.schedule` — `add(input?)`, `list()`,
`occurrences(from?, to?)`, `due()`, `get(key)`, `jumpToDue(scheduleId?)`, `jumpPast(key)`, `edit(key, edit,
scope?)`, `remove(key, scope?)`, `check()`, `fillHistory(days?, seed?)`, `demo(opts?)`; `window.sprout.calendar`
— `state()`, `setView(view)`, `go(date)` (docs/systems/calendar.md).

Widget (`src/widget/dev.ts`, `installWidgetDebug`): `window.sprout.widget` — `supported()`,
`isOpen()`, `open()`, `close()`, `tickerMode()`, `title()`, `favicon()`, `bloomed()`,
`lastNotification()`, `mountHarness()` (the floating card in `iframe#sprout-widget-harness`),
`closeHarness()`, `harnessMode()`, `harnessWatering()`.

UI (`src/dev/ui-debug.ts`): `window.sprout.ui` — `state()` (`UIState`: mode, panel, pill, plantView,
sessions, pillMore, pillAside, confirm, resting, dialogs, tips, markers, line, plantLabel, plantCard,
draft, calendar, due, scheduleSheet), `refresh()`, `setTimeScale(n)`,
`placement()`, `showPlantLabel(world)`, `slotScreen(id)` (client pixels: stage offset and scroll
included), `scroll()`, `scrollTo(y | sectionId, { instant? })`, `dock()`, `dockReady()`,
`wayfinding({ layout? })` (the guiding path's stops and centre line in client coordinates, the stop
being read, draw state, layout count), `setSectionHidden(id, hidden)`,
`waterPlantView()`, `onZoomGesture(fn)`, `widget` (fake only); `window.sprout.advance(ms)`,
`window.sprout.advanceTo('HH:MM')` (forward to the next local time of day; `E2E_CLOCK=HH:MM` makes
every e2e page do it on open, docs/TESTING.md).
Query flags: `?fixtures` (dev `fx-*` species, ADR 0055), `?uitime=0.05` (UI delays),
`?widget=fake`.

## UI (`src/ui/`, ADRs 0050–0055, 0121, 0124, 0130–0136, 0156, 0164–0168, 0175–0177, 0180–0181, 0190–0194, 0200–0205)
`createUI({ root, stage?, controller, store, bus, clock, getSpecies, slots, viewport, audio?, widget?,
notifications?, isKnownSpecies?, reducedMotion?, timeScale?, schedules?, camera? })` → `{ dock, stage, scroll, plantView, wayfinding,
calendar, camera, placement: { current(), subscribe(fn) }, state(), refresh(), setTimeScale(), showPlantLabel(),
dispose() }`. With `camera` (`{ camera: renderer.camera, hitTest: plants.hitTest }`) it adds the zoom
gestures and chips, the focus on the growing plant and the plant card (`src/ui/stage-camera.ts`,
`src/ui/plant-card.ts`; ADRs 0164, 0167, 0168); `ui.camera` is then `{ openCard(id), closeCard(),
setAutoFocus(on), state() }`, else null. With `schedules` (the scheduler) it fills the Calendar section, mounts the waiting card
and links a session started from a schedule (ADRs 0173–0177); `calendar` is then `{ state(),
setView(view), go(date) }`, else null. DOM only, drives the app through the controller. `root` is the page (`#ui`), `stage`
the element holding the canvas (default: `root`'s `.stage`). `viewport` is a function returning the
renderer's current `Viewport`. `widget` is the `WidgetIntegration` (`{ supported, open(), isOpen(), onChange?() }`,
satisfied by `surfaces.widget`). `main.ts` passes no `notifications`: the widget surfaces ask for
permission inside `session:start`.
`ui.placement.subscribe` gives the placement markers (world units); `main.ts` connects it to the
plant system (`plants.connectPlacement(ui.placement)`) for the in-canvas highlight (ADR 0117).
Plant labels hit-test with `plantWorldBounds` (`src/plants/bounds.ts`). The DOM slips follow the
garden's light: `main.ts` subscribes `applyUiLight` to `ambience.onLight` once the painting is ready
(ADR 0121). Details: `docs/systems/ui.md`.

## Page, stage and dock (`src/ui/`, ADRs 0130–0135, 0200–0203)
The page scrolls as a document. `index.html`: `#ui` > `section#stage` > `canvas#garden`; `createUI`
adds the stage overlay and puts the dock after the stage.

**Stage** — `ui.stage = { el, onZoomGesture(fn) => unsubscribe }`. Things on the painting live in
`.stage-ui` (absolute, viewport CSS pixels). ctrl/⌘ + wheel over the stage (trackpad pinch arrives
so) never scrolls the page; with a zoom handler registered it gets the event (default prevented),
otherwise the browser zooms the page as usual (the camera registers one: ctrl/⌘ + wheel zooms the
garden). One-finger touch scrolls the page natively at the overview (`touch-action: pan-x pan-y`
on the canvas, so a two-finger pinch reaches the camera); zoomed in it is `none` and a finger pans
the painting (ADR 0164).
The canvas edge dissolves into the page's paper through a CSS mask (ADR 0132).

**Dock** — `ui.dock` (`src/ui/dock.ts`), the contract for features below the garden:
```ts
interface DockSectionDef { id: string /* kebab-case, unique */; title: string; helper?: string /* ADR 0201 */;
  order?: number /* default 100 */; span?: 'half' | 'full' /* kept; every section takes the row since ADR 0200 */;
  backdrop?: 'leaf' | 'firm' | 'none' /* the sheet behind the section, default 'leaf'; ADR 0208 */;
  mount?(body: HTMLElement, section: DockSection): void | (() => void) }
interface DockSection { id; el /* <section data-section=id> */; body; heading /* h2#dock-<id>, tabindex -1 */;
  helper /* p.dock-helper#dock-<id>-helper, describes the section */; backdrop /* Backdrop | null */;
  setTitle(t); setHelper(t | null); setHidden(b) }
interface Dock { el; addSection(def): DockSection /* throws on duplicate/malformed id */; fill(id, mount): DockSection;
  removeSection(id); get(id): DockSection | null; sections(): DockSectionInfo[]; onChange(fn): () => void; dispose() }
interface DockSectionInfo { id; title; helper: string | null; order; span; filled: boolean; visible: boolean }
```
`createDock({ label? })` builds it (`createUI` does; `ui.dock` is the instance). Markup:
`section > header.dock-head > (h2.dock-title, p.dock-helper)` then `div.dock-body`.
Order: by `order`, then registration (`orderSections(list)`, pure). A section without `mount` is a hidden placeholder until
Markup: `section > div.backdrop[aria-hidden]` (the sheet, behind), `header.dock-head > (h2.dock-title,
p.dock-helper)`, then `div.dock-body`. Each section lies on its own sheet of washi (ADR 0208): the
section's padding is the sheet's margin, the heading sits on the sheet, and the path's lane stays
outside its left edge. The sheet is drawn for the section's size and again only when that changes.
Order: by `order`, then registration. A section without `mount` is a hidden placeholder until
`fill`. Registered by the UI: `session` "Study" (10; the waiting cards of due scheduled sessions,
the controls, then the sessions in progress, ADRs 0156, 0176), `plant` "Your plant" (20), `calendar`
"Calendar" (30, full; a placeholder filled by the calendar when `createUI` has a scheduler, ADR 0175),
`tools` "Garden tools" (90, full). The calendar's sheet is `firm`, the others `leaf`. One reading spine at every width (ADR 0200): each section
takes the row, in order, on one left edge; wide screens may set two tracks inside a section
(`--dock-main` / `--dock-aside`). The UI keeps the helper lines current from `ui/dock-guide.ts`: pure
`guideLines(input) => { session, plant, calendar, tools }` over a `GuideInput` (panel, confirming, due,
sessions, watered, plant, calendar view), the copy in `GUIDE` (ADR 0201).

**Guiding path** — `ui/wayfinding.ts` (`createWayfinding({ dock, stage, viewport, reducedMotion })`,
ADR 0202), with pure geometry in `ui/wayfinding-path.ts` (`layoutPath`, `brushOutline`,
`stonePath`, `centrePath`, `pointsInBoxes`, `CLEARANCE`). It hooks into the dock registry only: an `svg.wayfinding` as the dock's first child,
one stop per **visible** `dock.sections()` entry, measured at its `heading`. It lays out again
(once per frame) on `dock.onChange`, on ResizeObserver changes of the dock, the stage and every
section and heading, and on window resize. A section added later gets its stop with no change
here. The line starts where the stepping stones (`scene/geometry` `PATH`, through the renderer's
viewport) leave the stage. Widths differ only in custom properties on `.dock`: `--lane`,
`--stop-gap`, `--path-sway`, `--path-rise`, `--path-width`, `--stop-size`. `ui.wayfinding =
{ state(), layout() }`.

**Scroll** — `ui.scroll = { state(): { y, max, target, animating, smooth }, to(y | sectionId, { instant? }) }`
(ADR 0131). Wheel and arrow keys ease, page keys/Home/End/jumps glide, touch is native, reduced
motion lands at once; native scrolls are adopted. The custom scrollbar is `aria-hidden` decoration.

**Calendar** — `ui/calendar.ts` in the `calendar` section (ADR 0175): Daily (default) / Weekly /
Monthly, remembered per viewer (`localStorage` `studysprout:calendar-view`); the pure range, item,
overlap-layout and month-mark maths live in `ui/calendar-model.ts`. The schedule editor is the
`schedule` sheet (`ui/schedule-sheet.ts`, ADR 0177); the waiting card and its slip by the pill (under it on wide screens, ADR 0203) are
`ui/schedule-card.ts` (ADR 0176). Details: `docs/systems/calendar.md`.

**Plant view** — `ui.plantView = { water(): boolean, state() }` (ADR 0134). It shows the active
session's plant and plays on every `session:water` bus event for it — the tap in a break and the
automatic focus watering (`auto: true`, ADR 0153).

## Timer surfaces (`src/widget/`, ADRs 0090–0094)
`createTimerSurfaces({ controller, store, bus, clock, win?, notificationEnv?, openHost? })` →
`{ widget: { supported, open(), isOpen(), close(), onChange(fn), dispose() },
requestPermissionFromGesture(), dispose(), internals }` (`internals` = ticker, tab, notifier, widget
for the dev hooks; `main.ts` also gives `internals.ticker` to the scheduler, ADR 0174). It installs a Web Worker
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
(start paused), `?scale=2`, `?bg=paper|white|dark`. Cards paint lazily, near the screen and within a
frame budget (ADR 0006). `window.studio` = `{ ready, entries, errors, renders(), pause(), setT(t),
settle(), pending() }` for tests and screenshots: `settle()` paints every shown card and keeps it
painted (await it before reading pixels), `pending()` counts shown cards not yet painted. All species automatically get a section
(growth stages + grow loop) from `src/plants/species.studio.ts`. See `docs/systems/studio.md`.

## Conventions
- Pure logic in `core/` must have unit tests. Rendering code is verified with screenshots.
- No `Date.now()`/`Math.random()` outside `core/clock.ts`/`core/rng.ts` — everything seeded.
- Each system documents itself in `docs/systems/<name>.md`.
- Every sprite, creature, effect and paint primitive has a studio entry in a colocated `*.studio.ts`.
