# 93 · The falls in motion (S9)

## What
The rocky waterfall's falls, foam and spray now move (ADR 0282).
- `src/scenery/types.ts`: `Scenery.motion?: () => SceneryMotion` (`prepare()` paints sprites in
  parts, `draw(ctx, t)` blits them in world units as a pure function of `t`).
- `src/scene/system.ts`: creates the motion in `init` unless reduced motion is on, runs `prepare`
  between frames (12 ms budget, like a painting), waits for it in the first `ready()` /
  `whenPainted()`, draws it on `waterSurface` after the water (under the light plate), drops it on
  a scenery switch or dispose.
- `src/scenery/waterfall/falls.ts`: `createFallsMotion`, wired as `WATERFALL.motion` in `index.ts`.
  `paint-water.ts` exports `strip` (no paint change).
- `falls.studio.ts` (section `waterfall-falls-motion`), `falls.test.ts` (8 tests).
- Docs: ADR 0282, docs/ARCHITECTURE.md › Scenery, docs/systems/scenery.md › Waterfall › Motion.

## How it looks
Round 1 drew a full-sheet cover over the painting's streaks, then thin cyan streaks cut flat at
both ends, a second lip and a white band of puffs. Now:
- **No cover.** The still painting's streaks stay as the sheet's structure. The motion goes over it.
- **Surges**: wide (8–15 % of the sheet), pale, greyed shades (`SURGE`: the sheet colour moved
  toward stone, off the cyan), overlapping, two per lane, out of phase.
- **Lifted lights** between them veil the painting's streaks as they pass. **Threads**: eight thin
  bright lines falling a little faster.
- Every mark is a spindle with a long dissolving tail and a short **rounded** head with a
  watercolour edge (a pointed head read as an icicle). It is drawn between its tail's and its
  head's heights on a constant-gravity fall (40 → 120 units/s, 3.9 s lip to foam), so it stretches
  as it speeds up. It grows out of the lip and is swallowed by the foam by length and alpha, never
  cut flat. **No second lip**: the motion draws none, so the doubled hard band is gone.
- Lanes fall at 0.8–1.2× speed, fastest in the middle. Each pass draws its sprite, length, jitter
  and strength from a 96-entry table, and a weak draw skips the pass. A lane repeats after about
  4 minutes, and the lanes' cycles are unrelated.
- **Foam**: five cool blue-grey shades roll round small loops and breathe inside the foam, so it
  has body instead of reading as a white band. Twelve white puffs swell, rise and spread outward,
  then sink.
- **Spray**: three faint wisps (alpha ≤ 0.24) rise 50–90 units off the plunge over 11–16 s and
  drift right. It is a mist, not particles.

## Bench (1440 × 900, DPR 2, close view zoom 2.6 on the falls)
`artifacts/falls/bench.mjs` measures the app's `frameStats` (main-thread work per frame).
`artifacts/falls/micro.mjs` measures the motion alone: a full-screen canvas, the motion drawn K
times per frame, the frame interval recorded.

| | without motion | round 1 | now |
|---|---|---|---|
| frameStats, Metal GPU | 0.58 / 0.96 ms | 0.50 ms | 0.40 ms (overview 0.40): within noise, no measurable cost |
| frameStats, SwiftShader (no GPU) | 15.4 ms (21.9 on a busier rerun) | 56.2 ms (+41) | 35.8 ms (+14 against the rerun) |
| micro, Metal: main thread per draw | — | — | 0.04–0.07 ms |
| micro, Metal: 60 fps holds at | — | — | 96 draws a frame (so GPU < 0.17 ms per draw) |
| micro, SwiftShader: raster per draw | — | — | about 12–14 ms close, < 2 ms overview |
| prepare (sprites) | — | — | 85–136 ms in 516 parts, longest part 2–3.5 ms |

The budget (≤ 1 ms a frame) holds on the GPU path. What made the difference:
- **Sealing sprites into `ImageBitmap`s.** The painter reads its canvases back, so blitting them
  as canvases re-uploaded them every frame: SwiftShader went from 53 to 34 ms with that alone.
