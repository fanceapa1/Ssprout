# ADR 0145 — Painted sky plates under the landscape

- Status: accepted; amended by ADRs 0163, 0184, 0185
- Date: 2026-10-23

## Context
The daylight phases are "a big drawing task, not a tint": each needs its own painted sky (a clear
cerulean, a peach dawn, an amber and crimson sunset, an indigo night with moon and stars), the
pond should reflect it, and the sun and moon should move. Repainting the 1.5 s landscape per phase
or per minute is out of the question.

## Decision
- One **sky plate** per phase (`src/scene/paint-sky.ts`), painted with the watercolour engine on
  white over the world band y −240 … 500 at 0.7 px/unit: wet-in-wet gradients, clouds left as
  paper (midday) or laid as ribbon-shaped banks with a lost lower edge and a lit underside
  (sunrise, sunset), glows kept in the sky above the far ridge, the hills glazed cool against the
  warm sky, stars left as paper. Plus one **water plate** per phase: the same sky mirrored into
  the pond as horizontal bands broken by lifts.
- Plates are **multiplied over the landscape in the cached `background` layer**, as if the sky
  had been laid in first and the garden painted over it (multiply commutes): trees and the
  pavilion standing against the sky take its glaze, plants and fauna (entities) stand in front.
- `createSkyLight` blends the plates by the phase weights into one composite (heaviest first,
  each layer covering its share — an exact convex mix), then **punches the sun and the moon out**
  (destination-out): the sun only above the far ridge, so it sets behind the hills; the moon with
  faint seas and its dark side glazed back for the lunar phase. The composite is rebuilt only when
  the weights move by 1/200 or a disc by a world unit (checked every 2 s), which invalidates the
  background cache.
- The water composite is laid on the pond (source-over, 0.22–0.42 by phase) under the plants'
  reflections every frame. Water glints follow the sun: busiest at midday, rare at night.
- Plates are painted on demand (~100 ms each with its water plate); the next phase's are painted
  in idle time.

## Consequences
- Plants are not tinted by the sky plate, so most of the night's darkness lives in the light
  plate (ADR 0147), which covers everything; the sky plate adds hue and texture.
- 4 × (1120 × 518 + 430 × 140) px of plates in memory at most (~10 MB).
