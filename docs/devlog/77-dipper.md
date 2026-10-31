# 77 · Brown dipper (C1)

## What
The waterfall's signature bird, the **brown dipper** (kawagarasu, カワガラス, *Cinclus pallasii*),
row `dipper` of `WATERFALL_FAUNA` (always unlocked, not announced). Only new files:
- `src/fauna/creatures/dipper.ts`: the art, the behaviour (`Dipper`), pure helpers and the
  default-exported `CreatureDef` (kind `dipper`, role `resident`, rank 3, `show` on the `falls`
  stage, a parts `sheet`).
- `src/fauna/creatures/dipper.test.ts`: where it may go, a 30-minute run at the waterfall, night,
  determinism, reduced motion, the studio stage.

## How it is painted
Side view facing right, `DIPPER_SIZE` 23 world units from bill to tail tip at perspective 1 (a
little longer than the wagtail, about twice its bulk).
- **Body**: one wren-like silhouette with a big round head, a steep brow, a throat notch and a
  deep round breast. Wet-in-wet from a warmer sheen on the crown and back (`sumi` + 16 %
  vermilion, mixed 40 % toward `wood`) into chocolate below, then a brown glaze that loses its
  edge toward the back. In one wet layer clipped to it: a deeper belly, a pale sheen on the crown,
  and the folded wing bled into the flank, so the wing has no outline of its own, plus three
  faint feather lines.
- **Tail**: a short square stub (wet-in-wet, dark at the tip), drawn apart so it can cock. It
  rests cocked up and flicks higher with each dip.
- **Legs**: sturdy pale grey-violet. **Eye**: sumi with a speck of paper. **Eyelid**: a separate
  white almond (`lid`) drawn over the eye for 0.11 s.
- **Flight**: three frames, wings up, a pale whirr haze and down (broad petal dabs), cycled at
  about 15 beats a second, with no glides.
