# 226 · GA1: The coast's scene, after the acceptance

## What
The scene half of the acceptance's short list (devlog 225, open items 1, 3, 5, 6, 7 scene half, 8,
9, 10 and 21), in the acceptance's order. The garden stays behind `?dev&scenery=coast`. Looked at
before and after each change in the owner's window (1470 × 750 at DPR 2), at 1440 × 900 and on a
phone (390 × 844), at noon, and at sunrise, sunset and night at the end. Shots in the session
scratchpad (`ga1-<n>-before.png`, `ga1-<n>-after.png`, `ga1-overview-1470-*.png`, `ga1-phone-noon.png`).

## The items
1. **The terraces' seaward edge** (item 1): fixed. The ruled line was two things: the shoreline's
   runs that face away (from the top terrace's corner down to the bastion and the beach flight),
   painted as a thin wet band under a lit line, and the cliff's foot on the sea, a straight wet
   band. Neither line moved (`SHORE_EDGE`, `CLIFF_FOOT`: the motion, the slots and the wildlife read
   them). Painted over them (`lip-shapes.ts`, `paint-rocks.ts`):
   - a worn lip along the runs that face away: its edge wanders up to 11 out into the water and
     back in notches, in blocks with joints, end faces in shade, a weathered top, broken wet edges
     and weed; three boulders at its foot. Below y 712 it stays within 2.5 of the line, where
     `shallows-3` lies;
   - a broken wave-cut shelf along the cliff's foot (long low slabs, short tall blocks, gaps where
     the face drops straight in) and five fallen blocks; the face's wet band wanders in height.
   The motion's laps follow the new edges (`LIP_EDGES`, `FOOT_FRONT`) and its dry clip and glint
   test take the new boulders. At the overview the edge now reads as rock with boulders and foam;
   on the phone too.
2. **The pines in the owner's window** (item 3): partly fixed.
   - The leaning pine is drawn at 1.8× its box (was 1.9): its crown comes 30 units lower, clear of
     the chapel and the top houses, and the narrower left margin (item 3 below) no longer washes it
     out. In the owner's window its crown now shows as a pine head under the top edge, right of
     "Start studying"; its upper half is still above the window. Lowering it further puts the
     crown over the village. Its limbs, trunk and crown literals (`PINE_*`, `PINE.top`) follow the
     plan; the one pine perch and the cicada's bark follow them.
   - `scrub-1` did not move. A full-grown tree at its scale (0.55, 1.25×) is 316 units tall; the
     owner's window shows y 179–961 and the corner buttons cover the top-right to y ≈ 244. A tree's
     top clears that only with its foot at y ≥ 676 (the middle terrace) left of x ≈ 1225, and with
     a terrace's lift it grows faster than it rises. On the cliff the only open stretch left of the
     buttons is between the temple and the olive, where `top-1`'s tree (the pergola vine in the
     looked-at garden) and the goats' cliff-top way already are. Showing a crown there needs a
     smaller scale for that slot or a new tree place in the composition: left for the owner.
3. **The left side's veil** (item 5): fixed. Two causes. The far headland's wash (`HEADLANDS[0]`)
   ran on behind the far hill to a vertical edge at x 180, and showed through the lifted hill as a
   curved hard edge, white by day and pink at sunset; it is now only what shows over the hill.
   And the margins lifted the painting but not the daylight's plates, so the hill and the bay went
   pale under a sky and a sea plate at full colour. The coast now paints its own margins (the
   shared field, the left side narrowed from 200 to 140 units) and lays the same lift on its sky
   and sea plates (ADR 0387). The left edge is one soft dissolve in every phase; at night it reads
   as a paler band of the night's blue, like the bottom edge.
