# 212 · Island cat polish (GK1b, phase 15)

## What
A second pass on the island cat (devlog 185), the coast's resident and the animal looked at most.
Its character and behaviour set stay (doze, wake, stretch, wash, watch birds, stroll, jump a tier,
sit facing the sea at nightfall; three coats). Five things a review found are fixed.

- **The walk has joints.** The side-on rig is now a sprite a bone: upper arm, forearm and paw;
  thigh, shin and the metatarsus with its paw (`paintCat`: 14 bone sprites, near and far). Each leg
  is solved from its joint to its foot (`legJoints`, two-bone `ik2`): elbows fold back, knees
  forward, the hock points back. The gait (`GAIT`, `walkFoot`) is a lateral sequence with diagonal
  couplets: near hind 0, near fore 0.27, far hind 0.5, far fore 0.77 of a cycle, each foot down 60 %,
  so each hind lands in the print its fore has just left. A paw on the ground sweeps back exactly the
  body's travel, and the phase advances by the ground walked, so nothing slides: the stride is
  33.6 units a cycle (28 cat units) at 30 units/s, a little under a step a second (it was 21.6 at 28,
  with feet swinging as rigid sticks). The shoulders and hips rise a little over the planted foot
  (about ±0.3 units), the shoulder blades slide with the forelegs, the head stays level, the tail is up
  and sways with the stride. A new torso outline gives a deeper chest and a haunch.
- **Toward and away from the viewer.** The ground is foreshortened (`GAIT.depth` 0.45): a walk at the
  viewer goes at the same pace on the ground and covers less of the picture, and its stride is
  foreshortened to match (`travelPerCycle`). A way mostly in depth (`viewFor`) is walked in a front
  view (face and chest, forelegs as columns, the hind feet behind, the tail up behind the back) or a
  back view (the head over the shoulders, the rump, the hind legs with the hocks and the pads as a
  foot lifts, the tail up to one side), with their own stride from the same `walkFoot`. It turns
  before it sets off: the old view narrows to a third and the new one opens out (0.45 s), as the
  tortoise turns through its front view; back to side-on before it sits. Turning round side-on (at
  the end of a stroll, at nightfall to face the sea, on a zigzag) goes the same way instead of
  flipping (`flipTo`).
- **Pose changes are drawn** (`changeFor`, `inBetween`). Between two rig poses (stand, walk, crouch,
  leap, the stretch) the joints ease over 0.3 s. To or from a painted pose (sit, loaf, curl) the
  joints run 0.6 s through a rig pose made to meet the painting's outline (`RIGS.sit`, `.loaf`,
  `.curl`: the sitting rig drops its shoulder blades so the forelegs stand under an upright chest),
  with a 0.14 s dissolve only where the two meet. Painted to painted (sit to loaf, loaf to sit) runs
  0.9 s through the rig: the chest comes down, the forelegs fold under. A walk waits until it is up.
- **The front stretch** is rigged now (`RIGS.bow`, `stretchPose`): two forelegs out along the ground
  a little apart, the paws flat with the toes spread and the claws just out (`pawSpread`), chest
  down, rump up, the tail up and curved, pressing a little further; then the follow-through
  (`RIGS.reach`): the long back stretch with a hind leg trailing on its toes, and back to standing.
  The stretch runs 3.2–4.4 s (was 2.2–3.2) to fit the getting up into it.
- **Ground creatures keep off each other** through one shared helper, `creatures/lib/ground.ts`
  (ADR 0381): `GROUND_ROOM` (cat, tortoise, goat, green lizard, rock crab), `groundBodies` (the
  others in sight, where each is and where it rests), `groundFree`, `blockerOn`, `stepsRound`. The
  cat never settles on where one is or rests, never sets off on a way through one (a blocked
  destination is dropped for another), and walking, when one is close ahead, stops 0.8–1.8 s to look
  at it (`wait`), then steps round it side-on on its walk's ground (two steps beside it, behind or in
  front, `walkable`), or gives the stroll up and sits. If someone has settled on its place while it
  walked, it goes on elsewhere. The tortoise keeps off where ground creatures stand and stays put
  rather than plod through one (two lines in `nextPlod`). The lizard and the crab hold their spots
  and flee as before; they are listed so the walkers keep off them. `scops-owl.ts` is untouched.
- **Studio** (`cat.studio.ts`): `poses` (now standing, the stretch and its follow-through rigged),
  `walk` (ten frames), `views` (eight frames toward and eight away), `changes` (stand to sit, sit to
  loaf, loaf to the stretch, the painted pose at each end), `coats`, the live `wall` and `shade`, and
  `round`: a tortoise put down in its way along the middle walk.
- No contract change; `wildlife.ts` and the places are untouched.

## Why
- **A sprite a bone, not composed frames.** Pre-painted walk frames would cost one `drawImage` but
  quantise the cycle, and a planted paw would jitter by a sixteenth of a stride. Bones drawn live keep
  the paws exact at any speed and cost a few more small `drawImage`s (16 at most, was 9), measured
  below.
- **Foreshortened depth.** Walking toward the viewer at the side-on pace in picture units made the
  paws sweep further than the chest is tall; at the same ground pace and a foreshortened stride the
  front view's paws step a believable few units.
