# 45 — P2: the planting sheet opens at once

## What
The first "Start studying" click blocked the main thread for about 690 ms on this laptop. About
520 ms of that was the sheet painting 25 species previews synchronously. Task P1 (devlog 42) made
the plant view paintable ahead in a worker. This task moves the sheet onto that path (ADR 0222).

- **No species is painted in the click.** `renderPlants` asks `previews.paintReady` for each card.
  It draws only a preview that is already composed or whose prewarm has landed. Otherwise the card
  shows the **waiting plot**: a small pale patch of turned earth on grass, painted with the same
  washes as the view's ground, once per size. When the worker's sprite lands, the preview fades in
  over the plot (35 % → 100 % in `--ui-mid`; `data-preview` is `pending` → `landed`, or `painted`
  when it was drawn at once).
- **Cards on screen first.** An `IntersectionObserver` hurries the waiting cards on screen
  (`previews.whenReady`, which takes the `drawPlantView` pending path and raises their sprites to
  `now`). Once those have landed, the rest are hurried while the sheet is open.
- **The prewarm.** `planting.prewarm()` queues every selectable preview at idle priority in card
  order. `createUI` calls it on the first idle callback after `deps.whenGardenReady()` resolves.
  That is `renderer.whenReady()`, so it does not compete with the garden's first paint, and the
  idle lane also holds it behind the garden's sprites. It is called again on `pointerover` and
  `focusin` of a Start control (`[data-anchor="start"]`, "Plant another"). Each preview is composed
  as soon as its prewarm lands, ground wash included, so a later open only blits.
- **`src/ui/previews.ts`**: `prewarm`, `paintReady`, `whenReady`, `paintPlot`, plus
  `previewPixels` and `previewSeed`, the prewarm key (pixel size with DPR, seed). The herbarium keeps
  `get`/`paint`. A species the plant view does not know, or a failed worker render, is painted the
  old way after the click.
- **Readiness**: `ui.previewsReady()`, and `sprout.ui.previewsReady()` in `?dev`. The start-flow
  spec awaits it before reading a preview.
- **`src/main.ts`**: one line, `whenGardenReady: () => renderer.whenReady()` in `createUI`'s deps.
  `src/dev/ui-debug.ts` gains `previewsReady`.
- **Studio**: `ui/waiting-plot` shows the plot next to the preview that replaces it.

## Timing (1×, Chromium headless, the laptop shared with another agent, `nice -n 15`)
| | before | after |
|---|---|---|
| first open, click handlers (capture → bubble) | 688 ms (25/25 painted in the click) | 85–102 ms (0/25 painted; the plots show) |
| first open after a hover prewarm | — | 92 ms (25/25 drawn from the cache) |
| second open | 50–90 ms (P0 report) | 30–50 ms |

Event Timing's processing span equals the handler time. Its duration, to the next paint, was 256–360
ms after the change (848 ms before), because it includes laying out and painting the sheet itself.
A CPU profile shows what is left of the click: `showModal` takes about 75 ms the first time (the
browser's style and layout of the sheet), and the sheet's own `refill` takes about 3.5 ms.

## Tests
- `src/ui/previews.test.ts` (+6) uses a fake worker and a spied species draw. It covers a blank
  sized card with its sprite queued, drawing after the prewarm, `whenReady` hurrying a card, the
  old-way fallback for a species the view does not know, the plot painted once per size, and the
  pixel size and seed.
- `src/ui/planting-sheet.test.ts` (3, jsdom, a spy `PreviewCache`): opening calls no
  `paint`/`get`, waiting cards get the plot and fill in, the cards on screen are hurried before the
  rest, and the prewarm runs in card order with the card's options.
- `tests/e2e/planting-previews.spec.ts` (2) uses real species. It times the first click with a
  window capture → bubble listener and with Event Timing (assert < 200 ms), checks the plots,
  checks every card is inked after `previewsReady`, and checks `syncPaints` is unchanged. A second
  open draws every card in the click. A hover prewarm makes the first open draw every card at once
  and evicts nothing.
- `tests/e2e/ui-start-flow.spec.ts` awaits `previewsReady` before reading the iris preview.
- The matrix rows are P2.1–P2.4 in docs/TESTING.md, and P1.1 is now ✔.
- Shots: `sheet-midfill` and `sheet-filled` (desktop and phone), and `entry-ui_waiting-plot`.

## Left open
- **The rest of the click is the sheet's layout.** `showModal` forces style and layout of about
  240 nodes, including 25 cards of serif text, which takes about 75 ms the first time. Opening the
  dialog on the next frame, `content-visibility` on cards below the fold, or a pre-layout during
  the idle prewarm could cut it, but each touches the sheet's focus and scroll behaviour (ADR
  0190).
- **The garden frame right after the open** spent about 60–100 ms in one `drawImage` of the
  background layer in the profile. That is the renderer (src/render), not the sheet.
- **The herbarium** still paints its previews synchronously when it opens. Its pressed treatment
  needs the species drawn into a canvas the UI can read back. It could move to a worker too.
- The idle prewarm has no budget check against a busy widget or "Your plant" view sharing the
  24 MB view cache. The e2e test checks for no evictions in a fresh garden only.
