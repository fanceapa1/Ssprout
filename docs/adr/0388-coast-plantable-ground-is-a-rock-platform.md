# ADR 0388: The coast's plantable ground is a rock platform standing above the sea

- Status: accepted
- Date: 2026-11-22
- Builds on: ADRs 0360 (the coast's composition), 0370 (the beach flight), 0384 (the wide window)

## Context
The owner could not tell whether the terraces were a shore or a rocky platform above the shore:
the walls, drawn almost in elevation, said "stepped and raised", but the seaward edge was one
diagonal where the cream floor met the turquoise water with a row of round boulders and foam,
which said "beach at sea level". They chose the platform. GA1's worn lip (devlog 226) had only
changed the edge's texture: the floor still touched the water along the whole diagonal.

In this view (the sea on the left, the walls seen from the front) a vertical face shows only
where the land is above the water on the screen: where the shoreline runs down to the right. Where
it runs down to the left, the face turns away from the viewer: we see the floor's edge and, beyond
it, water farther off. The old shoreline was mostly the second kind, with two short faces 11–22
units high, so almost nothing said "drop".

## Decision
- The plantable ground is a rock platform. Each of the upper two terraces ends at its seaward end
  in a headland whose south face drops into the sea: the top terrace's over the upper cove, the
  middle terrace's (the bastion) over the lower one. A face runs from the floor's rim (the line
  from the headland's west corner to the coping of the wall that holds that terrace) down to its
  foot in the water, 52–73 units: more than the wall it ends. The higher headland stands higher in
  the picture, and the next terrace's floor passes in front of its foot at the east end.
- `SHORE_EDGE` runs along the faces' feet, so the faces are land: the sea, its depth lines, the
  motion's clips and the wildlife's water stop at the rock. The edges that run down to the left
  are the floor's rim over deeper water: a lip of bare rock, a lit arris, a thin dark line where
  the rock drops away, the water beyond in its shade, and no foam or stones (the sea meets that
  rock out of sight).
- The swell breaks on the faces' feet: the motion's laps run along them and the white water climbs
  the face and falls back; the old laps along the lip are gone, so the lap count stays about the
  same. Fallen blocks lie at the feet, not along the rims.
- The walls run full height to their seaward ends, built of quoins, and meet the headlands' faces;
  the rim's lit arris continues the coping. The beach steps are cut into the platform's corner,
  their stepped side rising out of the sand.
- Shapes are data (`platform.ts`, fixed seeds); the step `platform` (element `stones`, after the
  walls and before `shore-rocks`) paints them.

## Consequences
- The sea's shape near the terraces moved, so the water, rock, land, shore, vegetation and
  daylight hashes moved (devlog 229). No slot or id moved; `shallows-3` keeps 30 units from the
  bastion's corner. Two shore-scrub spots, a phrygana cushion, a grass tuft and a shore clump that
  stood where the faces now are moved onto the floors; the damselfish's shallows stay inside the
  turquoise and below the caique.
- The lower terrace has no face of its own: it ends at the beach steps, and its back edge is a rim
  over the water at the bastion's foot.
- The geometry is a painter's: the faces' heights are not the terraces' lifts above the sea (the
  top terrace would need 130 units of face, which would hide the middle terrace's west end).
