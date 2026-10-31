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
0190–0194 v2 polish 2 · 0200–0204 dock wayfinding · 0205+ queue tasks (Q1 0205, Q2 0206, Q3 0207, Q11 0208–0209, Q13 0210) · 0220–0239 performance (phase 9, one block of numbers per task) · 0240–0259 sceneries (phase 10) · 0260–0279 accounts (phase 11, branch `feat/accounts`) · 0250–0259 per-scenery flora and fauna (phase 12; S11 keeps 0248) · 0280–0299 phase 12 art tasks (only for real decisions).

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
| S4 | Waterfall geometry and slots (pool, stream, falls, ledges, explicit per-depth scale), habitat words, view focus, sky numbers; behind a dev flag | `src/scenery/waterfall/{geometry,slots,layout,index}.ts` | done (49 slots, every species placeable, lotus 2 pool spots; falls left of centre, open sky to the right; behind `?dev&scenery=waterfall`; ADR 0245) |
| S5 | Gardens dock section with painted thumbnails, stage chip, pill offer "go to its garden", per-garden copy | `src/ui/**`, `src/scenery/thumbnail.ts`, `src/main.ts` | done (UI spots and words follow the garden on view, planting in the waterfall end to end, Gardens section with stills, pill "Growing in the waterfall · Go"; thumbnails are camera stills, not painted overviews; ADR 0244) |
| S6 | Waterfall painters: rocks, cliffs, ledges | `src/scenery/waterfall/{paint-rocks,sprites}.ts` | done (strata, wet streaks, moss ledges, own wet and mossy boulders; `SceneArt.rockSprites` hook; devlog 64) |
| S6b | Waterfall rock forms (orchestrator review of S6): the buttress reads as a smooth rounded lump, ledges as flat trays stuck on the wall, the cliff top is nearly level; break the outlines (layout `CLIFF`), soften ledge shadows into the face, give the skyline a stepped broken edge and the gorge more presence; the buttress's right flank reads see-through against the ridge in every phase (S10 review) | `src/scenery/waterfall/{layout,paint-rocks}.ts` | queued |
| S10b | Shared shadows and rim light follow the scenery's sun side (at the waterfall the sun sets on the right, but boulder shadows fall right and rim light comes from the left); a per-scenery field, contract change | `src/ambience`, `src/scenery/types.ts` | queued |
| S5b | Garden thumbnails painted from each scenery's cached overview instead of camera stills | `src/ui/gardens-section.ts`, `src/scenery/thumbnail.ts` | queued |
| S7 | Waterfall painters: falls, plunge pool, stream | `src/scenery/waterfall/paint-water.ts` | done (streaked falls on reserved paper, deep cool pool with ripples from the foot, pale stream with riffles; devlog 65) |
| S8 | Waterfall painters: vegetation and moss | `src/scenery/waterfall/paint-veg.ts` | done (far ridge, banks, meadow, crown woods, overhanging trees, ferns, foreground; devlog 67) |
| S9 | Animated falls, foam and spray (still under reduced motion, ≤ 1 ms a frame) | `src/scenery/waterfall/falls.ts` | queued (after S7; ADR 0246) |
| S10 | Waterfall daylight: 4 sky plates, pool plate, light plates, grades | `src/scenery/waterfall/{sky,light}.ts` | done (4 sky plates cut to the skyline, pool plate, cliff shadows and crown light, moonlit falls at night; ADR 0247) |
| S11 (old) | superseded by the phase 12 S11 row below | — | moved |
| S12 | Iwana char in the plunge pool (renamed from trout: introduced trout are invasive in Japanese headwaters, B0) | `src/fauna/creatures/iwana.ts` | queued (after S11) |
| S13 | Dipper on the wet rocks | `src/fauna/creatures/dipper.ts` | queued (after S11) |
| S15 | Waterfall sound bed (`falls` layer, roar, rumble, spray hiss, splash events, dipper song) | `src/audio/**`, `src/core/soundscape.ts`, `src/ui/sound-mixer.ts` | queued (after S1, S3; ADR 0249) |
| S17 | Acceptance and docs: SPEC, ARCHITECTURE, `docs/systems/scenery.md`, TESTING matrix, a v3 export imports, switch-time numbers, shots of both gardens | `docs/**`, `tests/**` | queued (last) |

Phase 11 (deferred by the owner on 2026-10-28 to a later session; owner request 2026-10-27, branch `feat/accounts`, not merged to main): simple user/password accounts, with progress stored in a database. Local setup only: a Node (Fastify) server, Postgres in Docker. Owner decision: guest mode stays local, and signing up offers to import the local garden.

Phase 12 (owner request 2026-10-31): the waterfall gets its own flora and fauna. Research what grows and lives in such a biome, then create the plants and creatures for it. The plan is about 10 sceneries in the future, each with special plants and fauna. A species can be shared between sceneries where biology and geography allow, but each garden must feel unique. Owner decisions: research chooses the region; about 12 plants and 8 creatures of its own; species are shared by biology. Up to 3 agents at a time, with the same art process (the `drawing-assets` skill).

| # | Task | Area | Status |
|---|---|---|---|
| B0 | Biome research (web, read-only): candidate regions for a rocky waterfall, their flora and fauna, distinctiveness and paintability; a habitat taxonomy for about 10 future sceneries; what is shared with the Japanese garden | scratch report | done (recommended: a Japanese cool-temperate beech-forest mountain gorge, Oirase / Nikkō; 12 plants, 8 creatures; shared by biology: maple, maidenhair fern, violet, wild strawberry, susuki; striders, aka-tombo, swallowtail, bees, wagtail, heron, leaf; a taxonomy of 10 sceneries) |
| B1 | Code audit (read-only): species and creature registries, tiers, habitats and slots, unlocks, studio, tests; a per-scenery availability contract; an "add a species" / "add a creature" recipe | scratch report | done (registry already globbed; plants have no unlock progress, tiers come from session length; no schema change; faunaSeen reader bugs; fitted perspective 7–15 % off at the waterfall; recipes) |
| F1 | Species availability per scenery: a range on each species (realms, biomes, climates, `cultivatedIn`), a biome profile on each scenery plus `also`/`except`, `floraOf`; core, planting sheet, herbarium and dev hooks per garden; flora invariants; `nativeLang` | `src/plants/{types,flora,biomes}.ts`, `species/*.ts` (range line only), `src/scenery`, `src/core/{controller,state}.ts`, `src/dev`, `src/ui/{planting-sheet,herbarium,plant-card,types,index}.ts`, `src/main.ts` | in progress (ADR 0250) |
| F2 | Scaffolding so species tasks only add files: notes per species (globbed), family test suites, `species/<id>.test.ts`, line-up studio per scenery, `docs/systems/species-recipe.md`; narrow `PAINT_ROOTS` so art merges stop invalidating cached landscapes | `src/plants/notes*`, `src/plants/lib/*.test.ts`, `src/plants/lib/suites.ts`, review studios, `src/paint/paint-version.ts` | in progress (ADR 0251) |
| S11 | Wildlife per scenery (scope widened by B1): a creature registry (one default-exported def per file), unlock tables per scenery (the waterfall's 8 rows up front), remove `wild()`, fix the `faunaSeen` readers and `fauna:arrived` payload, waterfall targets (pool minus foam, stream, ledge perches, heron stands), `perspective(x, y)`, a falls studio stage | `src/fauna/**`, `src/core/fauna-unlocks.ts`, `src/scenery/*/fauna.ts`, `src/ui/{quiet-line,format}.ts`, `tests/e2e/fauna*.spec.ts` | in progress (ADR 0248) |
