# ADR 0330: The oasis's paint steps pause inside their loops, with no added canvas call

- Status: accepted
- Date: 2026-11-10
- Amends: ADR 0226 (scene paint steps in parts) and ADR 0238 (engine calls in parts), cost only

## Context
The oasis's cold paint is cooperative (ADR 0226), but some of its parts still ran long. The
phase 14 audit measured 72 ms in the grove under load; on a quiet laptop it was 24–26 ms. The
longest parts were plain JavaScript or a run of small marks between two pauses: the 19 grove crowns
planned in one part (21 ms), the ksar's seat join and lifts, the caprock's lips, the terrace
furrows and the beds' furrows (10–20 ms each).

## Decision
- **Pauses only.** The painters yield in more places and change nothing else. They make the same
  canvas calls in the same order and draw the same rng numbers, so the recorded-canvas hashes stay
  as pinned.
- **`pacer(n)`** (`paint-pace.ts`) marks every `n`th mark of a loop (6 by default) as a place to
  pause. The grove pauses after each palm's crown is planned and between a trunk layer's fills and
  its drying. `fillAndDry` pauses before it starts a layer, so the last layer's composite gets
  its own part. The ksar's bands and openings became generators.
- **A pause may fall inside a clip.** Nothing else paints on the job's canvas between parts
  (ADR 0226), so a clip stays as it is, like the view transform. The bed furrows and the near
  plots' furrows pause inside theirs, with no extra `restore`/`clip` pair.

### Rejected
- **Flush reads on the job's canvas** (one-pixel `getImageData`, like `WetLayer.flush`). What now
  costs most is Chromium rasterising the job canvas's queued composites when it decides to
  (17–18 ms, measured by moving a read). A read every few parts would bound that, but it adds
  recorded calls in every oasis view, and on GPU canvases it may switch the canvas to the CPU.
  If it is wanted, it belongs to the paint job (`background.ts`), not to one scenery.

## Consequences
- In the app (prod, 1440×900 @1, cold oasis, `sceneStats().longest`), the longest part went from
  24–26 ms (grove) to 18 ms (grove: the canvas's raster backlog), with the same total CPU. The
  ksar's longest part went from 11 to 6–7 ms, the bluff's from 10.5 to 7.4 and the terraces' from
  10.4 to 8.1. Under load (load average 7–12) parts still reach 30 ms or more. Those are the
  backlog and the engine's single reads.
- The overview has 10,478 parts (was 10,138). In Chromium the overview and two close views have the same pixels as before.
- A new oasis loop of small wet marks should take a `pacer()`.
