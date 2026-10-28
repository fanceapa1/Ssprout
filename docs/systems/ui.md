# UI system

`src/ui/` — the app page around the garden canvas: calm paper and ink (ART_DIRECTION › UI style).
The page scrolls as a document: the garden **stage** on top (~94 % of the window under a small
margin, ADR 0212), the **dock** of sections below it on the same washi (ADRs 0130–0136).
It drives the app **only** through the session controller (`src/core/controller.ts`) and reads
`controller.status()`; it never dispatches session actions or recomputes session maths (ADR 0050).

```ts
import { browserNotifications, createUI } from './ui';
const ui = createUI({
  root: document.querySelector('#ui')!, controller, store, bus, clock,
  getSpecies, slots: scene.slots, viewport: () => renderer.viewport,
  audio,                       // createGardenAudio(...) — optional
  widget: surfaces.widget,     // WidgetIntegration — optional (floating timer button)
  isKnownSpecies, reducedMotion,
  timeScale,                   // multiplies UI delays (dev `?uitime`); default 1
  schedules: scheduler,        // Scheduler — optional (Calendar section, waiting card)
  camera: { camera: renderer.camera, hitTest: (p, tol) => plants.hitTest(p, tol) }, // optional
});
plants.connectPlacement(ui.placement);
```
`surfaces = createTimerSurfaces(...)` (src/widget) is created just before the UI in `main.ts`; it
asks for notification permission inside `session:start` (the Begin click), so the UI passes no
`notifications` integration. Pass `notifications: browserNotifications()` only in a build without
the widget surfaces — the UI then asks in the Begin click itself.

## Components

The Study panel offers **Rename** beside the active task name, so editing does not require
finding a seedling in the garden. The plant card also offers **Rename** beside “Its story” for
growing, waiting and completed garden plants (ADR 0219). An inline, labelled text field uses the
existing task-name rules (40 characters, blank becomes “Study session”) and the planting sheet's
italic ink line (`.task-input`), which deepens on focus. Save (an ink slip) or Enter commits through
`controller.rename`; Cancel or Escape discards the draft and returns focus to Rename. A second
Escape closes the card. Ticks refresh progress without replacing the draft; closing or selecting
another plant discards it. In a phone card, which scrolls inside, opening the field scrolls the
whole form into view, so Save is not left below the cut. In Study, changing or ending the active
session discards its draft, so it cannot rename another session.

