# UI system

`src/ui/` — the DOM layer over the garden canvas: calm paper and ink (ART_DIRECTION › UI style).
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
});
plants.connectPlacement(ui.placement);
```
`surfaces = createTimerSurfaces(...)` (src/widget) is created just before the UI in `main.ts`; it
asks for notification permission inside `session:start` (the Begin click), so the UI passes no
`notifications` integration. Pass `notifications: browserNotifications()` only in a build without
the widget surfaces — the UI then asks in the Begin click itself.

## Components
| File | What |
|---|---|
| `index.ts` | `createUI` — composition, modes (`garden` / `planting` / `placement`), dialog management, flows, store/tick/bus wiring |
| `timer-panel.ts` | timer slip (bottom-centre; a 360 px slip in the lower-left corner on wide landscape screens, ADR 0127): idle "Start studying"; studying: task, block label, block + total remaining, plan line with progress, Pause/End, break Water/Skip, cancel confirm, long-pause prompt; fades while focusing |
| `session-view.ts` | the one adapter from `controller.status()` to what the panel shows |
| `planting-sheet.ts` | `<dialog>`: task name (≤ 40), total time, recommended plans, plant grid → "Choose a spot" (ADR 0053) |
| `duration.ts` | numeral + slider 10–180/5 + chips 25/50/90 + tier words |
| `plan-line.ts` | plan as a segmented brush line (focus strokes, water-drop breaks); pure geometry `planSegments`, `xAtMinutes`, `planSummary` |
| `placement.ts` | markers `button[data-slot-id]` for `controller.placementOptions(speciesId)`, swap markers, Back/Begin bar, `highlight` observable |
| `menu.ts` | top-right ink icons: sound, floating timer (only with a supported widget), pressed flowers, garden data, hints |
| `herbarium.ts` | Pressed Flowers book: each pressed plant's own sprite, desaturated and laid flat, with dates |
| `garden-data.ts` | export (`study-sprout-garden-YYYY-MM-DD.json`) / import (validated, errors inline, confirm before replacing) |
| `hints.ts` | ⓘ list of every tip incl. learned (retired) ones |
| `tips.ts` | floating hint notes with leader lines, one at a time (ADR 0124) |
| `quiet-line.ts` | one sentence at the top: completion, fauna arrivals (ADR 0054, ADR 0120) |
| `plant-labels.ts` | hover/tap a finished plant → "task · minutes · date" (DOM hit-test, `hitPlant`) |
| `previews.ts` | `renderPlantPreview(canvas, species, seed, growth?, createCanvas?)`, `createPreviewCache(getSpecies, createCanvas?)`, pressed-flower pixels |
| `paper.ts` | seeded deckled washi slips + grain as CSS custom properties (ADR 0052) |
| `icons.ts` | inline SVG ink icons (no emoji, no icon fonts) |
| `format.ts` | pure copy helpers: tiers, habitats, spoken durations, milestones, tip priorities |
| `ambient-light.ts` | `uiLight(grade)`, `applyUiLight(root, grade)`: `--ui-dab` / `--ui-dim` so the slips and paper dabs dim with the garden's light (ADR 0121) |
| `context.ts` | `UIContext`: state shared by the components (internal) |
| `dom.ts` | tiny DOM helpers (`h('button.primary', …)`, `setText`) |
| `sheet.ts` | `createSheet`: the modal washi `<dialog>` shell for herbarium, garden data and hints |
| `types.ts` | `UIDeps`, `UI`, `UIState`, `PlantingDraft`, `PlacementHighlight`, widget/audio/notification integrations |
| `notifications.ts` | `browserNotifications()`: the Notification API as a `NotificationIntegration` |
| `ui.studio.ts` | studio section: plant previews at a few growth values, pressed-flower treatment |
| `ui.css` | all UI styles; tokens on `:root` (`--ui-ink`, `--ui-paper`, `--ui-vermilion`, fonts) |

## Flows
```
idle ── Start studying ──▶ planting sheet ── Choose a spot ──▶ placement ── Begin ──▶ focus
  ▲                          ▲   (Esc/close → idle)          │ (Back/Esc)            │  ⇅ pause
  │                          └───────────────────────────────┘                        ▼
  │                                                                   break: Water · Skip break
  └── End → "End this session? Your <plant> won’t bloom this time." Keep studying / End
  └── complete → quiet line "Your <Plant> for “<task>” has bloomed."
