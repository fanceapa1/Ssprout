# 177: The coast's land and vegetation (G4)

## What
G4 replaces the coast's draft land and vegetation steps with real painting:
- the terraces' gravel and the beds;
- the dry-stone walls and their stone flights;
- the gravel path and two pithos jars;
- the big olive;
- the leaning Aleppo pine;
- the promontory's pines and maquis;
- phrygana, dry grass and the shoreline scrub.

Files:
- `src/scenery/coast/paint-land.ts` and `paint-veg.ts`: the painters.
- `shapes.ts`: their data, and the perches for the wildlife task.
- `land.studio.ts` (`coast-land`, 156) and `veg.studio.ts` (`coast-veg`, 157): the studio entries.
- `land.test.ts` and `veg.test.ts`: the tests.
- ADR 0367: the scenery olive is the olive species' tree.

The draft's flower mats and lavender humps on the beds are gone. The beds are tilled soil that
waits for the player's plants.

**The hook** (shared with the rock and water tasks), kept to adjacent lines:
- `index.ts`: `trees: ['olive', 'pine']` became `trees: ['maquis', 'olive', 'pine']`.
- `painters.ts`:
  - the placeholder import lost `paintBeds`, `paintLand`, `paintOlive`, `paintPine` and
    `paintWalls`;
  - two imports were added, from `./paint-land` and `./paint-veg`;
  - in `run`, `land`, `walls` and `beds` now call the new painters, and a `maquis` line was added
    before `olive`.
- `coast.test.ts`: the two step-name lists gained `maquis`.

`paint-placeholder.ts` is unchanged. Its land and vegetation functions are now unused; whoever
removes the placeholder last deletes them.

## Decisions
- **The big olive is scenery** (ADR 0367). No slot is there, and `top-1` is the tree slot.
  - The tree is the olive species' own, planned from seed 4 at growth 1 at 1.12× its box, and
    painted with the species' helpers one layer per part. A planted olive at `top-1` and the
    landmark are the same tree.
  - Its limbs are a literal in `shapes.ts`, checked against the plan, so eager data never imports
    the species' painting code.
- **The beds sit along each terrace's front, behind the coping**, under every bed slot. The raked
  gravel walk is behind them, under the wall above. In the planted view the plants stand in a strip
  of soil along the wall's top, as in the owner's photo.
- **A wall's seaward end steps down into the slope** over 60 units (`wallDrop`). Without that, the
  phone crop showed the three walls ending in vertical cuts.
- **Batched layers everywhere marks repeat** (ADR 0343):
  - the joints, stones and stone shades of each wall;
  - the coping's lit top and its shade line;
  - the path's edges, the raking and the grit;
  - all beds' soil, furrows and lips;
  - every clump's lobes and their shade;
  - the pine's needles.
- **Work outside the canvas is skipped** (`inView`). Each wall, bed, flight, jar, phrygana and
  tuft has its own rng, so skipping one changes nothing else. A close view on the pine now paints
  no walls or beds (it spent 280 ms on them before).
- **The land reserves `LAND`.** Anything a rock task paints over the shoreline's edge in the
  `shore` step, before `land`, is covered on the land's side. Shore rocks that should overlap the
  land belong in a step after `land`.

## Cost
Measured with a probe in headless Chromium against the dev server (`paintJob` to the end, its
`timings`), at DPR 1, overview at scale 0.9, warm, machine load about 5. The first column is
before the batching pass, the second after it:

| step | before | after | longest part |
|---|---|---|---|
| land | 184–265 ms | 155 ms | 9.2 ms |
| walls | 279–368 ms | 235 ms | 9.6 ms |
| beds | 206–272 ms | 62 ms | 3.7 ms |
| maquis | 109–145 ms | 96 ms | 6.2 ms |
| olive | 42–52 ms | 37 ms | 7.7 ms |
| pine | 61–73 ms | 48 ms | 5.9 ms |

- In total: about 640 ms warm and 900 ms cold, inside the 1.2 s budget.
- A 1.6× close view on the middle wall spends 380 ms on these steps. The longest part is 9.4 ms.
- The unit tests bound every part to 130 k calls and 400 k pixels. The exception is the olive's
  trunk part: 514 k pixels at 1.6×, because the species dries the trunk's layers over the scaffold
  limbs' box (ADR 0367, devlog 171 › Left open).

## Looked at
The shots are in `artifacts/g4/` (gitignored). The studio entries are `coast-land/{land,wall,steps,scene}`
and `coast-veg/{veg,olive,pine,maquis}`. The app shots are at `?dev&scenery=coast` at noon.
- **Round 1** (studio):
  - the walls were hexagonal cobbles in a thick grey joint net;
  - the beds were lumpy dog-bone stains;
  - the flights read as grey crates (a reserved box with a shade box over it);
  - the pine was sparse star-bursts on a thin stick;
  - the maquis were pale flat puffs;
  - the olive's trunk showed the cliff through it, and a pale box sat on the gravel below its sole.
- **Round 2:**
  - the stones became flat slabs with fine joints, cut from the face's dark wash;
  - the beds became rounded soil strips along the copings;
  - each step became a slab with its own shade;
  - the clumps became clouds of lobes;
  - the pine got denser tufts and darker bark;
  - the olive got paper under its trunk and a clip at its sole.
- **App, empty and planted** (`empty-*`, `planted-1440x900`):
  - in the planted view the ice plants, lavender and capers stand in the soil strips along each
    wall top, as in the owner's photo; it is the view that matters;
  - empty, the beds read as tended strips waiting for plants, a little too even in shape.
- **Phone** (`empty-390x844`): the walls ended in vertical cuts at the shoreline, so the faces now
  step down into the slope at their seaward ends.
- **Close views:**
  - `wallclose` (crack-1): fitted limestone, dark joints, a lit coping, ochre lichen, grass tufts
    and the soil strip above, with the plants reading clearly on it;
  - `pineclose`: the open needle pads over the far hill take the sky's wash, with no white gaps.
- **Sunset and night** (placeholder light): nothing breaks. The gravel warms at sunset and turns
  blue-grey at night.

## Left open
- **The pine** reads more as a Japanese black pine's cloud pads than as an Aleppo pine. An Aleppo
  pine is lighter and more see-through, with long wisps. Its trunk sits in the paper margin's
  fade, so the red of its bark barely shows.
- **The promontory placeholder** (the rock task's) still paints its own pines and scrub, so the
  promontory's back shows two sets of crowns until the rock painter drops its own.
- **The land meets the sea in a hard edge.** That edge is the rock task's lip. Shore rocks meant
  to overlap the land must come after the `land` step, because the land reserves `LAND`.
- **The empty beds** are evenly shaped, rounded strips. They could break up more where they meet
  the gravel.
- **Not tuned:** the walls' seaward ends (a step down, not real collapsed rubble); the path, which
  is quiet on the terraces; the jars, which are simple.
- **The olive's trunk part** is 514 k pixels at 1.6× (see Cost). Batching the species' trunk would
  fix it in both places.
- **E2E**: see the report. The full suite was not run (CPU rule).
