# 193 · Hermann's tortoise (GK7, phase 15)

## What
The coast's slow walker: Hermann's tortoise (*Testudo hermanni*), kind `tortoise`, the `tortoise` row
from GK0 (10 plants, announced: "A Hermann's tortoise plods out of the scrub.", which is what it
does). One tortoise, now and then two, on one terrace for a whole visit.

- **Module** `src/fauna/creatures/tortoise.ts`, its line in `creatures/sets/creatures-coast.ts`.
  No contract change; `wildlife.ts` is untouched (every place it needed was there).
- **Role:** a drifter by day (gap 300–700 s, stay 700–1300 s, not counted against the visitor cap),
  group 1–1.2, which the scheduler rounds to a pair about one visit in four.
- **Places** (`tortoiseMap`, cached per garden): the `walk-*` spots sampled every ~22 units, the
  level stretches of the path (`path-middle`, `path-lower`), read by name (`levelOf`), and the
  `scrub-*` clumps, each given the level of the walk it joins. 78 places, 255 ways; a home scrub (one with at
  least four places to stand within reach) on every terrace: `scrub-902` and `scrub-shore-1` (top,
  west), `scrub-1500` (top, east), `scrub-822`, `scrub-shore-2`, `scrub-1590` (middle), `scrub-1060`
  (lower). It cannot climb: a way never joins two levels and never crosses a `wall-*` face.
- **Plants:** every place and every way keeps 22 units off the planting slots, the jars and the
  olive's trunk; where it stops (pause, graze) it stands 30 units to the side of any slot in the
  bed just in front (`besideOf`), so a plant there never stands over it. It grazes at the ground
  next to greenery, never in it: the scrub's edge within 56 units, or a flower in the bed in front
  within its radius + 26 to one side (`greeneryAt`), turning to face it first.
- **Behaviour:** comes out of a scrub (fades in drawn in, then the head and legs come out), basks
  70–150 s with neck and legs stretched and the eyes mostly shut, then plods 1.5–3.5 body lengths at
  4.2 units/s (surging with each step) and stands 30–90 s, or grazes 14–32 s; after 300–520 s of
  activity it goes into the nearest scrub on its terrace to doze 180–360 s, then out again; at the
  end of its stay or at nightfall it plods to the nearest scrub and tucks in. In a simulated visit
  about a quarter of the time is plodding. It withdraws into its shell when a moving cat comes within
  70 units or a heron, gull, stork or goat lands within 60–130 (`TORTOISE_THREATS`, read the way the
  Sahara frog reads `FROG_THREATS`), stays in 6–14 s after the last one and peeks out. It gives
  its `spot()` (the cat and the birds keep off it) and keeps off theirs.
- **Toward and away from the viewer: kept side-on.** There is no three-quarter view. Every way climbs
  or drops at most half its run in the picture (the scrub links 0.65), so the walk always moves
  mostly across the picture, and a turn round goes through a painted front view (2.6 s: the side
  view narrows into the front view and opens out the other way). The gait cannot slide: the walk
  phase advances by the distance actually travelled, and a planted foot sweeps back exactly as far
  as the body goes (`footAt`, tested), each foot placed by its angle and length from its joint.
- **Gait:** the diagonal couplets of a real tortoise (near fore with far hind, then the other
  pair, each 6 % apart), feet down 72 % of a cycle, the shell pitching and lifting slightly as each
  pair takes the weight; the speed surges with the steps.
- **Paint** (`paintTortoise`, 12 parts, one `ArtCache` entry): the shell is a pale straw wash under
  a grid of scutes (eleven marginals, four costals, five vertebrals) whose seams fan toward the
  crest; each scute is its own small wet wash (straw-yellow to ochre) with a black-brown blotch
  dropped in wet and a broken growth ring, the pale seams left between them; a cool glaze lost
  toward the light, a warm bounce on the lower marginals, broken ink only where the shell turns
  away. Two shells, lit from the rear and from the head, so the light stays on the world's left
  whichever way it faces. Grey-olive scaly legs with stout claws and yellow scales on the forelegs, a
  wrinkled neck, a blunt head with a pale cheek patch, heavy lid, horny jaw. Drawn at 1.2 × life
  (`TORTOISE_K`).