| File | What |
|---|---|
| `index.ts` | `createUI` — composition (stage overlay, dock sections, fixed layers), modes (`garden` / `planting` / `placement`), dialog management, flows, store/tick/bus wiring |
| `stage.ts` | the garden stage: `.stage-ui` overlay, the edge mask, the zoom-gesture hook (ADR 0130, 0132) |
| `stage-edge.ts` | pure alpha mask for the dissolving edge (`stageEdgeAlpha`, `fadeHeight`, `featherWidth`) |
| `page-paper.ts` | the page's paper tile from `paperTexture` (same washi as the garden, ADR 0132) |
| `dock.ts` | the dock section registry (`createDock`, `orderSections`; contract in ARCHITECTURE › Dock) |
| `backdrop.ts` · `backdrop-sheet.ts` | the sheet behind each dock section (ADR 0208): `createBackdrop(host, { seed, strength })` lays `div.backdrop` (wash + leaf) and draws its SVG mask and wash for the section's size, again only when it changes; pure geometry `createTear`, `sheetOutline`, `sheetFibres`, `shadowLayers`, `sheetMaskSvg`, `sheetShadowSvg`, `SHEET` (`leaf`, `firm`) |
| `backdrop.studio.ts` | studio section `ui-backdrop`: a leaf, the calendar's firm sheet, the edge ×4, one seed at two heights |
| `near-view.ts` | the gate for work below the fold (ADR 0225): `createNearView({ ready })`; `request(el, task, { idle })` runs a task after the garden's first paint, when `el` nears the window (IntersectionObserver, `100% 0px`) or on an idle moment; never inside the request; `flush()`, `opened()`, `near(el)` |
| `dock-guide.ts` | the helper line under each heading, by state (`guideLines`, `GUIDE`; ADR 0201) |
| `wayfinding.ts` · `wayfinding-path.ts` | the guiding path from where the scenery's path leaves the painting (`pathOut()`, default the Japanese garden's stepping stones) down the dock's lane, a stone beside each visible heading (ADR 0202); pure geometry `layoutPath`, `brushOutline`, `stonePath` |
| `wayfinding.studio.ts` | studio section `ui-wayfinding`: the wide lane, the phone gutter, the stops, the draw-in |
| `hover.css` | the one hover language (ADR 0204): ink words, lifting slips, opening sprouts; focus and press; colour only with reduced motion |
| `smooth-scroll.ts` · `scroll-math.ts` | custom smooth scrolling (wheel/keys/jumps, native adoption, reduced motion) and its pure maths (ADR 0131); a focused inner scroller keeps its scrolling keys (`keyDirection`, ADR 0190) |
| `scrollbar.ts` · `brush-path.ts` | the brush-stroke scrollbar; seeded vertical brush strokes |
| `timer-panel.ts` | session controls in the dock's "Study" section: idle "Start studying"; studying: task, block label, block + total remaining, plan line with progress, Pause/End, break Water/Skip, cancel confirm, long-pause prompt; `resting` drives the root's `is-resting` |
| `pill.ts` | the timer pill on the garden: idle "Start studying"; block time, Pause/Resume, "Session controls" (glide down + focus) (ADR 0133); "+N" when other sessions are in progress (ADR 0156) |
| `session-list.ts` | the sessions in progress under the controls (ADR 0156): rows with a live 64 px plant, task, plan line, time left and Switch / Resume ("growing now" on the active one); "Plant another"; the gentle limit note |
| `plant-section.ts` | "Your plant": the **active** session's plant, live `drawPlantView` painted when due (ADR 0225; `settle()`, `data-paints`, `data-painted`), watering on `session:water` (tap or automatic, ADR 0153) / `water()`, wilt on cancel of that session, latest bloom or an empty bed when nothing is active; `paintRoundWindow`, `paintEmptyBed` (ADR 0134) |
| `calendar.ts` · `calendar.css` | the Calendar section: Daily (default) / Weekly / Monthly, remembered per viewer; painted timeline and month (ADR 0175) — docs/systems/calendar.md |
| `calendar-model.ts` | pure: view ranges, items, overlap layout (`layoutColumns`), month marks, opening window, week start |
| `calendar-art.ts` | the calendar's painted shapes (washes, plan outlines, rings, underline), as SVG backgrounds and on canvas |
| `schedule-sheet.ts` | the schedule editor sheet: name, day and time (painted pickers), open-by-default length and plan, repeat; only this one / this and following (ADR 0177) |
| `pickers.ts` | painted day and time pickers in the calendar's `Intl` formats (ADR 0192): a field that unfolds a month grid or hour / minute / AM-PM chips inline; pure `pickerFormat`, `uses12h`, `dayLabel`, `timeLabel`, `splitTime`, `joinTime`, `stepDay` |
| `schedule-card.ts` | the waiting card at the top of the Study section and its slip by the pill: under it on wide screens, above it on phones, stepping aside with it (ADRs 0176, 0203) |
| `calendar.studio.ts` | studio section `calendar`: washes, day / week / month fixtures, the waiting card, the pickers |
| `tools.ts` | garden tools, one implementation rendered twice: corner chips (`nav.menu`) and the dock list (`ul.tool-list`) (ADR 0135) |
| `session-view.ts` | the one adapter from `controller.status()` to what the panel shows |
| `planting-sheet.ts` | `<dialog>`: task name (≤ 40), total time, recommended plans, plant grid → "Choose a spot" (ADR 0053); `applyPrefill` / `clearPrefill` for a scheduled start (ADR 0173) |
| `duration.ts` | numeral + slider 10–180/5 + chips 25/50/90 + tier words |
| `plan-line.ts` | plan as a segmented brush line (focus strokes, water-drop breaks); pure geometry `planSegments`, `xAtMinutes`, `planSummary` |
| `placement.ts` | markers `button[data-slot-id]` for `controller.placementOptions(speciesId)`, swap markers, Back/Begin bar, `highlight` observable |
| `herbarium.ts` | Pressed Flowers book: each pressed plant's own sprite, desaturated and laid flat, with dates |
| `garden-data.ts` | export (`study-sprout-garden-YYYY-MM-DD.json`) / import (validated, errors inline, confirm before replacing) |
| `hints.ts` | ⓘ list of every tip incl. learned (retired) ones |
| `tips.ts` | floating hint notes with leader lines, one at a time (ADR 0124), riding with the page (ADR 0181) |
| `tip-place.ts` | pure note placement: on-screen control, preferred sides, room, leader line (ADR 0181) |
| `quiet-line.ts` | one sentence at the top: completion, fauna arrivals (ADR 0054, ADR 0120) |
| `plant-labels.ts` | hover a finished plant → "task · minutes · date" (the plant system's painted-pixel hit-test with a camera, else `hitPlant` over sprite boxes and taps too); hidden while a plant card is open |
| `stage-camera.ts` | the camera on the stage (ADRs 0164, 0168): ctrl/⌘ wheel and pinch zoom, double-click/tap, drag only when zoomed, touch-action switch, + / − / Whole garden chips, keys on the focused canvas, cursor hints, clicks → plant card; glides to the seedling on start/switch, to the whole garden on placement |
| `plant-card.ts` | the plant card (ADR 0167): `plantStory()` / `storyLines()` (pure), a dialog `.plant-story` beside the plant or docked on phones (up to 62 % of the stage); Esc / close / click away; a seedling's card refreshes each tick; a taller card keeps its name and scrolls `.plant-story-body` with `data-more="above below"`, a fade at the cut and an ink mark, the body a focusable region only while it scrolls (ADR 0190) |
| `previews.ts` | `renderPlantPreview(canvas, species, seed, growth?, createCanvas?)`, `createPreviewCache(getSpecies, createCanvas?)`: `get`/`paint` draw now (herbarium); `prewarm`/`paintReady`/`whenReady`/`paintPlot` never paint a sprite on the main thread (planting sheet, ADR 0222); `paintPlot`, `previewPixels`, `previewSeed`, pressed-flower pixels |
| `paper.ts` | seeded deckled washi slips + grain as CSS custom properties (ADR 0052); `--brush-mark`, the vermilion stroke under a chosen chip, plan, tool or tier (ADR 0194) |
| `icons.ts` | ink icons as stroke data: inline SVG (`ICONS`) and Path2D (`drawIcon`) (no emoji, no icon fonts); the sprout mark (`sproutMarkSvg`, `drawSproutMark`) that replaces every round red dot (ADR 0194) |
| `format.ts` | pure copy helpers: tiers, habitats, spoken durations, milestones, tip priorities |
| `ambient-light.ts` | `uiLight(grade)`, `applyUiLight(root, grade)`: `--ui-dab` / `--ui-dim` so the slips and paper dabs dim with the garden's light (ADR 0121) |
| `context.ts` | `UIContext`: state shared by the components (internal) |
| `dom.ts` | tiny DOM helpers (`h('button.primary', …)`, `setText`) |
| `sheet.ts` | `createSheet`: the modal washi `<dialog>` shell for every sheet (planting, schedule, herbarium, garden data, hints); in CSS the backdrop is the page's paper at 0.965, the page is locked while one is open, and `::after` draws the torn edge over the content (ADR 0190) |
| `types.ts` | `UIDeps`, `UI`, `UIState`, `PlantingDraft`, `PlacementHighlight`, widget/audio/notification integrations |
| `notifications.ts` | `browserNotifications()`: the Notification API as a `NotificationIntegration` |
| `ui.studio.ts` | studio section `ui`: plant previews at a few growth values, pressed-flower treatment |
| `shell.studio.ts` | studio section `ui-shell`: icons, the sprout and brush marks, corner chips, scrollbar, pill states and "+N", session thumbnails and rows, plant-view states, the seed bed, the garden's edge, a tip note with its × (`tip-note`) |
| `stage-camera.studio.ts` | studio section `ui-camera`: the zoom chips with "Whole garden", the plant card beside a plant, growing, docked on a phone, and a long docked card cut with its mark |
| `ui.css` | all UI styles; tokens on `:root` (`--ui-ink`, `--ui-ink-soft`, `--ui-ink-mute`, `--ui-paper`, `--ui-vermilion`, fonts); base 21 px (ADR 0136, checked by `ink.test.ts`) |
| `fonts.css` | the app's web fonts, the one place they are declared (ADR 0239; see Fonts below) |

## Fonts
`src/ui/fonts.css` declares every web font. The app (`index.ts`), the timer surfaces
(`src/widget/index.ts`, which copies the rules into the PiP window) and the studio
(`src/studio/main.ts`, `src/widget/widget.studio.ts`) import it. Nothing imports fontsource CSS.

- **Faces**: Shippori Mincho 500 (`--ui-display`). Cormorant Garamond 500 and 500 italic
  (`--ui-body`) and 600 (the calendar's chosen day and chip, the PiP card's buttons). Cormorant
  Garamond 400 and 400 italic are for the studio only.
- **Latin and Latin-ext only, woff2 only** (owner decision, ADR 0239). Cyrillic and Vietnamese text
  falls back to the system serif. Each face is a latin-ext rule and a latin rule with fontsource's
  `unicode-range`s, so the latin-ext file loads only when a character needs it. `font-display: swap`.
- **First view**: 3 files (Shippori 500, Cormorant 500 and 500 italic, latin, about 76 kB).
- **Preloaded** (ADR 0231): the built `index.html` has `<link rel="preload" as="font"
  type="font/woff2" crossorigin>` for exactly those 3 files, so they load with the HTML's own
  requests and the text is in its own fonts at the first paint (no fallback flash, no reflow of tips
  and the guiding path). A build-only plugin in `vite.config.ts` adds them, finding the hashed files
  by their fontsource names (`FIRST_VIEW_FONTS` in `src/build/font-preload.ts`). A missing face
  fails the build. `crossorigin` is required, or the file is fetched twice. The dev server and the
  studio have no preloads. Cost: on slow 4G the 76 kB share the link with the JS, so the first paint
  comes about 370 ms later in the lab. Preloading only some files keeps the reflow.
- **Adding a weight or style**: add its two rules, copying the ranges. A file under 4 kB needs
  `?no-inline`, or Vite inlines it into the render-blocking CSS. Then update the count in
  `tests/e2e/fonts.spec.ts`. If the first view uses it, add it to `FIRST_VIEW_FONTS` and to
  `tests/e2e/font-preload.spec.ts`. A weight with no rule is matched to the nearest declared face: canvas
  strings without a weight (400) for Shippori draw with the 500 face.

## Page layout
```
#ui (page, .ui-root) ─ section#stage ─ canvas#garden (masked edge)
                     │                └ .stage-ui: quiet line · plant label · markers · pill · nav.menu · placement bar · planned slip · zoom chips · plant card
                     ├ .dock: svg.wayfinding (behind) · Study (waiting cards + controls | sessions in progress) · Your plant · Calendar · Garden tools
                     │        each: div.backdrop (the sheet, behind) · header.dock-head (h2 + helper line) · div.dock-body
                     ├ absolute (document coordinates): .tips (ADR 0181)
                     └ fixed: .scrollbar · live region · dialogs (top layer)
```
- One reading spine at every width (ADR 0200): Study → Your plant → Calendar → Garden tools, one
  under the other on one left edge, with the path's lane to its left (84 px wide, 64 px under 860 px,
  a 38 px gutter on phones). Wide screens set two tracks inside Study (controls | sessions in
  progress, `.session-list[data-rows='true']`) and Your plant (window | caption). Phones (≤ 600 px):
  an 8 px margin and a 20 px base.
