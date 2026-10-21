# ADR 0065 — Shrubs batch their marks into shared wet layers

- Status: accepted
- Date: 2026-10-22

## Context
The first painted shrubs called a primitive per mark (`dab` per leaf and petal, `foliageClump`
per clump, `inkLine` per vein). Each call opens a wet layer and runs a drying pass, which reads
the layer's pixels back from the canvas. A shrub has hundreds of marks: the first versions made
50–110 drying passes and took 70–145 ms for a 400×440 px sprite, against a 60 ms target.
Profiles showed the pixel read-back alone at ~40 ms per hydrangea, then polygon deformation.

## Decision
Shared helpers in `src/plants/lib/shrub-*.ts` paint marks straight into a few open layers and
dry each layer once:
- all stems in one layer, their shadow-side accents in a second, twigs in a third;
- the whole foliage mass in three layers (body, mid tone, cool underside + darks) built from
  `foliageLayout` dabs of every clump;
- leaves in two or three alternating groups (neighbours dry separately, so overlaps show);
- flower petals per pass (ring × back/front × group) across all flowers of a call, plus one
  layer each for throats, stamens/filaments and sepals;
- composite heads (hydrangea, azalea) in two layers per alternating set of heads.

## Consequences
- 14–18 drying passes per full-bloom shrub; all six species measure 26–57 ms (median) at
  growth 1 on a loaded machine.
- Marks in one pass merge wet-in-wet: the foliage mass reads as one shrub (wanted), but same-group
  leaves and petals of different flowers in one pass lose mutual edges. Flowers that overlap
  heavily should be painted in separate calls.
- Per-mark opacity inside a batch is only available where the helper fills directly (heads,
  pads); petal batches take one opacity for the whole call.
