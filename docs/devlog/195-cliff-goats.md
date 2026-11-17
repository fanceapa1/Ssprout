# 195 · Island goats on the far cliff (GK6, phase 15)

## What
The coast's goats, kind `goat`, the `goats` row from GK0 (9 plants, announced: "Goats browse on
the ledges of the far cliff."): a band of two or three herded village goats picking their way along
the promontory's ledges, small and far.

- **Module** `src/fauna/creatures/goat.ts`, its line in `creatures/sets/creatures-coast.ts`. No
  contract change.
- **The rock's form moved to `shapes.ts`** (the fissures, the beds, `bedAt`, `fissureAt`, `topAt`,
  `footAt`): the painter imports it, so the goats' places read it by name. The move leaves the
  painting identical: the rock test's pinned hashes passed unchanged on that commit.
- **Their ground** (`GOAT_TRACKS` in `shapes.ts`): the cliff top west of the olive and five hard
  beds, three under the cliff top west of the olive (the lowest running out under the temple to
  the point, above the sea's notch) and two east of it, to the right edge. The rock painter now
  lays a lip along each bed track (pieces 8–26 long, gaps up to 4, the lit edge of varied height)
  with a thin undercut, so every ledge a goat stands on is painted. That changes the painting: the
  rock test's hashes are re-pinned. `wildlife.ts` cuts each track into stretches about 10 long,
  split at the deep fissures (`<track>-<k>`, 92 `ledge` perches, replacing the seven points 45 %
  down the face of devlog 183, one of which stood on the stylobate). A goat's feet go on the bed
  line (−0.2) or 1.5 inside the cliff top's edge.
- **The map** (`goatMap`, cached per garden): the stretches joined by name into six ways, hops
  where two ways come within 6–30 units, two ranges: the west (cliff top and three ledges, three
  hops apart top to bottom) and the east (two ledges). The far pines whose crowns a reared goat
  reaches from the cliff top (`map.pines`).
- **The band:** a black nanny leads, then a kid (70 %) or a tan nanny, and the pied billy with the
  beard and the bell (an ochre dot; silent, the sound bed has the bells). One creature, a drifter
  by day (gap 700–1300 s, first 40–180 s, stay 200–380 s).
- **Behaviour:** in over the cliff top (each goat walks up from behind the edge, clipped above it,
  head first) or from off the right edge along its ledge, one after another; single file at
  0.55 m/s in bursts with pauses, hops between ways, the kid skipping; whoever is nearest a new
  spot heads the file there, and one held up waits up to 3 s, then squeezes past. At a spot each
  goat grazes, looks up, browses high, stands or turns about. 3 moves in 10 go to the point under
  the temple, where the head of the file looks out to sea for 45–90 s; 3 in 10 of the others to a
  far pine, where the head rears into its crown; about one in five is a rest: most of the band lies
  down for 55–110 s. Leaves after its stay or at nightfall, back the way it came; never at night.
- **Range in view first:** the range is chosen among those the view shows (at the overview both),
  so the studio's crops and a zoomed view get a band they show.
- **Layering:** one depth for the band (its lowest goat's feet + 0.5, the ledges at y 327–441):
  behind every terrace slot (the top terrace's at 548 and lower), so a planted tree there draws
  over them, and in front of the cliff-top slot (306), whose plant box no way enters.
- **Art** (`paintGoat`, one sprite per coat and pose, 11 poses: stand, look, graze, browse, rear,
  lie, hop and four walk frames; drawn with one `drawImage` each): the body one wash with a shade
  glaze under and a warm light along the back, a ragged shaggy fringe, the legs broken ink lines
  with small hoof marks, the neck and head the dark accent, backswept horns, the billy's beard.
  Painted at the far measure (`S0` 0.13): about 16–19 units long, 14–17 px at the overview.
- **Dev hook:** `sprout.fauna.spawn('goat', n)` summons a band of `n` (2 or 3), ignoring the
  schedule; `step` and `list` as for the other creatures.
- **Studio:** `fauna-goat/alive`, `/parts`; `fauna-goat-close` (`goat.studio.ts`): `poses` (every
  coat in every still pose), `walk` (the four frames for the nanny and the kid, the hop, and the
  band at the overview's size), `west` and `east` (the behaviour on close crops; a jump in the
  studio's time runs the band forward from the start). `coast-wildlife/goats`: the promontory
  as painted over its form (hard beds, soft beds, fissures) and the ledges.

## Found in the inherited work
The interrupted branch had the refactor, the tracks, the map, the behaviour, the art, tests and
docs. Kept nearly all of it. Changed: the studio sheets drew every sprite at pixel ratio squared
(off the ledge band on a high-density screen); a goat not yet in sight when the band left walked
up and back down (now it goes at once); the close stages showed nothing at a fixed time (the stage
was only run forward on frame 0) and the band often took the range out of the crop; necks were
thick hoods and the hooves round balls; the feet stood 1 unit above the lip's painted line. Removed
`goat.probe.test.ts` (a console probe). Every claim in the docs was checked against the code.

## Why
- **No hour:** as for the tortoise, the fauna world knows night only (a contract), so the midday
  rest is any rest.
- **Ledges painted, not only found:** the face's own hard beds are short broken runs; a band
  walking on them would stand on blank rock. A lip along the bed lines the form already has keeps
  the painting's language.
- **No ADR:** nothing here binds other code.

## Looked at
In the scratchpad (`gk6b/`): `r0-face` (the ledges over the form), `r0-garden` (a goat on the
cliff top at the overview reads as a goat), `r1/r2` close views (the band reared against a pine on
the cliff top; the east ledges on the pale, fading right end), `r3-zw` (a stronger undercut made
the three west ledges ruled lines: reverted, the lip broken instead), `r4/r5` (poses at 2×, the
band under the temple at the overview: a looking billy and two grazing nannies read at 14 px),
`r6` (the close stages), `f-close` (zoom 3 on the middle ledge), `f-paths`.

**Bench** (production build, headless Chromium, 1440×900 at DPR 2, the coast at noon with 25
plants; spawned: 2 butterflies, 3 bees, the heron, 2 gulls, with the resident cat and a visiting
tortoise; `bench(60)` untimed, then `bench(120)` three times, three rounds; the laptop was busy with
another agent, so all numbers are about twice devlog 193's):
- without the goats: **1.198/1.205/1.147, 0.981/1.029/1.012, 1.223/1.128/1.110 ms** a frame;
- with a band of three: **1.178/1.114/1.133, 1.041/1.064/1.056, 1.060/1.134/0.994 ms**;
- the band and the cat alone: 0.24–0.31 ms against the cat alone 0.19 ms: the band costs a few
  hundredths to a tenth of a millisecond, inside the run-to-run spread of the roster.

## Tests
`src/fauna/creatures/goat.test.ts`, 14 tests (the ground, hops and ranges, routes, coast only; the
band's coats; three simulated hours: on its ways, never on the temple, in the olive or on the
terraces, its depth between the cliff-top slot and the terrace slots, every act; nightfall and
night; the summon; leaving early; fork and determinism; reduced motion; the studio stage; one
draw per goat; cheap). `scenery/coast/wildlife.test.ts` (the ledges on their painted lips, on the
face, clear of the olive, the stylobate and the cliff-top tree's box; the west ways a hop apart);
`scenery/coast/rock.test.ts` (hashes re-pinned for the ledges).
After the rebase on `main` (the cyclamen): typecheck clean; the full unit suite, 268 files, 2821
tests, all pass. E2E, one file at a time, one worker: `fauna` 6, `fauna-oasis` 4, `fauna-waterfall`
4, `lazy-creatures` 2, `sceneries` 8, `paint-cache` 3, all pass. The full e2e suite was not run,
and there is no coast fauna e2e spec yet. The arrival line was not caught on screen in the app
(other arrivals held the quiet line during the shots); its text reads as the band behaves.

## Left open
- **The east ledges** stand on the pale lit block at the right end, in the painting's fade to the
  paper: the lips barely show there and the goats read a little pasted on.
- **Three parallel west ledges** are more regular than the face's own beds, though broken now.
- **Poses:** the lying goat's folded legs are short pegs; the reared body is a straight block;
  legs are single ink lines without a knee's thickness. At the overview it reads.
- **No hour:** the midday rest is any rest.
- **A planted tree on the top terrace's west slot** hides most of the west ledges at the overview
  (it layers correctly; the cliff top and the point under the temple stay in view).

Status: done.
