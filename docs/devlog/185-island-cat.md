# 185 · Island cat (GK1, phase 15)

## What
The coast's first own creature: the island cat, kind `cat`, the `island-cat` row from GK0
(always, unannounced). One cat, there from the first visit, by day and at dusk; away at night.

- **Module** `src/fauna/creatures/cat.ts`, its line in `creatures/sets/creatures-coast.ts`. No
  contract change; `wildlife.ts` is untouched (the places it needed were all there).
- **Places** (`catMap`, cached per garden): the `wall` copings (`wall-top-*`, `wall-middle-*`,
  `wall-lower-*`), the terrace walks (`walk-*`) and the path (`path-*`), read by name
  (`terraceOf`). 53 places, 119 ways: strolls along a terrace (and the path's steps), and 22 jumps
  between a coping and the terrace below it. Every stroll keeps 22 units off the planting slots,
  the jars and the olive's trunk; it lies down or sits only 40 units clear (`rest`), so no plant
  spreads over it. The olive's shade is the top walk near the trunk.
- **Behaviour** (about 70 % of its time asleep in a simulated hour):
  - dozes 50–140 s (the first 25–60 s) in a loaf on a coping, or curled on a walk (mostly in the
    olive's shade), breathing, an ear flick every 5–14 s, the wrapped tail's tip every 4–11 s;
  - wakes (eyes open), does the front stretch and the hind-leg reach, sits (slow blinks, the head
    turning up toward a bird or butterfly within 260 units in front of it), washes a paw;
  - dozes again in place, or strolls (28 units/s) to a free coping, the shade or another walk
    within 520 units and at most one jump: crouch, an arc that clears the higher end, landing;
    on arrival it may turn round, sits, then settles;
  - at nightfall it sits up facing the sea for 45–90 s (`dusk`), then strolls off along its
    terrace to the landward edge; in the morning it walks back in. If the morning comes before
    it has gone, it stays (one cat, never two);
  - it never chases or catches anything. It gives its `spot()`, so birds that read `heldSpots`
    keep off its coping.
- **Paint** (`paintCat`, 16 parts per coat, one `ArtCache` entry): a white wash with a cool glaze
  where the body turns under and a warm bounce at the belly, coat patches bled in wet (a cap on
  the head and ears, a saddle, the rump, the whole tail), soft tabby bars, a few broad dry strokes,
  broken edges. Whole-pose sprites for the loaf, the curl (head tucked, tail round the nose), the
  sit and the front stretch; a rig (torso, four legs, raised tail, head) for the walk, crouch,
  leap and hind-leg reach. Heads in three-quarter view with closed eyes (a downward curve) or open
  ones (amber, slit), a pink nose, whiskers only up close. Poses cross-fade over 0.45 s. Drawn at
  1.2 × life (`CAT_K`) so the outline reads at the overview.
- **Coats** from the garden's seed: ginger and white, tabby and white (the near ear tipped, the
  trap-neuter-return mark), black and white.
- **Determinism:** its own fork of `w.rng`; time from the sim. Reduced motion slows it through
  `w.speed` (it still wakes and strolls).
- **Studio:** `fauna-cat/alive` and `/parts` (the coast stage over the middle terraces);
  `fauna-cat-close` (`cat.studio.ts`): `poses`, `walk` (eight frames), `coats`, and the real
  behaviour on close crops: `wall` and `shade`.

## Why
- **A map of its own** rather than raw perches: a cat walks and jumps, it does not fly, so it needs
  to know which places join. The terraces' names say which tier a place is on; a jump joins a
  coping only to the terrace right below it. Routes are short (Dijkstra over 53 nodes, only when
  it decides to move).
- **Dusk without a dusk signal.** The fauna world only knows night. The cat sits facing the sea
  when night falls and leaves later, so "at dusk it sits and watches" happens in the light's last
  phase without a contract change.
- **No ADR:** nothing here binds other code.

## Looked at
`artifacts/gk1/`:
1. `r1`: heads clipped by a wrong sprite box; a grey-lilac body with a sticker-like outline; the
   walk rig short-legged like a sausage dog; the legs swung backwards (the walk moonwalked).
2. `r2`, `r3`: faces read but heads too big (chibi), a frowning brow from the cap patch, a pink
   nose poking out like a tongue; dark fur ticks read as scratches; the stretch's hind legs as a
   high heel.
3. `r4` and `s1` (the whole section): loaf, curl, sit, wash, stretch, reach, crouch, leaps and the
   walk read; the three coats side by side.
4. In the app (production build): `g1`, `g2` (overview, noon, 25 plants; first too small and once
   on a caper in the wall, hence `CAT_K` and `rest`), `c1` (close view at 2.6 ×, a tabby loaf
   dozing on the middle coping, eyes shut, tail round).

**Bench** (production build, headless Chromium, 1440×900, the coast with 25 plants and its whole
roster spawned: the cat, butterflies, bees, swallows, a swallowtail, the heron; 9 creatures):
`bench(120)` ×3 → **0.057–0.064 ms per frame** (update 0.004–0.008, draw 0.05–0.056).

## Tests
`src/fauna/creatures/cat.test.ts`, 14 tests (the map, routes, choices, a long day, nightfall
and morning, coats, spot, fork, determinism, reduced motion, the studio stage, cost).
After the rebase on main (coast moving water): typecheck clean; the full unit suite, 257 files,
2676 tests, all pass. E2E, one file at a time, one worker: `fauna` 6, `fauna-oasis` 4,
`fauna-waterfall` 4, `lazy-creatures` 2, `sceneries` 8, all pass. The full e2e suite was not run,
and there is no coast fauna e2e spec yet.

## Left open
- **The walk rig is stiff:** the legs are single sprites rotated at the hip and shoulder, with no
  knee or hock bend, and the leaps are two fixed leg angles.
- **Strolls toward or away from the viewer** (walk to coping) slide sideways in a side view; they
  are costed higher so routes prefer the copings, but they happen.
- **No turn animation:** facing flips under the cross-fade.
- **The front stretch** reads, but its forelegs are one paddle.
- **The white** is a little grey in the shade; at the overview the cat is about 35 px long.
- **No reaction from other creatures:** the coast's birds do not exist yet; they should read its
  `spot()` (as the bunting reads `heldSpots`).
- **Pose changes are cross-fades,** not in-betweens (curl → stretch dissolves).

Status: done.
