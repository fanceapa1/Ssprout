# 175: The coast's rock (G2)

## What
- The rock painter for the Greek coast replaces the placeholder's far hill, promontory and temple,
  and its shelf, splash rocks, shoreline lip and boulders. The full description is in
  docs/systems/scenery.md › Coast › Rock.
- Files: `paint-rocks.ts` (the promontory and the shore's rock), `temple.ts`, `village.ts` (the far
  hill, the headlands and the village), `rock-kit.ts` (palette and helpers), `shapes.ts` (data:
  `SPLASH_ROCK_SHAPES`, `SHORE_BOULDER_SHAPES`, `VILLAGE_CUBES`), `rock.studio.ts` (studio
  `coast-rock`, 153: promontory, point, temple, village, shore, the rock alone) and `rock.test.ts`.
- **The hook** (`painters.ts`, `index.ts`), kept together:
  - `COAST_ELEMENTS.rock` is now `['village', 'promontory', 'promontory-green', 'temple']`, and a new
    element `stones: ['shore-rocks']` sits between `land` and `trees`.
  - `painters.ts` imports the three new modules and maps `far-hill`, `village`, `promontory`,
    `promontory-green`, `temple` and `shore-rocks`. My steps take `rock-*` rng labels.
- **`paint-placeholder.ts`**: `paintFarHill`, `paintPromontory` and `paintTemple` are gone. The
  promontory's pines and scrub moved into `paintPromontoryGreen` (the `promontory-green` step) for the
  vegetation painter. `paintShore` no longer paints the shelf or the splash rocks, and `paintLand` no
  longer paints the grey lip or the boulders. The water and land painters rebase onto this.
- No contract change, no schema change, no ADR. `src/main.ts` is unchanged.

## Decisions
- **The village is its own step in the rock element**, after the sea. The far hill is soft (draft
  resolution), which blurs the cubes at a close view. The placeholder sea's lobes also tint
  everything before it.
- **The shore's rock is one step after the land** (`stones`). Its faces hang over the water, its lips
  and blocks over the land's edge. It also cuts the pools out of the shelf, so the water painter's
  pools stay as they are.
- **The splash rocks are low ledges**, not domes. Each has a flat top foreshortened behind a front
  edge 2 below its slot, so the plant stands on the top. Most have a broken block on the back.
- **Form fixed by name**, brushwork by the art seed, as the oasis bluff (devlog 131). This covers
  `PROMONTORY_FORM`, the column shapes, the rock shapes and the village's cubes.
- **The headlands** stand where the horizon shows but the suns do not: over the hill's left end and
  behind the temple's point, under the sky's wash. The gap x 516–636 stays open sea.

## Looked at
- **Studio `coast-rock`** in three rounds (`artifacts/shots/r1–r3`).
  - **First round:**
    - The splash rocks read as haystack domes, and the blocks as stacked crates.
    - The pools' rims looked like coins.
    - The drum joints carried arrowhead chips, and the fallen drum read as a barrel with hoops.
  - **Second round:** the promontory read as a wall of brick courses, with even bed dashes and
    floating trapezoid panels.
  - **Third round:** the shade planes run from the rim down, jog at the ledges and darken into the
    fissures, and the beds are short and faint.
- **The app at `?dev&scenery=coast`**, noon, frozen: 1440×900, 390×844, a close view of the temple
  and one of the village (zoom 3), then sunset and night. Copies are in the session's scratchpad
  (`g2-desktop`, `g2-phone`, `g2-temple-close`, `g2-village-close`, `g2-sunset`).
  - **The promontory** reads as a pale cliff in blocks, with a sea-cut foot. The point meets the sea
    with no paper.
  - **The temple** holds up at the close view: fluted shafts, drums, capitals, the architrave and the
    krepis.
  - **The village** reads as white cubes stepping up the slope under one blue dome.
  - **At sunset and night** there are no hard rectangles and no glowing paper.

## Cost
- **How it was measured:** a scratch Playwright probe drove `paintSceneSync` in Chromium at DPR 1,
  over the overview at scale 0.9 with only the far, rock and stones elements. Four runs were made;
  the best is given.
- **Per step:** far hill 20 ms, village 7, promontory 91, temple 20, shore rocks 153. That is about
  0.29 s against the 0.7 s budget.
- **Longest part:** 6.4 ms.
- The placeholder `promontory-green` takes 265 ms in a single part. It is the vegetation painter's
  to replace.

## Left open
- **The promontory** still reads a little flat and regular at the overview: even beige, with ledges
  as short dashes. The notch runs along the diagonal foot as stacked strips in the close view.
- **The splash rocks** read as flat slabs at the overview, light on volume. The shoreline's faces
  and blocks look like stacked trays.
- **The village's cubes** keep a faint outline in the close view. The far hill is flat haze.
- **Not mine, seen:**
  - The sky's skyline reaches 2 units into each column's sides, which leaves a pale band.
  - The sky's wet edge frames the broken tops and the architrave.
  - The placeholder sea's lobes cover the village's lower rows and stand behind the temple as
    blue hills.
- **Not run:** the full e2e suite (the machine rule). The spec files run are listed in the report.
