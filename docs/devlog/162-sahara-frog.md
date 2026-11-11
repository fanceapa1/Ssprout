# 162 · Sahara frog (OK4, phase 13)

## What
The oasis's frog: the Sahara frog (*Pelophylax saharicus*), kind `sahara-frog`, the
`sahara-frog` row from OK0 (5 plants, announced: "A Sahara frog peers out of the basin."). The
sound bed already listens for `oasis:sahara-frog` (devlog 126): its evening chorus grows once the
frog has been seen.

- **Module** `src/fauna/creatures/sahara-frog.ts`, found by the registry glob. Nothing else changed:
  not `src/scenery/oasis/fauna.ts`, not `wildlife.ts`, not `src/main.ts`.
- **Role:** a resident. One frog by day, a chorus of three after dark (two in reduced motion):
  `resident: (n, mode) => n > 0 ? (mode.night ? 3 : 1) : 0`. At daybreak the sim asks the extra
  two to leave; each finishes its croak, goes under and is gone.
- **`needs`** is `w.pond.world.length >= 3`, nothing more. The sim asks it every frame in every
  garden (devlog 142), so it is kept trivially cheap. Its seat search is cached per world
  (`frogSeats`: a `WeakMap` on `w.perches`, checked against the still water and the stands).
- **Where** (only `w.*` targets, only the basin):
  - **Seats** (`frogSeats`): the 7 level `rim` perches near the water (the near and far coping,
    not the steep side copings), with the frog's feet at the coping's water edge (the far rim's lip,
    the near rim's inner edge); and the heron's 2 stands that lie inside the still water: the
    stair's submerged treads. On a tread it sits half under (`sub` 0.35 and 0.6): the sprite is
    clipped at the waterline, with a faint copy below it.
  - **Float spots** (`floatSpot`): inside `w.pond.world`, 7 units in from its edge, 26 units off
    the stair, clear of the other frogs and held spots by 22. Among the water plants' pads
    (`w.pads` in the basin) 60 % of the time when there are some, and in view first (a phone).
  - **Seat choice** (`chooseSeat`): a free seat in view first, never within 22 + its spread of
    what another creature holds (`spot()`/`perchPoint()`). It gives its own `spot()` while it
    sits or makes for a seat, so the bunting and the dove keep off it.
  - Never the seguia, the sluice or the oued.
- **Behaviour:**
  - **Bask** on the coping or a tread for 45–120 s by day, 15–45 s after dark, breathing, now
    and then turning about on the coping.
  - **Plop**: at the end of a spell, or at once when a bird comes near (`FROG_THREATS`: heron and
    stork 150 units, hoopoe 40, dove 36, bee-eater 32, bunting 28; a bird on the wing counts from
    1.5 times as far), it leaps off into the water beside the seat (`waterBeside`) with a splash
    ring and a smaller one after it.
  - **Under**, 3–9 s: a dim shape gliding under the water to somewhere else (half the time near,
    else anywhere it may float).
  - **Surface** with a ring: the eyes and snout rise out of the water in 0.9 s.
  - **Float** 20–50 s by day, 30–80 s after dark: only the head above the water, a faint ring now
    and then. Then by day it mostly (70 %) paddles to a free seat and climbs out (a little hop with
    a ring where it left the water); after dark mostly (70 %) it stays afloat. Otherwise it
    paddles to a nearby float spot (kicks with wake rings) or dives.
  - **Calls** after dark only, afloat or sitting (the sound bed's `FROG_CURVE` is silent by
    day): bouts of 4–9 croaks 0.2–0.32 s apart, quickening a little (`croaks`), every 3–9 s in the
    first 40 min after nightfall, 9–26 s later on. Both vocal sacs swell with each croak at the
    mouth's corners (the near one full, the far one peeping behind the head; `sacAt` from the
    kajika). A bout makes each other frog answer within 0.4–1.6 s 60 % of the time: a chorus.
- **Paint** (15 units snout to rump sitting, at perspective 1; about 11 on the basin):
  - a water frog in side view, its head raised on straight arms, the back sloping to the rump,
    a pointed snout, a big folded hind leg with dark crossbars and a long foot;
  - green (`#7f9a52`, blotches `#5a6a3a`) or olive-brown, a tone per frog (55 / 45 %), each tone
    its own art key;
  - the back's olive wash runs wet into a pale belly; uneven blotches dropped into a wet layer
    clipped to the body; a pale ridge from the eye along the side and a pale green line down the
    back; a pale upper lip, a dark tympanum, a gold eye with a level pupil;
  - reserved-paper glints on the wet skin, a soft cool shadow on the coping.
  - Parts: sitting, the floating head (eyes, snout and a pale waterline), the body hanging under
    the water (`deepCopy`: blurred and tinted celadon), the leap, a vocal sac, the shadow.
    A frame draws 2–4 of them per frog (sitting: shadow, body, two sacs while calling; afloat:
    the hanging body, the head, two sacs).
