# ADR 0247: The waterfall's daylight

- Status: accepted
- Date: 2026-10-28
- Builds on: ADRs 0145 (sky plates), 0147 (light plates), 0206 (the plate's lower edge), 0241 (scenery contract), 0242 (cache keys), 0245 (waterfall geometry)

## Context
The waterfall had a flat placeholder sky step and a light art with no marks of its own (S10). Its
skyline is not the garden's: a pale cliff stands high on the left and a buttress beside the falls,
and both low suns (sunrise x 1270, sunset x 1040) are right of the buttress. The garden's sky
hangs 40 units under its far ridge, where green hills hide the hang; the garden's shadows follow
the global `castShadow`, whose `dx` sends sunset shadows to the right.

## Decision
- **Sky plates** (`waterfall/sky.ts`): the garden's watercolour language (wet-in-wet grade, a
  sideways band, a glow round the sun, cloud banks with lit undersides, midday whites lifted out,
  stars reserved), with the glows and the banks placed over the far ridge on the right.
- **Clipped to a short hang.** The washes are clipped to `plateSky()`: 14 units under the crown,
  the notch and the buttress, 40 over the flank and the far ridge (x ≥ 870). Unclipped, the washes'
  spread showed as a pink band on the pale cliff top and the falls' lip. The far ridge's distance
  glaze is painted after the clip and fades out by y 470, so nothing reaches the plate's lower
  edge (y 500, ADR 0206).
- **Pool plate**: the mirrored sky darkens toward the back edge, which mirrors the cliff rather
  than the horizon, and is broken by lifted streaks.
- **Light plates** (`waterfall/light.ts`, `LightArt` hooks only, no contract change): the
  `shadows` hook shades the ledges' undercuts and the cliff foot in every lit phase, and at a low
  sun the notch and the falls' right half under the buttress and the left cliff, **always to the
  left**: both low suns stand right of the buttress here. The `lights` hook leaves feathered warm
  paper on the buttress's crown and flank, the crown woods' top edge, the ledges' tops and the far
  ridge under the sun at sunrise and sunset, and at night pale cool paper down the falls and over
  their spray instead of a lantern. Feathered radial dabs, as the garden's crown lights: a lifted
  wash at plate resolution leaves a pooled ring.
- **Grades stay global.** The four phases read right over the waterfall with `PHASE_GRADES`.
- Keys already carry the scenery (ADR 0242): `waterfall|…` for both plate kinds.

## Consequences
- The boulders' shadows still follow the global `dx` (to the right at sunset), and the rim light
  on sprites still comes from the left at sunset. Both disagree a little with this sky; a
  per-scenery shadow direction would need a `LightArt` or `SkyLayout` field (contract change).
- A hard clip line sits 14 units under the skyline; it falls inside the crown woods and the
  buttress's dark top, where it does not read.
