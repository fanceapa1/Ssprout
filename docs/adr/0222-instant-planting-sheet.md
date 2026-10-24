# ADR 0222 — The planting sheet opens at once; previews fill in as they land

- Status: accepted
- Date: 2026-10-24

## Context
The first "Start studying" click blocked the main thread for about 640–690 ms (2.2 s at a 4×
CPU throttle). About 520 ms of that went to painting 25 species previews synchronously in the
click (P0a/P0b audits). ADRs 0220 and 0221 made the plant view paint in a worker, and added
`prewarmPlantView` and a `drawPlantView` that never paints a sprite on the main thread. The sheet
still called `ctx.previews.paint`, which goes through `renderPlantView` and paints what is missing.

## Decision
- **The sheet never paints a species in the open.** Each card asks the preview cache for
  `paintReady(canvas, id, opts)`. It draws only when nothing needs painting: the composed preview is
  cached, its prewarm has landed, or the species cannot use the worker at all (painted the old way).
  Otherwise the card keeps `data-preview="pending"` and shows the **waiting plot**.
- **The waiting plot** is a small pale patch of turned earth on grass, painted with the same washes
  as the view's ground, where the plant will stand. It is painted once per pixel size, during the
  prewarm, and blitted. When a preview lands it fades from 35 % to full opacity over the plot in
  `--ui-mid` (`data-preview="landed"`). A card drawn in the open is `painted`. There is no spinner,
  shimmer or pulse, because nothing should read as a web page loading (ART_DIRECTION). Reduced
  motion drops the fade.
- **Cards on screen first.** An `IntersectionObserver` hurries the waiting cards it reports on
  screen through `previews.whenReady`. That is a `drawPlantView` pending path, so it raises their
  sprites to `now`. Once those have landed, the rest are hurried while the sheet stays open. A
  card scrolled into view later is hurried when the observer reports it. Without an observer,
  every card is hurried.
- **Prewarm on idle and on intent.** `createUI` takes `whenGardenReady()` (main passes
  `renderer.whenReady()`). When it resolves, it prewarms every selectable preview in card order on
  the next idle callback, at `PRIORITY.idle`. The idle lane (ADR 0221) also holds those jobs while
  the garden's sprites paint, so they never compete with the first paint. A `pointerover` or
  `focusin` on a Start control (`[data-anchor="start"]`, "Plant another") prewarms again. That is
  a no-op when the prewarm is already queued.
- **The preview is composed when its prewarm lands**, not in the click. The view's ground wash
  is painted on the main thread the first time a size needs it, and composing in the prewarm keeps
  that out of the click. A sheet opened after the prewarm only blits 25 canvases.
- **The prewarm key is the card canvas's pixel size**, DPR included (`previewPixels`), and the
  same seed (`previewSeed`), so the prewarmed sprites are the ones the draw looks up.
- **The herbarium keeps the synchronous path** (`get` / `paint`). Its pressed previews are
  painted in the UI with a pixel treatment, not by the view, and it opens far less often.
- **Readiness**: `ui.previewsReady()` resolves once every card on the sheet shows its preview.
  In `?dev` it is `sprout.ui.previewsReady()`. A spec or shot that reads previews awaits it.

## Consequences
- The first-open click handler went from about 690 ms to 85–100 ms at 1× on a loaded laptop. What
  is left is the browser's style and layout of the sheet in `showModal` (about 75 ms the first
  time, 30–50 ms later), not painting.
- A preview can appear a moment after the sheet, and the fade marks that. On a warm open (after
  the idle prewarm, or a hover) every card is drawn in the click.
- `UIDeps` gains the optional `whenGardenReady`, and `UI` gains `previewsReady()` (ARCHITECTURE ›
  UI). `PreviewCache` gains `prewarm`, `paintReady`, `paintPlot` and `whenReady`.
- The preview cache keeps one composed canvas per card (25 × about 140 KB at DPR 2) as before. The
  sprites stay in the view's 24 MB budget. The e2e test checks that the prewarm evicts nothing.
