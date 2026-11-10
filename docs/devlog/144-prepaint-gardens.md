# 144 — Z6: Pre-paint the gardens not on view

Phase 14, optimization pass. ADR 0339.

## What
- `PaintCache.has(kind, key)` answers from the index and the queued puts, without reading.
- `SceneSystem.prepaint(scenery, opts)` paints a garden not on view (its overview and its sprite
  atlas) into the paint cache, at the view a switch would paint, in 8 ms slices. The scene's own
  jobs go first. Nothing is painted when both entries are held. `sprout.scenePrepaint()` counts
  the work.
- The Gardens section's fill (started when the cards come within 400 px of the window) now
  pre-paints every garden not on view through `deps.paintOverview(…, thumb)` (main:
  `prepaintThumbnail`). Slices run in idle callbacks (250 ms timeout). The fill pauses while a
  session is active or the tab is hidden, and is skipped on save-data or a battery at 20 % or less
  and unplugged. Cards without a stored thumbnail compose theirs from that painting
  (`composeThumbnail` now draws any painting at the thumbnail framing). Readiness:
  `sprout.gardens.prepaint()` and `sprout.gardens.prepaintReady()`.
- `src/main.ts`: two lines (the import and `paintOverview`).

## Measured
Production build, 1440×900 @2, headless Chrome, `nice -n 5`, load 1.5–3.5. A first visit (fresh
context) on the Japanese garden, then the Gardens section scrolled into view. Scratch script
`z6/measure.mjs` (after `perf-runtime/switch.mjs`). Before = `main` at c47b39a.

| | before | after |
|---|---|---|
| switch into the oasis after the section was seen | 5262 ms (a full paint) | 257–290 ms (cache hit, `paints` 0) |
| switch into the waterfall after it | 3083 ms | 288–307 ms |
| warm switch (same page, for reference) | 102 ms | 100 ms |
| longest main-thread task while the cards / pre-paint run | 92 ms (1 long task) | none over 50 ms (longest part 25–36 ms) |
| background CPU when the cards come into view | ~1.45 s busy (two draft thumbnails) | 6.6–7.7 s of painting (two full overviews), once per paint version |
| wall time until both other gardens are stored | 4.7 s | 30–36 s (idle time only) |

The cards' own draft paints are gone. Their thumbnails arrive with the pre-paint and are sharper.

## Tests
- Vitest: `paint/persist` (has), `scene/scene-cache` (pre-paint: painted then a switch hits; cached
  paints nothing; the garden on view and no cache are skipped; cancelled stores nothing),
  `scenery/thumbnail` (the pre-paint runs for a stored thumbnail too; null branches).
- e2e `prepaint.spec.ts`: scrolling to the Gardens pre-paints the other gardens (entries appear,
  thumbnails `painted`, asked again nothing is painted, a switch paints no landscape); nothing is
  pre-painted on save-data; a session start pauses it and it goes on after the session.

## Left open
- **Sky and light plates are not pre-painted.** A switch after the pre-paint still paints them:
  0.26–0.31 s against 0.10 s warm, with one 115–135 ms task (likely the sky plate, which paints in
  one task). Painting the sky plate in parts would let the pre-paint store it too (and the light
  plates through `cast.paintPart`), which closes the gap.
- The pre-paint takes 30 s of idle time in headless Chrome, whose frames are slow. A click on a
  card before it lands cancels that garden's pre-paint, and the switch paints the garden as before.
- A save-data or low-battery visitor sees the waiting wash on cards for gardens never visited
  (before, they got a draft paint).
