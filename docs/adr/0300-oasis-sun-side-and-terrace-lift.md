# ADR 0300: The oasis's low suns stand on the right; raised terraces take their lift in scale

- Status: accepted
- Date: 2026-11-04
- Builds on: ADRs 0241 (scenery contract), 0245 (waterfall slots and ledge scales), 0284 (sun side)

## Context
O1 turns oasis draft A into a scenery. Two choices were not obvious.

**The sun.** The brief suggested the garden's pattern: the sun rises on the right and sets on the
left, behind the ksar. In draft A, though:
- the painting is lit from the upper right. The bluff's flank, the ksar towers' flanks and the
  palm fronds are lit on their right sides, and those lights are painted in.
- the bluff and the ksar fill the left third of the sky down to y 126–276. A sun setting on the
  left would be hidden from about 16° up, so its disc would never be seen.
- the only low open sky is the notch between the bluff's shoulder (x ≈ 838) and the grove's first
  palms (x ≈ 960), over the far range (y 300–336).

**Terraces.** The terraces on the left step down toward the viewer. Their walls drop 34 and 36
units, and the grove's wall behind the basin drops 24. Ground that is raised shows higher on the
screen than ground at the same depth, so `perspectiveScale(y)` would draw its plants too small.
This is the waterfall's cliff problem (ADR 0245), but here the ground is in steps.

## Decision
- **Both low suns stand in the notch**: `sunSide: { sunrise: 1, sunset: 1 }`, with `sunsetX` 920
  and `sunriseX` 990 over `horizonY` 340. The setting sun sinks behind the bluff's shoulder just
  below the ksar's east tower. The rising sun comes up a little further right, through the far
  grove. The moon arcs over the notch. The stars keep a gap over the ksar.
  This matches the painted light, and both discs stay inside the phone crop. The waterfall made
  the same call (ADR 0284).
- **Raised ground takes its lift**: `LIFT` in `oasis/layout.ts` is the sum of the drawn wall drops
  in front of each terrace: high 70, middle 36, grove 24. A slot on a terrace, or on the coping of
  the wall that holds that terrace, takes `perspectiveScale(y + lift)` (`terraceScale`). The drawn
  drop is in screen units at that depth, so `y + lift` is where the same depth would show on the
  basin's level.
- Slots on the basin terrace keep `perspectiveScale(y)`.

## Consequences
- O5 paints the warm light and the long shadows from the right at sunrise and at sunset. The
  shared cast shadow and rim light follow the stated side.
- If O2–O4 change the walls' heights, the terrace scales follow through `LIFT`.
- The oasis has no setting sun behind the ksar. The ksar can still glow at sunset, lit from the
  right, against a deeper sky above it.

## Update (O2, devlog 107)
The reframing moved the ksar right and down (x 430–898, horns at y ≥ 152) and narrowed the basin.
The low suns moved with the notch: sunset x 872 → 920, sunrise x 980 → 990, horizon still y 340.
The setting sun now sinks behind the shoulder right of the east tower. The terrace lifts are
unchanged.