- **Front and back views with a turn, not three-quarter views:** two more bodies and heads are a
  small set to paint, and the narrowing turn reads at the overview; it is the tortoise's answer too.
- **Painted poses kept,** with rig poses made to meet them: the painted sit, loaf and curl read better
  than any rig posed that way, and the dissolve is short where the outlines nearly match.
- **ADR 0381:** a rule other walkers must follow, in one place rather than a special case per pair.

## Looked at
Strips of 10 frames at small fauna steps, in the app (production build, `?dev&scenery=coast`, noon,
12 plants, close view ×3) and in the studio, before and after:
1. Before: the legs swung as straight sticks from the shoulder and hip, a short shuffling stride; down
   the path steps the side-on cat slid down the picture.
2. r1: joints read; the front view looked like a meerkat (the head huge over a tall narrow body) with
   the tail rising out of its crown; the back view's tail hid the head; the sit in-between was a long
   pitched body against the upright painted sit; the stretch's far foreleg hid behind the near one.
3. r2–r4: a wider, lower front body, the head over the chest, the tail behind a shoulder; the back
   view's tail to one side and the head above the shoulders; the sitting rig with its shoulder blades
   dropped meets the painted sit; the far foreleg ahead in the stretch, hind legs straighter.
4. In the scene: side-on along the lower walk, the paws stay put and step on; up the path away from
   the viewer, it narrows into the back view and walks off with the hocks and pads showing; a dozing
   tortoise put on its way: it stops, looks, steps behind it and walks on.

## Bench
Production build (`vite preview`), headless Chromium, 1440 × 900 at DPR 1, the coast at noon with
12 plants; `bench(60)` untimed, then `bench(120)` three times; the other agent's e2e running (load
2–3.5). "The cat" is the fauna cleared and the cat spawned: the resident crab, lizard and the others
come back with it (5 creatures); "everything" adds a bee, butterfly, swallow, heron, gull, tortoise,
goats, lizard, crab, thrush, cicada, dolphins, damselfish and octopus (20–23 creatures).
- Before (the old cat, mostly dozing): the cat overview **0.43 / 0.37 / 0.40 ms**, close (zoom 2.6)
  **0.32 / 0.36 / 0.35**; everything close **1.27 / 1.02 / 1.23**, overview **0.86 / 0.94 / 0.90**.
- After: the cat overview **0.38 / 0.39 / 0.32 ms**, close **0.29 / 0.24 / 0.27**; everything close
  **0.85 / 0.89 / 0.71**, overview **0.71 / 0.73 / 1.01**.
- After, the cat walking in (the rig: 16 `drawImage`s, the most it draws), `bench(90)` on fresh
  spawns: overview **0.39 / 0.36 / 0.34 ms**, close **0.54 / 0.35 / 0.26** (the first close run
  paints the bones at the close resolution).
- The run-to-run spread on this machine is larger than any difference: the jointed walk costs no
  measurable extra, and the busiest close view stays inside the 1.5 ms budget.

## Tests
`src/fauna/creatures/cat.test.ts`, 26 tests (12 new): the walk (footfall order and each hind in its
fore's print; planted paws side-on, slanting, toward and away; every bone reaching its joint in the
stride and every pose, elbows back and knees forward, the shoulders rising; in the scene at its real
pace a planted paw moves under 0.35 units over three seeds), the views (`viewFor`; every way mostly in
depth walked facing it over six seeds, turns, never sitting facing the viewer), changes of pose
(`changeFor`, `inBetween`; in the scene sitting down, lying down and the stretch start drawn
changes), the front stretch, ground creatures (the helper; two tortoises about over eight seeds, no
walking into one nor resting on one's place; a tortoise put down in its way over ten seeds: it stops,
looks and steps round or gives up, never within its room, with at least one step round), and the cost
test for the rig (at most 16 `drawImage`s, the front and back views 9).
Typecheck clean. After the rebase on `main` (the scops owl polish): the full unit suite, 281 files,
2999 tests, all pass. E2E, one file at a time, one worker: `lazy-creatures` 2, `fauna` 6, `sceneries` 8, `fauna-oasis` 4, `fauna-waterfall` 4, `studio` 14, all pass (the shared `lib/ground.ts` and the tortoise are touched, hence the oasis and waterfall specs). The full e2e suite was not
run, and there is no coast fauna e2e spec.

## Left open
- **The bones are separate sprites:** at the closest view a faint seam shows at an elbow or knee
  where two washes overlap.
- **Front and back views are plain:** the legs are columns that stretch to the foot, the hind feet
  behind the chest are small; no three-quarter view between them, the narrowing turn stands for it.
- **Corners:** at a waypoint the stride's heading swings over a few frames, so a planted paw pivots
  there (the slide test counts only stances on one heading).
- **Leaps** keep the side view and two rig poses; a jump straight down a wall toward the viewer is
  still drawn side-on.
- **Stepping round** needs room on the walk's ground: on the narrow top walk, the copings and the path
  steps it gives the stroll up instead; it never jumps over anything.
- **The washing paw** is still the old single sprite on the painted sit.

Status: done.
