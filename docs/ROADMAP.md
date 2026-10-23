# Roadmap & task ownership

The project is built by an orchestrator delegating to agents working in parallel git
worktrees (max 2 concurrent from phase 5 on). **Only the orchestrator edits this file** (agents report status in their devlog).

ADR numbering ranges (to avoid collisions in parallel work):
0001–0009 orchestrator · 0010–0019 foundation · 0020–0029 paint · 0030–0039 core logic ·
0040–0049 scene · 0050–0059 UI · 0060–0069 plants (0060–0063 A, 0064–0066 B, 0067–0069 C) ·
0070–0079 fauna · 0080–0089 ambience/lighting · 0090–0099 widget/notifications ·
0100–0109 audio · 0110–0119 plant view/growth/watering · 0120–0129 integration/polish ·
0130–0139 app shell & dock · 0140–0149 daylight & colour · 0150–0159 parallel sessions & watering ·
0160–0169 camera & plant descriptions · 0170–0179 calendar & scheduling · 0180–0189 v2 QA/polish.

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
| 7 | Camera: focus zoom on start / click, gentle pinch/ctrl-wheel zoom and pan, Whole-garden control, sharp sprites when zoomed, plant description card (species notes for every species) | `src/render/**` (camera), `src/plants/**` (hit-test, notes), `src/ui/plant-card*` | in progress |
| 8 | Calendar & scheduling: day/week/month (default day), history + scheduled sessions, one-off/daily/weekdays/weekly repeats, notify + one-tap prefilled start, missed state | `src/core/schedule*`, `src/ui/calendar*` | done |
| 8 | v2 QA & docs: SPEC/ARCHITECTURE/TESTING audit, gap tests, flakiness, performance on a busy page | `tests/**`, `docs/**` | queued |
