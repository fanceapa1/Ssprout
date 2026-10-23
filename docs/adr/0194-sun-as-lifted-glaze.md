# ADR 0194 — The sun weather as a warm glaze with light lifted out

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0084 (particles as Poisson spawns with pre-painted sprites); docs/systems/ambience.md

## Context
The "sun" session weather (not the daylight phases) drew four pale shafts with `screen` plus a flat
warm multiply grade. The pre-paper frame is white, so screen could not lighten the sky. Over the hills
and the far bank the shafts read as pale vertical columns, a generic "god rays" look. A watercolourist
does not add light on top. They leave or lift it out of a wash.

## Decision
- **A thin warm glaze with soft diagonal bands of light lifted out of it.**
  - One multiply sprite per band group (`sprites.sun`) holds a raw-sienna glaze (`COLOURS.sunGlaze`)
    over the garden. It is gently mottled and fades out above the hills (`sunGround`), so **the sky
    is never striped**.
  - Four bands fall from the upper left (≈ 0.62 rad from vertical) across the garden. Inside a band
    the glaze is lifted (−92 %), as with a damp tissue. The width wanders slowly along the band, and
    the lifted pigment **pools slightly darker at the band's edge**.
  - The light comes in soft from the hills and dies away on the near bank.
  - Pure maths: `sunBands`, `sunGround`, `sunGlazeAt`.
- **The light comes and goes.** Every band is lifted in both sprites, and each sprite favours one
  group (1 vs 0.5). The two sprites are cross-weighted by a slow breath (13 s, ±0.175). The overall
  glaze stays constant while the light shifts between the groups, as under drifting cloud.
- **Warm glints**: the pond glints are warmed (`COLOURS.glint`). New **leaf glints** are warm
  lifted dabs on the sunlit (upper left) side of the plants' crowns. They are Poisson spawns from
  the mote emitters, 0.9/s, at most 6, living 1.6–3.2 s, drawn with screen on foliage, where screen
  can lighten.
- The flat `sunGrade` and the screen shafts are removed.
- `LOOK.sunGlaze` 0.35, `sunBreath*`, `leafGlintAlpha` 0.55.
- Everything still follows the envelope: focus 1, break 0.55, paused 0.3 with motion 0 (glints
  hold still), and 0 when the session ends. The glaze also fades with the night weight.

## Consequences
- The sun reads as soft diagonal light across the garden with a warmer cast, and the sky is left
  alone. It stays subtle: about 6 levels per channel between a band and the glaze around it at noon.
- Unit tests in `src/ambience/sun.test.ts` cover: the sky unglazed, bands paler than beside them,
  the diagonal fall, the pooled edge, the half lift, leaf glints on the sunlit side only in sun, and
  stillness while paused.
- The e2e test `the sun weather (ADR 0194)` covers warmth in the garden, not the sky, a trace on
  pause and none after the end.
- Cost is unchanged: two full-frame blits replace two, and up to 6 small dabs.
