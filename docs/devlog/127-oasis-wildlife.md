# 127 · Oasis wildlife infrastructure (OK0, phase 13)

## What
The groundwork for the oasis's eight creatures (OK1–OK8): each creature task now only adds
`src/fauna/creatures/<kind>.ts` (ADR 0304).

- **Rows** (`src/scenery/oasis/fauna.ts`, data only): the eight rows are interleaved with the
  shared ones by threshold. They are skipped until their modules exist:

  | id | kind | rule |
  |---|---|---|
  | `house-bunting` | `bunting` | always, unannounced |
  | `laughing-dove` | `dove` | 2 plants |
  | `violet-dropwing` | `dropwing` | 3 plants |
  | `sahara-frog` | `sahara-frog` | 5 plants |
  | `hoopoe` | `hoopoe` | 8 plants |
  | `gecko` | `gecko` | 10 plants, at night |
  | `bee-eater` | `bee-eater` | 14 plants |
  | `white-stork` | `stork` | 20 plants, rare |

  The shared `swallows` row moved from 14 to 17 plants, so it no longer arrives with the
  bee-eater. No plant count now brings two creatures. The ids match what the sound bed (O7)
  listens for (`oasis:laughing-dove`, `oasis:gecko`, `oasis:sahara-frog`, `oasis:swallows` in
  `src/audio/params.ts`), so the audio code is unchanged.
- **Dropwing as its own kind**, not a `dragonfly` variant. A `dragonfly/violet` row would not
  skip: an aka or shiokara would fly in its place. It also behaves nothing like the hovering
  dragonfly (ADR 0304).
- **Contract** (`src/fauna/habitat.ts`, `targets.ts`, `types.ts`, `sim.ts`, minimal):
  - `SceneryFauna.ground` / `.walls` reach creatures as `w.ground` / `w.walls` (default `[]`);
  - `GroundSpot`, `WallFace`, `wallTopAt`, `wallFootAt`;
  - `Perch.kind` gains `wall | rim | frond | tower | post`, plus optional `slope` (followed by
    `perchY`) and `scale`;
  - `Show.stage` gains `'oasis'`, and `StageSpec` gains optional `x` and `y`.

  docs/ARCHITECTURE.md is updated.
