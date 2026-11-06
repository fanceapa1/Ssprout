# ADR 0304: The oasis's wildlife targets: plots, wall faces, perches with their own scale, the dropwing as a kind

- Status: accepted
- Date: 2026-11-06
- Builds on: ADRs 0248 (scenery wildlife), 0300 (terrace lift)

## Context
The oasis's eight creatures (docs/research/oasis-biome.md §3) need places the other gardens never
had. The hoopoe walks the damp plots. The gecko clings to warm walls. The doves and bee-eaters sit
in palm crowns, and the stork stands on a ksar tower. `SceneryFauna` only knew perches (rocks,
stones, ledges), heron stands and a perspective, and creature tasks must only add their own file
(docs/systems/fauna.md › Adding a creature). The research also suggested the violet dropwing as a
`dragonfly` variant.

## Decision
- **Two new optional target lists on `SceneryFauna`**, passed to creatures as `FaunaWorld.ground`
  and `FaunaWorld.walls` (`[]` by default, so the garden and the waterfall are unchanged):
  - `GroundSpot` (`id, x, y, rx, ry`): an ellipse of open ground to walk inside.
  - `WallFace` (`id, outline, top, h`): an upright face. `wallTopAt` and `wallFootAt` give its top
    and its foot (the entities depth) at x.
- **`Perch.kind` gains `wall`, `rim`, `frond`, `tower` and `post`**, and two optional fields:
  - `slope`, which `perchY` follows (a frond, or a side coping running to the vanishing point);
  - `scale`, for what stands where the ground's perspective is wrong.
- **Raised things carry their own scale; `perspective(x, y)` stays the ground's.**
  `oasisPerspective` is the slots' rule: a terrace and its coping take the lift, and a wall face
  takes its coping's scale down to its foot. Because each lift is the drop of the wall in front,
  the scale is continuous down every column. Fronds take their palm's foot scale (0.64–0.71). The
  tower takes `KSAR_SCALE` 0.15: tower-mid (150 units) reads as a pisé tower of about 8 m, so a
  stork about 1 m tall is a seventh of it. Putting these scales in `perspective(x, y)` would make
  a flier shrink or grow as it crosses a crown or the ksar, because fliers read perspective at
  their own position.
- **The violet dropwing is its own kind, `dropwing`, not a `dragonfly` variant.** A `dragonfly`
  row with variant `violet` would not be skipped (the module exists). `variantOf` would fall back
  to a random existing body, so an aka or shiokara would fly over the oasis before the dropwing is
  painted. The behaviour also shares nothing: the dropwing perches and sallies from a post with
  its wings drooped, while the dragonfly hovers and dips, seen from above. Adding a fourth body to
  `DRAGONFLY_VARIANTS` would also change the Japanese garden's random pick, and so its pinned
  regression hashes.
- **No gecko faces and no small-bird perches on the ksar.** At `KSAR_SCALE` a gecko would be about
  2 units long and a bunting 3. They live on the terrace walls, the basin's near face and its
  coping.

## Consequences
- The oasis creature tasks add only `src/fauna/creatures/<kind>.ts`. Their targets are
  `w.perches` (by kind), `w.ground`, `w.walls`, `w.stands()`, `w.pond` and `w.water.moving`.
- A creature on a perch draws at `p.scale ?? w.perspective(p.y, p.x)`. Creatures written before
  this ADR ignore `scale`, but none of them perch in the oasis.
- The table lives in `oasis/fauna.ts` as data only, so `scenery/fauna.ts › faunaTable` still loads
  no painting. The targets, which read the painters' shapes, are in `oasis/wildlife.ts`.
