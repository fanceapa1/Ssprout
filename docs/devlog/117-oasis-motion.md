# 117: The oasis's water in motion (O6)

Lines for the orchestrator to place:

- Devlog index: `| 117 | [Oasis motion](117-oasis-motion.md) | O6: the oasis's moving water over its still painting: sheens, long teal surges and threads down the seguia's two small falls with a pulsing splash at each foot, a glassy spill over the sluice gate, slow rings from the basin's inlet, and glints and riffles drifting down the oued, livelier at the bars' heads and sparse over the braids; pure in t, clipped to each water, still under reduced motion, skipped off screen | 0282 |`
- TESTING, §1a, after O5.3:
  - `| O6.1 | The oasis's water moves: falls (sheens, surges, threads, splash), the gate's spill, the inlet's rings, the oued's glints and riffles. A pure function of the animation time (held by freeze()), every element always moving, every mark inside its water (oued marks off the bars), rings from the inlet, livelier at the bars' heads, falls gathering speed, nothing under reduced motion, skipped off screen, painted in parts, at most 110 small blits and 7 clips a frame | scenery/oasis/motion (all) | — | ✔ |`
  - `| O6.2 | The oasis's moving water looks like the painted water at noon and night, overview and close, desktop and phone | — | studio oasis-motion/* (renders; looked at) | ✔ |`

## What
- `src/scenery/oasis/motion.ts`: `createOasisMotion`, wired as `OASIS.motion` in `index.ts`. It
  follows the waterfall's falls (devlog 93, ADR 0282): sprites painted once in parts and sealed
  into `ImageBitmap`s, then each frame blits them as a pure function of `t` at `TEMPO` 1.25.
  - **Falls**: five lanes a fall, two marks each, out of phase: lifted lights and long
    greyed-turquoise surges. There are also three threads (bright or teal). The marks fall from
    16 to 44 units/s (`fallDropAt`). At each foot, three pale puffs swell and sink and a turquoise
    pool breathes either side.
  - **Gate**: five glassy lights (a white dash over a teal trough) slip outward over the board and
    off its lip. A small puff pulses where the spill drops.
  - **Basin**: three rings from `INLET`, 11 s each, spreading ever slower to 150 units. They are
    painted at three sizes, so the line keeps its width.
  - **Oued**: 56 drifters (glints and riffle lines) drift down `ouedAt`, faster and larger toward
    the viewer. A pass is skipped more often over the deep braids and less near a bar's head.
    Four riffles stand at each bar's head and part either side.
  - Each element is clipped to its own water: the sheet, the foot and the channel below, the
    gate's cut, spill and channel, `BASIN_WATER`, and the oued with the bars cut out (even-odd).
    `MOTION_BOXES` skip any element the view misses.
- `motion.studio.ts` (section `oasis-motion`): each element animated over the still painting,
  frames 0.4 s apart, and the sprite sheet.
- `motion.test.ts`: 12 tests (O6.1).
- Docs: docs/systems/scenery.md › Oasis › Motion and Tests.

## Why
- **Contrast comes from teal, not white.** The falls and the spill are painted as lifted paper
  and the oued as pale milky water, so white marks on them were invisible (rounds 1 and 2). The
  falls move by their greyed-turquoise surges, and every glint carries a small teal trough under
  it. That is how the painting itself shows its flow marks.
- **Long surges.** Short ones with rounded heads stopped mid-sheet and read as wax drips (round
  2). At 0.85–1.25 of the fall's length their heads are lost in the splash.
- **Per-element culling.** The water is spread over the whole painting, so one bounds box would
  draw everything in any close view.

## Cost
`artifacts/o6/bench.mjs`: the app's `frameStats` (main-thread work a frame, average / p95 ms) at
1440 × 900, DPR 2, Chromium with Metal (`--use-angle=metal`), noon. It is A/B: reduced motion (no
motion is created) against no preference (the motion runs), two passes each, 5 s a view.

