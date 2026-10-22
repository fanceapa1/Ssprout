# ADR 0142 — One sun for every painted thing (sky layout)

- Status: accepted
- Date: 2026-10-23

## Context
The sky, the light plates, the plants' shadows and rims and the boulders' rims must agree on
where the light comes from, or the painting falls apart.

## Decision
`src/ambience/sky-layout.ts` (pure) maps a `DaylightState` to the garden's world:
- **Sun**: rises over the right-hand hills (x ≈ 1130, the engawa side) and sets over the left-hand
  ones (x ≈ 556), so its mirror image lands on the pond. y = `HORIZON_Y` (368) − 8.5 units per
  degree of altitude; drawn only while low (−3° … 15°) and in sunrise/sunset light. The sky plate
  clips it to the sky above the far ridge, so it sinks behind the hills.
- **Moon**: a Bézier arc from (902, 270) through (806, 182) to (708, 252) — east to west through
  the gap between the tree groups, and below y ≈ 165 so wide canvases (which crop the top of the
  world around the pond) keep it in view. Shown with the night weight.
- **Stars**: 30 seeded points (y 30–300, clear of the moon's arc), left as paper in the night sky
  and the night light plate alike.
- **Cast shadow** (`castShadow`): length from the altitude (0.55 / tan alt, ≤ 2.6× height),
  pointing left at sunrise, right at sunset, a short pool slightly toward the viewer at midday,
  faint at night; weighted over the phases so blends move it continuously.
- **Rim light** (`rimLight`): peach from the right at sunrise (0.75), deep gold from the left at
  sunset (1); none at midday or night.

## Consequences
Sun and moon positions are art-directed for this scene, not astronomical azimuths; altitude and
side are real. Moving the sky means editing one module.
