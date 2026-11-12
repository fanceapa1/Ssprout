# 176: The coast's water (G3)

## What
- The coast's sea, beach, rock pools and caique are painted for real, replacing the draft's
  steps. Files: `src/scenery/coast/sea.ts` (shapes, eager data), `paint-water.ts` (sea, beach,
  pools), `boat.ts` (the caique), `water.studio.ts` (studio `coast-water`, 153), `water.test.ts`.
- **Sea**: glassy aquamarine by the beach, turquoise past the shallows' edge, ultramarine-teal far
  out. The colour follows depth lines measured from the shore, not straight bands (ADR 0366). On
  top: seagrass and rock under the water, sandy windows behind the shallows' plants, the far hill
  and the village mirrored, the pale cliff mirrored with a dark line at its foot, a bright horizon,
  wind lanes, a few ripples and sparkles.
- **Beach**: wet sand graded to pale dry shingle, spatter in drifts, larger pebbles lit from the
  left, a wrack line with shells; at the water a thin aquamarine film, broken wet sand and lacy
  scalloped foam.
- **Pools**: clear aquamarine with a dark wet edge, the bottom, a darker middle, the far rim's
  shade and pale reflection, a glint.
- **Caique**: a white double-ended hull with a blue sheer strake and a red band at the waterline,
  the far gunwale's inside, a short mast with the sail furled on its yard, a mooring line to a red
  buoy, and a broken reflection.
- **Shared hook** (kept to adjacent lines): `index.ts` gains `beach: ['beach', 'pools'],` after
  `shore`. `painters.ts` drops `paintCaique` and `paintSea` from the placeholder import, imports
  them from `./boat` and `./paint-water` with `paintBeach` and `paintPools`, and gains the
  `beach:` and `pools:` lines after `shore:`. `coast.test.ts`'s step list gained the two names.
  `paint-placeholder.ts` is untouched (its `paintSea` and `paintCaique` are now unused).

## Decisions
- **Depth from the shore, beach and pools after the shore** (ADR 0366).
- **The generic water surface stays on** (`pondSurface` left out). Its shimmer, rings and
  glints are mild on the turquoise and keep the sea alive until the coast's motion lands. The
  motion task sets `pondSurface` when it replaces them (ADR 0302).
- **The caique's shapes are data** (`CAIQUE_SHAPES`, `CAIQUE_BOX`), so the motion task can paint
  the same boat into a sprite and rock it, and skip the `caique` step.

## Cost
Dev server, 1440×900 at DPR 1, overview, `sceneStats().timings` (probe in the app):
- sea: 174 ms in 446 parts, longest 12 ms;
- caique: 11 ms in 190 parts;
- beach: 61 ms in 171 parts, longest 6 ms;
- pools: 19 ms in 289 parts.

That is about 265 ms in all, under the 0.8 s budget. The four depth lines cost about 15–20 ms once (Node, cold), in the sea step's first part; each column's scan skips ahead by the distance still to go.

## Looked at
- **Studio** `coast-water`: the sea, the cove, the shoreline, the beach, a pool and the caique,
  rounds r1 to r2.
- **The app** at `?dev&scenery=coast`, noon, frozen: the desktop and phone overviews, a close view
  of the shoreline (zoom 3.2) and of the boat (zoom 5), rounds r3 to r6. Sunset and night were
  checked once: nothing breaks.
- **Fixed on the way**:
  - The deep's ragged fade left a pale "mountain range" in the turquoise. Fixed with smoother
    depth lines, a long-period wobble and no upward fade on the turquoise.
  - The waterline read as parallel rails. The foam now lies in scallops and the wet sand is broken.
  - The boat's reflection read as evenly spaced bars. It is now broken pieces over a soft mirror.
  - A brown rail along the waterline came from the placeholder shore's lap stroke. Fixed: the
    beach's reserve starts above it.

## Left open
- **For the rock task.** Its shelf is painted before the beach. The beach's paper stops at its
  back (`BEACH`), and only the sand's wash runs 8 units over the shelf's top edge. Its pool rims
  are painted before the pool water, which stays inside them. A rim that must lie over the water
  needs a step after `pools`.
- **Weak spots**:
  - the far hill's reflection is faint;
  - the horizon's haze is subtle;
  - the shingle still reads a little evenly spread at the overview;
  - the shallows' edge is one soft wavy line, with no sandbar detail.
- **For the motion task (G6).** It should read:
  - `FOAM_LINE` (laps), `shallowsEdge()` (where swell lines break),
  - `CAIQUE_SHAPES` and `CAIQUE_BOX` (rocking),
  - `CLIFF_FOOT` (the wash against the cliff),
  - `SEA_RECT`;

  and it should set `pondSurface`.
- **Not run** (CPU rule): the full e2e suite. Run: `sceneries`, `gardens`, `lazy-painters`,
  `paint-cache` and `prepaint`, one at a time.
