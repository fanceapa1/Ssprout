# 197 · Common dolphins (GK9, phase 15)

## What
The coast's rarest sight: a small pod of short-beaked common dolphins (*Delphinus delphis*), kind
`dolphin`, the `dolphins` row from GK0 (20 plants, rare, announced: "Dolphins break the surface far
out in the bay.").

- **Module** `src/fauna/creatures/dolphin.ts`, its line in `creatures/sets/creatures-coast.ts`. No
  contract change; `wildlife.ts` is untouched (the `bay` region was there).
- **One creature, the pod** (`Pod`), as the firefly swarm and the iwatsubame flock are: 2–5 animals
  (3–4 most often), in a pod of three or more half the time a calf at 0.62 × beside its mother. The
  arrival line is said once per pod.
- **Rare:** a drifter by day, gap 1500–3000 s, first visit 600–1500 s after the row unlocks or the
  page loads, a pass 60–100 s, one pod at a time. With the session's livelier gaps (× 0.75) that is
  a pass in some 25-minute sessions, not every one; over six simulated hours of day, four to fourteen
  passes. None at night: the scheduler does not send a diurnal kind after dark, and a pod out at
  nightfall dives and is gone.
- **A pass** (`planPass`): one track across the `bay` region, 40–80 % down it (where they read), in
  at one side and across 65–100 % of its width in the pass's time, about a minute. The pod is a loose
  line: the leader ahead, the others strung out behind and a little to either side. 40 % of passes
  stop 15–35 s to mill: each animal drifts about the spot and surfaces either way. Each adult breathes
  in its own rhythm (every 3.4–6.6 s, ± 15 %), out of step with the others.
- **The roll** (`rollAt`, pure): the body's centre rises on a sine to the surface and sinks again, the
  body pitched along its path, so the beak breaks first, the back and the falcate fin roll forward
  and the tail stock follows. Low rolls show only the back and fin; 20 % are high (the beak shows);
  each animal's last roll is a dive that pitches over at the end so the flukes lift clear; 30 % of
  passes (none in reduced motion) have one modest leap, half a length up. The calf rolls 0.2–0.4 s
  after its mother, the same way. Where the nose cuts back in (`REENTRY`, found once from the path):
  a small pale splash and a ring that spreads over 3.6 s.
- **In the water:** everything is on `waterSurface` (inside the sim's water clip), each body clipped
  at its own waterline, so nothing floats above the surface. That layer is drawn after the scene's
  moving water (over the swell marks) and before the plants and the light plates: plant sprites draw
  over it and the phase's light tints it as it tints the swell. At sunset the arcs are dark
  silhouettes on the apricot sea; at night there are none.
- **Where:** every roll, splash and ring stays inside the bay at its own y (`spanAt`, the roll's
  reach checked before it starts; a breath that would leave the bay is skipped, so the trailing
  animals come in as the pod does). The bay is left of both suns' glitter paths, right of the pine,
  clear of the shallows and every slot, and its foot is 10 units above the caique's mast top, so the
  pod never comes near the boat or the shore.
- **Size:** `DOLPHIN_LIFE` 253 units (2.1 m, the gull's measure) × `DOLPHIN_K` 1.8 × the bay's own
  scale (0.01 → 0.04): 11–17 units on the track, 9–13 css px at the overview, a quarter of the caique at
  most. At 1.5 × (the first try) the arcs were 3–4 css px and lost among the swell's glints; at 2 ×
  they began to look nearer than the boat.
- **Paint** (`paintDolphin`, four parts, one `ArtCache` entry, painted at the largest size): an
  opaque pale ground (the sea must not show through), the grey rear and the ochre front of the
  hourglass as glazes, the dark cape in one wet stroke dipping to a V under the fin, the fin and
  flukes, a small flipper, the eye in its dark stripe, the sky caught along the wet back. The splash
  is a few thin white streaks and loose drops over a foam lip (reserved white); the ring a pale broken
  line over a darker one.
- **Determinism:** its own fork of `w.rng`; time from the sim; `freeze()` stops it; reduced motion
  slows it through `w.speed` and drops the leap.
- **Dev hook:** `sprout.fauna.spawn('dolphins', n)` brings a pod of `n` (2–5) at once, the leader
  surfacing on the first frame; `spawn('dolphins')` a pod of the usual size.
- **Studio** `fauna-dolphin/alive` and `/parts` (the bay crop at 2.1 px a unit);
  `fauna-dolphin-close` (`dolphin.studio.ts`): `roll` (a low roll, a high roll, the dive and the leap,
  ten frames each, close), `roll-overview` (the same at the overview's scale), `pass` and `pass-close`
  (the real pod in the bay at 0.9 and 2.1 px a unit), `leap` (a pass planned with its leap, 4.7 px a
  unit) and `sunset` (a warm multiply standing in for the light plate).

## Why
- **A drifter, not a visitor:** a pass would otherwise take one of three visitor places from the
  bees and butterflies, or wait behind them; the gull and the tortoise are drifters for the same
  reason.
- **No hour, so no "toward sunrise and sunset":** the fauna world knows night only (`FaunaWorld` has no
  hour; it is a contract), as devlog 193 found for the tortoise. Weighting passes toward the low suns
  needs the hour in the world, a contract change; not made.
- **Gulls over the pod: skipped.** The gull circles only inside `sky-cove` (`soarCircle`), which is not
  over the bay; following the pod would mean changing the gull, not just using its mechanism.
- **No ADR:** nothing here binds other code.

## Looked at
`artifacts/gk9/` (rounds r1–r5 and the final run):
1. `r1`: the parts read as a dolphin at once; the splash read as a lotus (a symmetric crown of
   petals), the hourglass's front half as olive; in the garden nothing showed at 1.5 × and the pod
   sat right over the caique's mast at the close view.
2. `r2`, `r3`: the splash became thin streaks and loose drops; the size went to 1.8 ×; a check that
   kept the pod 30 units off the boat's perches hid most breaths (the pod in the bay's middle sat in
   the zone) and was dropped: the bay's foot is already above the mast top (tested instead).
3. `r4`: noon and sunset strips over 4 s, a close view at 3 ×: dark backs and fins with a pale cut
   where they re-enter, rings spreading after them; at sunset dark arcs on gold. The leap read like a
   small aeroplane (the flipper and the fin as wings): the flipper is smaller and swept back.
4. `r5` and the final run: the low roll a little lower so less of the flank shows at the overview.

The report's images: `gk9-dolphins-roll.png` (the studio's `roll`, final code),
`gk9-dolphins-garden.png`, `gk9-dolphins-close.png`, `gk9-dolphins-sunset.png`,
`gk9-dolphins-strip.png` (r5: the dev build before the low roll was lowered by 0.02 of a length).

**Bench** (production build, headless Chromium, 1440×900 at DPR 2, the coast at noon with 25 plants;
spawned: 2 butterflies, 3 bees, the heron, 2 gulls, 2 tortoises, with the resident cat; `bench(60)`
untimed, then `bench(120)` three times, three rounds):
- without a pod: **0.68/0.65/0.66, 0.71/0.63/0.64, 0.61/0.56/0.55 ms** a frame;
- with a pod of five: **1.19/1.10/1.12, 0.62/0.66/1.02, 1.09/1.03/0.91 ms**.
- The pod's own work is small (a body is one clipped `drawImage`, a frame a handful). The step is
  the sim's water clip: the waterSurface layer clips to the whole sea, and the browser rasterizes that
  clip only when something draws under it. A micro-benchmark on the same page (a 2880×1800 canvas,
  four small sprites a frame): no clip 0.64 ms, the sea clip 0.93, the sea clip with a rect clip per
  sprite 0.94, rotated sprites 0.97. So about 0.3–0.45 ms is the sea clip, paid by anything on the
  coast's water layers (a floating gull's rings pay it too), and the dolphins' own clips cost about
  0.01 ms. Inside the 1.5 ms budget; nothing is drawn when no pod is in the bay.

## Tests
`src/fauna/creatures/dolphin.test.ts`, 19 tests (the roll: under at both ends, low and high, dive and
leap; the bay: clear of slots, the size, coast only, every roll, splash and ring inside it and above
the mast top; a pass: pod sizes, a minute's crossing, the leader at once, own rhythms, leaps, mills,
the calf, a hand spawn's size, rarity and night, nightfall, the arrival only in sight, determinism,
reduced motion, the studio stage; cost: draw calls, update, the plan's fork).
After the rebase on `main` (the goats, the cyclamen): typecheck clean; the full unit suite, 269 files,
2840 tests, all pass. E2E, one file at a time, one worker: `fauna` 6, `fauna-oasis` 4,
`fauna-waterfall` 4, `lazy-creatures` 2, `sceneries` 8, all pass. The full e2e suite was not run, and
there is no coast fauna e2e spec yet.

## Left open
- **No hour:** passes are as likely at noon as at the low suns (above).
- **The overview arc is small** (9–13 css px) and the swell's pale glints are about as bright as a splash;
  a pass reads best as several arcs over a few seconds, not in one still.
- **A rigid body:** the roll pitches one sprite; a real back flexes, so the dive's flukes rise a little
  stiffly and the leap's entry is steep.
- **No breath mist** and no wake between surfacings.
- **The calf is a smaller adult:** no paler, fainter pattern.
- **The sea clip's cost** (Bench) belongs to the sim: a clip limited to the drawn creatures' bounds
  would remove it for every water creature; not changed here.
- **The studio's sunset** is a multiply over the noon backdrop; the app's real sunset was checked in
  the garden.

Status: done.
