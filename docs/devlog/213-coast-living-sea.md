# 213 · GS1: The coast's living sea

## What
The owner saw the coast's sea as a still turquoise sheet with a few faint dashes. The sea now moves
on one swell, and the motion reads at the overview (docs/systems/scenery.md › Coast › Motion;
ADRs 0282, 0374, 0362).
- `src/scenery/coast/swell.ts` (new, eager, pure in `t`): the crest schedule every moving part
  reads. Crest `n` breaks at `n · 10.6 s` ± 1.6 s (seeded) with a seeded strength in sets of about
  seven. It is born at the horizon and runs in, slow and close far out, about 6 units a second at
  the beach, some 100 s horizon to break; the break peels left to right over 2.6 s.
  `swellAt(depth, x, t)` is the water's height anywhere. `swashLimit(x)` keeps the run up the
  shingle 12 units short of every beach slot.
- **Crests**: each crest is broken pieces of a band sprite (a soft lit back over a darker face),
  laid along a line of equal depth (`shoreContour` at 54 depths, one per `prepare` part), so it
  bends round the coves and the headland. Thinner and fainter far out, fading in under the horizon
  and out at the break; a piece where its line climbs steeply fades (it read as a rain streak).
- **The shore break**: per reach, the next crest forms a broken white lip 13 units out and comes
  in; it runs up the shingle as the leading edge of a sheet of water (7–20 units, ease out, 2.2 s),
  rests, slides back over 3.8 s; the darker wet band left at the top dries over 6.5 s. The sheet
  sprite reaches back up over the waterline, so drawn a run's length down it covers the sand from
  the waterline to its edge. The pine's trunk is cut out of the clip.
- **Caustics**: a tiled net of light lines (cell edges on a torus, 128 px) filled twice as a
  foreshortened pattern over the pale shallows, sliding apart and breathing; by day only.
- **Glints**: 128 twinkle slots choose per pass the low-sun road, the moon's road or the noon
  scatter by the daylight weights; a road under `sunDisc`/`moonDisc`, dense at the horizon and
  widening toward the beach. Single sparks and small clusters, each over a teal shade.
- **Stone**: rock foam rises and swells with the swell at each rock's depth, each crest leaves a
  ring spreading round the foot; the ledge's lips and the cliff's foot lap with the crests.
- **Caique**: `caiquePose` heaves with the swell at its depth (0.65 units, a little pitch as the
  bow meets the crest first); the hull ring comes with strong crests. `CAIQUE_SWING.dy` 1.15 → 1.25.
- **Catspaws**: the old drifting dashes cut to 34 lights and 8 troughs (from 80 and 22); the old
  drifting glints are gone.
- **Contract** (ADR 0362, docs/ARCHITECTURE.md): `SceneryMotion.draw(ctx, t, light?)`; one line in
  `src/scene/system.ts` passes the scene's `DaylightState`. Other sceneries ignore it.
- Studio `coast-motion`: `swell`, `swell-frames`, `shore-break`, `shore-break-frames`, `caustics`,
  `glints-sunset`, `glints-night`, `glints-noon`; the sprite sheet shows the new sprites.

## How to look at it
`sprout.advance` moves the dev clock, not the motion's `t`, and `shots` freezes after `--eval`. To
render frames at chosen times in the app: `await sprout.freeze()`, replace
`window.requestAnimationFrame` with a queue, `sprout.unfreeze()`, then call the queued callbacks
with timestamps 50 ms apart (the renderer clamps a step to 0.1 s) and screenshot between pumps.
The script was `artifacts/gs1/look.ts` (gitignored): `strip`, `multi` (several views in one
browser) and `bench`.

## Cost
`bench`: `sprout.frameStats()` (main-thread work a frame, average ms), production build, overview,
noon, 5 s a run, three runs each, Chrome for Testing with Metal (Apple M3), two other agents running.

| | before (G6) | after | after, reduced motion (no motion) |
|---|---|---|---|
| desktop 1440 × 900, DPR 2 | 1.25, 1.48, 1.31 | 1.02, 1.21, 1.27 | 0.81, 0.79, 0.70 |
| phone 390 × 844, DPR 3 | 0.43, 0.46, 0.86 | 0.55, 0.56, 1.10 | 0.36, 0.54, 0.54 |

The noise between runs is as large as the change: the new motion costs about what G6's did, some
0.3–0.5 ms a frame at the overview on top of the still scene. The docs give no number for a
scenery motion's frame budget, so the bar was the whole coast motion under 1.5 ms a frame on this
machine; the whole frame stays under 1.3 ms. Unit test: at most 300 blits (crest pieces are most),
2 pattern fills and 7 clips a frame. `prepare` adds 54 depth lines (≤ 3 ms each) and about 30
sprites; the longest part is still the sea plate's.

## Looked at
`artifacts/gs1/r1`–`r7` (gitignored): overview strips 0.4–0.5 s apart (noon), the beach at zoom
2.2, the shallows at 3, a splash rock at 3.5, the overview at sunrise, sunset and night, the phone
at noon and sunset. Fixed on the way:
- The first crests were thin dashes; the band sprite is now a long soft lit back over a wide face.
- Crests climbing round the headland read as diagonal rain streaks: they fade with their slope.
- The run-up was a thin sheet moving down the sand with a gap behind it; the sheet now reaches back.
- The shore break ran over the pine's trunk.
- Sunset glints were tiny ticks lost on the bright road: larger, clusters, a teal shade under each.
- The caustics showed at night: they follow the sun now.

## Tests
- `swell.test.ts` (6, new): crest order and spacing, `latest`, the run in, the peel, the height's
  continuity and peaks, no run up to a beach slot.
- `motion.test.ts` (14): pure in `t` and the light; always crests, catspaws, caustics, foam and
  wavelets; breakers, glints, swirls, rings come and go; marks in their water, the shore wave never
  past its line; glints on the roads; every reach breaks each crest; the caique heaves with the
  swell; 300 blits, 7 clips.

## Left open
- At the overview the run-up is modest (7–20 units is 6–18 px); the lip and the moving crest
  bands carry most of the "alive" read. The lace sprites are G6's, close to the painted foam.
- The sunset glints are pale gold, not bright: the light plate multiplies them as it does the
  water, and the road under the sun is already light. Brighter would need a draw above the light
  plates.
- No overcast: daylight has no such phase and the motion does not see the weather.
- Crest pieces near the boat are only dimmed, not bent round it.
- The ledge faces of the bastion still have no foam of their own.
