# 220 · Coast creature polish: lizard, dolphins, rock crab (GK13, phase 15)

## What
Three coast creatures merged with weaknesses their reviews wrote down were looked at in the studio
and in the coast (overview and zoom 3, noon and sunset, at the owner's 1470 × 750 window at DPR 2),
then repainted one at a time, a commit each. Only the three creatures' files, their tests and studio
files, `creatures/lib/ground.ts` (the crab's room) and the fauna docs changed.

### Balkan green lizard (`green-lizard.ts`)
- **Seen first:** one flat saturated green fill with a hard pooled outline, black ink toes, a grey
  blob for a shadow: a vector sticker on the dry-stone wall. In the run frames the legs reached on
  the trunk's inner side.
- **Repainted** in washes: a pale yellow-green ground, the grass-green back laid in with lost edges
  (a little paler flank shows), granulating, a shaded lower side, fine black stipple and yellow
  flecks, the tail green at the root going olive-brown to the tip; a darker head with the frontal and
  parietal shields, pale lids round dark eyes, the yellow throat when lifted; short splayed legs as
  single wet strokes (upper limb out, the fore foot turned forward, the hind back) with a small palm
  and five long thin toes, the hind fourth the longest, a dark fleck or two. The greens were softened
  toward the painting's sap and sage after the first look in the garden.
- **Shadow:** the body's own outline and legs, a little down the stone and soft, painted into each
  body frame and the head sprite (further off when the head is lifted): two `drawImage`s a frame
  instead of three.
- **Run frames:** `legReach(bend, side, fore)`: the trunk's convex side reaches (fore leg forward,
  hind back), the concave side gathers, a diagonal pair moves together.
- **Spawn:** a hand `spawn` beside a living lizard is refused, as the owl's (the resident upkeep
  then retries harmlessly until the forced one is gone).
- **Path edge: not added.** No existing place covers it: the path's places (`path-foreground`,
  `path-lower`, `path-middle`) are walking ellipses on the path's middle, shared with the cat, the
  tortoise and the hoopoe, with no crack beside them to flee into; the scenery's places were not
  edited.
- **Reads now:** at the overview a soft green dash on the wall with a shadow under it; close, a
  speckled lizard lying in the wall's light rather than on top of it. Still the brightest green on
  the wall, as the research asks.

### Common dolphins (`dolphin.ts`)
- **Seen first:** at the overview a back was 5–6 css px, a dark fleck between the swell's streaks.
- **Size:** `DOLPHIN_K` 3 (from 1.8): 18–28 units on the track. At 3 a rolling back and its falcate
  fin read as a dolphin at the laptop's overview (about 16 css px for a back and fin) and the close
  view shows the beak, the cape's V and the hourglass; the thrush and the cicada are drawn about
  3.5 × far off. It stays far out: at the bay's foot (twice the caique's distance) at most about two
  fifths of the caique, and its darks take a breath of the bay's haze. Larger was not tried: at 3
  a high roll near the bay's foot is already about a third of the boat's length.
- **Looked at:** the roll's arc (unchanged, the centre rising on a sine, the leader breaking the
  surface at once), the fin (falcate, mid-back), the hourglass in the leap (ochre front, grey rear,
  dark cape) and the splash; a close portrait was added to the studio (`portrait`).
- **The water at the back:** `waterlineSpan(kind, u)` finds where the posed outline is above the
  water; a lip is drawn there on the surfacing line (a faint dark line, pale water heaped at both
  ends), one `drawImage` a surfacing body.
- **The swell:** `swell.ts` moves crest bands over a flat painted sea and heaves only the caique, so
  the straight waterline clip agrees with it; a heave like the caique's would be a third of a pixel
  at the bay's scale. Nothing else changed in the clip.

### Marbled rock crab (`rock-crab.ts`)
- **Seen first:** about 25 px wide at zoom 3; the eyes were black dots and the marbling a texture;
  the left eye sat off its corner (a sign slip in its x); no claw wave.