4. **The phone's empty sky** (item 6): not fixed. The scenery contract has one focus
   (`SceneryView.focus`), and a portrait phone never uses its y: `createViewport` shows at least
   600 units of width, so a 390 × 844 stage shows the whole height (y −136 to 1136) and the sky is
   40 % of it whatever the focus. Moving the focus sideways only trades the temple for the village.
   What it would take: a portrait framing per scenery, for example `SceneryView.portrait?: { focus,
   minVisibleW }` read by `createViewport` (src/render), so a tall window covers more and shows less
   width (about 460 units would put the cove, the caique, the temple and the terraces under a band of
   sky); with it ADR 0123 and ADR 0382's rectangle for phones. A shared contract change, not done.
5. **The pools and the painting's foot** (items 8, 21): fixed in part. The shelf breaks into slabs
   (joints across its beds, each slab its own grey), stones lie round the pools and on the
   foreground, low limestone ledges break through the soil below the lowest wall, sand drifts
   against its foot, and five more tufts grow there. Close up the pools now sit in a stepped
   limestone platform. The pools did not rise: their tops are 3–10 units under the beach's back,
   and the crab's rims, the octopus's pools and the shore break's 20-unit clearance read them. They
   stay at the top of the bottom dissolve at 1470 × 750; the paper margin still lifts the foot.