- **Poses ease** toward each mode's targets (neck out or in, its slope, the head, the legs out or
  splayed, the shell lowered), so there are no cross-fades; each pose is composed once into a small
  canvas and drawn with one `drawImage`, redrawn only when a quantised pose changes.
- **Determinism:** its own fork of `w.rng`; time from the sim; `freeze()` stops it; reduced motion
  slows it through `w.speed` and the scheduler gives one at a time.
- **Studio:** `fauna-tortoise/alive` and `/parts`; `fauna-tortoise-close` (`tortoise.studio.ts`):
  `poses` (standing, plodding, grazing, basking, dozing, peeking, withdrawn, facing left, the front
  view, a turn), `walk` (eight frames), and the real behaviour on close crops (`middle`, `lower`).

## Why
- **"Morning" and "midday" without an hour.** The fauna world knows night only (`FaunaWorld` has no
  hour, and it is a contract), so the tortoise's day is its own: it basks when it comes out (the
  first sun on a visit), and the heat after a long active spell sends it into the shade. With the
  clock's hour in the world it could bask only before ~10:00 and doze 12:00–15:00; that is a
  contract change and was not made.
- **A drifter, not a resident:** the brief's "for a whole visit" and the long stays fit the schedule;
  it does not take a visitor's place from the bees and butterflies.
- **No ADR:** nothing here binds other code.

## Looked at
`artifacts/gk7/`:
1. `tort-r1`: a flat loaf of a shell, blotches like small holes, a graze that put the head below the
   ground.
2. `tort-r2`: a higher dome; the vertebral blotches spilled over the crest like bumps, every scute a
   framed window with an inner frame (two growth rings).
3. `tort-r3`, `tort-r4`: one broken ring, larger soft blotches bleeding wet, seams fanning to the
   crest; reads as a Hermann's shell; the front view's opening went dark.
4. `r5`, `r6` (poses, walk, the close stages): the front view's head read as a smiley (two dots and
   a mouth curve on a pale disc); now a dark blunt head with the eyes at its sides.
5. In the app: `garden-r1` (overview, noon, 25 plants: the dome, head and legs read on the top
   terrace at ~14 px, hence `TORTOISE_K`), `garden-r2` (a pair on the lower terrace), `close-r1`,
   `close-r2` (2.6 × close views, grazing at the middle terrace's west end and beside an ice-plant
   mat; the arrival line "A Hermann's tortoise plods out of the scrub." on the quiet line).

**Bench** (production build, headless Chromium, 1440×900 at DPR 2, the coast at noon with 25
plants; the flushed bench of devlog 189 after the rebase; spawned: 2 butterflies, 3 bees, the heron,
2 gulls, with the resident cat; the 3 swallows were spawned too but had flown through before the
timed runs; `bench(60)` untimed, then `bench(120)` three times, three rounds):
- without the tortoise: **0.57/0.66/0.59, 0.55/0.61/0.61, 0.47/0.49/0.50 ms** a frame;
- with two tortoises: **0.55/0.58/0.61, 0.55/0.57/0.58, 0.52/0.61/0.52 ms**;
- the two tortoises and the cat alone: 0.26–0.29 ms (the cat alone is 0.25, devlog 189): the pair
  costs a few hundredths of a millisecond, inside the run-to-run spread. No jump; well inside the
  1.5 ms budget.
- Before the pose was composed into one canvas (ten `drawImage`s a tortoise a frame), the pair alone
  measured 0.2 ms over the cat with the old, unflushed bench; composed it is one `drawImage`, redrawn
  only when the quantised pose changes.

## Tests
`src/fauna/creatures/tortoise.test.ts`, 16 tests (the map, ways, greenery, plods, coast only; a visit
over six seeds; slowness; the shell and its threats; night; a pair; spot, fork and determinism;
reduced motion; the studio stage; the gait's planted feet; cost).

## Left open
- **No hour:** morning and midday are relative to its visit (above).
- **The scutes are still a little regular** at the close view (four costal panels in a row), and the
  marginals' blotches small marks; at the overview it reads.
- **Legs** are single sprites placed by angle and length (no elbow), grey blocks at the close view.
- **The turn** dissolves through the front view; at the overview it is soft, close it ghosts a
  little at the middle.
- **The scrub links** slope up to 0.65 (`scrub-822` sits above the middle walk's west end), a little
  steeper than the walks.
- **No hibernation** (it is about November to March): the tortoise visits all year.

Status: done.