- Each section on its own sheet (ADR 0208): a seeded, torn leaf of the page's paper tile, lifted
  lighter (0.44; the calendar's `firm` 0.74), with a glazed violet wash pooled under its lower and
  right edges. The section's padding is the sheet's margin (`--sheet-pad-top/x/bottom`: 30/38/44 px,
  28 px sides under 860 px, 20/20/26 on phones); the heading and helper sit on the sheet, the lane
  and its stones outside its left edge. The sheet is drawn for the section's size by a
  ResizeObserver (one frame later) and again only when the size changes; never per frame. A
  section opts out with `backdrop: 'none'`.
- A sheet is cheap to draw (ADR 0223). Its noise is pure in the seed and read along a few fixed
  lattice rows, so the 256-wide lattices are drawn lazily, a row at a time
  (`createLazyValueNoise2D`), and each seed's tear and shadow noise is built once, in a 32-seed
  cache shared by the outline, the fibres, the shadow and every later size. The SVG is byte for
  byte what the full lattices drew (`backdrop-sheet.golden.test.ts`). A new section costs about
  67 000 random draws (was 3.8 million), a resize about 400. All four sections at load: ~9 ms in
  Node cold, ~4 ms warm (was ~86 ms). The dock is not dimmed by the garden's light, so the
  sheets read the same in every phase.
- **The garden first** (ADR 0225): the sheets, the guiding path and "Your plant" draw nothing before
  the garden's first paint (`whenGardenReady`, plus one frame). Then each draws when it nears the
  window (one window height of margin) or on an idle moment. A click or a tick that changes them
  only marks them to be drawn. "Your plant" repaints for growth only once near, paints its sprites
  in the view's worker (`drawPlantView`; the last painting stays until they land), and plays the
  watering and the wilt only where it can be seen. Sheets and the plant fade in the first time
  they are drawn; they are absolute or of fixed size, so nothing moves. Tests read the dock after
  `sprout.ui.dockReady()`, which draws whatever still waits.
- One rhythm and one heading: `--rhythm-section` between sections, `--rhythm-head` under the heading
  block; `h2.dock-title` 27 px full ink (25 px on phones), `p.dock-helper` 20.5 px italic soft ink.
- One primary action in Study (`data-primary`, ADR 0201): Start studying (idle), Pause as the calm
  slip `.calm` (focus), Water then Skip break (a break), Resume (paused or the long pause), the first
  due card's Start (a planned session due: the panel steps back). The look follows the mark: Start
  studying and both Resumes are a seal only while they hold `data-primary`, an ink slip otherwise
  (`markPrimary` in `timer-panel.ts`), so Study never shows two seals. Secondary words rest in the
  soft ink.
- The guiding path (ADR 0202): from where the stepping stones leave the painting, across the dock's
  top margin to the lane, down the lane with a stepping stone beside each visible heading. It lays
  out again on dock changes, resizes and content changes. The stone of the section being read is
  darker. It draws in once on first view, never with reduced motion. On phones the line is straight.
- The pill (ADR 0203): top-left on wide screens, bottom centre on phones and narrow screens; `pill-aside` (fade, inert,
  with the planned slip) while the Study body is on screen. An `IntersectionObserver` keeps it; Begin settles it at
  once for where the page is gliding (the garden), so keyboard focus lands on the pill's Pause even before the
  glide has moved a frame (devlog 41).
- Session controls exist in the dock; the pill keeps time, pause/resume and the way down. While
  focusing, the pill and the corner tools rest; the dock never fades. Resting is a small step back
  (`--rest-tools: 0.88` for the corner tools and the zoom chips, `--rest-pill: 0.72`; ADR 0180): the
  chips stay ≥ 3 : 1 in every light.
- **Add a dock section:** `ui.dock.addSection({ id, title, helper, order, span, mount(body) { … } })` from
  `src/ui` (or `main.ts`). The calendar fills the reserved `calendar` section when `createUI` gets a
  scheduler (`schedules`); without one it stays a hidden placeholder. The guiding path gives a new
  visible section its stone by itself; keep its helper line current with `section.setHelper(…)`.
- **Scheduled sessions** (docs/systems/calendar.md): the waiting card's Start calls
  `openPlanting(opener, startPrefill(o))`, which applies the prefill to the shared draft
  (`applyPrefill`); Begin links the new session to the occurrence (`scheduler.link`). A normal Start
  studying clears a leftover link (`clearPrefill`).

## Gardens (ADR 0244)
With two or more available sceneries (`UIDeps.sceneries`) the dock shows **Gardens** (`gardens`,
order 25, full span, helper "Each garden keeps its own plants."), from `ui/gardens-section.ts`:
- a card per garden (`button.garden-card[data-scenery]`, a toggle: `aria-pressed` marks the
  garden on view) with a thumbnail, the scenery's name and blurb, and "On view" / "Go here";
- choosing a card calls `controller.showScenery(id)`; the scenery host cross-fades the stage;
- the thumbnail is a still of the stage canvas, cover-cropped to 192×120 and faded at its edge
  by an elliptical mask: the garden on view is copied after the first paint, and a garden again
  just before you leave it. A garden not seen yet shows a pale waiting wash.

The rest of the UI reads the garden on view: `deps.slots()` (placement markers' positions, the
camera's seedling framing, plant labels, `slotScreen`) and `deps.habitatWords?.()` (the planting
sheet's habitat line, the markers' names and the placement prompt: "will grow in the plunge
pool"). The camera frames a seedling only in the garden on view. Studio: `ui/garden-thumbs`.

## Flows
```
idle ── Start studying ──▶ planting sheet ── Choose a spot ──▶ placement ── Begin ──▶ focus
  ▲                          ▲   (Esc/close → idle)          │ (Back/Esc)            │  ⇅ pause
  │                          └───────────────────────────────┘                        ▼
  │                                                                   break: Water · Skip break
  └── End → "End this session? Your <plant> won’t bloom this time." Keep studying / End
  └── complete → quiet line "Your <Plant> for “<task>” has bloomed."
paused ≥ 30 min → "Still with us?" Resume / End session

several sessions (ADRs 0150–0156):
focus ── Plant another ──▶ planting sheet ── … ── Begin ──▶ new session active, the previous one waits
  ⇅ Switch (a row)                    at 3 in progress: the limit note, focus on the first Switch
bloom / End ──▶ nothing active: rows offer Resume (the one left last as a small seal)
```
- Starting while a session runs: the sheet opens over it (the session keeps running until Begin);
  the planting flow steps out only if the active session changes elsewhere meanwhile.
- "Still with us?" only ever concerns the active session the gardener paused; a waiting session
  never asks (ADR 0150).
- The `PlantingDraft` (task, minutes, plan, species, slot) is shared by the sheet and placement,
  so Back keeps everything. Changing the time re-reads plans and selectable species.
- Begin is in the placement bar; markers select a spot (aria-pressed), double-click begins.
  After Begin, keyboard focus lands on Pause; Escape steps back out of the end question.
- First Begin asks for notification permission: the widget surfaces do it inside `session:start`
  (or the UI, if given a `NotificationIntegration`); the answer is stored with
  `controller.updateSettings({ notifications })`.
- Plant previews use the shared PlantView (src/plants/view.ts, same renderer as the widget);
  species it doesn't know fall back to `renderPlantPreview`.
- **The sheet opens at once (ADR 0222).** Opening it paints no species: each card calls
  `previews.paintReady`, which draws only a preview that needs no main-thread paint (composed
  already, or its prewarm has landed). Otherwise the card shows the **waiting plot**, a small pale
  patch of turned earth where the plant will stand (`data-preview="pending"`). When the worker's
  sprite lands, the preview fades in over the plot (`landed`, 35 % → 100 % in `--ui-mid`, none
  under reduced motion). A card drawn at once is `painted`. Cards on screen are hurried first (an
  `IntersectionObserver` → `previews.whenReady`, the `drawPlantView` pending path), and the rest
  follow once those have landed.
- **Prewarm**: `planting.prewarm()` queues every selectable preview at idle priority in card order.
  `createUI` calls it on the first idle callback after `deps.whenGardenReady()` (main:
  `renderer.whenReady()`), and on `pointerover`/`focusin` of a Start control
  (`[data-anchor="start"]`, "Plant another"). A preview is composed as soon as its prewarm lands,
  so a later open only blits. The prewarm key is the card canvas's pixel size, DPR included
  (`previewPixels`). `ui.previewsReady()` (dev: `sprout.ui.previewsReady()`) resolves once every
  card shows its preview. The herbarium keeps the synchronous `paint`.
- Placement makes the dock, pill and corner tools `inert` (dock faded, pill hidden), glides the page
  to the top so the whole garden is the map; markers follow the renderer's viewport.
- After Begin, focus lands on the pill's Pause (the page stays on the garden). The pill's
  "Session controls" glides to the Study section and focuses Water (dry break), Resume or Pause.

## States (`window.sprout.ui.state()`)
`{ mode, panel: 'idle'|'focus'|'break'|'paused'|'longPause', pill (same values), plantView: { mode:
'growing'|'bloom'|'empty', speciesId, growth, watering, wilting }, sessions: { visible, rows: [{ id,
taskName, active, running, action: 'switch'|'resume'|null, suggested, totalRemainingMs, growth }],
limit }, pillMore, pillAside, confirm, resting, dialogs, tips, markers, line, plantLabel, plantCard,
draft, calendar, due, scheduleSheet }` (the last three are null without a scheduler).

## Sheets over the page (ADR 0190)
Every sheet is a `<dialog>` opened with `showModal()` through `ctx.openDialog`. Behind it the page
goes under a leaf of its own washi (`::backdrop`: `--page-paper` at `--sheet-veil`, 0.965), never a
grey scrim or a blur. `html.has-sheet` (set by `syncSheetLock` in `index.ts`) hides the page's overflow, so
the wheel beside the sheet, PageDown/Space/End and touch do not move the page, and the smooth scroll
already stands aside while a modal is open. The sheet's own paper scrolls (`overscroll-behavior:
contain`). The torn edge is drawn by `dialog.sheet::after` from `--slip-dense-edge-*` over the
content; the planting footer stops 8 px short of it (6 px on phones).

Keyboard focus never leaves a control under a sheet's sticky parts (Q14). `.sheet-inner` has
`scroll-padding-block` of the torn edge's clearance (`--sheet-edge-clear`, 14 px, room for the
focus ring) plus `--sheet-foot-h` / `--sheet-head-h`. `createSheet` measures a sticky `.sheet-foot`
(and a `.sheet-head-sticky`, if a sheet ever has one) with a `ResizeObserver` when the sheet
opens, so the padding follows the footer as its summary wraps on phones. Today only the planting
sheet has a sticky part. The schedule sheet, its pickers, the herbarium, garden data and hints get
the edge clearance from the same rule, and a sticky `.sheet-foot` added to any of them is measured
too. The reveal is the browser's instant scroll (`scroll-behavior: auto`), so nothing glides and
reduced motion has nothing to turn off.

## Accessibility
Real buttons with labels; `role=radiogroup` for plans; locked plants, and plants whose every spot holds a growing seedling (`data-full`, ADR 0205), `aria-disabled`; ink focus
rings (`:focus-visible`); sheets are `<dialog>` with focus on the heading and focus returned to
the opener; one polite live region announces start, pause/resume, break/focus changes, milestones
(30/10/5/1 min left — never every second), completion and cancel. Reduced motion: no breathing,
no fades.

## Tooltips
Tips come from the core registry (`activeTips(state, ctx)`); the UI only decides placement.
**One note at a time** (ADR 0124): `pickTips` (format.ts) takes the highest `TIP_PRIORITY`
(placement, swap, water, task, duration, plan, notifications, switch, widget, pressed, schedule, sound) whose control
is in view; the rest wait their turn. On first load that is the note by Start studying. A control
that exists twice (Start studying on the pill and in the dock; the tools in the corner and the dock)
is resolved to the dock's copy when it is in view, else the one on the garden, so notes follow the
page as it scrolls (`resolveAnchor` returns candidates, `tips.ts` takes the first visible). Sheet notes
retire when their control is used (task named, time committed, plan picked); a control in a sheet
counts as in view only while scrolled into it, and notes follow on scroll. Notes wait while the
quiet line speaks. `format.ts` also holds `TIP_GROUP` (sheet / panel / menu / garden / calendar) and
`tipSides`. A tip's `anchor` is resolved as `[data-anchor="<anchor>"]` (except `garden`:
placement bar, or the first swap marker for `swap`). The slips never take pointer events; they retire
when the controller retires them (or the UI calls `controller.retireTip` for UI-only mechanisms:
`widget` on opening the floating timer, `pressed` on opening the book).

**Dismissing** (ADR 0211): every note is `p.tip > span.tip-copy + button.icon-btn.tip-x`. The × is
the `close` icon at 14 px in the soft ink, with a 32 px target in the slip's right padding (34 px).
Only the × of a showing note (`.tip.is-in`) takes the pointer, and not while the notes step aside
(resting, quiet line). A click or tap on it, or Esc anywhere in the note (stopped there, so a sheet
or the placement stays), calls `controller.retireTip(id, 'dismissed')`. Focus that was in the note
goes back to the control (its first focusable part). No new note shows until the dismissed one has
faded (`FADE_MS` × `?uitime`, at once with reduced motion). Notes sit at the end of the page (or
sheet), so Tab is threaded by hand: Tab from a note's control (its last focusable part) goes to its
×; Tab from the × moves on after the control. Backwards it is the same order: Shift+Tab from what
follows the control stops at the × (a `focusin` check after a Shift+Tab), and Shift+Tab from the ×
goes to the control. Inline phone notes in a
sheet already follow their step and are left alone. Hover is the chip family (`hover.css`): the ink
deepens on a lifted paper dab, with the same `:focus-visible` (the ink ring inside the target) and
`:active` states.

**On a scrolling page** (ADR 0181): page notes live in document coordinates (the `.tips` layer sits
at the document's origin and scrolls with the page), so a note stays on its control through every
scroll with no per-frame work; notes in a sheet use the sheet's fixed layer. Placement is pure
(`tip-place.ts › placeTip`): only when the control is wholly on screen and the note fits on one of
its sides without covering other slips (`[data-ui]`, the dock's tool list counts as one) or the dock's
headings; otherwise the tip waits, or the other copy of the control takes it. A faded note stops
painting (`visibility`), a new note removes one still fading, and notes wait while a plant card is
open. Only notes on the painting (`data-on="stage"`) dim with the garden's light.

**Add a tip**: add it to `src/core/tips.ts` (copy, anchor, relevance, retire rule), put
`data-anchor="<anchor>"` on its control, and (optionally) give it a group/priority/sides in
`format.ts`. Unknown ids still show (lowest priority, own group).

## Fauna & completion line
Arrival copy lives in `src/core/fauna-unlocks.ts` (`arrival`). **Add a creature line** by adding
its unlock there with `announce: true`. The fauna system emits `fauna:arrived {id}` the first time
an unlocked creature is actually in view (ADR 0120); the quiet line queues it, shows it when the
garden is calm and then records it with `controller.announceFauna(id)` (ignoring that echo). The
UI no longer watches `newlyArrived`. Completion copy is in `index.ts` (`session:complete`).

## Widget integration
`src/ui/types.ts`:
```ts
export interface WidgetIntegration {
  readonly supported: boolean;       // Document PiP available
  open(): void | Promise<void>;      // called inside the button click (user gesture)
  isOpen(): boolean;                 // drives aria-pressed
  onChange?(fn: () => void): () => void; // optional: open/close notifications
}
```
Pass it as `createUI({ widget })`. Without it (or `supported: false`) the button is not rendered
and the `widget` tip is not relevant. `?dev&widget=fake` uses `createFakeWidget()`.

## Renderer integration
`ui.placement.subscribe((h) => …)` gives `{ active, speciesId, slots: [{id,x,y,occupied}], focused,
selected }` in world units. `main.ts` wires it: `plants.connectPlacement(ui.placement)` draws the
in-canvas highlight of the hovered/selected slot (ADR 0117).

## Ambient light
`main.ts`: once the painting is ready, `ambience.onLight((grade) => applyUiLight(uiRoot, grade))`
dims the DOM slips and paper dabs with the garden's light (ADR 0121): on the stage the pill,
placement bar, plant label, the corner chips and their labels, the zoom chips, the plant card, the
planned slip, and the tips on the painting. The dock is not dimmed:
it is read on the page, like a sheet.

## Audio
`sound-mixer.ts` / `sound-mixer.css`: Your soundscape, opened by the Sound mixer tool in both
the corner and dock. Standard sounds and Scenery sounds share playback and overall volume;
their levels are independent, with each scenery's saved levels keyed by `SceneryId`. All writes
use `controller.updateSettings({ soundscape })`. Editing is silent while muted; Listen calls
the same mute/unlock integration as the existing Garden sounds shortcut. The current collection
is `aria-pressed`, every layer has a labelled toggle and native range, and starting mixes use
brush marks. Auto means Follow the garden; an edit switches to custom without changing visual
weather. Clear is scoped to the selected collection/place. The compact sticky playback bar uses
the shared sheet's measured `--sheet-foot-h` for keyboard focus clearance. The optional audio
integration adds `getScenery()` / `onSceneryChange(fn)`; a future scenery selector supplies the
actual context to `GardenAudio.setScenery`. No coast selector is shown today.

`createGardenAudio` is created in `main.ts` and passed as `audio`. The sound button toggles
`settings.muted` via `controller.updateSettings` (audio follows `settings:changed`) and calls
`audio.unlock()` inside the click; a persisted "sound on" unlocks on the first pointer/key gesture.

## Debug API (`?dev`)
`?fixtures` adds the `fx-*` species (ADR 0055); `?uitime=0.05` scales UI delays; `?widget=fake`.
`window.sprout.ui`: `state()`, `refresh()`, `setTimeScale(n)`, `placement()`, `widget`
(fake only), `showPlantLabel(world)`, `slotScreen(id)` (client pixels), `scroll()`,
`scrollTo(y | sectionId, { instant? })`, `dock()`, `dockReady()` (after the garden's first paint,
draws the dock's deferred parts now and settles "Your plant"), `waterPlantView()`,
`onZoomGesture(fn)`, `wayfinding({ layout? })`, `setSectionHidden(id, hidden)`, `gardenStills()` (gardens whose card holds a still). `ui.state().plantCard` is the open card. The camera's hooks are
`window.sprout.camera` (docs/systems/camera.md). `window.sprout.advance(ms)` jumps the dev
clock and refreshes the UI (e.g. into a break or a long pause); `window.sprout.advanceTo('HH:MM')`
jumps it forward to the next local time of day (pins the hour for tests).

## Tests
Unit: `near-view.test.ts`, `backdrop-sheet.test.ts`, `backdrop.test.ts`, `dock-guide.test.ts`, `wayfinding-path.test.ts`, `session-list.test.ts`, `format.test.ts`, `plan-line.test.ts`, `plant-labels.test.ts`, `previews.test.ts`, `planting-sheet.test.ts`,
`ambient-light.test.ts`, `scroll-math.test.ts`, `smooth-scroll.test.ts`, `dock.test.ts`, `stage-edge.test.ts`, `ink.test.ts`,
`tip-place.test.ts`, `plant-card.test.ts`, `pickers.test.ts`, `prefill.test.ts` (calendar: `calendar-model.test.ts`).
E2E: `tests/e2e/gardens.spec.ts` (the Gardens section: both gardens listed, choosing switches, planting in the waterfall through the real flow, keyboard, phone width), `tests/e2e/deferred-dock.spec.ts` (nothing drawn in the dock before the garden's first paint,
every section drawn once scrolled to with no section moving, Begin's click under 100 ms with "Your
plant" current once scrolled to), `tests/e2e/backdrops.spec.ts` (a sheet per section holding its content, the calendar's the
strongest, re-layout on growth / resize / view and not on a tick or scroll, the lane outside the
sheets, text contrast from pixels in four lights at desktop, hd and phone),
`tests/e2e/wayfinding.spec.ts` (the spine, the path at desktop and phone, never over text,
re-layout on section/content/resize changes, the stop being read, helper lines by state, one primary
per state, the pill stepping aside, hover and focus, the draw-in and reduced motion),
`tests/e2e/camera.spec.ts` (zoom gestures and controls, focus on start/switch, the plant
card, placement while zoomed, docked card on phones), `tests/e2e/parallel-sessions.spec.ts` (start two, switch, waiting time frozen, limit of three,
automatic watering in Your plant, the widget and title follow the active session, reload),
`tests/e2e/ui-shell.spec.ts` (page and stage sizing, wheel/keys/reduced-motion scrolling,
scrollbar drag, pointer mapping when scrolled, dock order and columns, dock controls + pill,
duplicated tools, Your plant, tips in their new homes), `tests/e2e/ui-session.spec.ts` (sheet, begin, cancel, breaks/watering, long pause, completion,
swap → herbarium, reload mid-session, keyboard), `ui-menu.spec.ts` (tips + hints, sound persistence,
widget button, export/import, creature line, resting panel, mobile), `ui-start-flow.spec.ts` (task
name, total time, plant cards), `session-rules.spec.ts`, `polish.spec.ts` (one tip at a time,
keyboard focus, `plantsReady`, paper edges, tall phones), `overlays.spec.ts` (sheets on washi, the
page locked, focus clear of a sheet's sticky parts), `marks.spec.ts` (no round red dot; sprout marks),
`tips-scroll.spec.ts` (notes ride with the page), `tips-dismiss.spec.ts` (the × by mouse, keyboard, Esc and tap), `tools-visibility.spec.ts` (tools at rest in every
light), `plant-card-phone.spec.ts` (long cards on small phones), `v2-acceptance.spec.ts` (one primary
action, the hover language, the switch tip). Screenshots: `npm run shots -- --query "fixtures" --eval "…"`.
