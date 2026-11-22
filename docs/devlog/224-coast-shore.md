# 224 · The coast's real shore (GB2, phase 15)

## What was found
GR2 (devlog 222) left `shore` as the last step still run from G1's draft (`paintShore` in
`paint-placeholder.ts`). Looking closer, the draft shore was not what showed: it ran before the
`beach` step, which lays paper over the whole beach, and before `shore-rocks`, which lays an
opaque shelf round the pools. Painted with and without the step, a 2× crop of the beach differed
by more than 30 levels in 596 of 921,600 pixels (texture noise aside). What the owner sees as the beach and the pools is the water
painter's beach and pool water and the rock painter's shelf, with a hard grey ring round each
pool's perfect ellipse. A real shore painted in that slot would have been invisible too.

## What changed
- **The step moves**: element `shore` now runs after `stones` (`shore-rocks`), before the trees,
  and paints over the beach, the pools' water and the shelf. Three order tests said the opposite
  (written so the real painters would cover the draft); they now say the shore goes on top.
- **`paint-shore.ts`** (new), placement in **`shore-shapes.ts`** (data, fixed seeds):
  - a cool wet band 9–13 units under the waterline (under half the swash's reach, `SWASH_MAX` 26 since GS2), lost up the
    beach. The motion's sheet runs past it and leaves its own drying band, so the two agree: the
    painted band is the sand that never dries, the moving one the last wave's;
  - the sea's sorting: a speckle of fine grains low on the beach, a faint grey cast up its back;
  - the storm berm: 280 cobbles, none in the swash, few and small on the fine sand, packed and
    coarser (half-width up to 5) toward the back; mostly cream, white and pale grey, a few ochre,
    blue-grey, rust and dark; each a cast shade, a body, a shaded underside and a lifted lit top;
    none within 16 of a beach slot's foot. Five larger stones half buried in the berm;
  - the wrack: drifts of dead Posidonia along `WRACK_LINE` (a soft brown mat, leaves lying along
    it), a few stray leaves, and seven felted sea balls (egagropili). The research doc's Posidonia
    entry and the `posidonia` species (dead leaves and sea balls on the sand) back them;
    driftwood is not in the doc, so there is none;
  - five tufts of bleached grass in the sand against the shelf (the vegetation step paints none
    there);
  - each pool as a hollow in the shelf: the shelf's smooth ring and wet rings are covered with
    paper and the shelf's colour, so the cover reads as the shelf; then a hand-cut water edge
    (always inside the old ring), damp patches toward the water, the far inner wall in shade
    with a wet dark foot, a lifted lip and wet line on the near edge, pink-white coralline crusts,
    and in the water the turquoise deepening under the far wall into a dark hollow (the octopus's
    side), floor stones, weed and a sheen of sky. The pools keep their places (`POOLS`, the
    wildlife's outlines, the slots): the hand-cut water holds each pool slot and is 0.56 (the
    small `pool-3`) to 0.67 of the old ellipse.
- **`paint-placeholder.ts` is deleted.** Its other functions were dead since G3/G4; nothing
  imported it but `painters.ts` (checked `src`, studio files, `drafts/`, tests, scripts).
  `drafts/b/paint.ts` keeps its own draft shore as a record.
- Studio `coast-shore` (155): the beach and a pool close up, each painting only the steps round
  the shore (`sea`/`beach`/`stones`/`shore`), cached per seed and size.

## How it looks
Overview at 1470 × 750 with 48 plants: the beach reads as a shingle beach with a pebble berm
under the plants, the pools as hollows in the shelf. Close, the cobbles, the wrack and the pools'
walls and lips read; the crusts and weed in the pools are faint. The pools stand at the top of
the bottom dissolve at 1470 × 750 (devlog 219), so at the overview they are pale; nothing of
weight was put lower. Sunset warms it and night cools it like the rest (the light plates go
over); nothing glows or stays bright. The berm is the busiest band of the foreground: it holds
under plants at the overview, but more cobbles would tip it.

## Paint time
Production build, cold coast, `sceneStats().timings`, DPR 2 (total ms / longest part / parts),
three runs each, the 1-minute load beside each.

TIMES

A throwaway probe in the dev server, flushing after every part so each pays only for its own
work: the shore is 617 parts, 120–129 ms in all, its longest own part 5.7 ms. A first version (one
layer per kind of mark, 14 on the beach, and the shelf's whole wet-in-wet again for the pools'
cover) was 175 ms with a 28 ms part of backlog; shared layers (multiply layers commute, so
cobbles, stones, balls, tufts and wrack share four) and a small wash for the cover brought it
back.

## Pins
- `parts.test.ts`: the shore's recorded-marks pin (`df0b78ed` → `60f0f8e5`).
- No other pin moved: the `beach`, `pools`, `shore-rocks`, rock, land, vegetation, water,
  daylight and motion pins hold (each records its own steps). `sea` is untouched.
- Order assertions edited: `coast.test.ts` (the step list), `rock.test.ts` (`shore-rocks` before
  `shore`), `water.test.ts` (`shore` after `beach`).

## Tests
New `shore.test.ts`: the step's place, cobbles up the beach (coarser and more toward the back,
off the plants' feet), buried stones, sea balls and tufts on the beach, each pool's water inside
the old ring with its cover over it and its slot in it.

## Left open
- The pools' far wall is one even shaded band; a lit facet or two would break it.
- The crusts and weed in the pools hardly read below a close view.
- `shore-rocks`' longest part rose from about 8 to 17 ms in the production build: no change to
  its code; the raster backlog lands elsewhere now that the step order changed (devlog 218).
