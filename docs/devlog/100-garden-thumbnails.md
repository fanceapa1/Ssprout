# 100: S5b, garden thumbnails from the overview

The Gardens dock section's cards now show a small overview of each garden. Before, they showed a
still of the camera.

## Before
`gardens-section.ts` copied the stage canvas (`drawImage(stageCanvas)`, cover-cropped to 192×120)
at two moments: after the garden's first paint (`whenGardenReady`), and in `choose()` just before
a card switched gardens (ADR 0244). That had four problems:
- **What the camera framed.** On a phone the camera glides onto the seedling, so the card showed a
  zoomed fragment (`before-plants-phone`: a strip of pond, a corner of the cliff).
- **Too early.** At the first paint the landscape is still fading in from paper: the desktop card
  showed sky and hills over blank paper (`before-fresh-desktop`).
- **Never visited.** Every visitor has both gardens since S17, so every visitor saw the pale wash on
  the other card.
- **Blurry.** A 192×120 canvas shown about 205 CSS px wide at 2× was upscaled about 2.1×.

## Now (ADR 0285)
- `renderer.drawOverview(target)` draws the garden on view at the whole world fitted to the
  thumbnail, whatever the camera does: painting, sky of the hour, water, boulders, plants,
  creatures, and the paper multiplied last.
- `src/scenery/thumbnail.ts` picks a source per garden, best first: `live` (that draw: 1.5 s after
  the garden is ready, after its plants change, and just before a card switches) › `stored` (paint
  cache `scenery-thumb`, `<scenery>|<w>x<h>`, written by each live or painted take) › `painted` (a
  garden never seen: its `art` painted small through the cooperative `paintScene`, 10 ms slices
  with idle callbacks between them, no sky plate) › `waiting` (the wash). A late lookup or paint
  never replaces a live thumbnail.
- The canvas is 224×140 CSS px at up to 2× (448×280), so it is never upscaled.
- A live take waits until the scene's painting covers the whole world
  (`sceneSystem.detailStats().world`, wired in `main.ts`). The first after shots on a phone showed
  why: a phone first paints only its strip, so a take in the first ~1.5 s had paper sides. A garden
  left before its first live take falls back to the small paint (`visited-phone`: the waterfall was
  on view for 1.5 s).
- The small paint starts only when the cards come within 400 px of the window. Without that gate,
  every e2e page load painted the waterfall small, and a 60 s sceneries spec timed out under load.
- `src/main.ts`: three lines in `createUI` (`drawOverview` with its world check and a comment, `paintOverview`) and one import.
- Studio: `garden-thumbnails/thumb-japanese-garden`, `thumb-waterfall` (the painted ones under the
  card's mask). The `ui/garden-thumbs` label now says thumbnail.

### Cost
- Live take: one draw of the layers at 448×280, a few ms. It runs in idle callbacks.
- Small paint (dev server, the laptop under load, `nice -n 19`), measured with `paintSceneSync`:
  garden 0.54–0.74 s and waterfall 0.83–0.92 s of CPU, longest uninterrupted piece 14 ms
  (`meadow`). Run cooperatively with the frame loop frozen it gave no long task (`longtask`
  observer: none) and took 3.9 s of wall time. With the frame loop running, headless Chromium's
  software-rendered frames are 100–170 ms long tasks on their own, the same with or without the
  paint.
- One sky plate takes 190–260 ms in a single task, which is why the small paint has none: the
  waterfall's painted thumbnail has a paper sky until the first visit replaces it with a live one.

## Look
Section shots from `thumbs/shots.mjs` (Playwright against the dev server on 5426, `setTime('noon')`,
desktop 1440×900 @2 and phone 390×844 @3). Each case was shot on a fresh first visit (nothing
cached), after visiting both gardens, and with plants in both:
- before: `artifacts/shots/gardens-thumbs-before-{fresh,visited,plants}-{desktop,phone}.png`
- after: `artifacts/shots/gardens-thumbs-after-{fresh,visited,plants}-{desktop,phone}.png`
- studio: `artifacts/shots/studio-garden-thumbnails-1440x900.png`

After: both cards show the whole garden as a little watercolour, the pond and the engawa, the cliff
and the falls. They are sharp at 2× and have the same framing on desktop and phone. The painted
waterfall (fresh) differs from the live one only in its sky (paper, no plate). Plants are drawn but small: pines on the
crown and flowers on the ledges read as marks a few px tall (`gardens-thumbs-waterfall-canvas.png`,
the 448×280 canvas itself). In `after-plants-desktop` the garden's thumbnail has no plants. The
script left the garden 0.8 s after planting, while the new plants were still fading in, and that
take on leaving is what the card keeps.

## Tests
- `src/scenery/thumbnail.test.ts`: cache hit, cache miss (painted and stored; the garden on view
  waits for its live take), the waiting fallback, the source ranks, a late lookup never replaces a
  live one, a garden left keeps its live thumbnail, change events, the `scenery-thumb` key.
- `src/render/renderer.test.ts`: `drawOverview` draws background, underwater, water surface and
  entities at the whole world fitted to the target, the paper multiplied, not the camera's view;
  refuses before sizing and mid-switch.
- e2e `gardens.spec.ts`: after a switch, both cards report `live` (`sprout.ui.gardenThumbs()`,
  after `gardenThumbsReady()`). `gardenStills()` is gone.

## For the orchestrator
- Devlog index line:
  `| 100 | [S5b: garden thumbnails from the overview](100-garden-thumbnails.md) | Gardens cards show each garden's whole overview drawn by the renderer (not the camera): live (with plants and the hour's sky), stored in the paint cache (scenery-thumb), or painted small in idle slices for a garden never seen; sharp at 2×; studio garden-thumbnails | 0285 |`
- ADR index line:
  `| [0285](0285-garden-thumbnails.md) | Garden thumbnails from the overview, not the camera | accepted; amends 0244 | renderer.drawOverview(target) draws the garden on view at the whole world fitted to the target (background, water, entities, paper); sources live › stored (paint cache scenery-thumb, <scenery>\\|<w>x<h>) › painted (paintThumbnail: draft, 10 ms slices, no sky plate) › waiting; UIDeps.drawOverview?/paintOverview?; the small paint starts when the cards near the window |`
- TESTING row:
  `| S5b.1 | Each Gardens card shows its garden's whole overview at a fixed framing, never the camera's view: live for the garden on view (and kept when left), else stored, else painted small in idle slices, else the waiting wash; a late answer never replaces a live one | scenery/thumbnail (all); render/renderer › drawOverview… (all) | gardens › lists both gardens… (both live after a switch); shots artifacts/shots/gardens-thumbs-* | ✔ |`
- S5.2 and S5.5 in TESTING still say "still". SPEC §1a's status note says thumbnails are camera
  stills (S5b). Both are yours to reword.

## Left open
- The painted thumbnail has no sky plate, so the waterfall's is a paper sky until you first visit
  it. A plate taken from the cache (`sky-plate`) when one is there would close that gap.
- At night the live thumbnail shows the night sky over land in daylight colours, because the light
  plate is screen-space and is left out. A `midday` override for the take, or a world-space grade,
  would make it coherent.
- Seedlings change by growth, not by `state.plants`, so a growing seedling refreshes its card only
  on leaving or on the next plant change.
- The paint cache is off on the dev server, so `stored` is covered by the unit tests only. A
  production e2e (reload, then expect `stored`) would pin it.
