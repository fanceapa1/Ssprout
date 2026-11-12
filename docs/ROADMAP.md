# Roadmap & task ownership

The project is built by an orchestrator delegating to agents working in parallel git
worktrees (max 2 concurrent from phase 5 on). **Only the orchestrator edits this file** (agents report status in their devlog).

ADR numbering ranges (to avoid collisions in parallel work):
0001–0009 orchestrator · 0010–0019 foundation · 0020–0029 paint · 0030–0039 core logic ·
0040–0049 scene · 0050–0059 UI · 0060–0069 plants (0060–0063 A, 0064–0066 B, 0067–0069 C) ·
0070–0079 fauna · 0080–0089 ambience/lighting · 0090–0099 widget/notifications ·
0100–0109 audio · 0110–0119 plant view/growth/watering · 0120–0129 integration/polish ·
0130–0139 app shell & dock · 0140–0149 daylight & colour · 0150–0159 parallel sessions & watering ·
0160–0169 camera & plant descriptions · 0170–0179 calendar & scheduling · 0180–0189 v2 polish 1 & close views ·
0190–0194 v2 polish 2 · 0200–0204 dock wayfinding · 0205+ queue tasks (Q1 0205, Q2 0206, Q3 0207, Q11 0208–0209, Q13 0210) · 0220–0239 performance (phase 9, one block of numbers per task) · 0240–0259 sceneries (phase 10) · 0260–0279 accounts (phase 11, branch `feat/accounts`) · 0250–0259 per-scenery flora and fauna (phase 12; S11 keeps 0248) · 0280–0299 phase 12 art tasks (only for real decisions) · 0300–0329 phase 13 (the oasis) · 0330–0359 phase 14 (optimization pass) · 0360–0389 phase 15 (the Greek coast; devlogs 170–219).

| Phase | Task | Area (owned paths) | Status |
|---|---|---|---|
| 1 | Foundation: repo, tooling, CI/Pages, render skeleton, contracts, studio page | root config, `src/render`, `src/studio`, `src/main.ts` | done |
| 2 | Watercolour paint engine + studio entries | `src/paint` | done |
| 2 | Core logic (sessions, plans, state, persistence, unlocks, tips, controller), revised for plant-at-start (ADR 0003) | `src/core`, `src/dev/core-debug.ts` | done |
| 2 | Procedural audio | `src/audio` | done |
| 3 | Painted landscape scene + geometry + slots + water animation | `src/scene` | done |
| 3 | UI: planting sheet, session panel, watering, placement, menu, tips, herbarium | `src/ui`, `tests/e2e` | done |
| 3 | Floating widget (PiP), title/favicon, notifications, worker ticker | `src/widget`, `src/plants/view.ts` (stub) | done |
| 3 | **First playable → deploy to Pages** | — | done |
| 4 | Plant species A: tiers 1–2 (13) | `src/plants/species/*`, `src/plants/lib/small-*` | done |
| 4 | Plant species B: tier 3 (6) | `src/plants/species/*`, `src/plants/lib/shrub-*` | done |
| 4 | Plant species C: tier 4 trees (6) | `src/plants/species/*`, `src/plants/lib/tree-*` | done |
| 4 | Plant system: garden sprites, live growth, wither, painted watering animation, reflections, hover labels | `src/plants/{view,sprites,system}.ts` | done |
| 4 | Fauna | `src/fauna` | done |
| 4 | Ambience (weather, motes) + time-of-day lighting | `src/ambience` | done |
| 5 | Polish: mobile, reduced motion, tooltips pass, art review loop | `src/**` | done |
| 5 | QA: requirements→tests matrix, gap tests, flakiness, docs audit, README | `tests/**`, `docs/**` | done |

## v2 — app around the garden (ADR 0005)

| Phase | Task | Area (owned paths) | Status |
|---|---|---|---|
| 6 | App shell: scrollable page, top margin, ~88 vh garden stage fading into the UI dock, custom smooth scroll + scrollbar, section dock, controls moved below + canvas timer pill, plant view section, redesigned + duplicated tool icons, bigger/contrastier type | `index.html`, `src/style.css`, `src/ui/**`, `src/render/viewport.ts`, `tests/e2e/ui-*` | done |
| 6 | Daylight & colour: solar times from timezone, 4 painted phases (sunrise, midday, sunset, night), more saturated pigments and species, plants 1.25×, slot spacing | `src/ambience/**`, `src/scene/**`, `src/paint/pigments.ts`, `src/plants/**` (scale, palettes) | done |
| 7 | Parallel sessions (≤ 3, one active, switch pauses) + session log + v1→v2 migration + automatic focus watering every 4–10 min | `src/core/**`, `src/widget/**`, `src/plants/system.ts`, dock session switcher | done |
| 7 | Camera: focus zoom on start / click, gentle pinch/ctrl-wheel zoom and pan, Whole-garden control, sharp sprites when zoomed, plant description card (species notes for every species) | `src/render/**` (camera), `src/plants/**` (hit-test, notes), `src/ui/plant-card*` | done |
| 8 | Calendar & scheduling: day/week/month (default day), history + scheduled sessions, one-off/daily/weekdays/weekly repeats, notify + one-tap prefilled start, missed state | `src/core/schedule*`, `src/ui/calendar*` | done |
| 8 | v2 polish 1: resting icon visibility, tips on scroll, watering sound, midday sky, night margins, calendar week layout, plant-view wash, widget type, fresh-eyes pass | `src/ui/**` (not camera), `src/audio`, `src/ambience`, `src/scene`, `src/widget` | done |
| 8 | Close-view art: seams, foreground detail, sprite opacity and soft fauna at 2–3× zoom | `src/render/**`, `src/plants/**`, `src/scene/**` detail, `src/fauna/**` | done |
| 8 | v2 polish 2: plant card on phones, calendar day view follows now, planting sheet edge, schedule input locale, sun-shaft weather | `src/ui/**`, `src/ambience` weather | done |
| 8 | Dock wayfinding: a hand-inked path flowing from the garden's stepping stones through the dock sections in order, clearer hierarchy/alignment, short helper lines; responsive (owner: "only if responsive without too much hassle") | `src/ui/**` | done |


Task queue (atomic tasks, at most 2 agents at a time; owner feedback 2026-10-23: split work as if there were more agents, never bundle requests into one agent):

| # | Task | Area | Status |
|---|---|---|---|
| Q1 | Lotus plantable again after the 1.25× slot changes (real flow + plantable test) | `src/scene/slots.ts`, `src/plants` | done (already plantable; dead end when both spots are held fixed, ADR 0205) |
| Q2 | Night zoom artefact: a pale hard-edged rectangle and a clipped sprite at zoom 3 | `src/render`, `src/scene`, `src/ambience` | done (ADR 0206) |
| Q2b | Restore the night's depth after ADR 0206 lightened thin paint (tune the night grade, not the grey) | `src/ambience` | done |
| Q3 | Frame cost at rest while zoomed (20–47 ms headless at 2.6×, 30 plants) | `src/render`, `src/plants` | done (GPU ~2 ms; CPU raster 31–33 ms, ADR 0207) |
| Q4 | "Growing now" list order is nondeterministic | `src/ui/session-list*`, `src/core` | done (with wayfinding, ADRs 0200–0204) |
| Q5 | Seedling at growth ≈ 0 reads as empty in thumbnails / Your plant | `src/plants/view.ts` | done (with wayfinding, ADRs 0200–0204) |
| Q6 | Hover / focus / press states for every UI control (owner request) | `src/ui/**` CSS | done (with wayfinding, ADRs 0200–0204) |
| Q7 | The two "Start studying" buttons sit too close: new placement for the garden pill (owner request) | `src/ui/**` | done (with wayfinding, ADRs 0200–0204) |
| Q8 | v2 acceptance: owner requests → tests, TESTING matrix gaps | `tests/**`, `docs/TESTING.md` | done (41 rows; after Q8a/Q8b: 38 ✔, 3 ◐, 0 ✘) |
| Q8a | Long pause: Resume keeps its vermilion seal beside a due card's Start (two primaries) | `src/ui/timer-panel.ts` | done |
| Q8b | Keyboard focus lacks the hover lift on dock tools and the sheet's plan/plant cards (ADR 0204) | `src/ui/hover.css` | done |
| Q9 | Docs audit: SPEC/ARCHITECTURE/AGENTS/README vs code | `docs/**`, `README.md`, `AGENTS.md` | done |
| Q9a | Time-of-day dependent e2e failures: `calendar.spec.ts:702`, `marks.spec.ts:41` fail on main around 17:00 | `tests/e2e` | done (E2E_CLOCK, sprout.advanceTo) |
| Q13 | Calendar day view: opens an hour off on a DST day (25 Oct), and stops following now if redrawn mid-glide (TESTING open gaps 7, 8) | `src/ui/calendar*` | done (ADR 0210) |
| Q14 | Planting sheet: a keyboard-focused card can sit under the sticky footer (scroll-padding) | `src/ui/**` | done |
| Q11 | **Priority (owner):** a painted backdrop for each dock section, the calendar most of all | `src/ui/**` | done (ADR 0208) |
| Q12 | **Owner:** a small × on each tooltip to dismiss it (dismissed = retired, still listed under ⓘ) | `src/ui/tips*`, `src/core/tips.ts` | done (ADR 0211) |
| Q15 | Audio weather follows the active session (`session:switch`); ending a waiting session must not silence the active one | `src/audio` | done |
| Q16 | Favicon/notification icon: replace the unseen-bloom round dot with the inked sprout (ADR 0194) | `src/widget/favicon.ts` | done |
| Q17 | **Owner:** garden stage 7 % taller (≈ 88 → 94 vh), so more sky shows above the hills | `src/ui` stage CSS, viewport tests | done (ADR 0212) |
| PR1 | Collaborator PR #1 (soniaspn): standard / scenery sound mixes, schema v3; rebased and merged | `src/audio`, `src/core` | done (ADR 0213, devlog 40) |
| Q10 | Flakiness: three consecutive green e2e runs, root-cause fixes | `tests/**` | done (3 × 230/230, plus 17:00 and 00:30) |

