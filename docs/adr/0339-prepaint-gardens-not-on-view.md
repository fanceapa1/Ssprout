# ADR 0339: Pre-paint the gardens not on view into the paint cache

- Status: accepted
- Date: 2026-11-10
- Amends: ADR 0285 (garden thumbnails), ADR 0228 (the landscape from the paint cache)

## Context
On a first visit, a switch into a garden never painted on this browser waits for its whole
landscape: about 5–7 s into the oasis at 1440×900 @2 (runtime report, phase 14, item 3), against
0.1–0.35 s once it is in the paint cache (ADR 0228). Meanwhile the Gardens cards painted their
own small `draft` copy of every unvisited garden (ADR 0285) as they scrolled in: 0.9–1.7 s of
main-thread CPU each, thrown away once the garden is visited. The owner approved painting the
other gardens into the persistent cache in the background instead, and making the thumbnails
from those paintings.

## Decision
- **When.** The Gardens section starts its fill once the cards come within 400 px of the window
  (the IntersectionObserver of ADR 0285). The fill now goes over every garden not on view, one
  after another, and pre-paints each.
- **What.** `SceneSystem.prepaint(scenery, opts)` paints the garden's overview painting and its
  sprite atlas at the view a switch to it would paint: `paintViewFor` of the overview viewport
  of the scene's last `init`, the same quality, keys and cut-edge fade. So a later switch's lookup
  is a hit (`paints` stays, `cacheHits` + 1). The painting is stored with `{ copy: false }` and
  encoded in idle time as before (ADR 0227).
- **Once per paint version.** `PaintCache.has(kind, key)` answers from the cache's index (and its
  queued puts) without reading or decoding. When both the painting and the atlas are held,
  nothing is painted. The cache version (ADR 0227) changes with the paint code, so a deploy that
  changes the art pre-paints again once.
- **In parts, in idle time.** The paint runs through the cooperative painter in 8 ms slices. Each
  slice waits for an idle callback (250 ms timeout, so a busy page still gets a few slices a
  second). Since ADRs 0226 and 0238 a slice ends within one part, so a task stays under about
  50 ms.
- **The garden's own work goes first.** Between slices the pre-paint waits while the scene has a
  paint job (a switch's landscape, a resize repaint, a close view's detail) or the scenery's
  motion is preparing. Switching to the garden being pre-painted cancels the pre-paint, and the
  switch paints the garden itself.
- **Paused** while a session is active (`state.session`) or the tab is hidden. It goes on
  afterwards.
- **Skipped** when `navigator.connection.saveData` is set, or when `navigator.getBattery()` reports
  20 % or less and not charging. Then the cards show stored thumbnails or the waiting wash, and
  nothing is painted for them.
- **Thumbnails.** A card that has no stored thumbnail asks the pre-paint for the painting
  (`painting: true`). A fresh pre-paint hands back its painting. A garden already stored is read
  back from the cache (one decode). `composeThumbnail` then draws it at the thumbnail framing:
  painting, sprites, paper (smoothing `high`). It is still a `painted` thumbnail without plants
  or sky, and is stored as `scenery-thumb` as before. Without a paint cache (dev server,
  `?nopaintcache`), nothing is pre-painted and the card is painted small as before.
- **Not pre-painted:** the sky and light plates (`sky-plate`, `light-plate`, ADR 0236). The sky
  plate paints in one task of about 80–130 ms, which breaks the 50 ms budget. Painting it in parts
  is the next step. The switch looks them up and paints what is missing, as before (ADR 0337).
- **Readiness:** `sprout.gardens.prepaint()` → `{ state: 'waiting' | 'running' | 'paused' | 'done' |
  'skipped', reason }`; `sprout.gardens.prepaintReady()` resolves once the fill has gone over every
  garden (or at once when skipped); `sprout.scenePrepaint()` counts `painted`, `cached`,
  `cancelled`, `cpuMs`, the `longest` part and the garden `painting` now.

## Consequences
- Measured on a first visit at 1440×900 @2 (devlog 144): after the pre-paint, a switch into the
  oasis is ready in 0.26 s instead of 5.3 s, and into the waterfall in 0.31 s instead of 3.1 s. A
  warm switch takes 0.10 s. The difference is the sky and light plates, and their one task of
  115–135 ms. No task went over 50 ms during the pre-paint (longest part 25–36 ms). The pre-paint
  costs 6.6–7.7 s of painting CPU for the two other gardens, over about 30 s of idle time, once
  per paint version.
- The cards no longer paint their own draft copies: the 0.9–1.7 s of CPU per unvisited garden
  and the 92 ms long task they caused are gone. Their thumbnails now take longer to arrive (they
  wait for the full pre-paint) and are sharper (painted at full quality).
- Two more overviews with their sprites (about 7 MB each at 1440×900 @2) fit under the 48 MB cap
  next to the garden's own entries. Many resting views can still evict them (least recently used),
  and the next fill then paints them again.
- A resize after the pre-paint changes the overview view, so a later switch misses and paints as
  before. The next fill pre-paints the new view.