- **Dropping the cover and the lip sprite.**
- **Far less mist fill**: 3 smaller wisps instead of 6 huge ones.
- **Off-screen skip** (`MOTION_BOUNDS` against the context's transform).

I tried a low-resolution scratch canvas for the foam and mist. It cost more on Metal (66.7 ms a
frame at 96 draws against 16.7 ms with direct blits), so it was taken out. On software raster the
cost follows the number of blits more than their area: tightening the sprites changed nothing.

## Looked at
All in `artifacts/falls/` (gitignored). Frame sequences 150–250 ms apart:
- Before and round 1: `base-close-0.png`, `base-foot-0.png`, `r1-close-0..3.png`.
- Noon close: `r5-noon-0..3.png`. Montage `m-r5-noon.png`. Frame difference
  `diff-noon-01.png`: motion only on the sheet and the foam, nothing else changes.
- Sunset and night close: `r5-sunset-0..3.png`, `r5-night-0..3.png`, montage `m-r5-sn.png`. The
  light plate tints the motion like the painting: warm at sunset, moonlit blue at night.
- Foot: `r4-foot-0..2.png` and `r6-foot-0..2.png` (after tightening the sprites), montage
  `m-r6-foot.png`.
- Overview: `r4-overview-0..1.png`. Phone 390 × 844: `r4-phone-0..1.png` (overview),
  `r5-phone-0..2.png` (close), `r5-phone-night-0..1.png`, montage `m-r5-phone.png`.
- Studio: `artifacts/shots/falls-studio-t1-1440x900.png` and `falls-studio-t13-1440x900.png`.

Honest look: the sheet now reads as one painting with water sliding down it, not as a white cover
with stripes. The movement is gentle. At overview scale it is subtle, and it is clear from the
close and foot views. The foam churns visibly between frames and the mist is barely there, as
asked. The painting's own fixed streaks still show their flat-cut ends (S7, not touched here).

## Tests
- `src/scenery/waterfall/falls.test.ts` (8): wired as the waterfall's motion; painted in parts;
  pure in `t` (two motions alike, one moment twice alike); held while frozen, moving 0.15 s later;
  always more than 8 marks and 8 foam puffs, wisps over a minute, two passes of a cycle unlike;
  nothing under reduced motion (`still`); nothing when the view misses the falls; the fall gathers
  speed from the lip to the foam.
- `npm run typecheck` passes. `VITEST_WORKERS=1 npx vitest run src/scenery src/render src/ambience
  src/scene`: 37 files, 386 tests pass. `src/paint/paint-version.test.ts` and `src/studio` pass.
- e2e (no spec touched; run because the scene's ready path changed):
  `tests/e2e/sceneries.spec.ts` and `tests/e2e/fauna-waterfall.spec.ts`, 11 passed
  (`E2E_WORKERS=1 E2E_PORT=4382`).

## Status
Done. `src/main.ts` is not touched. The scene hook is about 30 lines in `src/scene/system.ts`.
`index.ts` imports `falls.ts`, so the computed paint version changes once and cached paintings
repaint on the next load.

## Rows for the orchestrator
TESTING matrix:

| S9.1 | The waterfall's falls move: surges, lifted lights and threads falling over the still streaks, a churning foam and a faint mist. A pure function of the animation time (held by `freeze()`), nothing under reduced motion, skipped off screen, painted in parts; noon, sunset, night and phone looked at | scenery/waterfall/falls (all) | — (studio `waterfall-falls-motion/*`, renders; looked at) | ✔ |

Devlog index:

| 93 | [S9: the falls in motion](93-animated-falls.md) | Pale surges and lifted lights fall over the still painting's streaks, the foam churns with cool shades and a faint mist drifts off the plunge; `Scenery.motion?` (ADR 0282) |

ADR index:

| [0282](0282-scenery-motion.md) | A scenery's moving water is an optional motion over its painting | accepted | `Scenery.motion?: () => SceneryMotion` (`prepare()` in parts, `draw(ctx, t)` pure in t); the scene creates it unless reduced motion is on, draws it on `waterSurface` under the light plate; it goes over the painting, never covers it; sprites sealed as ImageBitmaps; one paint version change |

## Left open
- **Software raster (no GPU)** still pays about 14 ms a frame in the close view. On software
  raster the cost follows the number of blits (about 40) more than their area. Fewer, merged marks
  would be the next cut if it ever matters. The overview is cheap.
- **No e2e pixel test** that the falls move and stay still under reduced motion. The unit tests
  cover it at the motion level, and the scene's reduced-motion guard is one condition.
- **The lip** has no motion of its own (a slow glint along it would suit). The painting's fixed
  streaks keep their flat-cut ends (S7).
- **Sound** is not tied to the motion (S15 owns audio).
