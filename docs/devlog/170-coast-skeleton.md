# 170: The Greek coast skeleton (G1)

## What
- Draft B ("Stepped terraces down to the shore", the owner's choice) is now the fourth scenery,
  `coast`, behind `?dev&scenery=coast`. The working name is "Greek coast", `order` 3.
- Files: `src/scenery/coast/{index,layout,geometry,slots,flora,fauna,sky,light,painters,paint-placeholder}.ts`,
  `map.studio.ts` (studio `coast-map`, 152) and `coast.test.ts`. It is O1's twin (devlog 105), with
  O2's framing lessons (devlog 107) built in from the start.
- The painting is a placeholder: draft B's steps moved onto the final layout
  (`paint-placeholder.ts`), grouped by element in `COAST_ELEMENTS`. Those groups are the seams the
  painter tasks swap. The draft's own sky step is dropped, as in O1. `drafts/b` stays as a record.
  The painters, sky and light marks are one lazy chunk (ADR 0341).
- `coast` is added to `SCENERY_IDS`. No schema change was needed: validation reads `SCENERY_IDS`,
  and a test validates and re-imports a v4 garden with coast plants.
  - The core tests' `Record<SceneryId, …>` fixtures got an empty `coast` entry.
  - The tests that used `coast` as an unknown id now use `reef`.
- The fauna table is empty (`COAST_FAUNA`). The sound is `coast`, the seaside profile that was
  already in `SCENERIES`.
- `src/main.ts` is unchanged.

## Decisions
- **Layout** (ADR 0360). The full description is in docs/systems/scenery.md › Coast.
  - **Light from the left at both low suns.** The suns stand over the sea's horizon (y 400),
    between the far hill and the temple's point (sunset x 552, sunrise x 636).
  - **The skyline is traced** from the far hill, the promontory and each column.
  - **The shoreline is broken.** It has a rock shelf, a cove, a bastion, a second cove, scrub, and
    steps down to the beach.
  - **Focus (760, 600).**
  - **The beach and the pools sit higher than in the draft.** The draft had them in the paper
    margin's corner, where they faded.
  - **Terrace lifts** are 48, 92 and 132.
- **Flora** (ADR 0361). The research's profile needed a new climate (`mediterranean`) and two new
  biomes (`scrub`, `marine`), one line each. No existing climate fits: `arid` would offer the retama
  and the desert hyacinth, which are not Greek. No species was retagged. **By biology the coast
  offers only the caper** (`cultivatedIn: ['mediterranean']`).
  - The research's other shared species need their tags first: oleander, southern maidenhair,
    grapevine and pomegranate.
  - The coast stays behind the flag until its own species land.
- **Slots (48)**: water 9, shore 5, meadow 12, path 5, back 6, rock 11. Sizes: 2 trees, 3 large,
  11 medium, 32 small.
  - **Large slots:** a large shallows slot for the seagrass, a large beach slot for the oleander,
    and a large bed on the middle terrace.
  - **Tree slots:** one in the beds at the top terrace's left end (the olive) and one in the scrub
    at the promontory's foot (a showpiece pine).
  - **Habitat words** are the research's: in the shallows, on the beach, in the terrace beds, along
    the path, in the scrub, on the walls and rocks.
- **Three tiers make spacing hard.** A medium plant's 1.25× box reaches about 190 units up, past
  the terrace behind. So each terrace's slots stand in the gaps of the ones behind:
  - The big beds are few, and most terrace beds are small.
  - The lower terrace has no large slot.
  - Placing slots took several rounds against the "nothing over a raised slot's base" test.

## Looked at
- **Draft B, its map and the review.** The phone crop round (860, 760) showed the temple and the
  terraces, but none of the plantable sea edge. The shoreline was one straight diagonal.
- **`coast-map/map`** (`artifacts/shots/g1-map-1440x900.png`): the slots sit on their ground, both
  suns are in the gap over the sea, the moon arcs left of the temple, and the portrait crop and the
  16:9 band are drawn.
- **The app at `?dev&scenery=coast`**, overview, noon, frozen (`artifacts/shots/g1-*`: 1440×900,
  1920×1080, 390×844).
  - **First round:** the beach and the pools faded into the paper margin.
  - **The phone crop:** it holds the temple, sea, splash rocks, beach, a pool and the terraces'
    left ends.
  - **Desktop:** it shows the whole world.
  - **1920×1080:** it shows y 100–1000. The temple has sky above it; the pine's and the olive's
    crowns come in under the corner controls, as trees, not as the landmark.
- **Paper showing through:**
  - Between the two tall columns under the architrave. Fixed: the skyline leaves the architrave
    out, so the sky runs between the columns.
  - Under the promontory's ragged rim. Fixed: the placeholder strokes the rim.
  - Beside the promontory's pines. Fixed: they are left out of the skyline.

## Left open
- **Rock painter:** the promontory and the temple; the shoreline's shelf, bastion, boulders and
  steps; the splash rocks, shingle and rock shelf. A sliver of paper shows at the promontory's tip.
- **Water painter:** the sea from deep turquoise to the aquamarine shallows, the lap at the
  waterline, the pools, the caique. The placeholder sea bleeds over the horizon in lobes that read
  as far hills.
- **Land and vegetation:** the far hill and the village, the walls and gravel, the beds, the olive,
  the pine, and the promontory's pines and scrub.
- **Daylight:** the plates lit from the left. The architrave and the crowns sit under the sky's
  wash.
- **Motion and the fauna's targets:** perches on the copings, the caique's mast and the chapel;
  heron stands on the splash rocks; a far sea band.
- **The release:** the species and the shared species' new tags. After that, `flora.test.ts`'s
  released invariants must pass before `available` becomes true.
- **Not run** (CPU rule): the full suites, until the final run.
