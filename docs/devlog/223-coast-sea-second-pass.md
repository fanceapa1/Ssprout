# 223 · GS2: The coast's sea, second pass

## Why
GS1 (devlog 213) made the sea move. From the owner's seat (1470 × 750, DPR 2, overview) it still
read weak: the swell was thin pale scratches, the shore break was barely there, crests only dimmed
by the caique, the rocks' rings did not answer a crest, and the sunset glints were pale gold.
Looked at first in motion (frame strips at the overview, on the beach, a splash rock and the
caique, at noon, sunrise, sunset and night), then built. docs/systems/scenery.md › Coast › Motion.

## What
- **The swell slows over the shelf** (`swell.ts`): a crest's speed is
  `(2 + 0.011 · g) · shoaling(d)`, `shoaling` falling from 1 at depth 175 (the turquoise's edge) to
  0.68 at the beach, so crests stop spreading apart and bunch to about 45 units before they break
  (64 before). `crestDepth`/`travel` read a table of the integrated speed. Crest life 104 s.
- **Swell bands with body** (`motion.ts`): each piece is a broad soft band (200 × 40 units): a
  lighter, greener back behind the crest line and a darker teal trough ahead of it, granulated,
  uneven along its length, feathered. Drawn as wide as half the gap to the next crest (tens of
  units by the beach, a few far out), swelling and fading slowly along its length. About a third
  of the pieces of strong crests carry a thin broken highlight on the crest (by day, at the low
  suns, faint at night); at night the bands are 45 % quieter. A piece follows its line of equal
  depth up to 0.32–0.62 rad of slope, so the bands wrap a little way round the headland's point.
- **Crests part round the hull and the splash rocks**: each wet rock and the hull is an obstacle
  at the depth of the grid line through its foot. Once a crest has passed one, the stretch behind
  it lags (0.6–2.6 s by its width) and thins in its lee, healing as it runs on: the crest parts and
  closes. Only that stretch is drawn in short spans cut from the band's matching slice. The rocks'
  foam and rings and the hull's ring use the same depth, so a ring starts as the band reaches the
  foot (tested: under 0.3 s). The caique's heave reads `bandDepth` (the crest line's depth through
  it: the lines wander ±6 %), so it lifts as the band passes it (`contourWander` in `sea.ts`, the
  contour's own wander, pulled out without changing its output).
- **The shore break reads**: each reach takes a crest at its place on the peel plus its own
  ±0.45 s, so the lip arrives in sections. The lip is thicker over a darker face; it pitches into
  white water (`bore`) riding the front of a thin aqua-pale sheet that now covers the shingle from
  the waterline to its edge; the run is 9–24 units (from 7–20; `SWASH_MAX` 26) and still 12 units
  short of every beach slot; its lace is left at the turn and breaks up there over 3.2 s (`left`)
  while a thinner lace follows the sheet down; the wet band dries as before.
- **Low-sun glints**: their own sprite, a white core in a pale gold flare over a warm shade. Under
  the light plate's multiply (which can only darken) the core stays as bright as the plate allows
  and the flare is the warmest mark on the water; smaller near the beach so they do not read as
  coins.
- Catspaws 34 → 16 (the bands carry the swell now); `inRock` tests each rock's outline bounds (a
  tall rock's top was missed: a glint could land on it).
- Studio `coast-motion`: `crest-parting`, `rock-rings`; labels of `swell`, `shore-break`,
  `glints-sunset` and the sprite sheet updated.

## Cost
`sprout.frameStats().workAvg` (ms of main-thread work a frame), production build, overview, noon,
5 s a run, three runs, Chrome for Testing on ANGLE Metal (Apple M3), other agents running. The
before and after builds ran back to back in one browser session, so the load is the same:

| | before (GS1) | after | reduced motion (no motion) |
|---|---|---|---|
| desktop 1470 × 750, DPR 2 | 1.48, 1.57, 1.70 | 1.69, 1.89, 1.84 | 0.53, 0.53, 0.49 |
| phone 390 × 844, DPR 3 | 1.07, 1.06, 1.00 | 1.33, 1.28, 1.31 | — |

The motion is about 1.05 ms a frame before and 1.28 ms after on the desktop (+0.23), about
+0.26 ms on the phone, under the 1.5 ms bar. A first try at bands spanning 0.72 of the gap
with long overlaps, parting round every wet rock, cost +0.55: the bands' fill area (190 k → 355 k
units² a frame) and the extra blits were most of it. Now: about 176 blits a frame on average at
noon (140 before), at most 300 (tested), the bands' area about 190 k units², the JavaScript about
the same as before (0.22 ms a frame in Node with a recording context). The area cap in the test
went from 400 k to 560 k units².

## Looked at
Overview at 1470 × 750 and 1440 × 900, noon, sunrise, sunset and night; the phone at noon; strips
0.5 s apart at the overview, 0.25 s on the beach, 1–1.5 s on a splash rock and round the caique;
the damselfish shoal and the crab under the bands; reduced motion (the still painting, complete).
Copies: `gs2-*` in the session scratchpad.

## Tests
- `swell.test.ts`: the run in is continuous; crests slow over the shelf and bunch (new).
- `motion.test.ts`: bands inside `MOTION_BOUNDS` and the new sprites painted; a crest parts round
  the hull and each splash rock and heals; each wet rock rings as the band reaches its foot; the
  shore break comes in by sections, never past its line, 20 units short of every pool and short of
  every beach slot (new); the area measure reads a sliced blit's destination.
- `npm run typecheck` clean; unit suite (2 workers) 284 files, 3036 tests passed.
- e2e on the production build, one file at a time, one worker: sceneries 9, ambience 6, scene 5,
  lazy-painters 1, fauna 6, studio 38: all passed. No full e2e run.

## Left open
- At the overview the bands are calm and soft; a crest's highlight is faint at 0.9 px a unit.
- The parting shows best close; at the overview it is a soft dip of a few pixels. The wake is a
  lag, not a true diffraction: no crossing crests behind a rock.
- The shore break's sheet is one colour over the whole beach; no backwash streaks in the shingle.
- Dolphins and the octopus were not caught in a frame; the fish and the crab were.
- The ledge faces of the bastion still have no foam of their own (as GS1 left them).