paused ≥ 30 min → "Still with us?" Resume / End session
```
- The `PlantingDraft` (task, minutes, plan, species, slot) is shared by the sheet and placement,
  so Back keeps everything. Changing the time re-reads plans and selectable species.
- Begin is in the placement bar; markers select a spot (aria-pressed), double-click begins.
  After Begin, keyboard focus lands on Pause; Escape steps back out of the end question.
- First Begin asks for notification permission: the widget surfaces do it inside `session:start`
  (or the UI, if given a `NotificationIntegration`); the answer is stored with
  `controller.updateSettings({ notifications })`.
- Plant previews use the shared `renderPlantView` (src/plants/view.ts, same renderer as the
  widget); species it doesn't know (the dev fixtures) fall back to `renderPlantPreview`.
- Placement makes the panel and menu `inert` and dim; markers follow the renderer's viewport.

## States (`window.sprout.ui.state()`)
`{ mode, panel: 'idle'|'focus'|'break'|'paused'|'longPause', confirm, resting, dialogs, tips,
markers, line, plantLabel, draft }`.

## Accessibility
Real buttons with labels; `role=radiogroup` for plans; locked plants `aria-disabled`; ink focus
rings (`:focus-visible`); sheets are `<dialog>` with focus on the heading and focus returned to
the opener; one polite live region announces start, pause/resume, break/focus changes, milestones
(30/10/5/1 min left — never every second), completion and cancel. Reduced motion: no breathing,
no fades.

## Tooltips
Tips come from the core registry (`activeTips(state, ctx)`); the UI only decides placement.
**One note at a time** (ADR 0124): `pickTips` (format.ts) takes the highest `TIP_PRIORITY`
(placement, swap, water, task, duration, plan, notifications, widget, pressed, sound) whose control
is in view; the rest wait their turn. On first load that is the note by Start studying. Sheet notes
retire when their control is used (task named, time committed, plan picked); a control in a sheet
counts as in view only while scrolled into it, and notes follow on scroll. Notes wait while the
quiet line speaks. `format.ts` also holds `TIP_GROUP` (sheet / panel / menu / garden) and
`tipSides`. A tip's `anchor` is resolved as `[data-anchor="<anchor>"]` (except `garden`:
placement bar, or the first swap marker for `swap`). Tips never take pointer events; they retire
when the controller retires them (or the UI calls `controller.retireTip` for UI-only mechanisms:
`widget` on opening the floating timer, `pressed` on opening the book).

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
dims the DOM slips and paper dabs with the garden's light (ADR 0121).

## Audio
`createGardenAudio` is created in `main.ts` and passed as `audio`. The sound button toggles
`settings.muted` via `controller.updateSettings` (audio follows `settings:changed`) and calls
`audio.unlock()` inside the click; a persisted "sound on" unlocks on the first pointer/key gesture.

## Debug API (`?dev`)
`?fixtures` adds the `fx-*` species (ADR 0055); `?uitime=0.05` scales UI delays; `?widget=fake`.
`window.sprout.ui`: `state()`, `refresh()`, `setTimeScale(n)`, `placement()`, `widget`
(fake only), `showPlantLabel(world)`, `slotScreen(id)`. `window.sprout.advance(ms)` jumps the dev
clock and refreshes the UI (e.g. into a break or a long pause).

## Tests
Unit: `format.test.ts`, `plan-line.test.ts`, `plant-labels.test.ts`, `previews.test.ts`,
`ambient-light.test.ts`.
E2E: `tests/e2e/ui-session.spec.ts` (sheet, begin, cancel, breaks/watering, long pause, completion,
swap → herbarium, reload mid-session, keyboard), `ui-menu.spec.ts` (tips + hints, sound persistence,
widget button, export/import, creature line, resting panel, mobile), `ui-start-flow.spec.ts` (task
name, total time, plant cards), `session-rules.spec.ts`, `polish.spec.ts` (one tip at a time,
keyboard focus, `plantsReady`, paper edges, tall phones). Screenshots: `npm run shots -- --query "fixtures" --eval "…"`.
