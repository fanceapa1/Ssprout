# ADR 0185 — Seamless close views

- Status: accepted (amends ADRs 0020, 0041, 0145, 0163)
- Date: 2026-10-23

## Context
Zoomed onto a plant (sunset, 1440×900 at DPR 2), vertical bands and edges crossed the meadow.
They were not tile or cache boundaries: the detail painting covered the whole view, and so did the
overview's. The cause was in the painting itself, made visible by the zoom:
- **The paper margins** (`paintMargins`) were nine nested, nearly rectangular frames (a
  superellipse with exponent ≈ 7), each lifting 20 % toward paper, 24–38 units apart. Their sides
  were straight vertical lines 200–320 units deep into the sheet. At 1× the steps read as a soft
  vignette; at 2–3× each frame's side is a straight seam across the bank.
- **Wet-layer flow was anchored to the buffer, not the world.** A layer's mottling noise started
  at its (clipped) work canvas's corner, with a random offset in work pixels; a layer cut by the
  canvas, or painted at another resolution, mottled differently from the same layer in the
  overview, so the detail painting faded in as a different pattern. And a layer that missed the
  canvas entirely skipped its two draws from the painter's rng, so every later layer of a detail
  painting drew different numbers from the overview's.
- **The cross-fades** drew the old painting at `1 − e` and the new one at `e` over it. The
  paintings are translucent (paper shows through), so mid-fade the paper showed through both: a
  pale pulse rather than a blend.
- **The reflected sky on the pond** was clipped by the pond's outline, a hard vector line inside
  the painted water's ragged rim: at the near edge, zoomed in, a hard pink band at sunset.

## Decision
- The margins are **one continuous field** (`marginField`): each sheet edge contributes a ramp
  (sides 200 units, deeper toward the bottom; top 77; bottom 166), its front perturbed by two
  octaves of world-anchored noise (±35 units), the edges combined as a soft maximum (corners cut
  deeper), and the nine 20 % steps replaced by the curve `1 − 0.8^(9c)` eased in at zero. It is
  evaluated on a 4-pixel grid of the work buffer and interpolated, written into the same wet layer
  and dried as before. The overview and any detail painting compute the same lift for the same
  place.
- **Flow is a function of the place**: the offset is drawn in noise units (`FLOW_UNITS`) and the
  noise grid is anchored at the area's own corner (before clipping), so a clipped layer or one
  painted at another resolution mottles exactly like the whole one. The two offsets are drawn
  even for a layer that paints nothing on this canvas.
- **Cross-fades are exact lerps**, `(1 − e)·a + e·b`: the second painting is added with `lighter`
  (the background layer starts empty).
- **The reflected sky fades out inside the rim**: the water composite is multiplied by a feathered
  pond mask (the outline pulled in 7 units, its edge wandering, blurred over 3) instead of relying
  on the clip.

## Consequences
No seams at any zoom, pan or phase; the detail painting fades in as the overview resolved, not a
different painting. All mottling patterns changed once (same seed, same statistics). The margins
step costs ≈ 40 ms on the overview (the grid sampling keeps it near the old polygon fills).
Tests: `margins.test.ts` (the field is a continuous ramp: no step between neighbouring units
above 0.03, against the old 0.2; it wanders; deeper at the corners), `tests/e2e/close-view.spec.ts`
(a pinned 2× view of the left bank at sunset and at night: the detrended column profile across the
old bands has no step over 2.2 levels; the banded margins measured 2.6–3.3).