Phase 9: performance (owner request 2026-10-24). The page is laggy. Draw only what is visible, load in smaller async pieces with the garden layout first, use the browser cache and preloading (this should remove the delay on "Start studying"), and add any other optimisation that takes nothing away from the app. Measure first, then split the work into atomic tasks.

| # | Task | Area | Status |
|---|---|---|---|
| P0a | Measure: runtime load profile, Start-studying latency, frame cost overview/zoomed/scrolled away | read-only (scratch report) | done (garden pixels at 1.8 s, ~630 ms of off-screen work before them; Start studying 648 ms; Begin 216 ms + ~600 ms detail repaint; canvas renders while scrolled away) |
| P0b | Measure: bundle composition, fonts, request waterfall, cache headers, service-worker and painted-cache options | read-only (scratch report) | done (Start studying: a 640 ms main-thread block painting 25 previews; landscape 1.2 s of main-thread paint on every load; Pages max-age=600 revalidation chain) |
| P1 | Plant-view preview prewarm: worker-backed view cache, `prewarmPlantView`, never paint a queued preview synchronously | `src/plants/view.ts`, `src/plants/sprites.ts` | done (worker-painted previews pixel-identical, `prewarmPlantView`, `drawPlantView` pending state; ADRs 0220–0221) |
| P0c | Perf harness in the repo: port the scratch measurement scripts (load, flow, frames, bundle, Pages-like server) to `scripts/perf/`, record the baseline in `docs/systems/performance.md` | `scripts/perf/`, `docs/systems/performance.md`, `package.json` script | queued |
| P2 | Planting sheet opens at once; previews fill in as they land (visible first), prewarmed on idle and on hover/focus of Start studying | `src/ui/planting-sheet.ts`, `src/ui/previews.ts` | done (first-open click 688 → 85–102 ms, no main-thread preview paints; ADR 0222) |
| P3 | Dock backdrop noise: build each tear once per seed, cheap edge noise, identical SVG output | `src/ui/backdrop-sheet.ts` | done (86 → 9 ms first layout, 78 → 4 ms per resize, SVG byte-identical; ADR 0223) |
| P4 | Pause the render loop while the garden stage is scrolled out of view | `src/render/renderer.ts`, `src/main.ts` (1–2 lines) | done (0 garden frames while scrolled away; sessions, widget and audio unaffected; ADR 0224) |
| P5 | Defer below-the-fold dock painting (plant section, backdrops, wayfinding) until after the garden's first pixels and until near the viewport; no synchronous plant-section paint on Begin | `src/ui/plant-section.ts`, `src/ui/backdrop.ts`, `src/ui/index.ts` | done (dock script before the garden ~145 → ~1 ms, FCP 889 → 729 ms, Begin click 133–144 → 30–32 ms processing; ADR 0225) |
| P6 | Split long scene paint steps so the cooperative painter yields every ~20 ms (load and close-view detail repaint) | `src/scene/background.ts`, `src/scene/paint-*.ts`, `src/scene/sprites.ts` | done, partly (longest part at load 192–233 → 103–128 ms, big-tree detail 305–346 → 34–38 ms, pixel-identical; the rest are single paint-engine calls, see P23; ADR 0226) |
| P7 | Persistent paint cache module: IndexedDB blob store, versioned keys, LRU byte cap, null adapter | `src/paint/persist.ts` (new), `vite.config.ts` define | done (IndexedDB `studysprout-paint`, 48 MB LRU, build-time paint version over the painters' import closure, bit-exact round trip; ADR 0227) |
| P8 | Garden background from the persistent cache: a repeat visit shows the landscape without repainting it | `src/scene/system.ts`, `src/scene/background.ts` | done (repeat visit: landscape 1.6 → 0.5 s, 0 scene paint CPU, pixel-identical; close views cached too; ADR 0228) |
| P9 | Service worker build manifest (precache list and version written into `dist/sw.js`) | `vite.config.ts` plugin, `scripts/` | done (18 URLs, ~619 kB gz, version over the URL list and index.html; ADR 0229) |
| P10 | Service worker caching: precache, cache-first hashed assets, network-first HTML, old-version cleanup; notifications untouched | `public/sw.js` | done (versioned precache, cache-first assets, network-first HTML with offline fallback, keeps the previous version; ADR 0230) |
| P11 | Service worker registered at boot (idle, after the landscape); e2e blocks service workers by default, `sw.spec.ts` | `src/widget/notifications.ts`, `src/main.ts` (1 line), `playwright.config.ts`, `tests/e2e/sw.spec.ts` | done (registered after the first paint, load and idle; e2e blocks service workers unless opted in; reload once on a stale chunk; ADR 0230 amended) |
| P12 | Fonts start loading before boot (preload/`document.fonts.load` of the 5 first-view files), one wave | `index.html` or `vite.config.ts`, `src/ui/index.ts` font imports | done (owner kept the preload: no fallback text or reflow; slow 4G first visit +370 ms; ADR 0231) |
| P13 | Font trim (owner: Latin only): own `@font-face` for Latin + Latin-ext woff2, only the weights used, no woff | `src/ui/fonts.css` (new), `src/widget/index.ts` imports | done (54 → 12 font files, 31 → 12 rules, first view 5 → 3 files, 117 → 76 kB; screenshots identical; ADR 0239) |
| P14 | Boot in stages, garden first: paper and scene start painting before plants, fauna, ambience and the dock; ambience sprites built per phase on first use | `src/main.ts`, `src/ambience/sprites.ts`, `src/ambience/ambience.ts` | done (FCP 430 → 260 ms; landscape first visit 1653 → 1403 ms, repeat 523 → 308 ms; plants and the dock wait for it; ADR 0232) |
| P15 | The `?dev` API is loaded only with `?dev` (dynamic import, atomic `window.sprout`) | `src/main.ts`, `src/dev/install.ts` (new) | queued (ADR 0233) |
| P16 | Lazy chunks for what is not visible, one task each: a fauna · b audio · c PiP art · d sheets and cards · e calendar; prefetched on idle; reload-once on a stale chunk | per sub-task | queued (ADR 0234) |
| P17 | Idle callbacks respect their deadline (sky next-phase, cast prepare, sprite `runIdle`) | `src/scene/sky-light.ts`, `src/scene/system.ts`, `src/ambience/cast.ts` | queued (ADR 0235) |
| P18 | Sky and light plates from the persistent cache | `src/scene/sky-light.ts`, `src/ambience/lighting.ts` | done (repeat visit: no plate painted, FCP 238–256 → 160–163 ms, busy before the landscape 366–381 → 248–265 ms; pixel-identical; +2 MB; ADR 0236) |
| P19 | Spike, then build if it pays: scene painting in a worker (OffscreenCanvas) | `src/scene/*`, worker | queued (ADR 0237) |
| P20 | Scroll path: tips, format and wayfinding read layout once per frame | `src/ui/tips.ts`, `src/ui/format.ts`, `src/ui/wayfinding.ts` | queued |
| P21 | Planting sheet layout off the click: the remaining ~75 ms first-open cost is `showModal` layout (content-visibility for off-screen cards, or lay the sheet out during the idle prewarm) | `src/ui/planting-sheet.ts`, `src/ui/ui.css` | queued |
| P22 | Herbarium previews through the worker (still painted synchronously on open) | `src/ui/herbarium*` | queued |
| P23 | Paint engine yields inside its long single calls: `WetLayer.dry` and the water/sky/bank recipes pause between row bands, same pixels (finishes P6) | `src/paint/wet.ts`, `src/paint/recipes*` | done (longest scene part at load 69–146 → 15–18 ms at 1×, 308 → 65 ms at 4×; pixel-identical; ADR 0238) |
| P24 | Remaining UI work before the garden's first pixels: page paper, stage edge mask, paper grain, the calendar's first render; "Growing now" thumbnails through the plant-view worker | `src/ui/page*`, `src/ui/stage*`, `src/ui/calendar*`, `src/ui/session-list*` | queued |
| P25 | Open the paint cache's IndexedDB store at the very start of boot (the lookup takes ~300 ms while boot holds the main thread) | `src/main.ts` (1–2 lines), `src/paint/persist.ts` | folded into P14 (same file, same boot order) |
| P26 | Flaky under load: `camera.spec.ts` "a session start glides the camera onto its seedling" reads `gliding` after the glide already ended (seen 3× in full runs at load avg 20–40); make the check race-free | `tests/e2e/camera.spec.ts`, `src/dev/camera-debug.ts` | done (glides read from an in-page log, `sprout.camera.glides()`; 40/40 under ×4 throttling) |

Phase 10 (owner request 2026-10-27): land phase 9, then a second scenery, a rocky waterfall in the same watercolour style, switchable from a "Gardens" dock section. Owner decisions: the timeline is shared (sessions, calendar, history and settings), and only plants and spots belong to a garden; a running session keeps growing in its own garden. The scene is full: animated falls and plunge pool, rock ledges and a stream as spots, its own 4 daylight phases, fauna to suit it and a waterfall sound bed. The plantable flowers stay the same for now; shops and achievements come later.

| # | Task | Area | Status |
|---|---|---|---|
| L1 | Land phase 9: CI has failed since P6 because the recorded-canvas hash pins (`src/paint/parts.test.ts`, `src/scene/paint-slices.test.ts`) differ between macOS and CI's Linux. Make the pins platform-independent, then get the whole CI (unit + e2e) green so Pages deploys. | `src/paint/*.test.ts`, `src/scene/*.test.ts`, `tests/**`, CI | done (rounded recorded numbers, same-run parity; e2e in 3 CI shards; fauna budget warm-up; devlog 59) |
| S0 | Scenery audit (read-only): everything hard-wired to the Japanese garden, a proposed scenery contract and schema v4, the task split | read-only report | done (contract, schema v4, 17 tasks; owner answers: switching a session follows it to its garden, wildlife unlocks per garden, the waterfall is open to all, weather follows the active session everywhere) |
| PR2 | **Owner:** finish and merge collaborator PR #2 (soniaspn, rename study sessions and garden plants): rebase onto main keeping authorship, renumber its ADR 0240 → 0219 and devlog 59 → the next free number, make CI green, merge | `src/core/state.ts`, `src/core/controller.ts`, `src/ui/plant-card.ts`, `src/ui/timer-panel.ts` | done (rebased with soniaspn's authorship, ADR 0219, devlog 61; phone form scroll fix, ink-line fields, calendar hour pinned; CI green; merged) |
| S1 | Schema v4: plants, pressed flowers, sessions and log entries carry `sceneryId`; `state.scenery` is the garden on view; `scenery/view`; slot uniqueness per scenery; migration from v3; sound levels missing a layer read as 0; controller and dev API take a scenery | `src/core/{state,persistence,controller,placement,fauna-unlocks,soundscape}.ts`, `src/dev/{core-debug,fill-garden,fill-history}.ts`, `src/main.ts` (≤3 lines) | done (`sceneryId` everywhere, `state.scenery` stored, wildlife per garden as `waterfall:<id>`, v1–v3 migrate; ADR 0240) |
| S2 | Scenery contract, with the Japanese garden behind it (pixel-identical): `src/scenery/{types,registry}.ts`, generalised geometry, sky layout, lights, eave, structure, wayfinding origin, viewport focus; paint-cache keys get the scenery id | `src/scenery/**`, `src/scene/{geometry,background,paint-sky,sky-light}.ts`, `src/ambience/{sky-layout,cast,lighting,ambience,index}.ts`, `src/ui/wayfinding.ts`, `src/render/viewport.ts`, `src/paint/paint-version.ts` | done (Japanese garden behind `Scenery`, 0 px difference in 12 frames × 3 canvases; keys carry the scenery id; ADRs 0241–0242) |
| S3 | Runtime switching: `renderer.setScenery` with a snapshot cross-fade, scenery host, per-system swaps, a dev fixture scenery, `sprout.scenery()` | `src/render`, `src/scenery/host.ts`, systems, `src/main.ts` | done (`renderer.setScenery` with a 0.9 s cross-fade, scenery host, plants per garden, a session in the other garden brings it back; UI slots still the garden's, see S5; ADR 0243) |
| S4 | Waterfall geometry and slots (pool, stream, falls, ledges, explicit per-depth scale), habitat words, view focus, sky numbers; behind a dev flag | `src/scenery/waterfall/{geometry,slots,layout,index}.ts` | done (49 slots, every species placeable, lotus 2 pool spots; falls left of centre, open sky to the right; behind `?dev&scenery=waterfall`; ADR 0245); dev flag lifted in S17 |
| S5 | Gardens dock section with painted thumbnails, stage chip, pill offer "go to its garden", per-garden copy | `src/ui/**`, `src/scenery/thumbnail.ts`, `src/main.ts` | done (UI spots and words follow the garden on view, planting in the waterfall end to end, Gardens section with stills, pill "Growing in the waterfall · Go"; thumbnails are camera stills, not painted overviews; ADR 0244) |
| S6 | Waterfall painters: rocks, cliffs, ledges | `src/scenery/waterfall/{paint-rocks,sprites}.ts` | done (strata, wet streaks, moss ledges, own wet and mossy boulders; `SceneArt.rockSprites` hook; devlog 64) |
| S6b | Waterfall rock forms (orchestrator review of S6): the buttress reads as a smooth rounded lump, ledges as flat trays stuck on the wall, the cliff top is nearly level; break the outlines (layout `CLIFF`), soften ledge shadows into the face, give the skyline a stepped broken edge and the gorge more presence; the buttress's right flank reads see-through against the ridge in every phase (S10 review) | `src/scenery/waterfall/{layout,paint-rocks}.ts` | done (devlog 96) |
| S10b | Shared shadows and rim light follow the scenery's sun side (at the waterfall the sun sets on the right, but boulder shadows fall right and rim light comes from the left); a per-scenery field, contract change | `src/ambience`, `src/scenery/types.ts` | done (devlog 97; ADR 0284) |
| S10c | Boulder shadows that fall left tilt ~27° up and away while right-falling ones lie flat (`cast.ts`); now visible at the waterfall's sunset too. Fixing it changes the garden's sunrise plate (S10b devlog) | `src/ambience` | done (devlog 101) |
| S5b | Garden thumbnails painted from each scenery's cached overview instead of camera stills | `src/ui/gardens-section.ts`, `src/scenery/thumbnail.ts` | done (devlog 100; ADR 0285) |
| S7 | Waterfall painters: falls, plunge pool, stream | `src/scenery/waterfall/paint-water.ts` | done (streaked falls on reserved paper, deep cool pool with ripples from the foot, pale stream with riffles; devlog 65) |
| S8 | Waterfall painters: vegetation and moss | `src/scenery/waterfall/paint-veg.ts` | done (far ridge, banks, meadow, crown woods, overhanging trees, ferns, foreground; devlog 67) |
| S9 | Animated falls, foam and spray (still under reduced motion, ≤ 1 ms a frame) | `src/scenery/waterfall/falls.ts` | done (devlog 93; ADR 0282) |
| S10 | Waterfall daylight: 4 sky plates, pool plate, light plates, grades | `src/scenery/waterfall/{sky,light}.ts` | done (4 sky plates cut to the skyline, pool plate, cliff shadows and crown light, moonlit falls at night; ADR 0247) |
| S11 (old) | superseded by the phase 12 S11 row below | — | moved |
| S12 | Iwana char in the plunge pool (renamed from trout: introduced trout are invasive in Japanese headwaters, B0) | `src/fauna/creatures/iwana.ts` | moved to C3 |
| S13 | Dipper on the wet rocks | `src/fauna/creatures/dipper.ts` | moved to C1 |
| S15 | Waterfall sound bed (`falls` layer, roar, rumble, spray hiss, splash events, dipper song) | `src/audio/**`, `src/core/soundscape.ts`, `src/ui/sound-mixer.ts` | done (devlog 94; ADR 0283; needs a human ear) |
| S17 | Acceptance and docs: SPEC, ARCHITECTURE, `docs/systems/scenery.md`, TESTING matrix, a v3 export imports, switch-time numbers, shots of both gardens | `docs/**`, `tests/**` | done (released: available to all; a real v3 export and a two-garden v4 export import; warm switches ready ≤ 0.6 s desktop, cold 2.4–7 s; shots of both gardens; scenery docs audited; ADR index and TESTING gaps restored; devlog 95) |
| S18 | Begin's click forces a full layout (`settleAside` reads `scroller.state()` and rects right after the mode change); `deferred-dock`'s 100 ms limit fails on a busy laptop since the Gardens section joined the dock (passes on CI) | `src/ui/**` | done (devlog 99: Begin 31–36 ms; the paper tile is a blob URL) |
| S19 | On a phone at sunset the waterfall's sun is cut in half by the right edge (S17 shots) | `src/scenery/waterfall/{sky,light}.ts` | done (devlog 98; sunrise and moon still outside a phone frame, by choice) |

Phase 11 (deferred by the owner on 2026-10-28 to a later session; owner request 2026-10-27, branch `feat/accounts`, not merged to main): simple user/password accounts, with progress stored in a database. Local setup only: a Node (Fastify) server, Postgres in Docker. Owner decision: guest mode stays local, and signing up offers to import the local garden.

Phase 12 (owner request 2026-10-31): the waterfall gets its own flora and fauna. Research what grows and lives in such a biome, then create the plants and creatures for it. The plan is about 10 sceneries in the future, each with special plants and fauna. A species can be shared between sceneries where biology and geography allow, but each garden must feel unique. Owner decisions: research chooses the region; about 12 plants and 8 creatures of its own; species are shared by biology. Up to 3 agents at a time, with the same art process (the `drawing-assets` skill).

| # | Task | Area | Status |
|---|---|---|---|
| B0 | Biome research (web, read-only): candidate regions for a rocky waterfall, their flora and fauna, distinctiveness and paintability; a habitat taxonomy for about 10 future sceneries; what is shared with the Japanese garden | scratch report | done (recommended: a Japanese cool-temperate beech-forest mountain gorge, Oirase / Nikkō; 12 plants, 8 creatures; shared by biology: maple, maidenhair fern, violet, wild strawberry, susuki; striders, aka-tombo, swallowtail, bees, wagtail, heron, leaf; a taxonomy of 10 sceneries) |
| B1 | Code audit (read-only): species and creature registries, tiers, habitats and slots, unlocks, studio, tests; a per-scenery availability contract; an "add a species" / "add a creature" recipe | scratch report | done (registry already globbed; plants have no unlock progress, tiers come from session length; no schema change; faunaSeen reader bugs; fitted perspective 7–15 % off at the waterfall; recipes) |
| F1 | Species availability per scenery: a range on each species (realms, biomes, climates, `cultivatedIn`), a biome profile on each scenery plus `also`/`except`, `floraOf`; core, planting sheet, herbarium and dev hooks per garden; flora invariants; `nativeLang` | `src/plants/{types,flora,biomes}.ts`, `species/*.ts` (range line only), `src/scenery`, `src/core/{controller,state}.ts`, `src/dev`, `src/ui/{planting-sheet,herbarium,plant-card,types,index}.ts`, `src/main.ts` | done (garden keeps its 25, the waterfall offers the 5 shared by biology; `floraOf`, `sprout.flora()`; ADR 0250) |
| F2 | Scaffolding so species tasks only add files: notes per species (globbed), family test suites, `species/<id>.test.ts`, line-up studio per scenery, `docs/systems/species-recipe.md`; narrow `PAINT_ROOTS` so art merges stop invalidating cached landscapes | `src/plants/notes*`, `src/plants/lib/*.test.ts`, `src/plants/lib/suites.ts`, review studios, `src/paint/paint-version.ts` | done (notes per file, family suites, 726,075 assertions before and after, line-up studio; art no longer changes the paint version; `docs/systems/species-recipe.md`; ADR 0251) |
| S11 | Wildlife per scenery (scope widened by B1): a creature registry (one default-exported def per file), unlock tables per scenery (the waterfall's 8 rows up front), remove `wild()`, fix the `faunaSeen` readers and `fauna:arrived` payload, waterfall targets (pool minus foam, stream, ledge perches, heron stands), `perspective(x, y)`, a falls studio stage | `src/fauna/**`, `src/core/fauna-unlocks.ts`, `src/scenery/*/fauna.ts`, `src/ui/{quiet-line,format}.ts`, `tests/e2e/fauna*.spec.ts` | done (creature registry, a table per scenery with all 8 waterfall rows, arrivals per garden, pool-minus-foam, stream, ledge perches, heron stands, perspective within 0.02; ADR 0248) |

Phase 12 art queue: one species or creature per task (atomic), 2–3 at a time, after F1, F2 and S11. Each task follows `docs/systems/species-recipe.md` or the fauna recipe and the `drawing-assets` skill. Descriptions for illustrators are in B0 §2 and §3.

| # | Task | Area | Status |
|---|---|---|---|
| W1 | Iwatabako (rock tobacco, *Conandron ramondioides*): T1, wet cliff and ledges | `src/plants/species/iwatabako.ts` | done (devlog 73) |
| W2 | Daimonjisō (*Saxifraga fortunei*): T1, spray-zone rock | `src/plants/species/daimonjiso.ts` | done (devlog 74) |
| W3 | Iwakagami (*Shortia soldanelloides*): T1, mossy banks and ledges | `src/plants/species/iwakagami.ts` | done (devlog 75) |
| W4 | Wasabi (*Eutrema japonicum*): T1, stream shore | `src/plants/species/wasabi.ts` | done (devlog 76) |
| W5 | Kurinsō (*Primula japonica*): T2, stream banks | `src/plants/species/kurinso.ts` | done (devlog 78) |
| W6 | Baikamo (*Ranunculus nipponicus* var. *submersus*): T2, water, flowing | `src/plants/species/baikamo.ts` | done (devlog 80) |
| W6b | Baikamo polish: the sunset rim light lands on the underwater weed (needs a species opt-out on the shared type); bolder blossoms at overview size | `src/plants/species/baikamo.ts`, plants rim light | done (devlog 80 › W6b; ADR 0281) |
| W7 | Mizubashō (*Lysichiton camtschatcensis*): T2, water and shore | `src/plants/species/mizubasho.ts` | done (devlog 81) |
| W8 | Hototogisu (toad lily, *Tricyrtis hirta*): T2, cliff foot | `src/plants/species/hototogisu.ts` | done (devlog 82) |
| W8b | Hototogisu polish (orchestrator review): too small and faint on its ledge, even in close view; bigger, whiter stars and a fuller clump so it holds its own beside the violet | `src/plants/species/hototogisu.ts` | done (devlog 82 › W8b) |
| W9 | Yamabuki (*Kerria japonica*): T3 shrub | `src/plants/species/yamabuki.ts` | done (devlog 84) |
| W10 | Taniutsugi (*Weigela hortensis*): T3 shrub | `src/plants/species/taniutsugi.ts` | done (devlog 86) |
| W11 | Katsura (*Cercidiphyllum japonicum*): T4 tree | `src/plants/species/katsura.ts` | done (devlog 88) |
| W11b | Katsura polish (orchestrator review): the crown is sparse and twiggy at overview size, not yet the brief's broad round cloud; fill it, hide more twigs, cut paint cost (80 ms, twice the ginkgo) | `src/plants/species/katsura.ts` | done (devlog 88 › W11b; crown dabs a little stamped) |
| W12 | Tochinoki (*Aesculus turbinata*): T4 tree | `src/plants/species/tochinoki.ts` | done (devlog 89) |
| C1 | Brown dipper (kawagarasu): bobs on wet rocks, walks under water (was S13) | `src/fauna/creatures/dipper.ts` | done (devlog 77) |
| C1b | Dipper polish (orchestrator review): the body reads as a smooth flat blob with a dot eye, more cartoon than watercolour; add plumage texture and edge variation, visible legs while wading, smoother flight frames | `src/fauna/creatures/dipper.ts` | done (devlog 77 › C1b) |
| C2 | Miyama-kawatombo damselfly | `src/fauna/creatures/damselfly.ts` | done (devlog 79; phone read weak) |
| C3 | Iwana char in the plunge pool (was S12) | `src/fauna/creatures/iwana.ts` | done (devlog 83) |
| C4 | Sawagani river crab | `src/fauna/creatures/sawagani.ts` | done (devlog 85; no dusk/rain signal yet) |
| C5 | Kajika frog on the stream stones | `src/fauna/creatures/kajika.ts` | done (devlog 87) |
| C6 | Iwatsubame (Asian house martin) along the cliff | `src/fauna/creatures/iwatsubame.ts` | done (devlog 90) |
| C7 | Genji firefly (night only) | `src/fauna/creatures/firefly.ts` | done (devlog 91) |
| C8 | Yamasemi (crested kingfisher, rare) | `src/fauna/creatures/yamasemi.ts` | done (devlog 92) |
| C8b | Predator reactions (C8 devlog): the wagtail (`bird.ts`) treats only other wagtails' perches as taken, so it can land on the yamasemi's rock; the iwana ignores all birds and could sink or scatter when the yamasemi hovers | `src/fauna/creatures/{bird,iwana}.ts` | done (devlog 92 › C8b) |

Phase 13 (owner request 2026-11-04): a third garden, a desert oasis, with a golden, sandy feel in the same watercolour style, and its own plants and creatures, sharing species with the other gardens only where biology fits. Owner decisions: Sahara / Maghreb; a tended palm grove (mud-brick walls, irrigation channels, terraces); rough drafts first, then the chosen one is built in full. Drafts are rough (20 minutes a round). The owner asked for a closer view in round 2: plants are the focus, so the camera stands in the garden like the other two. Chosen: draft A, "Ksar & palmeraie" (Draa valley).

| # | Task | Area | Status |
|---|---|---|---|
| D-a | Draft A: ksar on a red bluff, palm terraces, a seguia into a stone basin, the oued bend | `src/scenery/oasis/drafts/a/**` | done, chosen (devlog 102; round 2 is the close view) |
| O0 | Biome research (web, read-only): the Draa valley palmeraie's flora and fauna, about 12 plants and 8 creatures of its own, species shared with the other gardens by biology, cultivated plants of the oasis gardens, pitfalls; illustrator notes | `docs/research/oasis-biome.md` | done (12 plants: spearmint, alfalfa, caper, colocynth, cattail, barley, desert hyacinth, henna, oleander, Damask rose, pomegranate, date palm; 8 creatures: house bunting, laughing dove, violet dropwing, Sahara frog, hoopoe, Böhme's gecko, blue-cheeked bee-eater, white stork; no plants shared, shared creatures: bees, swallowtail, cabbage white, striders, swallow, heron (rare), leaf) |
| O1 | Oasis scenery skeleton from draft A: id, registry, geometry and slots, habitat words, view focus, sky numbers, flora profile, an empty wildlife table, placeholder sky and light; behind `?dev&scenery=oasis` | `src/scenery/oasis/**`, `src/core/sceneries.ts`, `src/scenery/registry.ts` | done (devlog 105; "Ksar oasis", 47 slots with terrace lifts, both low suns on the right in the bluff–grove notch, ADR 0300; offers no species yet, so it stays behind the flag) |
| O2 | Oasis framing and rock (owner: "the crop is really bad"): the ksar inside the frame with sky above, the sky shape following the silhouette (no white holes), a phone crop that holds the ksar and the basin, structure in the empty foreground; then paint the bluff and the ksar | `src/scenery/oasis/{layout,slots,sky,paint-rocks}.ts` | done (devlog 107; ksar x 430–898 under open sky at every viewport, skyline traced from the silhouette, FOCUS (730, 520), suns 920/990; bluff and ksar painter; oued-1 and oued-3 large for the oleander) |
| O3 | Oasis painters: the basin, the seguia and its falls, the oued | `src/scenery/oasis/paint-water.ts` | done (devlog 110; basin with reflection, steps and sluice gate, seguia falls, braided oued; the oued is pale at the overview, sunset greys the basin until O5) |
| O4 | Oasis painters: palms, grove, terraces, sand and foreground | `src/scenery/oasis/{paint-veg,paint-land}.ts` | done (devlog 112; own land and veg painters, no draft steps in the app; terraces still straight-ish, big palm crowns mostly above the 1440 frame) |
| O5 | Oasis daylight: 4 sky plates, basin plate, light plates, sun side | `src/scenery/oasis/{sky,light}.ts` | done (devlog 114; ADR 0301 per-scenery grades; turquoise basin in every phase, shadows fall left; moon top hidden on wide screens) |
| O6 | Moving water: the seguia's falls and the oued's glints | `src/scenery/oasis/motion.ts` | done (devlog 117; seguia falls, sluice spill, inlet rings, oued glints at TEMPO 1.25, within noise per frame; the generic pond shimmer still draws on the basin) |
| O7 | Oasis sound bed (wind in the palms, trickling water, doves) | `src/audio/**`, `src/core/soundscape.ts` | done (devlog 126; ADR 0303; seguia trickle, palm rustle, dove, bunting, bee-eater, insects, gecko, frogs; ≈ −40.8 dBFS between the pond and the waterfall; needs a human ear: artifacts/o7/*.wav) |
| O8 | Acceptance and docs, release | `docs/**`, `tests/**` | done (devlog 140; released 2026-11-10 at the owner's word; the wildlife queue OK2–OK8 continues after release) |

Phase 13 art queue (after O0 and O1): one plant (OP1–OP12) or creature (OK1–OK8) per task, from the O0 brief.

| # | Task | Area | Status |
|---|---|---|---|
| OP12 | Date palm (*Phoenix dactylifera*): T4 tree, the signature; the background palms follow it | `src/plants/species/date-palm.ts` | done (devlog 106) |
| OP9 | Oleander (*Nerium oleander*): T3 shrub, shore and back; distinct from the Damask rose | `src/plants/species/oleander.ts` | done (devlog 108) |
| OP3 | Caper (*Capparis spinosa*): T1, trailing from wall cracks, rock and path | `src/plants/species/caper.ts` | done (devlog 109) |
| OP1 | Spearmint (*Mentha spicata*): T1, shore and path, the freshest green | `src/plants/species/spearmint.ts` | done (devlog 111; 50–54 ms) |
| OP5 | Southern cattail (*Typha domingensis*): T2, water and shore, the basin and the oued | `src/plants/species/cattail.ts` | done (devlog 113; 20–22 ms; oued shallows slots are small only) |
| OP11 | Pomegranate (*Punica granatum*): T4, flowers and crowned fruit together | `src/plants/species/pomegranate.ts` | done (devlog 115; 60–76 ms; large, T4) |
| OP10 | Damask rose (*Rosa × damascena*): T3, ruffled cups on arching canes; distinct from the oleander | `src/plants/species/damask-rose.ts` | done (devlog 116; 76–79 ms; reads apart from the oleander) |
| OP7 | Desert hyacinth (*Cistanche phelypaea*): T2, a leafless gold candle in the sand, path and back | `src/plants/species/desert-hyacinth.ts` | done (devlog 118; 42–52 ms; path slots are all small, so it grows on the two medium back slots only) |
| OP4 | Colocynth (*Citrullus colocynthis*): T1, a sprawling vine with gold gourds on the sand, path and rock | `src/plants/species/colocynth.ts` | done (devlog 120) |
| OP6 | Barley (*Hordeum vulgare*): T2, golden bearded ears in the plots | `src/plants/species/barley.ts` | done (devlog 122; 82–105 ms median, near the top of the budget) |
| OP13 | White water lily (*Nymphaea lotus*): T2 or T3, the second water plant (owner decision 2026-11-06: release needs 2 per habitat; white flowers on floating pads in the basin, distinct from the garden's lotus) | `src/plants/species/white-water-lily.ts` | done (devlog 123; tier 2, water; wild only round the Sahara's edges, so planted in the Draa basin: owner's call 2026-11-06; about 64 ms) |
| OP8 | Henna (*Lawsonia inermis*): T2, a neat green dome frothing with cream sprays, meadow and back | `src/plants/species/henna.ts` | done (devlog 124; 29–32 ms) |
| OP2 | Alfalfa (*Medicago sativa*): T1, a green tuft with violet clusters, distinct from the garden's white clover | `src/plants/species/alfalfa.ts` | done (devlog 125; 51–68 ms; now the first species, so the widget and shell studio cards show it) |
| OP14 | Grapevine arbour (*Vitis vinifera*): T4, the oasis's showpiece (owner pick 2026-11-10), trunks on a palm-wood treille, a leaf canopy hung with purple and amber bunches | `src/plants/species/grapevine.ts` | done (devlog 133; T4 large arbour on meadow/back slots, ≈85 ms quiet-machine estimate, the slowest oasis species) |
| OP15 | White broom (*Retama raetam*): T2, a fountain of fine grey-green rods foaming with fragrant white pea flowers, sand and path | `src/plants/species/retama.ts` | done (devlog 134; T2 medium on the walk, oued banks, high-2 and grove-1; ≈30–50 ms quiet-machine estimate) |
| OP16 | Jujube (*Ziziphus lotus*): T3, a spiny, tangled grey shrub with small glossy red fruit, back and rock | `src/plants/species/jujube.ts` | done (devlog 135; T3 large on the oued banks and back tree slots; 60 ms median loaded, below the damask rose) |
| OP17 | Southern maidenhair (*Adiantum capillus-veneris*): T1, fan-leaflet fern on the wet walls by the seguia and the basin | `src/plants/species/southern-maidenhair.ts` | done (devlog 136; T1 small on wet wall copings, the basin rim and the seguia bank; ≈10 ms) |
| OK0 | Oasis wildlife infra: unlock rows for the 8 oasis creatures (rows skip until a module exists), perches (walls, basin rim, palm fronds, a ksar tower), hoopoe ground spots, gecko wall faces, heron stands, a studio stage | `src/scenery/oasis/fauna.ts`, `src/fauna/habitat.ts` | done (devlog 127; ADR 0304; 15 rows, 42 perches, 5 ground spots, 4 wall faces, 5 heron stands; dropwing its own kind; swallows moved to 17) |
| OK1 | House bunting (*Emberiza sahari*): tame, hops the copings and rim, always | `src/fauna/creatures/bunting.ts` | done (devlog 128; a resident pair by day on walls, rim and stones; 0.90 ms with the whole roster) |
| OK2 | Laughing dove (*Spilopelia senegalensis*): fronds, wall tops, walks the plots, drinks at the rim; 2 plants | `src/fauna/creatures/dove.ts` | done (devlog 160; a pair by day on fronds, walls and the rim, walks the plots, drinks at the rims; 0.39–0.46 ms with the whole roster) |
| OK3 | Violet dropwing: perch-and-sally dragonfly over the basin; 3 plants | `src/fauna/creatures/dropwing.ts` | done (devlog 161; perch-and-sally from the gate posts, stones, rim and wet copings, wings drooped, obelisk pose, rival chases; frame cost to confirm on a quiet machine) |
| OK4 | Sahara frog: in the basin and on the rim; 5 plants | `src/fauna/creatures/sahara-frog.ts` | done (devlog 162; basks on the coping and the stair stands, floats eyes-up, plops when a bird comes near, a chorus of three after dark; 0.47–1.12 ms with the roster on a busy laptop) |
| OK5 | Hoopoe: walks the damp plots, fans its crest; 8 plants | `src/fauna/creatures/hoopoe.ts` | queued |
| OK6 | Böhme's gecko: on the warm walls at night; 10 plants | `src/fauna/creatures/gecko.ts` | queued |
| OK7 | Blue-cheeked bee-eater: sallies from frond tips; 14 plants | `src/fauna/creatures/bee-eater.ts` | queued |
| OK8 | White stork: nest on the ksar tower, now and then the plots; 20 plants, rare | `src/fauna/creatures/stork.ts` | queued |
| O1b | Oasis polish: medium sand slots for the desert hyacinth, a medium shallows slot for the cattail, the moon arc lower for wide screens, a stronger far range at sunset, the basin a still mirror (a minimal opt-out of the generic water surface) | `src/scenery/oasis/**`, `src/scene/water.ts`, `src/scenery/types.ts` | done (devlog 119; medium sand and shallows slots, moon arc lower, deeper far range, the basin a still mirror, ADR 0302) |
| O2d | Oasis basin perspective (owner: "the camera is looking at it from too high, not aligned with the rest of the scenery"): a flatter basin with sides converging on the horizon, a thin far wall, more reflection | `src/scenery/oasis/{layout,geometry,slots,paint-water,motion,light}.ts` | done (devlog 121; far rim y 476 → 562, sides aimed at the horizon point (810, 340), thin far wall, reflection fills the water) |
| O9 | Oasis ksar (owner: the background castle is not finished): eroded pisé towers, layered washes, varied openings, loose carved bands, seated in the bluff; same silhouette | `src/scenery/oasis/{ksar,paint-rocks}.ts` | done (devlog 130; eroded tapering towers, houses stepping back, loose bands and openings, seated in the bluff; ksar step ≈2× paint time, within budget) |
| O10 | Oasis bluff and cliffs: real rock form (strata, buttresses, talus, cast shadows) instead of a flat wash with streaks | `src/scenery/oasis/paint-rocks.ts` | done (devlog 131; buttresses, gullies, ledges, varnish and scree; rock rises into the ksar's ends; pale sky wedge closed; bluff step 0.98 → 0.52 s) |
| O11 | Oasis falls: the seguia's drops and the sluice spill painted as falling water, not blue strips | `src/scenery/oasis/{paint-water,motion}.ts` | done (devlog 132; glassy lips, strands, foam pools and wet halos at both drops and the sluice; lined runs; motion follows the strands) |
| O12 | Plantable ground between the basin and the ksar (owner: "super empty rn"): 5–7 slots behind the basin, bunds or damp tilled earth so it reads as plots | `src/scenery/oasis/{slots,paint-land,layout,fauna}.ts` | done (devlog 137; four irrigated beds and a head ditch behind the basin, 7 new slots bed-1…4, foot-1…2, talus-3; 55 slots) |
| O13 | Oasis bluff, second pass: the buttresses under the ksar read as rounded loaves with even ledges; vary them, fix the hanging clefts and the pale left ridge at sunset | `src/scenery/oasis/paint-rocks.ts` | done (devlog 138; continuous beds and caprock, shade by plane, V gullies over scree, varied buttresses; sunset ridge fixed in the painter) |
| O14 | Oasis basin corner and sluice gate: the bare paper triangle at the near-right corner, a roomier gate | `src/scenery/oasis/{paint-water,motion}.ts` | done (devlog 139; washes run past every corner of the coping, face and water; a roomier gate with its foam downstream) |

Phase 14: optimization pass (owner request 2026-11-10). Optimize the whole app, the desert oasis first. Drawing is done, so sprites and paints may be bundled. Measured first: the oasis cold landscape is 3.8 s of CPU at DPR 1 and 5.5 s at DPR 2 (plots and ksar are 43 % of that). Nothing is lazy-loaded: 1.41 MB of JS in the first view. A cold switch into the oasis takes 6.9 s; a warm one freezes the main thread for about 205 ms in the ambience rebuild. The frog's water checks are about 20 % of an oasis frame. Alfalfa is the slowest sprite at 246 ms. Owner decisions:
- slight pixel changes are fine when an art review compares before and after screenshots
- unseen gardens are pre-painted on idle when the Gardens section nears
- 30 fps at rest is built behind a flag, and the owner judges it

Not done: a motion-sprite atlas (1.3 MB, not worth it) and shipping pre-painted landscapes. Owner decision 2026-11-11: this queue runs before the oasis creatures (OK5–OK8); creature agents already running finish first. The phase 9 tasks still queued (P15, P17, P19–P22, P24) follow once this queue is done.

| # | Task | Area | Status |
|---|---|---|---|
| Z1 | Oasis cold paint yields: split the paint steps into finer parts (longest 72 → ≤20 ms), same pixels | `src/scenery/oasis/paint-*.ts` | done (devlog 141; ADR 0330; longest oasis part 24–26 → 18 ms at 1× on a quiet machine (the audit's 72 ms was under load), pixel-identical; the 18 ms left is Chromium flushing the canvas, not oasis code) |
| Z2 | Frog water checks cheap (`closestOnPolygon` 23–26 ms/s, high GC in the oasis), same behaviour | `src/fauna/creatures/kajika*`, geometry helper | done (devlog 142; oasis frog checks 26 → 0.2 ms/s, GC 3 → 0.6/s, frame JS 1.83 → 1.40 ms; the oasis has no kajika, its suitability check is now cached) |
| Z3 | Oasis plots: one wet layer per plot instead of per furrow (bundle, −0.6–0.9 s), art review | `src/scenery/oasis/paint-land.ts` | done (devlog 146; ADR 0343; plots at DPR 2 1.3–1.6 s → 0.66–0.72 s; art review passed) |
| Z4 | Ksar blocks batched per tower or band (bundle, −0.3–0.5 s), art review | `src/scenery/oasis/{ksar,paint-rocks}.ts` | done (devlog 147; ADR 0345; ksar step DPR 2 695 → 588 ms, DPR 1 1,084 → 946 ms, short of the −0.3–0.5 s target: the rest is the engine's wet-in-wet washes and glazes; art review passed) |
| Z5 | Garden switch: ambience (cast, night edge, grade wash) rebuilt in parts, 205–557 ms freeze → <50 ms; confirm with a profile first | `src/ambience/*` | done (devlog 143; ADR 0337; the light ready in parts under the cover, the night edge shared; warm switch at night 99–129 ms → no task over 50; noon: ~100 ms left in fauna first sprites, see Z23) |
| Z6 | Pre-paint unseen gardens into the paint cache on idle when the Gardens section nears; cards use the cached overview instead of draft paints (cold switch 6.9 → ~0.3 s) | `src/scene/system.ts`, `src/scenery/thumbnail.ts`, `src/ui/gardens-section.ts` | done (devlog 144; ADR 0339; after the Gardens section is seen, a switch into the oasis 5.3 s → 0.26–0.29 s, the waterfall 3.1 → 0.3 s; no task over 50 ms; 6.6–7.7 s background CPU once per paint version; thumbnails from the cached overview) |
| Z7 | Lazy per-garden painters: each scenery's painters in its own chunk (P16g, −150–200 kB at boot) | `src/scenery/{types,registry}.ts`, each garden's `index.ts`, `src/scene/{system,sky-light}.ts`, `src/ambience/cast.ts` | done (devlog 145; ADR 0341; first-view JS 1,416 → 1,324 kB raw, 500 → 476 kB gzip; each garden's painters a lazy chunk; a warm repeat visit never requests them; ~76 kB of oasis paint code still eager, see Z25) |
| Z8 | Creatures loaded per garden (P16a′, −190 kB at boot) | `src/fauna/creatures/registry.ts`, `src/fauna/{system,roster}.ts` | done (devlog 148; ADR 0346; first-view JS 1,385 → 1,129 kB raw, 497 → 412 kB gzip; no creature code at boot; each garden's set lazy, prefetched with the pre-paint) |
| Z9 | Species painters out of the main bundle, spike then build (P16f, −433 kB raw) | `src/plants/{types,registry}.ts`, `src/ui/previews.ts`, `src/plants/sprites.ts` | done (devlog 150; ADR 0348; first-view JS 1,385 → 970 kB raw, 497 → 348 kB gzip at the time; species metadata extracted at build time, painters per species on demand) |
| Z10 | Alfalfa sprite: batch wet layers (246 ms, the slowest), art review | `src/plants/species/alfalfa.ts` | done (devlog 151; 0.47× the old time, ≈110–115 ms against the audit's 246 (target <100 not quite met); now about the white clover's cost; art review passed) |
| Z11 | Damask rose sprite: batch wet layers (125 ms), art review | `src/plants/species/damask-rose.ts` | done (devlog 153; 72 → 37 ms quiet (0.51×), ≈64–67 ms on the audit's scale; art review passed) |
| Z12 | Oleander sprite: batch wet layers (103 ms), art review | `src/plants/species/oleander.ts` | done (devlog 154; 90 → 48 ms quiet (0.53×); art review passed, the stems a little softer at the base where they cross other bands) |
| Z13 | Spike, then build if it pays: drying skips empty tiles, bit-identical (every garden, every sprite) | `src/paint/wet.ts` | done (devlog 156; ADR 0349; drying only the painted box plus the blur's reach, bit-identical (8,671 real layers compared); drying 0.87× overall, ksar 0.73×, katsura 0.77×; a paint-version bump: caches repaint once to the same pixels) |
| Z14 | 30 fps while the camera rests, behind a flag, so the owner can compare | `src/render/renderer.ts` | queued (owner judges) |
| Z15 | Free close-view buffers back at the overview (−33 MB) | `src/scene/system.ts`, `src/paint/wet.ts` scratch | done (devlog 158; after a close view the overview holds 128 MB instead of 174–178 MB at DPR 2: the renderer's rest cache, the detail painting and atlas, the sky detail freed; pooled wet-layer canvases shrink after 4 s idle) |
| Z16 | Free the night-edge canvases by day, rebuilt on idle before dusk (−9.5 MB) | `src/ambience/night-edge.ts` | done (devlog 157; ADR 0350; 9.56 MB → 0 by day, rebuilt on idle in 10 parts (longest 19–29 ms) 30 min before the evening; night frame identical) |
| Z17 | Paint-cache eviction at DPR 2: measure, then give priority to the viewed and base sets | `src/paint/persist.ts` | in progress (devlog 164) |
| Z18 | `latin-ext` fonts out of the SW precache (−99 kB install) | `src/build/sw-manifest.ts` | queued |
| Z19 | Oasis: skip the empty `scene-sprites` cache entry | `src/scene/system.ts` | queued |
| Z20 | Oasis motion tidy: cached clip paths, no per-mark allocations, `drawFall` indexed | `src/scenery/oasis/motion.ts` | queued |
| Z21 | Creature part atlas (bundle, about 50 canvases → 8): measure the GPU first, drop it if it doesn't pay | `src/fauna/sprite.ts` | queued |
| Z22 | Fauna sim asks for a creature's wanted count before its suitability check, so creatures not on the garden's roster cost nothing | `src/fauna/sim.ts` | queued |
| Z23 | Garden switch at noon: each creature's first sprite (bunting, dipper, ~100 ms) and the waterfall falls' `prepare` built in parts or on idle before the switch | `src/fauna/sprite.ts`, `src/scenery/waterfall/falls.ts` | queued |
| Z24 | Sky plate painted in parts (one 115–135 ms task today) and pre-painted with the Z6 garden pre-paint, so a switch after the pre-paint gets near the warm 0.10 s | `src/scene/sky-light.ts`, `src/scene/system.ts` | queued |
| Z25 | Oasis shape data out of the painters: the constants `oasis/wildlife.ts` reads from `paint-land`/`paint-water`/`paint-veg` (and `EARTH` from `paint-rocks`) move to a data module, so about 76 kB of oasis paint code leaves the first view (after Z3, Z4) | `src/scenery/oasis/*` | done (devlog 149; first-view JS 1,132.8 → 1,051.6 kB raw, 413.1 → 386.4 kB gzip; no oasis paint code on a Japanese garden visit; pixels unchanged) |
| Z26 | Light plates wait for the lazy painters like the sky does (devlog 152 left open): a missing daylight light plate draws without the garden's shadows and lights until the painters land; a still frame waits for it | `src/ambience/{cast,plate-cache}.ts`, `src/scene/system.ts` | done (devlog 155; a still frame waits for the light's lazy painters; a listed cache hit is waited for (cacheHitWaitMs 4 s) instead of painted over, which was CI's lazy-painters failure) |
| Z27 | The sky's lookup race (devlog 155 left open): a sky draw before its plate's cache lookup answers starts the painters load; the same one-line check `cast.ts` got | `src/scene/sky-light.ts` | done (devlog 159; a sky drawn during a pending plate lookup loads no painters; a hit recomposes, a miss loads) |
| Z28 | The lantern flame's flicker follows real frame time, so two fresh loads at night can differ in a 64-px square and `switch-light.spec.ts` (which hashes frames) could flake: `settleAmbience()`/`freeze()` should pin the flicker phase (devlog 157) | `src/ambience/**` | done (devlog 163; the flame's time starts over on settle; two fresh night loads freeze identical; the water shimmer's real time left for Z29) |
| Z29 | Water shimmer, ripples and glints run on the renderer's real time (`f.t` in `src/scene/system.ts` → `src/scene/water.ts`), so a frozen frame with the water layers differs between loads; give the scene a time that `freeze()`/`settleAmbience()` reset like the ambience's (devlog 163) | `src/scene/{system,water}.ts` | queued (after Z15) |

Phase 15 (owner request 2026-11-12): a fourth garden, the Greek coastline, in the same painted style as the other gardens, with its own Mediterranean plants and creatures. Owner decisions:
- a tended clifftop terrace standing close, over a turquoise cove with limestone cliffs and pines (two reference photos)
- all four structures: dry-stone walls and gravel, a far white village with a blue-domed chapel, ancient marble columns, a moored fishing caique
- plantable water is the sea edge: shallows, rock pools and splash rocks
- creatures wanted for sure: an island cat, a tortoise in the scrub, dolphins far out (rare), goats on the cliff; research picks about 8 more
- finished tasks are merged and pushed in batches; the garden stays behind `?dev&scenery=coast` until the owner releases it
- chosen: draft B, "Stepped terraces down to the shore" (two 10-minute drafts; draft A was dropped)

Up to 3 agents at a time for this phase, beside the phase 14 queue's agents. Scenery id `coast`, folder `src/scenery/coast/`.

| # | Task | Area | Status |
|---|---|---|---|
| D-b | Draft B: an olive on the top tier, three dry-stone tiers down to a pebble beach and rock pools, a temple promontory, the village across the bay | `src/scenery/coast/drafts/b/**` | done, chosen (merged with G1) |
| G0 | Biome research (web, read-only): region, 14–16 plants over four tiers with two per habitat, the owner's four creatures plus about 8 wild ones, species shared by biology, sound notes, pitfalls | `docs/research/coast-biome.md` | done (Ionian islands; 16 plants, 14 new creatures in two waves, 5 plants and 7 creatures shared by biology; orchestrator defaults until the owner says otherwise: the blue-domed chapel stays, the ice plant is a cultivated *Lampranthus* on the terrace only, the cypress stays, algae are labelled as algae, common dolphins, the cat is always there) |
| G1 | Coast scenery skeleton from draft B: id, registry, geometry and about 50 slots, habitat words, view focus, sky numbers, flora profile, an empty wildlife table, placeholder sky, light and painting; a broken natural shoreline and a phone crop that holds a landmark; behind `?dev&scenery=coast` | `src/scenery/coast/**`, `src/core/sceneries.ts`, `src/scenery/{registry,ids}.ts` | done (devlog 170; ADRs 0360–0361; 48 slots: 9 water, 5 shore, 12 meadow, 5 path, 6 back, 11 rock; focus (760, 600), the phone crop holds the temple, sea, shore and all three tiers; light from the left, both low suns over the sea; new range words: climate `mediterranean`, biomes `scrub` and `marine`; the painting is draft B on the final layout) |
| G2 | Coast painters: the limestone promontory, the temple columns, the far hill with the village and chapel, the rock shelf and boulders | `src/scenery/coast/paint-rocks.ts` | done (devlog 175; temple and village hold up in close views; about 0.29 s in all, longest part 6.4 ms; the splash rocks and shoreline blocks are weak, see G2b) |
| G3 | Coast painters: the sea, the shallows, the pebble beach, the rock pools, the caique | `src/scenery/coast/paint-water.ts` | done (devlog 176; ADR 0366; a turquoise cove whose colour follows depth, lacy foam on wet-to-dry shingle, clear pools, a caique that reads at the overview; about 265 ms in all, longest part 12 ms; the far-hill reflection is faint; motion reads the shapes in `sea.ts`; the generic water surface is still on) |
| G4 | Coast painters: terraces, dry-stone walls, gravel and steps, the pines, the scrub, the foreground | `src/scenery/coast/{paint-land,paint-veg}.ts` | in progress (devlog 177) |
| G5 | Coast daylight: 4 sky plates, sea plate, light plates, grades | `src/scenery/coast/{sky,light}.ts` | queued (after G2–G4) |
| G6 | Moving water: the swell, foam on the pebbles, glints, the caique rocking | `src/scenery/coast/motion.ts` | queued (after G3) |
| G7 | Coast sound bed (waves on pebbles, cicadas, a Scops owl at night, goat bells, the boat's ropes) | `src/audio/**`, `src/core/soundscape.ts` | queued (after G1) |
| GK0 | Coast wildlife infra: unlock rows, perches, ground spots, sea and rock-pool targets, far-cliff and bay stages, a studio stage | `src/scenery/coast/fauna.ts`, `src/fauna/habitat.ts` | queued (after G0, G1) |
| G8 | Acceptance and docs; release at the owner's word | `docs/**`, `tests/**` | queued |

Phase 15 art queue (after G0): one plant (GP…) or creature (GK…) per task, from the G0 brief. Rows are added when G0 lands.

| # | Task | Area | Status |
|---|---|---|---|
| GP1 | Olive (*Olea europaea*): T4 tree, the signature; a fat fluted trunk and a broken silver crown | `src/plants/species/olive.ts` | done (devlog 171; 77 ms median, level with the date palm, 125–134 ms on 12-clump seeds; cultivated round the Mediterranean and offered by the oasis too; its wild range still says `coast` / `warm-temperate`, see GF2; the young stages are bare, the crown a little spotty up close) |
| GP2 | Ice plant (*Lampranthus*): T1, magenta and red mats on the terrace, walls and path | `src/plants/species/ice-plant.ts` | done (devlog 172; about 36 ms; cultivated only, `cultivatedIn: mediterranean`; the lobes read a little as separate heaps) |
| GP3 | Lavender (*Lavandula*): T2, grey-green humps with violet spikes, terrace and path | `src/plants/species/lavender.ts` | done (devlog 173; 27–33 ms; the dome rim is a little spiky and the stems stiff) |
| GP4 | Sea daffodil (*Pancratium maritimum*): T2, white trumpets on the beach sand | `src/plants/species/sea-daffodil.ts` | in progress (devlog 178) |
| GP5 | Posidonia (*Posidonia oceanica*): T3, a seagrass meadow in the shallows | `src/plants/species/posidonia.ts` | in progress (devlog 179) |
| GP6 | Rock samphire (*Crithmum maritimum*): T1, fleshy lime umbels on splash rocks and shingle | `src/plants/species/rock-samphire.ts` | queued |
| GP7 | Peacock's tail (*Padina pavonica*): T1, pale banded fans in the rock pools (an alga) | `src/plants/species/peacocks-tail.ts` | queued |
| GP8 | Cyclamen (*Cyclamen hederifolium*): T1, pink swept-back flowers over marbled leaves, walls and scrub | `src/plants/species/cyclamen.ts` | queued |
| GP9 | Sea holly (*Eryngium maritimum*): T2, steel-blue spiny bracts on the beach | `src/plants/species/sea-holly.ts` | queued |
| GP10 | Cystoseira: T2, an amber-brown algal bush in the pools and shallows | `src/plants/species/cystoseira.ts` | queued |
| GP11 | Sea lavender (*Limonium*): T2, a lilac haze on wiry stems, rock and wall | `src/plants/species/sea-lavender.ts` | queued |
| GP12 | Pink rock rose (*Cistus creticus*): T2, crumpled pink flowers, scrub and path | `src/plants/species/rock-rose.ts` | queued |
| GP13 | Tree spurge (*Euphorbia dendroides*): T3, a lime-yellow dome on the cliff and rocks | `src/plants/species/tree-spurge.ts` | queued |
| GP14 | Jerusalem sage (*Phlomis fruticosa*): T3, whorls of yellow hooded flowers over grey felt leaves | `src/plants/species/jerusalem-sage.ts` | queued |
| GP15 | Aleppo pine (*Pinus halepensis*): T4 tree, a leaning trunk and a light open crown | `src/plants/species/aleppo-pine.ts` | queued |
| GP16 | Mediterranean cypress (*Cupressus sempervirens*): T4, the dark spire | `src/plants/species/cypress.ts` | queued |
| GK1 | Island cat: sleeps on the copings, strolls the path; always there | `src/fauna/creatures/cat.ts` | queued (after GK0) |
| GK2 | Yellow-legged gull: the caique's mast, a splash rock, the cove; 1 plant | `src/fauna/creatures/gull.ts` | queued (after GK0) |
| GK3 | Cicada: on the olive and pine trunks by day; 2 plants | `src/fauna/creatures/cicada.ts` | queued (after GK0) |
| GK4 | Marbled rock crab: splash rocks and the pool edge; 5 plants | `src/fauna/creatures/rock-crab.ts` | queued (after GK0) |
| GK5 | Blue rock thrush: wall tops, the temple, ledges; 8 plants | `src/fauna/creatures/rock-thrush.ts` | queued (after GK0) |
| GK6 | Goats on the far cliff ledges; 9 plants | `src/fauna/creatures/goat.ts` | queued (after GK0) |
| GK7 | Hermann's tortoise: scrub, terrace foot and path; 10 plants | `src/fauna/creatures/tortoise.ts` | queued (after GK0) |
| GK8 | Scops owl: the olive, a wall top, a pine; night only; 12 plants | `src/fauna/creatures/scops-owl.ts` | queued (after GK0) |
| GK9 | Common dolphins far out in the bay; rare; 20 plants | `src/fauna/creatures/dolphin.ts` | queued (after GK0) |
| GK10 | Balkan green lizard on the sunlit wall; 3 plants | `src/fauna/creatures/green-lizard.ts` | queued (second wave) |
| GK11 | Damselfish shoal in the shallows; 11 plants | `src/fauna/creatures/damselfish.ts` | queued (second wave) |
| GK12 | Common octopus in the rock pool; rare; 16 plants | `src/fauna/creatures/octopus.ts` | queued (second wave) |

Shared by biology, no art task: caper, oleander, grapevine, pomegranate and southern maidenhair (checked against the coast's flora profile in G1); cabbage white, bees, swallows, swallowtail, heron, and the hoopoe and gecko once OK5 and OK6 exist (rows in GK0). Left for later, if the owner wants them: hummingbird hawk-moth, Scopoli's shearwater, loggerhead turtle.

Phase 15 follow-ups:

| # | Task | Area | Status |
|---|---|---|---|
| GF1 | Coast flora wiring: the coast test's pinned offer list becomes invariants (it breaks on every species merge), and the four species shared by biology (oleander, pomegranate, grapevine, southern maidenhair) get range lines the coast's profile offers | `src/scenery/coast/coast.test.ts`, four species' range lines | done (devlog 174; the coast offers caper, grapevine, ice plant, oleander, pomegranate, southern maidenhair and the olive; the other gardens are unchanged; oleander and maidenhair tagged wild by the agent) |
| GF2 | Olive range in the new words (`mediterranean`, `scrub`) instead of `coast` / `warm-temperate`; check every merged coast species' range against ADR 0361 | species range lines | queued (after GF1) |
| G2b | Coast rock, second pass (orchestrator review of G2): the splash rocks read as flat slabs on legs and the shoreline blocks as trays; make them rounded, sea-worn boulders and a natural broken ledge with wet dark feet. The promontory's fissures and ledges read as quarried masonry in the close view: vary the beds, break the verticals, soften the sea-cut notch; nothing paints a reflection, contact shadow or foam ring where the splash rocks and the shoreline faces meet the water, and the beach meets the rock shelf in a hard straight line | `src/scenery/coast/{paint-rocks,paint-water}.ts` | queued (after G4) |