- **Under water**: `swim` (wings half open, level) as a `deepCopy` with a cool tint, and `deep`
  (the body's deep copy) for the part below the waterline. **Wake**: two ripple lines at the
  waterline.

## Behaviour
- **Resident**, one, by day: `resident: (n, mode) => n > 0 && !mode.night ? 1 : 0`. At nightfall,
  upkeep calls `leave()` and it flies off down the stream. By day upkeep spawns it again, and it
  flies in from the stream's mouth. A sim that has just started (`w.t < 2`) puts it straight on a
  perch: it is there from the start.
- **Perch** (`w.perches`; rocks 4×, ledges 1×, near ones likelier, `nextPerch`): **bobs** in
  bursts of 1–5 dips 0.42–0.7 s apart, then rests 1.2–3.5 s. A dip is 0.32 s, down fast and up
  slower (`dipCurve`); the legs bend and the tail flicks. It **blinks** every 1.5–5 s (sometimes a
  double flash) and with 40 % of its dips. Now and then it turns round or peers down. Every
  10–30 s it makes a big move:
  - **dive** (50 %, rocks only): it walks down the rock in three little hops to the water at the
    rock's foot (`diveEntry`: beside or in front of the rock, never behind it, the nearest valid
    point first, 6 units inside the water). It **wades** for 1–3 s, bobbing, then walks on as
    the water rises over its back (`dive`, 1.4 s), and goes **under** for 5–12 s to a point
    24–70 units on (`underExit`: the whole path under the same water, 6 units in). It
    **emerges** and **swims** for 1–2.6 s, floating half sunk like a little duck, then flies to a
    perch;
  - **away** (12 %, and only after it has been around for 90 s): it flies off down the stream
    (`streamMouth`: the stream's far end, pushed just off the view) and is gone 25–70 s;
  - otherwise it **flies** to another perch, low and fast (240 u/s) on a straight line. When the
    line's middle is over water it sags toward the surface; over the cliff it arcs a little.
- **Water**: wading, swimming and the dive's start draw on `entities`, clipped above the
  waterline, with the `deep` copy below it on `underwater` and the wake on top. Under water it is
  only on `underwater` (inside `w.water.clip`, so never on land). Ripples go out on entry, on
  emerging, every 0.5–1.1 s while wading or swimming, and as small air beads under water. The
  water it may use is `w.pond.world` (the still pool, foam carved out) plus `w.water.moving`, so
  it never wades or dives in the foam.
- **Sizes**: on a perch, `w.perspective(perch.depth, perch.x)` (the cliff's 0.64–0.72 on
  ledges). In the water, the perspective at its point. In flight, a blend from the start's scale
  to the end's. Depth: the perch's depth, or `max(rock depth, y)` while it is in the water beside
  its rock.
- **Reduced motion**: everything runs at `w.speed` (0.6): dips, gaps, walks, flight and time
  under.
- **Randomness**: only `w.rng`. **Unlike the wagtail**: round, short-tailed, all dark brown, it
  bobs its whole body instead of pumping a long tail, and it is the only bird that goes into the
  water.

## Looked at
Probe shots in the session scratchpad. Copies of the ones that mattered are in `artifacts/shots/`:
- r1 parts: a pale milky taupe egg with a dark lower half, a wing like a glued-on leaf and a
  fish-like petal tail → darker chocolate (vermilion in the sumi, plus a glaze), no hard belly
  blob, a wing bled into the flank.
- r2–r3 (`dipper-r3-parts.png`): the egg had no head, and the blade tail read as an arrowhead →
  a silhouette with a brow, a nape and a throat notch, and a square wet-in-wet stub tail.
- r4 (`dipper-r4-alive-timeline.png`, `fauna-dipper/alive` at t 10…34): it went away down the
  stream in the first 20 s and the studio showed an empty stage → no going away in its first
  90 s. In the garden (`dipper-r4-states-wf.png`: perch, wade, under, swim, fly at the waterfall),
  it read as a small dark round bird on the wet rocks, the under-water copy as a dark shape
  swimming, and the swim as a little duck on the stream. But it was too small beside the
  boulders (20 units) → 23, and it waded far from its rock → entry points nearest first.
- r5 close view (`dipper-r5-close.png`, zoom 3): the tail drooped (wrong rotation sign) and it
  floated a hair above the rock's painted top. Thin legs showed while it waded → the tail cocked
  up, feet a little into the dome of a rock, wading sunk deeper, no legs once wet.
- r6 (`dipper-r6-close-sunset-phone.png`, `dipper-r6-sunset.png`, `dipper-r6-phone.png`):
  close wade, sunset perch and swim, phone 390×844. At sunset it takes the warm light and stays
  the darkest small thing on the rock. On the phone it is small but still reads as a dark stub on
  the outflow rock. Studio (`dipper-r5-parts.png`, `dipper-r5-falls-alive.png`): parts, the
  falls stage with the whole table, and the alive stage.

What reads well: at garden size, a small dark round bird with a cocked tail on a pale wet rock.
Its going under and coming up further on reads, and the floating swim is the most "dipper"
moment.

## Bench
`sprout.fauna.bench(300)` at the waterfall, 1440×900, DPR 2, headless Chromium, 25 plants, the
whole roster spawned (12 creatures: striders, 2 dippers, leaf, butterflies, dragonfly, bees,
wagtail, heron), art settled, one untimed `bench(60)` first: **update 0.005–0.007 ms + draw
0.24–0.25 ms = 0.24–0.26 ms a frame**, under the 1.5 ms budget. The machine was busy (load
about 16).

## Rows for the orchestrator
fauna.md › Creatures and behaviour:

| Kind (unlock id) | Behaviour |
|---|---|
| `dipper` (waterfall: dipper) | resident ×1 by day (`resident` 0 at night: it flies off down the stream, back by day; on its perch from the start). Bobs in bursts of dips (legs bend, tail flicks), blinks a white eyelid; every 10–30 s it dives (walks down its rock to the water's edge, wades, sinks, 5–12 s under to 24–70 units on, emerges, floats, flies off), flies low and straight to another perch (rocks 4×, ledges 1×), or (rarely, after 90 s) goes away down the stream for 25–70 s. Only in `w.pond.world` and `w.water.moving`, never in the foam. |

fauna.md › Layers: `dipper` on a perch or in the water → `entities` (depth: the perch's, or
`max(rock depth, y)` in the water; clipped above the waterline), the part below the waterline and
the whole bird when under → `underwater`, in flight → `air`.

TESTING matrix:

| C1.1 | The brown dipper: on a perch from the start, one resident by day, gone at night and back by day; bobs and blinks; dives only from rocks, into the water at the rock's foot, under the water the whole way, never in the foam, comes up 24–70 units on; prefers rocks to ledges; deterministic; still dives in reduced motion | fauna/creatures/dipper (all) | fauna-waterfall › every creature on the roster can be spawned…; › a busy pool renders cleanly and stays cheap (roster-driven) | ✔ |

## Left open
- **Flight frames** are the weakest art: at 15 Hz the up/haze/down cycle is a flicker, and the
  petal wings have pooled outlines. They are small and fast on screen, but a close view of a
  flight would show it.
- **Wading** shows no legs: it reads as floating on the surface rather than standing in
  shallows. A real dipper wades with its legs in clear water. A refracted leg pair on
  `underwater` would sell it.
- The **perch line on rocks** sits a hair above the painted top on some boulders. I added a small
  local offset (`standY`) instead of changing `perchesOf` (shared with the wagtail, which floats
  the same way).
- Under water it moves on a straight eased line with a wobble. It does not walk along the bottom
  against the current or turn round under.
- No song or call (the sound task).
- The `fauna-dipper/alive` stage is the shared falls stage at 380×240, where the rocks are small
  for the bird. It shows the behaviour, but the scale is only right in the garden.
- No e2e of its own: the waterfall spec picks it up from the roster (spawn, in bounds, cost).
