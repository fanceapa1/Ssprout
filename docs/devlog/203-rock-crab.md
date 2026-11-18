# 203 · Marbled rock crab (GK4, phase 15)

## What
The coast's splash-rock crab: the marbled rock crab (*Pachygrapsus marmoratus*), kind `rock-crab`,
the `rock-crab` row from GK0 (5 plants, announced: "A marbled rock crab sidles over a splash rock.").

- **Module** `src/fauna/creatures/rock-crab.ts`, its line in `creatures/sets/creatures-coast.ts` (the
  only shared file touched, one import and one array entry). No contract change; `wildlife.ts` is
  untouched: the `splash-*` faces, the `rock-*` perches and the `pool-*` regions were there.
- **Role:** a resident, day and night: one by day, a second after dark (one in reduced motion), on
  different rocks.
- **Where** (`crabRocks`): each `splash-*` face gives two rows, the crown's front lip (1.5 units above
  the face's top edge) and the waterline (2 units above its foot); each `pool-*` region gives its back
  rim (the outline above its centroid, pushed 6 and 1.5 units out). A crab's place is a rock, `u`
  along it and `v` between the rows. The lip is used only within 4 units of the rock's `rock-*`
  perch: the places put that perch clear of the slot, so the crab keeps out of a plant's footprint
  without a wider contract. Splash rock 1 has no perch (its crown is all slot), so its crab keeps to
  the waterline. Checked in the painting: on splash rock 1 and 2 it sits on the rock's front face at
  the water (with a cyclamen planted on top, it is below and in front of it); the rims are on the pale
  rock shelf round the pools.
- **Behaviour:** starts hidden at one end of its rock, comes out and runs sideways in quick runs
  (3–12 units at 26 u/s × perspective; three runs in ten climb between the lip and the waterline),
  stops (0.6–3 s) or feeds (3–9 s: the claws pick at the rock in turn, 2.2 Hz). At the waterline a
  swell's foam washes over its legs every 6.5 s and it sits a little lower. Something big within
  reach (gull 80, heron 160, cat and goat 90, tortoise 40, thrush and hoopoe 50, octopus 45, owl 60)
  freezes it flat for 0.4–1.1 s; then it darts off the rock's nearer end at 60 u/s, round the back,
  and stays hidden 6–15 s and as long as the threat is near. After 60–180 s on one rock it leaves the
  same way and comes out on another.
- **Paint** (`paintRockCrab`, one `ArtCache` entry): from above and a little in front, front edge
  toward the viewer. A squarish carapace in a wet-in-wet of dark violet-brown and green-black,
  24 short broken pale lines of marbling, flank ridges, the eyes in the front corners with a glint,
  eight red-brown legs with pale knees in three frames (stand, gait A, gait B: alternate legs lift
  and reach), one small claw with pale fingertips drawn mirrored, a soft shadow, a foam sprite.
  Five `drawImage`s a frame, six under a swell. `ROCK_CRAB_SIZE` 8 units (about 2.5 × life).
- **Studio:** `fauna-rock-crab-close` (`rock-crab.studio.ts`): `poses` (standing, picking left,
  picking right, frozen flat, under a swell), `gait` (stand, A, B, A, B), and the live behaviour on
  close crops of splash rocks 2 and 3. The def's `sheet` and `show` give `fauna-rock-crab/alive`
  and `/parts`.

## Why
- **Faces and rims, not perches:** a perch is a point to stand on; the crab runs along the rock, and
  the `splash-*` faces were made for it (ADR 0373). The sawagani's homes are the waterfall's stones
  and foam; nothing of it fitted the coast's places, so no helper is shared (its leg layout and
  gait-frame idea are reused).
- **No ADR:** nothing here binds other code.

## Looked at
`gk4` shots (production build, 1440 × 900, the coast at noon, 6 plants, crabs spawned and stepped
25 s, camera zoomed onto the crab; the dev zoom stops at about 2.5 ×):
1. `crab1`: two crabs, one on splash rock 1's face at the water under the planted sea daffodils, one
   on the rock shelf by the bottom pool; enlarged, it reads as a crab: square carapace, legs out to
   both sides, at the waterline.
2. Studio `poses` first round: claws hung below the front edge like separate blobs and the marbling
   was faint on a grey-olive shell. Second round: darker violet shell, more and stronger marbling,
   claws bigger with the chela pointing in under the front edge.
3. `crab3`: six crabs spawned at 2.5 ×: on splash rocks 1, 2 and 3 (face and lip) and on the back
   rims of the pools, every one on painted rock, none on water or sand.
4. In the overview it is a dark speck, as asked.

## Bench
Production build, headless Chromium, 1440 × 900 at DPR 2, the coast at noon, 25 plants, overview;
`bench(60)` untimed, then `bench(120)` three or four times; a busy machine with two other agents.
- The roster after 60 s (cat, one resident crab, cicada, tortoise, gull, bee, two butterflies):
  **0.54/0.50/0.47 ms**; with two more crabs: **0.54/0.54/0.62 ms**.
- After `clear()` (the cat and the resident crab only): **0.33/0.32/0.31/0.31 ms**.
- So a crab costs about 0.02–0.04 ms a frame, inside the noise. Well under the 1.5 ms budget. No
  "before" on `main` was measured separately.

## Tests
`src/fauna/creatures/rock-crab.test.ts`, 11 tests (the rocks and rows, coast only; out of its
crack, runs, stops, feeds, on its rows and `entities`; runs mostly sideways and never too fast; the
claws in turn; a cat near: freeze, dart, hide, come back; the swell only at the waterline; one by
day, two after dark; another rock now and then and determinism; the studio stage; cost).
After the rebase on `main` (Jerusalem sage): typecheck clean; the full unit suite, 275 files, 2907
tests, all pass. E2E, one file at a time, one worker: `lazy-creatures` 2, `fauna` 6, `sceneries` 8,
`fauna-waterfall` 4, all pass. The full e2e suite was not run, and there is no coast fauna e2e spec.

## Left open
- **The camera's close view** stops at about 2.5 ×, where the crab is about 25 px wide: legs and
  shell read, the eyes and marbling only when enlarged.
- **Pool rims** are the back half of each pool's ellipse; the front rim is not used.
- **Climbs** between the lip and the waterline are a straight diagonal over the face.
- **No claw wave** (the research's "it waves a claw").

Status: done.
