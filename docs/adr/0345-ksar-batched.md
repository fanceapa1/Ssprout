# ADR 0345: The ksar's small marks dry per kind and block, its big washes take fewer layers

- Status: accepted
- Date: 2026-11-12
- Amends: ADR 0330 (oasis paint pauses), for the ksar step

## Context
The phase 14 audit put the ksar step next to the plots as the costliest part of the oasis's cold
paint. The plan (Z4) was to do what ADR 0343 did for the plots: dry a block's small marks
together instead of one wet layer and one drying pass per mark.

A CPU profile of the step (dev build, DPR 2) showed that the small marks were not where the
time went. Of about 720 ms, the strokes, dabs and small washes took about 150 ms. The big washes
took about 560 ms: each block's front and flank `wetInWet` (267 ms), its shade glazes (218 ms)
and the parapet washes (76 ms). A `wetInWet` lays 14 layers, each two fills clipped by two
freshly deformed half planes. The half planes' geometry and the clipped fills' rasterising made
up most of its cost, not the size in pixels.

Batching the small marks alone saved only about 25 ms. A batched layer spans the whole face, so
its drying pass covers pixels the separate marks' layers never did.

## Decision
- **One wet layer per kind of mark, per block.** On each block: the pale and the damp pisé patches,
  the formwork courses, the putlog holes, the rain streaks, the blotted corners and the lit
  touches on the tops. On a tower's band: the fillets, the flicks (the zigzag and the lozenges)
  and the niches. On a curtain wall: the rain gullies, their lit edges and the holes. In the
  openings: the holes, the lintels and the sills. On the palms: each frond's blades. At the seat:
  the join's dark cracks and its lit edges. The marks, their order and their rng draws are as
  before.
- **The marks come from `ksar-batch.ts`.** `strokeInto` lays `stroke`'s marks, wet or dry-brush,
  into a given layer. When given a strength below 1 it scales the marks by `globalAlpha`, so a
  run of flicks of different strengths can share one layer. `strokeDry` gives the drying
  `stroke` would use. `washInto` lays a small wash's or glaze's fills. A test checks that a
  stroke laid with `strokeInto` and dried with `strokeDry` makes exactly the canvas calls of
  `p.stroke`. `batchLayer` gives a layer the resolution one mark's own layer would get.
- **Fewer layers in the blocks' big washes.** The fronts' `wetInWet` takes 9 layers (it was 14)
  and the flanks' takes 6. Both use `spread: 0.02`, so their layers are almost the same outline,
  and the extra layers added little but cost. The soft band between the two colours comes from
  each layer's own split, and 9 splits still blend it.
- **Pauses.** Long runs (the courses and the join) flush and pause every 18 marks. The drying
  passes pause by bands (`dryParts`).

### Rejected
- **Bundling only.** It saves about 25 ms and does not reach the target.
- **Changing `wetInWetParts`** (cheaper half planes, one clip per layer). That is the engine
  owner's call. It would help every scenery and belongs in its own task.
- **Fewer layers in the shade glazes.** Their `spread` is 0.2–0.3, so their layers make the soft
  edges. Fewer layers would show.

## Consequences
- The rock recording pins change: overview `59fcb2af` → `bce0f3ed`, detail `94c1b4e4` →
  `621f5c7d`. The ksar step's pixel reads drop from 1122 to 342 at the overview (507 to 205 in
  the detail view).
- Where two marks of the same kind touch, they merge before drying instead of each getting its
  own rim. An opening's fade toward its foot is now a plain gradient lift (0.3), without the ragged fronts.
  The blotted corners dry as one paper wash. The art review is in devlog 147.
- `strokeInto` overlaps with `dryBrushInto` (`paint-batch.ts`, ADR 0343). Both belong in the
  engine as one `strokeInto` once its owner takes them.
