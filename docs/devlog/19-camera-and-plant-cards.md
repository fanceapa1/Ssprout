# 19 — Camera & plant descriptions (phase 7)

ADRs 0160–0168 · SPEC §12a · docs/systems/camera.md

## What
- **A camera over the garden** (`src/render/camera.ts`): a pose (zoom 1–3, the world point at the
  stage's centre) composed over the cover viewport, which is now the overview. The renderer owns
  it; `renderer.viewport` is the camera's view, so markers, labels and pointer mapping follow it
  unchanged; systems keep the overview in `SystemContext.viewport` and get a live
  `SystemContext.camera`. Views stay inside the overview at zoom 1 and may reach the whole painted
  world from 1.25× (a phone can look at the sides its overview crops). The paper stays
  screen-fixed.
- **Glides** on van Wijk & Nuij's zoom-and-pan path, eased like a breath (0.75–1.9 s);
  ctrl/⌘-wheel and trackpad pinch follow their target (τ 75 ms); input interrupts; reduced motion
  cuts.
- **Caches**: the background is blitted from the overview cache while the camera moves and cached
  again at the resting view; nothing is repainted inside a frame.
- **Detail for close views**: once the camera rests, the scene repaints the view (≤ 2.8 px/unit)
  and cross-fades it in; the sky punches the moon, sun and stars at full resolution; the light
  plate repaints its marks (shadows, crown lights, stars) at ≤ 2 px/unit in idle time; plants in
  the view get sprites at the zoomed resolution (up to 6 px/unit, ≤ 2048 px per side), requested
  at the glide's start; high-res sprites of plants out of view are evicted at rest.
- **Interaction** (`src/ui/stage-camera.ts`): plain wheel scrolls the page, ctrl/⌘-wheel and pinch
  zoom about the pointer, double-click/tap zooms in, drag pans only when zoomed (`touch-action`
  switches `pan-x pan-y` ↔ `none`), two-finger touch pinch, + / − / "Whole garden" chips at the
  bottom right (above the pill on narrow stages), keys on the focused canvas, cursor hints.
- **Focus**: session start and `session:switch` glide to the seedling; entering placement glides
  to the whole garden (placement works at any zoom); nothing else re-zooms.
- **Plant card** (`src/ui/plant-card.ts`): click any plant (painted-pixel hit-test, front-most
  wins — `src/plants/hit-test.ts`) → the camera glides onto it and a washi card opens beside it
  (docked at the bottom on phones): species, Japanese name, a note on its place in Japanese
  gardens (written for all 25 species, `src/plants/notes.ts`), the poetic line, and the plant's
  story (task, minutes, day; a seedling's growth and time to go; the plant it replaced). Esc, the
  close mark or a click elsewhere closes it; the camera stays. The hover label stays as the
  desktop glance; taps open the card.
- **Dev**: `sprout.camera` (state, focusSlot/Plant, zoomTo, glideTo, overview, settle, autoFocus,
  toClient, openCard/closeCard), `sceneDetail()`, `lightDetail()`, `plants.hitTest()`.
- **Studio**: `camera/playground`, `camera-detail/moon`, `camera-detail/shadows`,
  `ui-camera/*` (zoom chips, cards; the seed walks through every species' note).
- **main.ts**: passes `camera: { camera: renderer.camera, hitTest: plants.hitTest }` to
  `createUI` and installs the camera dev hooks (a few lines next to the calendar's).

## Why these choices
- Composing the camera into a `Viewport` kept every existing consumer working; only caches that
  depend on resolution had to learn about it, and they all key off one `detailVersion`.
- Detail is painted only when the camera rests, and each layer uses it only when it covers the
  whole view, so there are no seams and glides cost what a still frame costs.
- Max zoom 3 rather than 2.5: at 2.5 a near tier-1 plant was only a quarter of a wide stage.

## Looked at
Screenshots at DPR 2 (desktop 1440×900) and DPR 3 (phone 390×844): overview, a plant framed, the
closest view, all four daylight phases zoomed onto a plant, the moon at 3× at night, the card on
both sides and docked, a seedling's card. Fixed on the way: the card's title had neither class
nor id (`h('tag.class#id')` takes the id first), the card's class collided with the planting
sheet's `.plant-card`, the seedling framing on phones (plants outside the overview's crop; the
docked card's slack).

## Numbers
- Glide (desktop, 30 plants, e2e under 4 workers): 2.1 ms average main-thread work per frame,
  p95 2 ms; no background repaint inside it.
- Detail paint of a resting view: ~2 s wall on desktop (cooperative), ~1.4 s on a phone; the
  light plate's detail a few ms per phase at night, more at sunset (shadows).

## Left open
- Real touch pinch on devices is only tested with synthetic pointer events; a browser may claim a
  two-finger gesture as a pan before both fingers land.
- Ambience particles (rain strokes, motes) and fauna parts are not repainted for close views;
  they are soft by nature and read fine, but fauna can look a little soft at 3×.
- The light plate's grade wash itself is upscaled (only its marks are repainted).
- The first glide on a phone toward the garden's sides shows the overview painting's edge until
  the whole-world extension lands (about a second).
