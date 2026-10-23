# Architecture decision records

One file per decision: `NNNN-slug.md` with Status, Date, Context, Decision, Consequences.
Numbers are reserved in blocks by area so parallel agents never collide (see `docs/ROADMAP.md`):
0001–0009 orchestrator · 0010–0019 foundation, tooling and tests · 0020–0029 paint ·
0030–0039 core logic · 0040–0049 scene · 0050–0059 UI · 0060–0069 plant species ·
0070–0079 fauna · 0080–0089 ambience/lighting · 0090–0099 widget/notifications ·
0100–0109 audio · 0110–0119 plant view/growth/watering · 0120+ integration/polish.
Gaps between blocks are expected.

**Adding an ADR:** take the next free number in your area's block, add a row here in the same
commit, and when it replaces or changes an earlier decision, update that ADR's Status line too
("superseded by …" / "amended by …").

| ADR | Title | Status | Summary |
|---|---|---|---|
| [0001](0001-founding-decisions.md) | Founding decisions | accepted; §2 superseded by 0003 | Procedural watercolour, 10–180 min sessions, 4 tiers, PiP/title timers, one fixed garden, localStorage, no server |
| [0002](0002-pending-reward-blocks-new-session.md) | Pending reward blocks a new session | **superseded** by 0003 | A pending end-of-session reward blocked starting a new session |
| [0003](0003-plant-chosen-at-start-with-study-plans.md) | Plant chosen at start; study plans with watering breaks | accepted | One plant per session, chosen up front, grows live; breaks are for watering; skipping allowed |
| [0004](0004-disable-vitest-fs-module-cache.md) | Disable Vitest's fs module cache | accepted | `fsModuleCache: false` so `import.meta.glob` finds newly added species files |
| [0005](0005-app-shell-multi-session-camera-calendar-daylight.md) | App shell, parallel sessions, camera, calendar, daylight (v2) | accepted | Scrollable page with a UI dock below an 88 %-high garden, up to 3 sessions, focus camera, scheduling calendar, 4 sun-timed daylight phases, bolder type and colour, plants 1.25× |
| [0006](0006-lazy-studio.md) | The studio paints lazily | accepted | Cards paint when near the screen within a 10 ms frame budget, far cards release their pixels; `studio.settle()` for tests/shots |
| [0010](0010-e2e-against-preview-build.md) | E2E against the preview build | accepted | Playwright tests the production build via `vite preview`; `E2E_PORT`, `E2E_REUSE`; console errors fail tests |
| [0011](0011-store-design.md) | Tiny synchronous store | accepted | `createStore(initial, reducer, onChange?)`; same reference = no change; re-entrant dispatches queued |
| [0012](0012-rng-forks-from-seed.md) | mulberry32; forks from the seed | accepted | Hashed string seeds; `fork(label)` depends only on seed and label, not stream position |
| [0013](0013-studio-page.md) | Studio page | accepted | Second Vite entry; `*.studio.ts` sections discovered by glob; URL controls |
| [0014](0014-deploy-pages-after-ci.md) | Deploy to Pages only after CI | accepted | `pages.yml` runs on a successful CI `workflow_run` for main and builds that exact commit |
| [0015](0015-deterministic-e2e-under-load.md) | Deterministic e2e under load | accepted | Explicit readiness signals, in-page sampling and loops, pinned light, sharded studio, calm UI motion |
| [0020](0020-wet-layers-and-pixel-drying-pass.md) | Wet layers and a pixel drying pass | accepted | Pooled CPU wet layers; `dryPixels` adds edge darkening, granulation and flow |
| [0021](0021-paint-on-white-paper-multiplied-last.md) | Paint on white; paper multiplied last | accepted | Everything is painted on white; washi texture is multiplied over the frame at the end |
| [0022](0022-organic-outline-families.md) | Organic outline families | accepted | Capped recursive deformation, median contour, `innerClip` for organic shapes |
| [0030](0030-reducer-validates-with-injected-world.md) | Reducer validates with an injected world | accepted; amended by 0036 | Invalid actions are no-ops returning the same reference; tier/slot checks via `ReducerWorld` |
| [0031](0031-offer-generation.md) | Reward offer generation | **superseded** by 0003/0036 | The old 3-species end-of-session offer (removed) |
| [0032](0032-session-controller.md) | Session controller is the single UI API | accepted; API revised by 0036, 0150 | Only dispatcher of session actions; injectable ticker; completes due sessions on boot |
| [0033](0033-persistence-format-and-recovery.md) | Persistence format and recovery | accepted; first migration 0154 | Stable key, chained migrations, corrupt data backed up, 300 ms debounced saves |
| [0034](0034-hand-written-validation.md) | Hand-written validation | accepted; amended by 0036 | Lenient on missing keys, strict on types; unknown species kept and flagged |
| [0035](0035-dev-clock-jump.md) | Dev clock jump | accepted | `advance(ms)`; dev break/complete helpers jump time, then `check()` |
| [0036](0036-plan-based-sessions-in-core.md) | Plan-based sessions in core | accepted; amended by 0150 | Plans, plan position, growth = focus fraction, water/skip, block events |
| [0040](0040-scene-owns-the-paper-layer.md) | Scene owns the paper layer | accepted | `createPaperSystem` draws the washi texture, composited last |
| [0041](0041-background-paint-cache-and-fade.md) | Background paint cache and fade | accepted | Cached painting, rescale ≤ 10 %, repaint in 20 ms slices, 1.2 s cross-fade |
| [0042](0042-boulders-and-tufts-as-entity-sprites.md) | Boulders and tufts as entity sprites | accepted | Foreground rocks and tufts depth-sorted with plants by base y |
| [0043](0043-slot-perspective-and-plant-sizes.md) | Slot perspective and plant sizes | accepted; plants drawn 1.25× by 0148 | Scale 0.55 → 1.15 with y; `PLANT_SIZES` per size class; trees only on the far bank |
| [0050](0050-dom-ui-over-canvas.md) | DOM UI over the canvas | accepted | DOM in `#ui`, controller only; slot markers are buttons |
| [0051](0051-dialog-strategy.md) | Dialog strategy | accepted | Native `<dialog>` sheets; placement is a non-modal mode |
| [0052](0052-washi-slips-as-generated-svg.md) | Washi slips as generated SVG | accepted | Seeded deckled SVG backgrounds, grain, ink icons |
| [0053](0053-planting-sheet.md) | Planting sheet | accepted | One sheet (task, time, plan, plant) → placement → Begin → `controller.start` |
| [0054](0054-quiet-line-and-fauna-announcements.md) | Quiet line and fauna announcements | accepted; trigger changed by 0120 | One quiet line at a time for completions and arrivals |
| [0055](0055-dev-fixture-species.md) | Dev fixture species | accepted | 12 `fx-*` species under `?dev&fixtures` for stable UI tests |
| [0060](0060-plan-then-render-growth.md) | Plan, then render growth | accepted | Pure species plan from `rng.fork('plan')`; growth only transforms it |
| [0061](0061-continuous-growth-test.md) | Continuous growth test | accepted | Recording painter + 200-step continuity test for every small species |
| [0062](0062-bud-dissolves-into-flower.md) | Bud dissolves into flower | accepted | Cross-dissolve inside one render, no threshold switch |
| [0063](0063-opaque-light-marks-on-sprites.md) | Opaque light marks on sprites | accepted | Light marks dried source-over; small overlaps merged |
| [0064](0064-build-then-reveal-growth.md) | Build, then reveal growth | accepted | Shrubs built once from the rng; elements have growth windows |
| [0065](0065-batched-wet-layers-for-shrubs.md) | Batched wet layers for shrubs | accepted | 14–18 drying passes per shrub, 26–57 ms |
| [0066](0066-projected-petal-rings.md) | Projected petal rings | accepted | 3-D petal rings with an opening parameter; buds are folded flowers |
| [0067](0067-tree-skeleton-first-growth-reveals.md) | Tree skeleton first | accepted | Full skeleton with growth windows; `treeView` maps growth |
| [0068](0068-stable-rng-per-mark-and-drying-pass.md) | Stable rng per mark and drying pass | accepted | One fork per mark; drying passes get their own stream |
| [0069](0069-batched-tree-layers-and-soft-resolution.md) | Batched tree layers, soft resolution | accepted | Shared layers; soft passes at 0.6 resolution |
| [0070](0070-fauna-sim-behind-the-system.md) | Fauna sim behind the system | accepted | `FaunaSim` owns behaviour and time; thin System wrapper (`createFauna`) |
| [0071](0071-painted-parts-composed-per-frame.md) | Painted parts composed per frame | accepted | Creature parts painted once, composed per frame with transforms |
| [0072](0072-pond-plane-coordinates.md) | Pond-plane coordinates | accepted | Water creatures simulate in an unsquashed pond plane |
| [0073](0073-visit-scheduling.md) | Visit scheduling | accepted | Residents kept alive; visitors with long gaps, cap 3, retries |
| [0074](0074-perched-creature-depth.md) | Perched creature depth | accepted | Depth = the support's base y + ε |
| [0080](0080-ambience-engine-behind-a-thin-system.md) | Ambience engine behind a thin system | accepted | Engine plus adapter; `addAmbience` registers it |
| [0081](0081-critically-damped-envelopes-and-ambience-time.md) | Critically damped envelopes | accepted | Spring channels per phase; particles run on `dt × motion` |
| [0082](0082-lighting-as-a-reserved-multiply-wash.md) | Lighting as a reserved multiply wash | accepted; the wash is now the base of each phase's light plate (0141, 0147) | Cached multiply wash, paper reserved around the lantern, repaint ≤ every 3 s |
| [0083](0083-wind-field-contract.md) | Wind field contract | accepted | Pure seeded `wind(t, x, y, boost)` with travelling gust fronts; `windBoost` |
| [0084](0084-particles-as-poisson-spawns-with-prepainted-sprites.md) | Poisson particles, pre-painted sprites | accepted | Rain, ripples, glints, motes; still frame under reduced motion |
| [0090](0090-worker-ticker.md) | Worker ticker | accepted | Inline Blob worker with interval fallback, installed via `setTicker` |
| [0091](0091-notification-policy.md) | Notification policy | accepted | Ask at the first start; notify only when unattended; one tag |
| [0092](0092-notifications-only-service-worker.md) | Notifications-only service worker | accepted | `public/sw.js` handles clicks only |
| [0093](0093-floating-card-dom-over-canvas.md) | Floating card: DOM over canvas | accepted; amended by 0157 | `mountCard(window)`, `HostOpener`, `WidgetController` |
| [0094](0094-plant-view-seam.md) | Plant view seam | accepted; internals replaced by 0118 | Fixed `renderPlantView` signature for widget and previews |
| [0100](0100-procedural-audio-as-data.md) | Procedural audio as data | accepted | Pure planner and recipes over a thin Web Audio backend |
| [0101](0101-audio-gating-and-fades.md) | Audio gating and fades | accepted | Muted by default, gesture unlock, 2 s fades, suspend when muted |
| [0102](0102-audio-clock.md) | Audio clock | accepted | Scheduling on the AudioContext clock; `Clock` only gives the hour |
| [0103](0103-audio-levels.md) | Audio levels | accepted | Gains ≤ 0.12, master 0.8, compressor; chimes outside the mist filter |
| [0110](0110-growth-steps-cross-fade-and-morph.md) | Growth steps: cross-fade and morph | accepted | 24 growth steps; neighbour cross-fade with a clamped morph |
| [0111](0111-sprites-painted-in-workers.md) | Sprites painted in workers | accepted | Priority queue, up to 2 module workers, idle-callback fallback |
| [0112](0112-sprite-lru-and-resolution-buckets.md) | Sprite LRU and resolution buckets | accepted | Quarter-octave buckets; byte-budgeted LRU |
| [0113](0113-sway-skew-bend-and-wind-adapter.md) | Sway: skew, bend, wind adapter | accepted | Skew small plants, 6-slice bend for large ones; driven by the ambience wind |
| [0114](0114-watering-animation.md) | Watering animation | accepted; amended by 0155 | Pure 2.5 s timeline; painted can and droplets on `air`; damp soil lingers |
| [0115](0115-wither-from-store-actions.md) | Wither from store actions | accepted; amended by 0155 | Cancel → 3 s wither; completion hands the growth over without a gap |
| [0116](0116-reflections-about-the-local-shoreline.md) | Reflections about the local shoreline | accepted | Mirror about the plant's base or the nearby pond edge |
| [0117](0117-placement-highlight-in-canvas.md) | Placement highlight in the canvas | accepted | The plant system echoes `ui.placement` with dabs and a ghost plant |
| [0118](0118-plant-view-on-the-plant-system.md) | Plant view on the plant system | accepted | View uses its own sprite cache plus the shared watering and wither |
| [0120](0120-fauna-arrival-on-first-sight.md) | Creature announced on first sight | accepted | `fauna:arrived` comes from the fauna system when a creature is first in view, not on unlock |
| [0121](0121-ui-under-the-gardens-light.md) | UI under the garden's light | accepted | DOM slips dim with the lighting; the light eases in only once the painting is ready |
| [0122](0122-engawa-on-the-bank.md) | Engawa on the bank; a walked stone path | accepted | Pond pulled back from the pavilion; six broad stones winding to the water |
| [0123](0123-portrait-minimum-visible-width.md) | Tall phones see ≥ 600 world units | accepted | Portrait viewport shows at least 600 units of width, paper above and below |
| [0124](0124-one-tip-at-a-time.md) | One tip at a time | accepted | Tips by priority, one visible; they wait while the quiet line speaks |
| [0125](0125-small-plant-design-box.md) | Small-plant design box | accepted | Tier-1 plants draw in a 70-unit design box scaled into a larger garden box (86) |
| [0126](0126-open-sides-in-the-drying-pass.md) | Open sides in the drying pass | accepted | No false wet edge where a wash is cut off by the canvas |
| [0127](0127-timer-slip-in-the-corner.md) | Timer slip in the corner | superseded by 0133 | The timer panel lies in the lower-left corner on wide screens |
| [0130](0130-page-shell-stage-and-dock.md) | Page shell: stage and dock | accepted; amended by 0156, 0175 | Garden stage 88svh under a small margin; a registry of dock sections below; calendar placeholder hidden (filled by 0175) |
| [0131](0131-custom-smooth-scroll-and-scrollbar.md) | Custom smooth scroll and scrollbar | accepted | Native document scroll, eased wheel/keys, glided jumps, touch native, reduced motion instant; brush scrollbar |
| [0132](0132-garden-edge-mask-and-page-paper.md) | Garden edge mask, page paper | accepted | The canvas dissolves into the page through a CSS mask; the page tile is the garden's own washi |
| [0133](0133-timer-pill-on-the-garden.md) | Timer pill on the garden | accepted; amended by 0156 | Only a small pill (time, pause/resume, go to controls) stays on the painting |
| [0134](0134-your-plant-view.md) | Your plant view | accepted | Live `renderPlantView` in the dock; plays watering on `session:water` or `water()`; latest bloom when idle |
| [0135](0135-garden-tools-twice-one-state.md) | Garden tools twice, one state | accepted | One tool set rendered in the corner and the dock; bigger, clearer ink icons on paper chips |
| [0136](0136-bigger-darker-type.md) | Bigger, darker type | accepted | Base 21 px, weight 500, ink tokens ≥ 4.5:1 checked by a test |
| [0140](0140-sun-times-from-the-time-zone.md) | Sun times from the time zone | accepted | NOAA sunrise/sunset/civil twilight for the solar day around now, location from a zone table or the UTC offset; no prompt |
| [0141](0141-four-daylight-phases.md) | Four daylight phases | accepted | Night/sunrise/midday/sunset on civil dawn, sunrise + 60, sunset − 60, civil dusk; 40-min blends; setTime phases, blends, aliases; fauna rests by phase |
| [0142](0142-one-sun-for-every-painted-thing.md) | One sun for every painted thing | accepted | Sky layout: sun over the right/left hills, moon arc, stars, cast shadow and rim light from one state |
| [0143](0143-one-shared-daylight-source.md) | One shared daylight source | accepted | `createDaylightSource` in main, passed to scene, plants, fauna and ambience |
| [0144](0144-richer-pigments.md) | Richer pigments | accepted | ~1.4× chroma for shared pigments, 1.3× for species colours, eight sky pigments; never neon |
| [0145](0145-painted-sky-plates.md) | Painted sky plates | accepted | One watercolour sky per phase multiplied in the background layer, sun and moon punched out, mirrored on the pond |
| [0146](0146-rim-light-and-cast-shadows-on-sprites.md) | Rim light and cast shadows on sprites | accepted | Cached edge masks drawn with screen; one painted shadow blot stretched under each plant |
| [0147](0147-painted-light-plates.md) | Painted light plates | accepted | Per-phase plate (grade wash, long shadows, crown lights, lamp light) blended with moving lights; night desaturates |
| [0148](0148-plants-1-25x-in-the-garden.md) | Plants 1.25× in the garden | accepted | `GARDEN_PLANT_SCALE` on every garden plant box; sprites painted larger; two slots moved |
| [0149](0149-plants-ready-means-shown.md) | plantsReady means shown | accepted | Waits for init, the store change, the sprites and the fade-in |
| [0150](0150-parallel-sessions-active-and-waiting.md) | Parallel sessions: active and waiting | accepted | `session` stays the active one, `waiting` holds up to two paused others; switch/start pause the active one; held slots |
| [0151](0151-session-log.md) | Session log | accepted | Append-only `log` of completed/cancelled sessions with wall times, focused minutes, plan, plant; pure local-calendar queries |
| [0152](0152-after-a-bloom-the-gardener-chooses.md) | After a bloom the gardener chooses | accepted | Completion/cancel leaves nothing active; the dock offers Resume on the session left last |
| [0153](0153-automatic-focus-watering.md) | Automatic focus watering | accepted | Seeded 4–10 min intervals of focused time; one `session:water { auto: true }` per due batch, only in focus |
| [0154](0154-schema-v2-migration.md) | Schema v2 and the v1 → v2 migration | accepted | v1 session stays active, nothing waits, log back-filled from plants; v2 validation rules |
| [0155](0155-several-seedlings-in-the-garden.md) | Several seedlings in the garden | accepted | One growing record per session in progress; waiting seedlings hold their growth and sway calm; water by `sessionId` |
| [0156](0156-sessions-in-progress-in-the-study-section.md) | Sessions in progress in the Study section | accepted | Rows with a live thumbnail, plan line, time left, Switch/Resume; "Plant another"; a gentle limit note; the pill's "+N"; a switch tip |
| [0157](0157-widget-follows-the-active-session-and-switches.md) | Widget follows the active session and switches | accepted | Title, favicon, notifications, card follow the active session; Switch cycles in start order; Resume when none is active |
| [0160](0160-camera-over-the-overview-viewport.md) | A camera over the overview viewport | accepted | Zoom ≥ 1 and a centre composed over the cover viewport; the renderer owns it; `renderer.viewport` is the camera's view; paper screen-fixed; reach widens to the whole world by 1.25×; max 3× |
| [0161](0161-background-caches-for-a-moving-camera.md) | Background caches for a moving camera | accepted | Overview cache blitted as a sub-rect while moving; a cache at the resting view; direct draw outside the overview's crop |
| [0162](0162-camera-glides-and-gesture-follow.md) | Camera glides and gesture follow | accepted | van Wijk–Nuij zoom-and-pan path with a breathing ease, 0.75–1.9 s; wheel/pinch follow (τ 75 ms); input interrupts; reduced motion cuts |
| [0163](0163-detail-for-the-resting-view.md) | Detail painted for the resting view | accepted | Scene repainted for the view (≤ 2.8 px/unit), sky's moon/sun/stars punched sharp, light plate marks repainted (≤ 2) in idle time |
| [0164](0164-zoom-gestures-and-controls.md) | Zoom gestures and controls | accepted | Plain wheel scrolls; ctrl/⌘ wheel and pinch zoom about the pointer; double-click/tap; drag only zoomed; touch-action switch; + / − / Whole garden chips; keys |
| [0165](0165-sprite-resolution-follows-the-camera.md) | Sprite resolution follows the camera | accepted | Plants in the detail view at its bucket, others at the overview's; max 6 px/unit, 2048 px per side; 96 MB; evict far-off high-res at rest |
| [0166](0166-hit-testing-painted-pixels.md) | Hit-testing painted pixels | accepted | Coarse alpha mask per sprite bitmap; front-most painted plant wins; tolerance in world units; labels and cards share it |
| [0167](0167-the-plant-card.md) | The plant card | accepted | Species, Japanese name, a note per species, poetic line, the plant's story; beside the plant or docked on phones; Esc/close/click away; the camera stays |
| [0168](0168-when-the-camera-moves-by-itself.md) | When the camera moves by itself | accepted | Glide to the seedling on start and switch, to the whole garden on placement; never re-zoom otherwise |
| [0170](0170-schedules-in-the-garden-state.md) | Schedules in the garden state | accepted | `state.schedules` (name, local date and time, optional length and plan, repeat, notes); optional key, no schema bump |
| [0171](0171-repeat-rule-plus-notes.md) | Repeats: a rule plus notes | accepted | One-off/daily/weekdays/weekly rule, per-occurrence notes, pure DST-safe expansion; "only this one" vs "this and following" as planned actions |
| [0172](0172-due-grace-window-and-missed.md) | Due, the grace window and missed | accepted | Due from its time until length (30 when open) + 30 min, then quietly missed; status derived, never stored |
| [0173](0173-prefilled-start-and-the-occurrence-link.md) | Prefilled start and the occurrence link | accepted | One-tap Start opens the planting sheet prefilled; the started session is linked by a note; at three in progress the card offers the sessions instead |
| [0174](0174-scheduler-tick-and-notification.md) | The scheduler's tick and the soft notification | accepted | The scheduler subscribes to the widget's worker ticker while schedules exist; `schedule:due` once per occurrence; the notifier's usual background-only policy |
| [0175](0175-calendar-section-painted-timeline-and-month.md) | The calendar section | accepted | Daily (default) / Weekly / Monthly, remembered per viewer; pure ranges, items and overlap layout; washes in each plant's colour, planned as broken ink, passed as ghosts; month of pigment dabs |
| [0176](0176-waiting-card-in-the-study-section.md) | The waiting card | accepted | A card at the top of the Study section and a slip above the pill; Start / Not this time; at three in progress it offers the sessions instead |
| [0177](0177-schedule-editor-sheet.md) | The schedule editor | accepted | A washi sheet: name, date, time, length and plan open by default, repeat chips; only this one / this and the following; Start now |
| [0180](0180-tools-visible-at-rest.md) | The tools on the painting stay visible while they rest | accepted | Resting is a small step back (tools 0.88, pill 0.72), not a fade to 0.32; resting chips measured at ≥ 3 : 1 ink in all four lights |
| [0181](0181-tips-ride-with-the-page.md) | Tips ride with the page and wait for room | accepted | Page notes in document coordinates; pure placement that never falls back off screen or over other UI; the on-screen copy of a twice-existing control; faded notes stop painting; none over a plant card |
| [0182](0182-watering-pour.md) | A soft pour on every watering | accepted | Procedural `pour` recipe (swelling water noise, rising bubbles) on every `session:water` when unmuted, one at a time |
| [0183](0183-week-blocks-at-their-drawn-size.md) | Week blocks at their drawn size, short times, a deliberate first day | accepted | Overlap layout uses the drawn minimum (44 min in a week); the now seal in the line; "4:10"; grow to read on hover/focus; the locale's first day, tested |
| [0184](0184-paint-not-fade.md) | Paint, don't fade: lifted midday whites, the night edge, the round window | accepted | Midday whites lifted from wet blue (no cloud shapes); in dark light the wash stops short of the dissolve with a watercolour edge (no milky haze); a round window wash |
| [0185](0185-seamless-close-views.md) | Seamless close views | accepted | Paper margins as one continuous ragged field (not nine straight bands); wet-layer flow anchored to the world and the rng kept in step; exact cross-fades; the reflected sky feathered inside the pond's rim |
| [0186](0186-close-up-texture-in-the-painting.md) | Close-up texture painted into the landscape | accepted | Meadow patches, back-runs, granulation and sparse grass from a world-anchored cell grid (forked rngs, culled to the painted rect), in the overview and detail alike; trunks with a shadow flank, striations, knots, joined forks |
| [0187](0187-plants-read-as-solid-paint.md) | Plants read as solid paint at every zoom | accepted | A sprite's body laid twice when painted (the landscape keeps a ninth, no per-frame cost); rim widths follow the bitmap's resolution by √k |
| [0188](0188-creatures-sharpen-in-a-close-view.md) | Creatures sharpen in a resting close view | accepted | Parts cached per resolution; the resting view's resolution painted in idle time while the old parts draw; two resolutions kept |
| [0189](0189-edges-of-the-frame.md) | Edges of the frame | accepted | A phone's strip painting extended to the world soon after load, its cut sides faded; the plant view's can fades by its share in frame; `framing: 'growth'` for thumbnails |
| [0190](0190-sheets-on-a-leaf-of-washi.md) | Sheets sit on a leaf of washi and lock the page | accepted | The page's paper at 0.965 behind every sheet; the page cannot scroll under it; the torn edge drawn over a sticky footer; a focused inner scroller keeps its keys |
| [0191](0191-plant-card-reads-whole-on-phones.md) | The plant card reads whole on phones | accepted | Docked card up to 62 % of the stage, tighter on phones; the name stays, the rest scrolls inside, thinning at the cut under an ink mark; a focusable region only while it scrolls |
| [0192](0192-day-view-follows-now.md) | Today's day view follows now | accepted | Opened with now in view, the window glides on before now leaves its band; the gardener's scroll stops it until Today; turns to the new day at midnight |
| [0193](0193-painted-day-and-time-pickers.md) | Painted day and time pickers in the calendar's formats | accepted | Fields that unfold a month grid / hour, minute, AM-PM chips inline; the calendar's own `Intl` formats (12 h or 24 h); full keyboard and screen reader support |
| [0194](0194-sun-as-lifted-glaze.md) | The sun weather as a warm glaze with light lifted out | accepted | A thin raw-sienna glaze over the garden (not the sky) with soft diagonal bands lifted out, the groups taking turns; warm glints on the pond and on sunlit leaves |
