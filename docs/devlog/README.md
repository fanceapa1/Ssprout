# Devlog

One short entry per task: what was done, why, what is left. Numbered in the order the tasks
landed. Entries are a historical record. They describe the code *as it was when the task ended*,
so later entries and the system docs (`docs/systems/`) win where they disagree.

**Adding an entry:** `NN-slug.md` with the next number, sections *What*, *Why/decisions* (link the
ADRs), *Tests*, *Left / for others*; add a row here in the same commit. Numbers 24 and 32 were
never used.

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
| 28 | [Q3: frame cost at rest while zoomed](28-zoomed-frame-cost.md) | Measured with whole main-thread time (raster included) instead of the frame callback; CPU vs GPU raster; sprites blit only their ink; the resting light plate laid 1:1 at device resolution; fill counters and a zoomed/overview rest-cost e2e | 0207 |
| 29 | [Night depth](29-night-depth.md) | Q2b: the night's weight back on the thin paint of the lower frame through the night grade (amount 0.54, sky 0.22, ground 1.2), indigo rather than grey; an e2e band on the lower frame's luminance and colour against midday | 0206 |
| 30 | [v2 acceptance](30-v2-acceptance.md) | Q8: every ADR 0005 request and decision and the later owner requests mapped to code and tests (41 rows: 36 ✔, 3 ◐, 2 ✘); new e2e for cancel-one, the switch tip, double tap, the replaced line, hover families, type, 1.25× and chroma; two UI bugs kept as `test.fail()` | — |
| 31 | [Q9a: tests that fail at some hours](31-time-pinned-tests.md) | `schedule.demo()` waited at whatever hour it ran (nothing due after 16:40); now always opens at the next 16:10; `sprout.advanceTo('HH:MM')` and `E2E_CLOCK` pin the time of day; DST-safe day steps in the calendar spec; two calendar UI bugs found (DST day window, follow lost mid-glide) | — |
| 32 | [Q11: section backdrops](32-section-backdrops.md) | Every dock section on its own seeded, torn leaf of the page's washi with a pooled wash under it; headings on the sheet, the path outside; the calendar's sheet firm with firmer blocks; re-layout on size changes only; contrast from pixels in four lights | 0208 |
| 33 | [Q13: the calendar on a daylight-saving day](33-calendar-dst.md) | The day timeline is a 24-hour wall-clock face (opening window, now line, blocks and following count wall minutes; the repeated autumn hour folds onto one band); following no longer stops when the hours are redrawn mid-glide; unit tests across both 2026 changes, e2e pinned to 25 Oct in Europe/London | 0210 |
| 34 | [Q14: sheet focus clears the sticky footer](34-sheet-focus-scroll.md) | `scroll-padding` on every sheet's scroller, sized to a measured sticky footer plus the torn edge; an instant reveal; e2e tabs to the last plant card at 1440×900 and 390×844 and through the schedule sheet's pickers | — |
| 35 | [Q9: docs audit](35-docs-audit.md) | SPEC, ARCHITECTURE, AGENTS, README, ART_DIRECTION and every system doc checked against the code; 33 missing "amended by" back-links and a phantom 0190 row fixed; three code issues recorded (audio weather on switch, favicon dot, a stale comment) | — |
| 36 | [Q15: audio follows the active session](36-audio-follows-active.md) | The weather bed and session activity re-read `state.session` on every session event: a switch brings the new active weather, ending a waiting session changes nothing, a bloom with others waiting goes quiet; tests through the real controller | — |
| 37 | [Q12: a small × to dismiss a tip](37-dismissible-tips.md) | Every tip note has a small inked × (a named button, 32 px target): it or Esc in the note retires the tip as dismissed (saved, listed as learned under ⓘ), focus returns to its control, the next tip waits for the fade and the quiet line; Tab threaded from a control to its ×; e2e by mouse, keyboard, Esc and tap | 0211 |
| 38 | [Q16: no round dot in the favicon](38-favicon-mark.md) | An unseen bloom closes the favicon ring around the sprout mark (ink, sap-green leaves) instead of a vermilion dot, the notification icon too; a 64 px PNG; `rasterContext` pixel tests at 16–96 px on light and dark strips; e2e reads the real favicon; studio `widget/favicon-sizes` | 0194 (amended) |
| 39 | [Q17: a taller garden stage](39-taller-stage.md) | The garden stage is 94svh (was 88): landscape screens show more sky above the hills, phones the same garden on a taller stage; tests and docs at 94 % | 0212 |
| 40 | [Standard and scenery sound mixer](40-sound-mixer.md) | Nine Standard sounds, a palette and remembered mix per scenery, reversible Follow the garden, lazy synthesized beds, quiet fades, a paper mixer with sticky playback, validated exports and real offline audio checks | 0213 |
