# 208 · Scops owl (GK8, phase 15)

## What
The coast's scops owl (*Otus scops*), kind `scops-owl`, the `scops-owl` row from GK0 (12 plants,
night only, announced). One owl, alone, after dark.

- **Module** `src/fauna/creatures/scops-owl.ts`, its line in `creatures/sets/creatures-coast.ts`
  (the only shared source file touched: one import, one array entry). Built on the rock thrush's
  structure (devlog 205). No contract change, no ADR.
- **Role:** a nocturnal drifter (gap 200–500 s, group 1, max 1; the spawn also refuses a second
  while one lives). Not counted against the visitor cap. Leaves by itself at daybreak.
- **Where:** `owlPerches`: the olive's fork and boughs, the leaning pine's branches and the wall
  copings, weighted 3 : 2 : 1 per group. Never a perch another creature holds.
- **Behaviour:** flies in on a low swoop, sits upright and thin with its feet on the perch line and,
  act by act, sits still, turns its head slowly, blinks, or calls for 8–18 s (the throat puffs every
  2.6 s; the sound is the sound bed's). After 30–90 s it swoops silently (mostly gliding frames) to
  another perch. A cat, goat, heron or tortoise within 120 units makes it stretch tall and narrow
  (ear tufts up, eyes narrowed) until it has gone.
- **Paint** (`paintOwl`): a bark-grey body with a paler streaked breast and pale scapular spots;
  four heads (front, turned, blink, tall) with a dark-rimmed facial disc, short tufts and yellow
  eyes; a pale throat puff; three flight frames. 24 units (about 20 cm), drawn at least at scale 0.7.
- **Studio:** `fauna-scops-owl-close`: `poses` and `olive` (the real behaviour at night, hour 23).

## Looked at
`artifacts/gk8/`: `poses-crop` (first: a stiff capsule body, the head sat on it like a cat's head);
after a rounder, shorter body, the head lower into the shoulders and smaller tufts; `scene2-crop`
(the coast at night, zoom 3: the owl on a pine branch; the pale breast and the yellow eyes carry it
against the dark tree, it does not glow). `olive-crop` (studio stage, by day, minDraw 0.5) showed
it too small on the olive; raised to 0.7.

## Bench
Production build, headless Chromium, 1440 × 900, the coast at night, 25 plants, the cat, 2 gulls
and the heron spawned plus the schedule; `bench(60)` untimed, then `bench(120)` three times:
without the owl **0.51 / 0.69 / 0.63 ms** (6 creatures), with it **0.47 / 0.47 / 0.47 ms**
(5 creatures: a gull left at night during the 25 s step that brings the owl in, so the rosters
differ by one). No measurable cost inside the spread (two `drawImage`s perched).

## Tests
`scops-owl.test.ts`, 9 tests: the olive, pine and walls only; the olive most, never a held perch;
not in the oasis; a night (in, feet on the perch line, call, turn, blink, a swoop to another perch);
one at a time; tall and thin while the cat is near and back after; gone by day, nocturnal;
deterministic; the call's puffs.
Typecheck clean. E2E, one file at a time, one worker: `lazy-creatures` 2, `fauna` 6, `sceneries` 8,
all pass. The full unit suite was started after the last rebase; see the report for its totals.

## Left open
- In the scene the owl was seen on a pine branch; not checked on the olive's boughs or a coping in
  the app (the studio's olive crop is by day).
- The camera `glideTo` onto the owl did not centre it (it sat at the frame's edge).
- No call sound (the sound bed's); the head turn swaps sprites at the half-way point.

Status: done, pending the owl checked on the olive and a coping in the app.
