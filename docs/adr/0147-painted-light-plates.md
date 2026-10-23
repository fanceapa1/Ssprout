# ADR 0147 — Painted light plates per phase

- Status: accepted (extends ADR 0082: the multiply wash becomes the base of a painted plate); amended by ADR 0163
- Date: 2026-10-23

## Context
The light of each phase must be painted (long shadows, light caught on crowns, the lit shoji,
the moon's path on the water), cover plants and fauna too, and cost nothing per frame.

## Decision
- One **light plate** per phase (`src/ambience/cast.ts`) over the whole world at 0.4 px/unit:
  the phase's grade wash (`gradePlate`: v1's noise-mottled per-pixel wash with the lantern
  reserve, now opaque on white), then with the watercolour engine: long cool shadows from the
  boulders, shrubs, trees (trunk stroke + one dappled crown mass) and the engawa away from a low
  sun, pools at midday; warm paper feathered out of the sun side of the crowns at sunrise/sunset;
  lamp light in the shoji and on the deck (sunset 0.45, night 1); stars left as paper at night.
- The plates are **blended by the phase weights** into a composite with the moving lights lifted
  out: a warm glow round a low sun, the moon left as paper with a halo, the light's broken path
  on the pond (from its mirror image, or the far shore for a high moon), the lantern's warm pool.
  Recomposed when the light moved (every 3 s check, at once after setTime); every frame is one
  multiply blit of the composite.
- **Grades** (`PHASE_GRADES`): midday almost bare paper (0.03); sunrise a thin cool lavender
  (0.2) warmed toward the right; sunset warm amber (0.34) glowing toward the left, the lantern
  coming on; night indigo (0.5, +0.26 toward the sky), the paper still breathing through.
- **Night takes colour out first**: a `saturation` glaze (0.38 × night weight) before the indigo,
  as the eye loses colour in moonlight — so bright flowers don't glow at night.
- **Dawn mist** (the mist bands on the far bank and the water, rising and thinning as the sun
  climbs) and **dew glints** on the near grass belong to the ambience engine, weighted by sunrise.
- `onLight(grade)` still reports the blended grade to the UI (ADR 0121).

## Consequences
~30 ms to paint a plate (on demand, the next one in idle time); one full-frame blit and, at
night, one full-frame fill per frame (ambience frame budget unchanged, < 1.5 ms).
