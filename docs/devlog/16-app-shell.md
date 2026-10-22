# 16 — App shell: the garden on a page, the controls below it

## What
Phase 6 "App shell" (ADR 0005). The full-window canvas became a scrolling page:

- **Stage** (ADR 0130): `#stage` holds the canvas, 88svh tall under a 14 px margin (8 px on
  phones). The renderer already measured the canvas's own box with a `ResizeObserver`, so the
  viewport follows the stage with no change to `src/render/viewport.ts`; cover scaling and the
  ADR 0123 phone floor work as before. Everything on the painting lives in `.stage-ui` in
  viewport pixels, so scrolling never enters the maths.
- **Edge and paper** (ADR 0132): a CSS mask (`stage-edge.ts`, pure and tested) dissolves the
  painting into the page: a broad ragged band at the bottom with uneven pools, a narrower one on
  the top and sides. The page is a tile of the garden's own `paperTexture` (same seed, grain only).
- **Smooth scroll and scrollbar** (ADR 0131): eased wheel/arrows, glided page keys/Home/End/jumps,
  native scrolls adopted, touch native, reduced motion instant, ctrl/⌘+wheel left to a zoom hook;
  a brush-stroke thumb on a faint track in the right margin, draggable, fading, `aria-hidden`.
- **Dock** (ADR 0130): a section registry (`dock.ts`, tested) with Study (session controls, moved
  from the old slip), Your plant, a hidden Calendar placeholder and Garden tools.
- **Timer pill** (ADR 0133, supersedes 0127): time, pause/resume, "Session controls" (glide + focus);
  idle "Start studying".
- **Your plant** (ADR 0134): live `renderPlantView` over a pale round "window" wash, watering on
  `session:water` or `ui.plantView.water()`, wilt on cancel, latest bloom or an empty bed when idle.
- **Tools** (ADR 0135): `tools.ts` replaces `menu.ts`; one definition, two views (corner chips,
  dock list with names and notes), one shared state. Icons redrawn as stroke data (24 px, bolder,
  clearer book/backup metaphors) on torn round paper chips.
- **Type** (ADR 0136): base 21 px, Cormorant at 500 (500 italic bundled), darker ink tokens checked
  by `ink.test.ts`; the seal's vermilion deepened so its label reads at ~5:1.
- **Tips** follow controls to their new homes: a control that exists twice resolves to the dock's
  copy when it is in view, else the garden's.
- `src/main.ts` is unchanged: `createUI` finds the stage inside `#ui`.

## Why / decisions
See ADRs 0130–0136. The main trade-offs: native document scrolling with eased inputs rather than
a transformed wrapper (focus, find-in-page, fixed layers and tests keep working); a CSS mask
rather than painting the fade into the canvas (the scene and its paper layer are untouched and
nothing repaints on scroll); the calendar placeholder hidden rather than an empty heading.

## Tests
- Unit: `scroll-math` (approach, glides, wheel/key deltas, thumb geometry), `dock` (order,
  placeholders, cleanups, ids), `stage-edge` (dissolve, feather, ragged line, determinism), `ink`
  (contrast of the tokens read from `ui.css`).
- E2E: new `ui-shell.spec.ts` (14 tests, see TESTING › §12). Existing UI specs follow the controls
  into the dock (`.panel`, `.pill`, `.menu` scopes); the resting test moved to the pill and the
  corner; the phone test now checks the stacked layout; `polish` expects focus on the pill's Pause.
  `scene.spec` samples the sky inside the visible rect (the 88 % stage crops a little more sky on
  short windows).
- Studio: `ui-shell` section (icons, chips over a wash, scrollbar, pill states, plant-view states
  incl. the looping watering, the edge mask).
- Screenshots reviewed (`artifacts/shots/`): desktop 1440×900 and phone 390×844, top and full
  page, focus, break, idle with blooms, a fresh garden, night, the planting sheet, the studio
  section.

## Measurements (headless Chromium, M3, 30 plants + a session, 1440×900)
`frameStats` still at the top: 0.74 ms avg / 0.9 p95 main-thread work, 16.7 ms frames; while
wheel-scrolling for 4 s: 0.74 / 0.9 (max 1.7), 16.7 ms. The scene is not repainted or rescaled by
scrolling (asserted).

## Left / for others
- **Camera (phase 7):** wheel over the canvas scrolls the page; ctrl/⌘ + wheel (and trackpad pinch,
  which arrives as ctrl+wheel) is handed to `ui.stage.onZoomGesture(fn)` — register there and the
  page never zooms or scrolls on it. Touch: the canvas has `touch-action: manipulation` (one finger
  scrolls the page natively); set `pan-y` / `none` while zoomed in. Pointer → world:
  `viewport.screenToWorld({ x: clientX - canvasRect.left, y: clientY - canvasRect.top })`.
  Overlays (markers, labels) are positioned with `viewport.worldToScreen` inside `.stage-ui`;
  a camera that changes the viewport per frame should keep `renderer.viewport` current (the
  placement layer re-reads it every frame while open).
- **Calendar (phase 8):** `ui.dock.fill('calendar', (body, section) => { …; return cleanup })`;
  the section is `full` width at order 30 and becomes visible once filled.
- **Automatic watering (phase 7):** emit `session:water` (or call `ui.plantView.water()`); the
  garden, the widget card and Your plant all play it.
- The widget card's typography was not part of this task.
- Possible later saving: pause the renderer while the stage is fully scrolled out of view (on most
  screens it never is: the dock is shorter than a window).
