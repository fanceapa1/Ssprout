# ADR 0387: The coast's paper margins: a narrower left side, and the plates lifted with the painting

- Status: accepted
- Date: 2026-11-22
- Builds on: ADRs 0185 (one continuous margin field), 0372 (the coast's daylight), 0380 (the
  leaning pine), 0384 (the wide window)

## Context
Every garden lifts its painting back toward paper near the sheet's edges (`paintMargins`, ADR
0185): 200 units at the sides, deeper toward the bottom. The coast's sky and sea are not in the
painting: they are the daylight's plates, multiplied over it (the sky) or laid on the water at
`waterAlpha` (the sea), and the plates were not lifted. The acceptance (devlog 225, open item 5)
saw the left side as a veil with an edge: the far hill, the bay and the leaning pine lifted to a
pale sheet while the sky above them kept its full colour, white by day and a pink sheet at sunset.
Part of the edge was a far headland's wash that ran on behind the far hill (fixed in its shape,
`HEADLANDS[0]`). The rest was the mismatch, and in the owner's window (the world's full width) the
200-unit lift also washed out the pine's crown and turned its trunk into a pale stripe (item 3).

## Decision
- The coast paints its own margins step (`paintCoastMargins`, `coast/margins.ts`): the shared
  field read at a remapped x (`marginX`), so the left side's lift reaches 140 units instead of 200
  (224 at the bottom corner instead of 320); from x 560 on the field is the shared one. The other
  gardens keep `paintMargins` unchanged.
- The same field (same seed, same noise) is laid on the coast's sky plates (below y 140 only, so
  the phone's sky above the world is untouched) and its sea plates, at both sides, lifting them
  toward white. The left edge then dissolves alike in every phase.
- `COAST_SEEN` (ADR 0382) is unchanged: x 60 stays out of the deep fade.

## Consequences
- The margins, sky, sea-plate and light hashes moved (recorded in devlog 226).
- The routine duplicates the shared step's 40 lines (the field is not a parameter there); a
  shared `paintMargins(p, rng, field)` would remove the copy, a change outside the coast.
- Each plate pays a pixel pass over its two side bands (about 1 ms each at plate resolution).