6. **`low-4`** (item 9): partly fixed. It moves 18 left (1560 → 1542), with `scrub-4` (1498, 826)
   → (1486, 812) and `mid-5` (1474, 680) → (1460, 676), so no plant stands over another's base and
   every spacing rule holds. A full medium box now ends at x 1620 (was 1638): a wide lavender still
   dissolves a little at the right edge. With `mid-4` moved too it could reach 1534, but that
   changes the cat's walk on the middle terrace and the cat's tortoise test (`cat.test.ts`, a
   creature file) sees no detour; further left every place fails `coast.test.ts`; making the slot
   small changes which species fit it (`sites.test.ts` and the Jerusalem sage's own test).
7. **Sunset** (item 10): fixed. On the light plate the low sun rakes the point and the faces east
   of the headland's deep fissures and its rim, and the columns' left flanks, with cool right
   sides. On the sea plate a dark band lies under the far shore and the point, a bright warm core
   sits under the sun, and less of the mirrored sky lies near the shore (`WATER_NEAR` sunset 0.2,
   sunrise 0.34; `COAST_WATER_ALPHA.sunset` 0.7), so the turquoise shelf reads under the warm
   light. The low sun's glints on the far road are a little larger. Sunrise takes the same,
   softer. The `sea` step is unchanged (its pin holds).
8. **The ledge scrub** (item 7, scene half): fixed. Every clump (the maquis on the headland, the
   phrygana, the shore clumps) is a soft cushion: more, smaller scalloped lobes, a lifted top where
   the sun catches the dome, its shade gathered in its foot, softer edges. The ledges' scrub on the
   face is small cushions with a lit top, a shaded foot, a cast shadow and twig flecks.

## What moved
- Geometry: nothing. New painted data: `LIP`, `LIP_EDGES`, `FOOT_SHELF`, `FOOT_FRONT`,
  `LIP_BOULDER_SHAPES` (three at the lip, five at the cliff's foot), `FOOT_STONES` (`lip-shapes.ts`);
  `HEADLANDS[0]`; five `GRASS` tufts; `SHORE_RUNS`, `LEDGE_EDGE` and `shoreRuns` moved from
  `paint-rocks.ts` into `lip-shapes.ts` (re-exported).
- Slots: `low-4`, `scrub-4`, `mid-5` (above). Ids, habitats, sizes and sites unchanged.
- Perches: the pine's (its literals follow the plan at 1.8×); `COAST_SEEN` unchanged. The view
  (ADR 0384) unchanged.
- The motion: laps along the lip's and the shelf's fronts; the new boulders in its dry clip; the
  low sun's glint a little larger. Its caps hold (`motion.test.ts`).
- No creature or species file touched.

## Pins
`rock.test.ts` (overview, detail), `veg.test.ts` (overview, detail), `daylight.test.ts` (the four
sky plates). The `sea` step's and the caique's plate did not move (`water.test.ts`, `motion.test.ts`).

## Paint time
Production build, a cold coast in a new context (`sceneStats().timings`), 1470 × 750 at DPR 2,
three runs each, `main` built from the same tree minutes apart. The machine was loaded (two other
agents; the 1-minute load beside each block), so read the two columns against each other, not
against devlog 225's quiet numbers. Total ms / longest part / parts:

| step | before (load 5.7–11.7) | after (load 9.9–21.8) |
|---|---|---|
| `shore-rocks` | 426–433 / 9.7–19.1 / 947 | 747–785 / 13.9–17.4 / 1624 |
| `promontory` | 419–490 / 15.4–22.9 / 721 | 446–517 / 15.6–53.7 / 805 |
| `maquis` | 420–470 / 33.6–63.2 / 491 | 468–614 / 33.1–57.7 / 493 |
| `pine` | 142–162 / 19.5–25.1 / 153 | 154–181 / 25.1–31.9 / 153 |
| `margins` | 86–102 / 24.7–28.1 / 86 | 83–87 / 28.1–29.7 / 86 |
| `far-hill` | 70–96 / 4.1–8.2 / 249 | 80–97 / 3.9–9.0 / 249 |
| `sea` (unchanged) | 458–575 / 10.6–30.0 / 752 | 525–532 / 23.0–25.9 / 752 |

- `shore-rocks` is the real cost: about +330 ms at this load (the lip, the cliff's shelf, the
  shelf's joints, the foreground's ledges and 23 more stones), in 677 more parts, none of them
  over 20 ms. On devlog 225's quiet machine that is roughly +150 ms on a 2.1 s paint.
- The other steps' longest parts over 20 ms (`promontory` once, `maquis`, `pine`, `margins`) are
  over it before as well, at this load: the raster backlog of devlogs 218 and 222. The `pine`
  and `margins` steps did not grow; `maquis` grew by its finer lobes (within the noise).
- The sky and sea plates each pay one pixel pass over their two side bands (not measured apart).

## Tests
- New: `rock.test.ts` › the worn lip and the cliff's wave-cut shelf (three tests); `coast.test.ts`
  › the coast's paper margins and far headland (two tests); studio `coast-rock/lip`. Rows GA1.1–3
  in TESTING.md.
- `npm run typecheck`: clean.
- Full unit suite after the last rebase (`VITEST_WORKERS=1`, 855 s): 286 files, 3055 tests, one
  failure: `cat.test.ts` › a tortoise put down on its way (no detour in any seed), caused by moving
  `mid-4`; with `mid-4` back in place `cat.test.ts` passes (26), and `coast`, `wildlife`, `sites`,
  `motion`, `shore`, `parts`, `rock`, `veg`, `daylight` and the coast creatures' tests (tortoise,
  green lizard, goat, cicada, gull, scops owl, rock thrush) pass one file at a time.
- E2E, production build on 4369, one worker, one file at a time (before the last rebase, which
  brought only GA2's card texts, and before the last slot nudge): `sceneries` 11 of 12 (the
  Japanese garden ↔ waterfall cross-fade check failed once, then passed twice alone), `scene` 5,
  `camera` 16, `lazy-painters` 1, `daylight` 10, `ambience` 6, `fauna` 6, `lazy-creatures` 2,
  `planting-previews` 2, `plants` 8, `plant-card-phone` 5, `lazy-species-painters` 1, `studio` 38.

## Left open
- The phone's first view (contract change above); `scrub-1`'s crown in a wide window.
- `low-4`'s lavender still touches the right edge's dissolve; the pools stay at the top of the
  bottom dissolve at 1470 × 750.
- The coast's margins duplicate the shared step's routine (ADR 0387).
- The sunset's road core is soft at zoom 3 (the sea plate's feathered rim at the horizon).