- **Determinism:** everything draws on `w.rng.fork('sahara-frog:…')`, then a fork per frog.
- **Reduced motion:** `w.speed` slows its spells, paddling and hops, and two frogs call at night.
- **Studio:**
  - `fauna-sahara-frog/alive` and `/parts` (the def's `show`: three frogs on a crop of the
    oasis's basin, `spec` x 520, y 470, 600 × 230);
  - `fauna-sahara-frog-close` (`sahara-frog.studio.ts`): `poses` (sitting green and olive,
    calling, half under on a step, afloat, afloat calling, the plop, under the water), `basin`
    (the basin's right end and its stair by day) and `chorus` (the basin after dark).
- **E2E:** `fauna-oasis.spec.ts` now checks that the frog is afloat or under only in the basin,
  sits only on its coping or the stair (within 3 units of the water), and never in a channel.

## Why
- **A resident, not a visitor.** It lives in the basin. One by day keeps the day calm and seldom
  seen; three after dark make the chorus the sound bed already plays.
- **The stair through the heron's stands.** The basin's steps are not perches (devlog 127), and
  making them perches of kind `rim` would send the bunting and the dove onto treads inside the
  water (and break their "out of the basin" checks). The stands on the two submerged treads are
  already in `w.stands()`; the frog takes the ones inside the still water, so nothing in the
  contract or in `wildlife.ts` changed. A frog half out of the water on a submerged tread is also
  what the research describes ("half in the basin").
- **Plopping at birds, not at everything.** Only birds that could eat it or land on it, and a
  bird on the wing from farther, so a swallow skimming the basin does not empty it. Since it gives
  its `spot()`, birds seldom land right beside it; the threat comes mostly from a dove or a
  bunting arriving or flying past, and from the heron.
- **No per-croak event for the audio.** The fauna has no hook to the audio (the only event is
  `fauna:arrived`); the sound bed's frogs follow `FROG_CURVE` and whether the frog was seen. The
  frog calls only when the curve is above zero (after dark), so what is seen and heard agree.

## Looked at
`artifacts/ok4/`:
1. `r1-poses`: the sitting frog read as a loaf (body level, head not raised), the ridge and
   stripe dabs stuck out of the back like antennae (a dab's base is its start, not its middle),
   the leg's crossbars hung below the body like spikes, the blotches were round polka dots, the
   floating head was a long slug.
2. `r2-poses`: the head raised on its arms reads as a water frog, but the sprite clipped the top
   of the head and the eye; crossbars too dark (teeth); the sac a grey ball.
   `r3-poses`: box enlarged, bars and sac lighter, the floating head shorter: all read.
3. `r3-basin`, `r3-chorus`, `r4-basin-t8/t30`, `r4-chorus-t8/t30`: on the stage crop the frog
   on the near coping reads as a green frog sitting at the water's edge; afloat it is a small
   olive wedge with two gold eyes. Afloat over the far bank's warm reflection it was too pale:
   the floating head is now darker, its eyes larger (`app-noon`).
4. In the app (25 plants, lilies in the basin):
   - `app-noon-1440x900`: one frog sits on the far coping, two float among the reflections (two
     were spawned by hand on top of the resident);
   - `app-noon-basin-1440x900`: the first try; the zoom point missed the frogs (two afloat, low
     contrast over the reflection: what made the floating head darker);
   - `app-sunset-1440x900`: the day frog on the far coping in the warm light, small at zoom 2.6;
   - `app-night-1440x900`: the chorus of three afloat (x 790–920); at this zoom and in the night
     grade they are dull specks, and the sacs cannot be read;
   - `app-phone-390x844`: the basin in view; the frog (surfacing) is a speck, the buntings read.

   The frogs move while the camera settles (real frames run the sim), so a close shot has to be
   aimed at where they are after `camera.settle()`, not where they were spawned.

**Bench** (production build, headless Chromium, 1440×900 at DPR 2, 25 plants, the whole oasis
roster spawned: striders, bunting pair, leaf, dove, butterflies, frog, bees, swallows, heron; on
a laptop shared with another agent): `bench(120)` ×3 at noon (14 creatures, one frog)
**0.62–1.12 ms**, at 22:00 (16 creatures, three frogs calling) **0.47–0.57 ms** per frame, update
0.01–0.02 ms. That is under the 1.5 ms budget. The spread at noon comes from the shared machine:
the dove measured 0.39–0.46 ms with 13 creatures on a quieter run.

**Tests:** `src/fauna/creatures/sahara-frog.test.ts`, 14 tests. `npx tsc --noEmit` is clean.
`registry.test.ts`, `scenery/oasis/fauna.test.ts` and the rest of `src/fauna`, `src/scenery/oasis`
and `src/audio` pass. Four long waterfall and kajika suites timed out once while a browser probe
ran beside them, and passed when run alone. `tests/e2e/fauna-oasis.spec.ts` (3 tests) passes with
`E2E_PORT=4191`. It caught a hand-spawned frog sitting at (0, 0) until its first update (fixed).

## Left open
- **Afloat at night it is hard to find.** The head is about 9 units long on the basin: in the
  night grade, at the overview and on a phone it is a dull speck. The sacs show only close. A
  slightly larger size (the kajika's 18) or a paler waterline would help.
- **The dry treads** (the stair's top two steps) are not targets, so it never sits fully out on
  the stair. A `step` perch kind (a contract change) or exported tread perches would add them.
- **No reflection** of a frog sitting on the far coping in the mirror basin.
- **No per-croak audio event**; the sound bed's chorus is a time curve.
- **No jump between seats** along the coping, and no frog sitting on a lily pad (the research
  frog floats among the pads; the pads only draw float spots near them).
- The sitting sprite is one pose: no crouch before the plop (the leap starts at once).

Status: done.

## For the orchestrator to place
The devlog index line, the row for docs/systems/fauna.md › Creatures and behaviour, the Layers
line and the TESTING row:

`| 162 | [OK4: Sahara frog](162-sahara-frog.md) | The oasis's water frog, one by day and a chorus of three after dark: basks on the basin's near and far coping and half under on the stair's submerged treads, floats with only its eyes and snout up among the lilies, plops in when a bird comes near or at random and comes up elsewhere with rings, calls after dark in answering bouts with both vocal sacs swelling; green or olive-brown, blotched, pale back ridges and line, gold eyes; 0.47–1.12 ms a frame with the whole roster |`

`` | `sahara-frog` (oasis: sahara-frog) | resident: 1 by day, 3 after dark (2 in reduced motion); `needs` only still water. Seats (`frogSeats`, cached): the level near and far rim perches at the water's edge, and the heron's stands inside the basin (the submerged treads, where it sits half under); float spots (`floatSpot`) inside the basin 7 units in, off the stair, near the lilies' pads, in view first; keeps 22 units off other frogs and held spots, gives its `spot()` while seated. Basks 45–120 s by day (15–45 s at night), floats 20–50 s (30–80 s), then by day mostly paddles to a seat and climbs out, after dark mostly stays afloat; plops in at the end of a spell or when a bird comes near (`FROG_THREATS`), swims under 3–9 s and surfaces elsewhere with a ring. After dark it calls in bouts of 4–9 croaks (both sacs swelling), every 3–9 s in the first 40 min after nightfall, 9–26 s later; the others answer. Side view; green or olive-brown, dark blotches, pale ridges and green back line, gold eye. | ``

`` - `sahara-frog` (oasis) on the coping or a tread → `entities` (depth: the seat's + 0.5; on a tread clipped at the waterline over a faint copy); a plop or a climb → `air`; afloat, surfacing, diving → `waterSurface` (head and sacs) over `underwater` (the hanging body's deep copy); under → `underwater` (a dim gliding shape). ``

`| OK4.1 | The Sahara frog: seats only on the near and far coping at the water's edge and on the basin's submerged treads, floats only in the basin off its edge and the stair, near the pads when there are some, keeps off held seats; one by day, three after dark, the extra ones gone at daybreak; basks, floats, plops, surfaces, paddles and climbs out; calls only after dark, in answering bouts; plops in when a bird lands near; never in the Japanese garden or the waterfall; draws only on its own fork; deterministic; slower in reduced motion; lives on its studio stage; a cheap needs and update | fauna/creatures/sahara-frog (all) | fauna-oasis › every creature on the roster can be spawned…the Sahara frog keeps to it and its coping; › a busy oasis renders cleanly and stays cheap | ✔ |`
