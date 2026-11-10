# 141: Oasis paint in finer parts (Z1)

## What
The phase 14 audit found the oasis's cold paint still had long parts that the cooperative painter
could not split. The worst was 72 ms in the grove, under load. This task added pauses inside the
oasis painters' loops and changed nothing else (ADR 0330).
- `paint-veg.ts`: each grove palm's crown is planned in its own part (19 parts where there was one
  21 ms part). A trunk layer's fills and its drying are separate parts. `fillAndDry` pauses
  before it starts a layer. The big palms pause after the leaf-base lattice.
- `paint-pace.ts` (new): `pacer(n)` marks every `n`th mark of a loop as a pause.
- `paint-rocks.ts`: these loops pause every few marks: the strata's lit lines, the buttress
  arrises, the caprock lips, the ksar's pisé patches, formwork lifts, rain gullies and lit tops,
  and the seat's shades, bed lines, join and fallen pisé. `paintBands` and `paintOpenings` are now
  generators (a pause per lozenge and per opening).
- `paint-land.ts`: the terrace furrows and cross-bunds, the near plots' two furrow strokes and their
  seedlings, and the back beds' furrows pause, some inside their clip.

## Pixels
- **Recording pins**: the land, rock, water and veg hash pins are unchanged, so every canvas call
  and its arguments are the same.
- **Chromium** (dev server, `paintJob` driven to the end): pixel hashes before and after the
  change. Overview at 0.8825 `ede04ba9`, grove close view at 1.6 `b0ce1fb4`, ksar close view at
  2 `b3b8ae8b`, all identical. Parts went from 10,138 to 10,478 (overview).

## Numbers
Prod preview, `?dev`, 1440×900 @1. Fresh context, so the paint cache is cold. Switch to the oasis,
then read `sceneStats()`. Before and after were measured back to back.

| | longest part | where | total CPU |
|---|---|---|---|
| audit (load ~13) | 72 ms | grove | 3,776 ms |
| before (load ~2) | 24.3–25.6 ms | grove | 2.70–2.74 s |
| after (load 7–10) | 17.7–18.0 ms | grove | 2.72–2.94 s |

Longest part per step, after (before): ksar 6.3–6.8 (10.7–11.1), bluff 7.4 (10.4–10.5),
terraces 8.1 (10.3–10.4), plots 8.2–9.4 (9.0–9.2), big palms 6.3–8.7 (6.5–6.6).

## Left open
- **The 18 ms that remains is not oasis code.** A one-pixel read placed in front of the grove's
  wet layers took 17.7 ms by itself. The cost is Chromium rasterising the job canvas's queued
  composites, and it lands on whichever part triggers the flush. Under load (load average 7–12)
  such parts and the engine's single big reads (`oued` and `seguia` wet-in-wet reads, the
  `margins` put) still reach 30 ms or more. A flush every few parts in `paintJob`
  (`background.ts`, scene owner) would bound it, but it adds recorded calls (ADR 0330 › Rejected).
- Plots and ksar are still the costliest steps in total (≈ 580 and 540 ms). Making them cheaper
  is the separate task (audit item 5).
- Scripts used: `parts.mjs` (each part's time), `where.mjs` (which canvas calls a slow part made),
  `pixels.mjs` (Chromium pixel hashes) and `app.mjs` (`sceneStats()` in the prod preview). They
  are in the task's scratchpad and are not committed.