- **Targets** (`src/scenery/oasis/wildlife.ts`, from the real shapes in `layout.ts`, `ksar.ts`,
  `paint-land.ts`, `paint-water.ts` and `paint-veg.ts`):
  - 42 perches:
    - 14 wall copings;
    - 9 on the basin rim (near, far and both sides);
    - 11 palm fronds (5 on the big palms, 6 on the grove's near row);
    - the middle tower's top (`NEST`, `KSAR_SCALE` 0.15);
    - 2 sluice-gate posts;
    - 5 stones.
  - 5 ground spots (three plots, two terrace strips).
  - 4 wall faces (three terrace walls, the basin's near face).
  - 5 heron stands (basin steps ×2, oued ×3).
  - `oasisPerspective(x, y)`, which handles the terrace lifts. `paint-land.ts` now exports the
    stones it paints (`FALLEN_STONES`, `NEAR_STONES`, same values and order, so the painting is
    unchanged).
- **Studio:**
  - `fauna-oasis/all` (`src/fauna/fauna.studio.ts`, `stage.ts`) runs the oasis's table over a
    crop of its real painting (`OASIS_STAGE` x 360, y 120, 880 × 790);
  - `oasis-wildlife/targets` and `/targets-close` (`src/scenery/oasis/wildlife.studio.ts`) mark
    every target with a creature of its size.
- **Tests:**
  - `src/scenery/oasis/fauna.test.ts`: ids, kinds, the sound ids, shared rows unchanged in kind
    and variant, thresholds, one arrival per count, roster skipping.
  - `src/scenery/oasis/wildlife.test.ts`: every perch, spot, face and stand inside its shape;
    perspective within 0.02 of every slot and continuous down every column; the sim hands out
    the new lists.
  - `src/fauna/targets.test.ts`: sloped `perchY`, `wallTopAt`/`wallFootAt`.
  - `src/scenery/oasis/oasis.test.ts`: checks the shared rows only.
- `src/main.ts` is not touched.

## Why
The waterfall's S11 pattern: the whole table up front, rows skip until their modules land, and
the scenery says where its creatures live. The oasis needed two kinds of place the other gardens
lack (walkable plots and wall faces) and perches above the ground. Raised perches carry their own
scale instead of bending `perspective(x, y)`, so fliers crossing a crown or the ksar keep their
size.

## Looked at
`artifacts/ok0/`:
- `targets-1440x900.png`, `targets-390x844.png`: the whole painting with every target;
- `targets-close-1440x900.png`: the stage crop;
- `stage-1440x900.png`: `fauna-oasis/all` at t 30.

What I saw:
- The wall perches sit on the painted copings of all three walls. The rim perches sit on the near
  and far copings, and the side ones on the side copings by the inlet and above the gate.
- The tower perch is on the middle tower's merlons. The gate posts and the corner stones are where
  they are painted.
- The plots' ellipses lie on the tilled patches. The terrace strips lie between the walls.
- The heron stands on the submerged steps at the basin's right end, and in the oued's water
  either side of the bar.
- The frond perches sit on level stretches of the big palms' and grove palms' fronds.
- In the portrait crop (x 430–1030), the basin's rim, the steps' stands, the tower, the gate and
  two plots are inside. The big palms, the oued's stands and the west plot are outside.

## Left open
- **The bunting** (OK1): `wall`, `rim` and `rock` perches. The window slits of the ksar are too
  small at its scale, so there is no "slips into a slit".
- **The dove** (OK2): `frond` (palm scale) for the coo-and-bow pairs, `rim-far-*` and `rim-near-*`
  to drink, and `w.ground` to walk the plots. The ksar palms (`KSAR_PALMS`) are painted with
  unexported random fronds, so they have no perches yet. They would take `KSAR_SCALE`, too small
  for a dove.
- **The dropwing** (OK3): `post` and `rock` perches. There are no reed or stick tips until the
  cattail or similar plants are planted. A creature could also perch on plant tips, as the
  damselfly does.
- **The Sahara frog** (OK4): `w.pond` (the basin) and the `rim` perches near the water. The basin
  is a deep stone tank, so it floats with eyes up or sits on the coping. The steps
  (`BASIN_STEPS`, tread 0–1 above water) are a good haul-out spot and are not exported as
  perches.
- **The hoopoe** (OK5): `w.ground`. The plots are on the basin terrace. The terrace strips take
  the terrace scale through `w.perspective`.
- **The gecko** (OK6): `w.walls`, night only (`visit.nocturnal`). At night it needs the walls'
  moonlit side (O5's night grade). The terrace walls face the viewer and their top edges are
  smoothed coping lines, so it should stay below `wallTopAt + 2`.
- **The bee-eater** (OK7): `frond` perches. Never animate it catching the oasis's bees. Every frond
  perch (x 1050 and beyond) is outside the portrait crop (x 430–1030). On phones it sits only on
  walls or the rim, or a perch on the ksar palms or the plants is needed.
- **The stork** (OK8): `tower` perch, `scale` 0.15, `NEST` (x 664, y 158, 30 wide) for the nest.
  The skyline (`layout.ts › SKYLINE`) is traced from the ksar shapes, so a nest painted above the
  merlons must either join the silhouette or be drawn over the sky plates. On the plots it walks
  at ground scale; its size there should match the heron's.
- The heron's basin stands are on the steps at the far right of the basin. Its reflection is
  drawn on the still water, which suits the mirror basin (ADR 0302).
- The `talus-2` slot stands on the grove wall's painted extension (x < 1066). Its scale is 0.02
  under what `oasisPerspective` gives there; the slot was left as it is.
- No e2e spec yet. A `fauna-oasis.spec.ts` like `fauna-waterfall.spec.ts` can come with the first
  creature.

Status: done.

- Devlog index: `| 127 | [Oasis wildlife](127-oasis-wildlife.md) | OK0: the eight oasis creature rows (skipped until painted), perches on walls, rim, fronds, a ksar tower, gate posts and stones, the hoopoe's plots, the gecko's wall faces, heron stands, terrace-aware perspective and an oasis fauna stage (ADR 0304) |`
- ADR index: `| [0304](0304-oasis-wildlife-targets.md) | The oasis's wildlife targets | accepted | Plots and wall faces as new target lists; perches gain wall/rim/frond/tower/post kinds, a slope and their own scale (palm crowns, the ksar at 0.15) while perspective(x, y) stays the ground's; the violet dropwing is its own kind |`
- TESTING rows:
  - `| OK0.1 | Oasis table: ids, kinds, sound ids, shared rows, thresholds, one arrival per count, rows without a module skipped | src/scenery/oasis/fauna.test.ts |`
  - `| OK0.2 | Oasis targets: every perch, plot, wall face and stand inside its shape; perspective within 0.02 of every slot and continuous; the sim hands out ground and walls | src/scenery/oasis/wildlife.test.ts, src/fauna/targets.test.ts |`
