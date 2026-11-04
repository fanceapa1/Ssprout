# 105: The oasis scenery skeleton (O1)

Lines for the orchestrator to place:

- Devlog index: `| 105 | [Oasis scenery skeleton](105-oasis-skeleton.md) | O1: draft A as a third scenery behind ?dev&scenery=oasis: basin, seguia and oued geometry, 47 slots with terrace lifts, habitat words, view, placeholder golden sky and light, an empty flora profile, the creatures shared by biology | Done |`
- ADR index: `| [0300](0300-oasis-sun-side-and-terrace-lift.md) | The oasis's low suns stand on the right; raised terraces take their lift in scale | accepted | Draft A is lit from the right and its only low open sky is the notch between the bluff's shoulder and the grove: both low suns stand there (sunset x 872, sunrise x 980, horizon y 340, sunSide right/right); ground and copings on a raised terrace take perspectiveScale(y + lift), with lifts of high 70, middle 36 and grove 24 (the drawn wall drops) |`
- TESTING, §1a, after S4.x (phase 13):
  - `| O1.1 | The oasis is registered, offered only with ?dev&scenery=oasis, consistent with itself (no building, lantern, eave, falls or motion), paints draft A's steps but its sky, by element; v4 gardens with oasis plants validate and round-trip | scenery/oasis › the oasis scenery (all), › oasis gardens in the saved state; scenery/registry › holds the oasis…; core/sceneries › lists the Japanese garden…, the waterfall and the oasis | sceneries › (the oasis is not offered without the flag) | ✔ |`
  - `| O1.2 | Slots: 40–49 with prefixed ids, every habitat (4+) and size (2+); in the world at 1.25×, out of the sky, off the bluff; water, land and shore slots against the water; rock slots on a coping or the talus; terrace lifts in scale (ADR 0300); footpath slots; spacing (distance, footprints, nothing over a raised slot's base, trees hide nothing) | scenery/oasis › oasis slots (all), › oasis spacing… (all) | — | ✔ |`
  - `| O1.3 | Sky placeholder: both low suns in the open notch (8–16°), hidden at −3°, clear of the tree crowns; the moon's arc and the stars in open sky; the plate band below the skyline; sun side right at both | scenery/oasis › the oasis sky (all) | — | ✔ |`
  - `| O1.4 | Flora and wildlife: the profile (n-africa-arabia, desert/wetland, arid, cultivated) offers no species yet, so the oasis stays behind the flag; its table holds only creatures shared by biology | scenery/flora › the oasis offers no species yet…; scenery/oasis › the oasis's flora and wildlife (all) | — | ✔ |`

## What
- `src/scenery/oasis/{index,layout,geometry,slots,flora,fauna,sky,light}.ts` and `map.studio.ts`.
  The scenery is called "Ksar oasis", with the blurb "Palm terraces under a mud-brick ksar, a stone
  basin fed by a seguia, and the oued bending past." Its `order` is 2.
- `available` is true only with `?dev&scenery=oasis`, as the waterfall's was before S17.
- `oasis` is added to `SCENERY_IDS`. No schema change was needed: validation reads `SCENERY_IDS`,
  and a test validates and re-imports a v4 garden with oasis plants. The core tests'
  `Record<SceneryId, …>` fixtures got an empty `oasis` entry.
- The painting is still draft A's. `oasisSteps` runs each draft step on its own (the draft forks
  its rng per step by name, so a step paints the same alone), grouped by element in
  `OASIS_ELEMENTS`. Those groups are the seams: O2 swaps `rock`, O3 `water`, O4 `ground`, `grove`,
  `walls`, `palms` and `near`. The draft's own sky step is dropped, because the sky plates multiply
  over the painting.
- `src/main.ts` is unchanged.

## Decisions
- **Slots (47)**: water 7, shore 13, meadow 9, path 6, back 5, rock 7. See docs/systems/scenery.md
  › Oasis › Slots.
  - Per O0: there are rock slots on the wall copings and the bluff's talus (for the caper and the
    colocynth), two tree slots (for the date palm and the pomegranate), and a large water slot in
    the basin's overflow corner by the sluice (for the cattail).
  - The habitat words come from the brief's suggestions.
- **Terrace lift and sun side** (ADR 0300). Both low suns stand on the right, not with sunset
  behind the ksar as the brief suggested. The painting is lit from the right, and a sun setting on
  the left would be hidden by the bluff from 16° down.
- **Path habitat**: the draft has no path, so I defined `FOOTPATH` from the bottom edge to the
  basin's near rim (`pathOut` uses it), with `walk-*` slots on the sand beside it. O4 paints it.
- **Flora**: the profile is the coordinator's (`desert`, `wetland`; arid; cultivated). It offers
  nothing, so the oasis stays behind the flag. `flora.test.ts` now says so explicitly, and its
  released-scenery invariants do not apply until it ships.
- **Wildlife**: only the creatures O0 shares by biology are listed. They are the strider (margin),
  the gold leaf (`katsura`), the cabbage white, bees, the swallowtail, swallows (14 plants) and the
  heron (22 plants, rare). The oasis's own creatures come with the art queue. There are no perches
  or heron stands yet: perches fall back to nothing, and stands to the basin's far edge.
- **Sound**: `pond` until O7.

## Looked at
- Draft A's world and map studio shots (`artifacts/shots/draftworld-1440x900.png`,
  `draftmap-1440x900.png`). I used them to find the open sky (the notch between the bluff's
  shoulder and the grove) and the free ground.
- `oasis-map/map` (`artifacts/shots/oasismap-1440x900.png`), the composition map over the painting:
  - Two passes. The first, driven by the tests, found water-plant boxes hiding the ground behind the
    basin's far rim, front plots hiding the terrace slots, and the right tree hiding a wall slot.
  - So I removed the front row of left plots (no medium plant there fits without covering a
    terrace slot), moved the trees, and turned the slot behind the basin into `talus-2`.
  - After the look, I moved `wall-2`, `wall-5` and `plot-3` in from the frame's edges.
  - Every slot sits on its ground: copings on the wall lines, talus under the bluff, the overflow
    slot by the sluice, the sand bar slot on the bar.
- The app, `?dev&fixtures&scenery=oasis` with 47 fixture plants at noon
  (`artifacts/shots/oasis-full-1440x900.png`, `oasis-full-390x844.png`):
  - The garden switches and paints. The lilies sit in the basin, and plants stand on the copings
    and the talus.
  - The phone crop holds the two east towers, the notch, the basin and the foreground.
  - The placeholder sky reads as a pale wash, and the guiding path leaves from the bottom centre.
  - The fixture plants are small, so they do not test the large boxes. The map does.

## Left open
- O2–O4: the painters. The draft's palms, bluff and middle-ground bands are the known weaknesses
  (devlog 102). O4 also paints the footpath.
- O5: the real sky plates. The placeholder wash is cut to a skyline that runs along the far range
  on the right, so it lightly tints the big palms' crowns. The skyline over the ksar is blocky.
- O5: the light plates (the palms throw no shadows; `trees`/`shrubs` are empty).
- O6: motion. O7: sound.
- No boulders, stepping stones, perches or heron stands: the fauna art queue should add perches on
  the copings and the basin's rim (the house bunting, the gecko).
- The release needs the art queue's species. After that, `flora.test.ts`'s released invariants
  (10–30 species, 2 per tier, 2 per habitat, 6 own) must pass before `available` becomes true.