- **Size:** `ROCK_CRAB_SIZE` 11 (from 8, about 3 × life): the crab with its legs is about a quarter
  of a splash rock's width, under half of the shortest waterline (splash-1, 32 units), with room for
  three body widths along every rock and rim (tested). Its `GROUND_ROOM` grows from 6 to 8. On a pool
  rim its front legs reached into the water, so the rim rows move out a little (3 and 7.5 units from
  the pool's outline, from 1.5 and 6); on a splash rock its legs hung below the foot and, at a
  rock's end, past its side, so the waterline row is 3.5 units above the foot (from 2) and a run
  keeps the shell on the rock (only hiding takes it round an end).
- **Paint:** an olive-brown to green-black shell (from violet-grey), stronger pale-yellow marbling
  with a few faint blotches, the eyes on short pale stalks in the front corners, darker purple-brown
  claws with pale tips.
- **Claw wave** (the research's "it waves a claw"): one stop in five becomes a wave (1.3–2.4 s): one
  claw raised up and out past the shell's front corner, a little larger, swung at 1.7 Hz, lowered
  (`wavePose`); drawn over the shell instead of under it, so still five `drawImage`s. A threat
  freezes it as any stop.
- **Reads now:** on the splash rocks' crowns and waterlines and the pool rims, a dark marbled square
  crab with eyes; at the overview still a small dark speck.

## Frame cost
`sprout.fauna.bench` on the production build, 1470 × 750 at DPR 2, the coast at noon, 25 plants,
the residents plus 2 butterflies, 3 bees, 2 gulls, a tortoise and a pod of five; `bench(60)`
untimed, then `bench(120)` three times; three fresh pages each; the machine shared with two agents.
Before = `main` built from a clean export.
- Overview: before 0.84–1.00 ms (one 1.67 spike), median 0.92; after 0.78–1.22, median 0.95.
- Zoom 3 on the crab: before 0.71–1.40, median 0.81; after 0.67–0.94, median 0.80.
- Zoom 3 on the lizard: before 0.67–1.24, median 0.74; after 0.73–1.10, median 0.77.
Inside the noise and under the 1.5 ms budget: the lizard draws one image fewer, the crab the same,
a surfacing dolphin one more.

## Tests
- `green-lizard.test.ts` 13 (+3): a hand spawn beside the resident is refused and another comes once
  it is gone; the run frames' leg reach; two `drawImage`s a frame.
- `rock-crab.test.ts` 13 (+2): the claw wave (only while stopped, one claw, down at both ends,
  swinging); it fits every rock and rim and, stopped, keeps its shell on the rock; five
  `drawImage`s waving. The sideways-run speed check now allows for the crab's scale on the pool rims
  (unevenly spaced rim points), which the new random path happened to reach.
- `dolphin.test.ts` 20 (+1): the water parts round a back only while it is out, never wider than
  the body; the size bound is now about two fifths of the caique; a frame's draw calls ≤ 23.
- After the last rebase on `main` (the coast's wide-window view): typecheck clean; the full unit
  suite, 283 files, 3029 tests, all pass. E2E, one file at a time, one worker, against the production
  build: `lazy-creatures` 2, `fauna` 6, `sceneries` 9, `studio` 14, all pass. The full e2e suite was
  not run.

## Left open
- **The lizard on the path edge** needs a place from the scenery (a strip along the path's edge
  with a crack): not added.
- The lizard can bask under a plant hanging over the coping (the maidenhair) and is drawn over its
  fronds (depth: the wall's foot); its stretch is not clipped to the slots.
- No juvenile lizard (brown with pale stripes) and no blue-throated spring male.
- The dolphins' leap was checked in the studio only (a pass's leap is random in the garden).
- The crab's wave is small at zoom 3 (a few pixels of movement); its legs are still leaf-shaped dabs.
- A water plant in a rock pool (the peacock's tail) draws over a crab on the pool's back rim, so it
  can hide behind the fronds; on splash-1 its legs may reach past the rock's side at the row's end.
