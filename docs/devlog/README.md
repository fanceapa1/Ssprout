# Devlog

One short entry per task: what was done, why, what is left. Numbered in the order the tasks
landed. Entries are a historical record. They describe the code *as it was when the task ended*,
so later entries and the system docs (`docs/systems/`) win where they disagree.

**Adding an entry:** `NN-slug.md` with the next number, sections *What*, *Why/decisions* (link the
ADRs), *Tests*, *Left / for others*; add a row here in the same commit.

| # | Entry | Summary | ADRs |
|---|---|---|---|
| 01 | [Foundation](01-foundation.md) | Vite/TS/Vitest/Playwright scaffold, contract types, placeholder scene, studio, `npm run shots`, CI and Pages | 0010–0013 |
| 02 | [Paint engine](02-paint-engine.md) | Noise, pigments, wet layers with a drying pass, primitives, recipes; critique rounds | 0020–0022 |
| 03 | [Core logic](03-core-logic.md) | Reducer, session maths, rewards, persistence, controller; then revised to plan-based sessions | 0030–0036 |
| 04 | [Procedural audio](04-audio.md) | Muted-by-default Web Audio soundscape driven by pure data | 0100–0103 |
| 05 | [UI shell](05-ui.md) | Timer panel, planting sheet, placement, menu, tips, quiet line, herbarium, washi slips | 0050–0055 |
| 06 | [Widget, tab surfaces & notifications](06-widget.md) | Worker ticker, tab title/favicon, notifications + service worker, PiP card, plant-view seam | 0090–0094 |
| 07 | [Scene](07-scene.md) | The real painted garden: geometry, 52 slots, boulders as entities, paper layer | 0040–0043 |
| 08 | [Plant species A (tiers 1–2)](08-plants-a.md) | 13 small species, shared helpers, the continuity test | 0060–0063 |
| 09 | [Plant species B (tier 3)](09-plants-b.md) | Six shrubs and flowers, batched wet layers | 0064–0066 |
| 10 | [Plant species C (tier 4)](10-plants-c.md) | Six trees, skeleton-first plans, batched layers | 0067–0069 |
| 11 | [Fauna](11-fauna.md) | FaunaSim, residents and visitors, painted parts, frame cost | 0070–0074 |
| 12 | [Ambience & lighting](12-ambience.md) | Weather, motes, wind field, time-of-day multiply wash, envelopes | 0080–0084 |
| 13 | [Plant system](13-plant-system.md) | Worker sprite cache, growth morph, sway, wither, watering, reflections, placement highlight | 0110–0118 |
| 14 | [Polish](14-polish.md) | End-to-end review rounds: placeholder out, tier-1 sizes, pond/engawa, path, tips one at a time, arrivals on sight, phone framing | 0120–0127 |
| 15 | [QA & docs](15-qa-docs.md) | Requirements → tests matrix, gap tests, deterministic e2e under load, CI gating of Pages, docs audit, README | 0014–0015 |
| 16 | [App shell](16-app-shell.md) | Scrolling page: garden stage with a dissolving edge, dock of sections, smooth scroll + brush scrollbar, timer pill, Your plant, tools twice, bigger darker type | 0130–0136 |
| 17 | [Daylight & colour](17-daylight-and-colour.md) | Real sun times, four painted daylight phases (skies, light plates, shadows, rims, mist, moon), richer pigments, plants 1.25×, plantsReady fix | 0140–0149 |
| 18 | [Parallel sessions & focus watering](18-parallel-sessions.md) | Up to three sessions (one active, others waiting), switch, session log, schema v2 migration, automatic focus watering, sessions in the Study section, pill "+N", widget switch | 0150–0157 |
| 19 | [Camera & plant cards](19-camera-and-plant-cards.md) | Camera over the overview viewport (zoom 1–3, glides, gestures, + / − / Whole garden), focus on the seedling on start/switch, detail painted for close views, sprites following the zoom, painted-pixel hit-test, plant card with a note for every species | 0160–0168 |
| 20 | [Calendar & scheduling](20-calendar.md) | Daily / Weekly / Monthly calendar in the dock, scheduled sessions (rule + notes, DST-safe repeats), waiting card with one-tap prefilled Start, missed after a grace window, link back to done, soft notification on the worker tick | 0170–0177 |
| 21 | [v2 polish, part 1](21-v2-polish.md) | Tools visible at rest, tips that ride with the page, a watering pour, lifted midday whites and a night edge, week blocks at their drawn size, a round plant window, the card's type, a fresh-eyes pass | 0180–0184 |
| 22 | [Close-view art](22-close-view-art.md) | Close views painted to lean into: no seams (continuous paper margins, world-anchored flow, exact cross-fades, feathered pond sky), meadow and bark texture, plants as solid paint, creatures sharp at rest, a phone's sides painted early, plant-view can and thumbnail framing | 0185–0189 |
| 23 | [v2 polish, part 2](23-v2-polish-2.md) | Sheets on a leaf of washi with the page locked, the plant card readable on phones, the day view following now, painted day/time pickers in the calendar's formats, the sun as a lifted glaze, an inked sprout and brush marks instead of red dots, a fresh-eyes pass | 0190–0194 |
| 25 | [Dock wayfinding](25-dock-wayfinding.md) | One reading spine, helper lines, one primary per state, a guiding ink path from the stepping stones through the dock, the pill top-left and stepping aside, one hover language, stable session order, seeds that read | 0200–0204 |
| 26 | [Q1: the lotus is plantable](26-lotus-plantable.md) | Real-flow e2e proves the lotus plants in `water-1`/`water-3`; the report came from stale docs; a species whose every spot holds a growing seedling is shown full in the sheet | 0205 |
| 27 | [Night zoom edge](27-night-zoom-edge.md) | Q2: no hard line at y 500 (where the sky plate stops) in a night close view; the night's saturation glaze over a white-backed frame, a row-step regression test | 0206 |
