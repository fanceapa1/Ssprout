# ADR 0284: Each scenery says which side its low sun lights from

- Status: accepted
- Date: 2026-11-03
- Builds on: ADRs 0142 (sky layout), 0146 (plant shadow and rim light), 0147 (light plates),
  0241 (scenery contract), 0247 (waterfall daylight)

## Context
The shared cast shadow and rim light (`castShadow`, `rimLight` in `ambience/sky-layout.ts`) had
the Japanese garden's sun built in: shadows fall left at sunrise and right at sunset, rims face
the other way. At the waterfall both low suns stand on the right (sunrise x 1270, sunset x 1040,
ADR 0247), so at sunset its boulder and plant shadows fell toward the sun and the rims lit the
shaded side. The waterfall's own light art already worked around it with `|dx|`.

## Decision
- `SkyLayout.sunSide?: { sunrise: -1 | 1; sunset: -1 | 1 }`: the side of the frame the low sun
  lights the scene from (−1 left, +1 right). The garden states `{ sunrise: 1, sunset: -1 }`, the
  waterfall `{ sunrise: 1, sunset: 1 }`. Without it, `sunSide(sky)` gives the garden's.
- `castShadow(s, sky?)` and `rimLight(s, sky?)` take the sky like `sunDisc` and `moonDisc` do,
  default the garden's. Only the sign of the low-sun terms changes: the length, darkness, rim
  strength and colours stay the same. Midday and night (the moon) are left as they were.
- The readers pass the viewed scenery's sky: the plant system (`SystemContext.scenery.sky.layout`),
  the scene system's boulder rims, the light plates (`LightArt.sky`: boulder, shrub and tree
  shadows, and the paper reserved on the sun side of the crowns) and the `daylight()` dev readout
  (`AmbienceSystem.sky()`). The plant debug state shows the result as `sun`.
- A side per low sun, not an azimuth through the day. It is the smallest form that says both
  gardens right: the painted shadows and rims have only ever had a left and a right.
- Why not derive the side from `sunriseX`/`sunsetX` against the middle of the world: a hidden rule,
  and a sun near the middle would flip on a few units. The side is the painter's choice; it is stated.
- The waterfall's value is set in `waterfall/sky.ts` (`WATERFALL_SUN_SKY`, its layout plus the
  side) and used as both `sky.layout` and `light.sky`, so `layout.ts` stays as it is.

## Consequences
- The Japanese garden renders the same to the bit: with its side, the shadow's `dx` multiplies by
  ±1, which is exact, and the rim's side is the same constant.
- The waterfall's light plates change at sunrise and sunset (the boulder shadows now fall left),
  and their cache key changes with `light.sky`.
- Paint sources change, so the paint version changes once.
- Weather sun's leaf glints and lifted bands (ADR 0193) are not daylight and keep their upper-left
  light everywhere.
- Covered by `ambience/sky-layout.test.ts`, `plants/shadow.test.ts`, `plants/system.test.ts`
  and `scenery/registry.test.ts` (every scenery states its side).
