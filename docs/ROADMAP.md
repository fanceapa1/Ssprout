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
0190–0194 v2 polish 2 · 0200–0204 dock wayfinding · 0205+ queue tasks (Q1 0205, Q2 0206, Q3 0207, Q11 0208–0209, Q13 0210) · 0220–0239 performance (phase 9, one block of numbers per task).

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
| P2 | Planting sheet opens at once; previews fill in as they land (visible first), prewarmed on idle and on hover/focus of Start studying | `src/ui/planting-sheet.ts`, `src/ui/previews.ts` | in progress (ADR 0222) |
| P3 | Dock backdrop noise: build each tear once per seed, cheap edge noise, identical SVG output | `src/ui/backdrop-sheet.ts` | done (86 → 9 ms first layout, 78 → 4 ms per resize, SVG byte-identical; ADR 0223) |
| P4 | Pause the render loop while the garden stage is scrolled out of view | `src/render/renderer.ts`, `src/main.ts` (1–2 lines) | in progress (ADR 0224) |
| P5 | Defer below-the-fold dock painting (plant section, backdrops, wayfinding) until after the garden's first pixels and until near the viewport; no synchronous plant-section paint on Begin | `src/ui/plant-section.ts`, `src/ui/backdrop.ts`, `src/ui/index.ts` | queued (ADR 0225) |
| P6 | Split long scene paint steps so the cooperative painter yields every ~20 ms (load and close-view detail repaint) | `src/scene/background.ts`, `src/scene/paint-*.ts`, `src/scene/sprites.ts` | queued (ADR 0226) |
| P7 | Persistent paint cache module: IndexedDB blob store, versioned keys, LRU byte cap, null adapter | `src/paint/persist.ts` (new), `vite.config.ts` define | queued (ADR 0227) |
| P8 | Garden background from the persistent cache: a repeat visit shows the landscape without repainting it | `src/scene/system.ts`, `src/scene/background.ts` | queued (after P7; ADR 0228) |
| P9 | Service worker build manifest (precache list and version written into `dist/sw.js`) | `vite.config.ts` plugin, `scripts/` | queued (ADR 0229) |
| P10 | Service worker caching: precache, cache-first hashed assets, network-first HTML, old-version cleanup; notifications untouched | `public/sw.js` | queued (after P9; ADR 0230) |
| P11 | Service worker registered at boot (idle, after the landscape); e2e blocks service workers by default, `sw.spec.ts` | `src/widget/notifications.ts`, `src/main.ts` (1 line), `playwright.config.ts`, `tests/e2e/sw.spec.ts` | queued (after P10) |
| P12 | Fonts start loading before boot (preload/`document.fonts.load` of the 5 first-view files), one wave | `index.html` or `vite.config.ts`, `src/ui/index.ts` font imports | queued (ADR 0231) |
| P13 | Font trim (owner: Latin only): own `@font-face` for Latin + Latin-ext woff2, only the weights used, no woff | `src/ui/fonts.css` (new), `src/widget/index.ts` imports | queued |
| P14 | Boot in stages, garden first: paper and scene start painting before plants, fauna, ambience and the dock; ambience sprites built per phase on first use | `src/main.ts`, `src/ambience/sprites.ts`, `src/ambience/ambience.ts` | queued (ADR 0232) |
| P15 | The `?dev` API is loaded only with `?dev` (dynamic import, atomic `window.sprout`) | `src/main.ts`, `src/dev/install.ts` (new) | queued (ADR 0233) |
| P16 | Lazy chunks for what is not visible, one task each: a fauna · b audio · c PiP art · d sheets and cards · e calendar; prefetched on idle; reload-once on a stale chunk | per sub-task | queued (ADR 0234) |
| P17 | Idle callbacks respect their deadline (sky next-phase, cast prepare, sprite `runIdle`) | `src/scene/sky-light.ts`, `src/scene/system.ts`, `src/ambience/cast.ts` | queued (ADR 0235) |
| P18 | Sky and light plates from the persistent cache | `src/scene/sky-light.ts`, `src/ambience/lighting.ts` | queued (after P7; ADR 0236) |
| P19 | Spike, then build if it pays: scene painting in a worker (OffscreenCanvas) | `src/scene/*`, worker | queued (ADR 0237) |
| P20 | Scroll path: tips, format and wayfinding read layout once per frame | `src/ui/tips.ts`, `src/ui/format.ts`, `src/ui/wayfinding.ts` | queued |