| view | without motion | with motion |
|---|---|---|
| overview | 0.59 / 1.0, 0.85 / 1.1 | 1.25 / 1.9, 0.52 / 0.7 |
| close on the falls (zoom 5) | 0.73 / 2.0, 0.56 / 0.9 | 0.98 / 1.6, 0.37 / 0.6 |
| close on the oued (zoom 2.4) | 0.47 / 0.8, 0.35 / 0.5 | 0.43 / 0.6, 0.54 / 0.7 |

The difference is within the noise between passes, so the ≤ 1 ms budget holds. The unit test pins
at most 110 blits and 7 clips a frame. Software raster (the default headless shell on this busy
laptop, load about 15) ran about 34 ms a frame in the oued's close view all told. That number
says nothing about the motion's share, and the A/B was not run there.

## Looked at
All in `artifacts/o6/` (gitignored), 1440 × 900 and 390 × 844 at DPR 2, noon and night: overview,
close on the falls (zoom 5), the oued (2.4), the gate (6) and the inlet (3). Frames were taken
about 0.4 s apart (8 frames 150 ms apart for the noon falls and oued). Montages are `m-r*-*.png`.
- **Round 1** (`r1-*`, `m-r1-fall*.png`, `m-r1-oued.png`): on the falls the white sheens were white
  on white and invisible. The shades were grey with waxy outlines, and the splash a grey cloud on
  the clay. On the oued nothing could be seen moving.
- **Round 2** (`r2-*`, `m-r2-*.png`): the teal surges move down the falls, but their rounded heads
  read as drips. The oued showed only hairline dashes. The gate's glass was white on a white
  spill and too small. The inlet's rings show faintly at the notch.
- **Round 3** (`r3-*`, `m-r3-fall1.png`, `m-r3-gate.png`, `m-r3-night-fall.png`,
  `m-r3-phone-fall.png`): long surges slide down the whole sheet and the frames differ clearly.
  At night the falls stay pale and moonlit, not neon. On the phone the surges still read. The
  gate shows pale glassy patches slipping along the board. The oued was still too faint:
  troughs and lifts were 1–2 units thick, and the noon plate multiplies the lifted white down.
- **Round 4** (`r4-*`): the oued's glints and riffles are thicker (a 2–3 unit lift over a
  2 unit trough) and now read as painted flow marks drifting downstream, about a dozen at a time.
  They are dense on the milky shallows by the big bar and upstream, sparse over the deep left
  braid (`m-r4-oued.png`, `r4-1440x900-noon-oued-0..7.png`). At night they stay readable as
  moonlit dashes over a dark trough (`m-r4-night-oued.png`), and on the phone too
  (`m-r4-phone-night.png`). The overview at noon and night: `r4-1440x900-*-overview-*.png`.
  The nearest riffles, scaled up toward the viewer, are a little heavy.

## Left open
- The scene's generic `waterSurface` (`scene/water.ts`, not O6's path) still draws its shimmer
  bands, occasional rings and glints over the basin, as it does over every scenery's pond. The
  brief wants the basin a still mirror apart from the inlet's rings. Turning that off for the
  oasis needs a small contract change (e.g. an opt-out on the geometry or the scenery).
- The motion ignores the daylight weights (like the waterfall's): the oued's glints are as busy
  at night as at noon, only tinted by the plate.
- The falls' painted threads (O3) are fixed ruled lines that the motion slides over.
- The nearest oued riffles (scaled 1.5× toward the viewer) read a little heavy. A smaller near
  scale for riffles alone would calm them.
- The motion was looked at in app frames taken about 0.4 s apart (freeze, wait, freeze), not at
  exact t. The studio's `*-frames` entries render t, t + 0.4 and t + 0.8 exactly, but they were not
  shot this time because the laptop was loaded.
- Sunrise and sunset were not shot; the plates tint the motion as they tint the painting.
