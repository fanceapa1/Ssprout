# 85 · Sawagani freshwater crab (C4)

## What
The waterfall's crab, **sawagani** (サワガニ, *Geothelphusa dehaani*), row `sawagani` of
`WATERFALL_FAUNA` (8 plants, announced). Only new files:
- `src/fauna/creatures/sawagani.ts`: the art, the behaviour (`Sawagani`), pure helpers
  (`crabHomes`, `inFoam`, `waterlineDistance`, `threatNear`, `chooseHome`) and the default-exported
  `CreatureDef` (kind `sawagani`, role `resident`, rank 4, variants `red`/`blue`, `show` on the
  `falls` stage, a parts `sheet`).
- `src/fauna/creatures/sawagani.test.ts`: homes, foam, threats, a 15-minute run by night and by
  day, determinism, daybreak, the heron and camera frights, reduced motion, the studio stage
  (10 tests).

## How it is painted
Front view, seen a little from above, `SAWAGANI_SIZE` 9 world units across the carapace at
perspective 1 (about three times life size: at 2–3 cm it would be 3 px on screen). With its legs
it is about 20 units wide, smaller than the wagtail.
- **Carapace**: a rounded square, wet-in-wet from a lighter warm `#b5614a` on the lit back
  into the shell colour, granulating. In one clipped wet layer: a deeper red-brown on the shaded
  flank and along the front margin, with no rim, so the colour rounds off instead of making a patch.
  A small wet gloss is lifted on the back edge. A dark wash of the face under the front margin
  joins the claws to the body.
- **Eyes**: two small red-black dots on short stalks at the front margin. They rise when it
  is alert.
- **Legs**: four pairs, each as two pooled leaf dabs (a flattened thigh, a slimmer lower leg) with
  a darker knee and a darker tip, overlapping at the joint. Three frames: standing and two
  alternating gaits.
- **Claws**: milky `#efe6d8`, source-over so they stay pale on dark rock: a short reddish arm,
  then the palm and the fixed finger in one wet-in-wet shape (warmer at the wrist), a cool shade
  along the underside, a moving finger, and darker horn tips. The big right claw has an open
  frame for raising; the left one is smaller and mirrored.
- **Shadow**: a soft, fading glaze under it.
- **Blue morph** (`blue`, 10 %): `#7f8fa8` shell, blue-grey legs, whiter claws.
- Seven `drawImage` calls a frame (`drawSawagani`, shared with the studio portraits).

## Behaviour
- **Resident**: one by day, two after dark (`resident: night && !reduced ? 2 : 1`). At daybreak
  upkeep sends the second home, and it goes back under its stone. Each crab lives under its own
  **wet stone** (`crabHomes`, from `w.scene.rocks`). A stone side is a home when its **door**
  (just clear of the side, at the foot) is in the water or within 12 units of the waterline, in
  view, and not within 8 units of the **foam** (`inFoam`: inside the water clip but in neither
  the still water nor a stream). At the waterfall the foot boulder's side toward the falls is
  refused. The **den** is behind the stone's foot. The **spots** are on its lower wet face and
  along its foot.
- **Under** (`hidden`): it draws nothing, and its depth is just behind the stone. Then it
  **emerges**: it sidles slowly from the den to the door, behind the stone (in the garden the
  painted stone hides it), fading in, with stops to look about. It **forages** for 30–90 s after
  dark or 8–20 s by day, hidden 5–16 s or 25–70 s between outings. Its first outing is always a
  long one, so the arrival line is true. While foraging it **picks at the moss** (one claw at a
  time dips down and comes up to the mouth, in bursts) and now and then **raises the big claw**
  with its fingers open. Every 2.5–7 s it **sidles** sideways (front to the viewer, gait frames,
  a little bob) to another spot on its stone. Then it **returns**: door, then den.
- **Fright**: a heron (170 units), crested kingfisher (150), dipper or wagtail (60) within reach
  makes it **freeze** for 0.5–1.4 s: legs still, eyes up, claws guarding. If the bird is still
  there it **scuttles** home (32 u/s) and stays under 6–14 s. The **camera**: the creature world
  has no camera, so it uses `w.art.res` rising by more than 15 % (a close view at rest) as the
  signal. It freezes for 1.5–3.5 s, then goes home 45 % of the time. Fright while emerging
  sends it back in; on its way home it just hurries.
- **Never in the foam**: doors and foot spots keep 8 units off it. Face spots are on the stone
  and keep 6 units off it.
- **Depth**: its stone's base y + 0.5 when out, − 0.5 while going to or from its den.
  Ripples: a faint ring now and then while it moves in the water.
- **Sizes**: `w.perspective(rock.y, x)`. **Randomness**: each crab draws from its own
  `w.rng.fork(…)` (labelled by the sim's seed, time and count), which does not consume the world's
  stream: a crab arriving leaves every other creature's run as it was. **Reduced motion**:
  everything at `w.speed` (0.6), and one crab at night.

## Looked at
Probe shots from a small Playwright script against my own dev server (port 5410), under
`nice -n 15`. Copies are in `artifacts/shots/sawagani-*.png`:
- r1 (`sawagani-r1-parts.png`, `sawagani-r1-crops.png`): in the garden a red smudge, with no white
  claws at garden size. On the sheet the legs read as flat blades, the shell as a bun on a pink
  plate with an H of grooves like a face, and the claw as an egg with a red diamond → 7 → 9 units,
  legs as pooled leaf dabs, no grooves, a reworked claw, assembled portraits on the sheet.
- r2 (`sawagani-r2-parts.png`): it reads as a crab. But the claws lay on the ground below it,
  cut off from the body, the legs were loose petals with spidery high knees, the shaded flank
  was a hard patch, and the eyes were big black dots under the shell (a cartoon face) → knees
  lower and joints overlapping, shoulders up, eyes smaller on the front margin, no rim on the
  flank, a softer shadow.
- r3–r4 (`sawagani-r3-parts.png`, `sawagani-r4-crops.png`): legs jointed. At zoom the shell was a
  pale, pinkish, glossy bun → a deeper shell, a smaller gloss, a dark face band. (One of my
  close shots was soft because I painted before the sharp resolution was applied, not the art.)
- r5 (`sawagani-r5-wf-close.png`, `sawagani-r5-crops.png`, the camera's closest view at night):
  on its stone it is a red-brown crab with jointed legs and two milky claws at the stone's
  wet foot. `sawagani-r5-parts.png`: red at rest, raised claw, blue picking.
- r6 (`sawagani-r6-phone.png`, `sawagani-r6-phone-crops.png`, 390×844): a red fleck at the foot of
  its stone. The pale claw dot shows only cropped. The dusk run (the orchestrator's
  `setHour(19); spawn; step(20)`) showed both crabs **hidden**, and the studio stage showed it
  under from t 14 on: by day an outing was 8–20 s → the first outing is always long. On the
  stage the stones were tiny for it → spec 440×278.
- r7 (`sawagani-r7-wf-dusk.png`, `sawagani-r7-dusk-crops.png`, `sawagani-r7-alive.png`): at dusk
  at garden size, **a red-brown fleck with a white dot at the wet foot of a stone**, which is
  the brief's read. In the studio it is out at t 5, 14 and 30, on the stream stone.
- r10 (`sawagani-r10-wf-dusk.png`): the orchestrator's dusk command after the rng fork: both
  crabs out foraging on their stones.
- Busy pool (`sawagani-r8-bench.png`): the whole roster with the heron in. The crabs are under
  (the heron frightens them).

## Bench
`sprout.fauna.bench(300)` at the waterfall, 1440×900, DPR 2, headless Chromium, 25 plants, art
settled, one untimed `bench(60)` first, load about 4:
- the whole roster spawned plus two more crabs (17 creatures): **update 0.03–0.04 ms + draw
  0.31–0.41 ms = 0.35–0.44 ms a frame**;
- without the birds (so all five crabs are out and drawn, 14 creatures): **0.26 ms a frame**.

Both are under the 1.5 ms budget.

## Status
- `npm run typecheck`: clean.
- `VITEST_WORKERS=1 npx vitest run src/fauna src/scenery/waterfall`: 18 files, 176 tests pass
  (with `sawagani.test.ts`, 10 tests).
- No local e2e (CI runs it). `fauna-waterfall.spec.ts` picks the crab up from the roster.

## Rows for the orchestrator
fauna.md › Creatures and behaviour:

| Kind (unlock id) | Behaviour |
|---|---|
| `sawagani` (waterfall: sawagani) | resident: one by day, two after dark (one in reduced motion); each lives under its own wet stone at the waterline (`crabHomes`: a door in the water or within 12 units of it, in view, 8 units off the foam). Sidles out from behind the stone's foot with stops, forages on the stone's lower face and foot (30–90 s at night, 8–20 s by day, its first outing always long), picks at the moss with one claw at a time, now and then raises the big claw, sidles sideways to another spot, goes back under. Freezes when a heron, kingfisher, dipper or wagtail comes within reach, or when a close view comes to rest (the art resolution rises), then scuttles home if the bird stays. Never in the foam. Front view; red-brown, or a rare blue-grey morph (`blue`). |

fauna.md › Layers: `sawagani` → `entities` (depth: its stone's base y + 0.5 when out, − 0.5 going to
or from its den behind the stone's foot).

TESTING matrix:

| C4.1 | The sawagani crab: lives under wet stones at the waterline, never by the foam, in view; one by day and two after dark, the second goes home at daybreak; stays on its stone; out mostly after dark; freezes when a heron comes near and scuttles back under, stays under while it is there; freezes when a close view comes to rest and comes out again; slower and alone in reduced motion; deterministic; comes out on the studio's falls stage | fauna/creatures/sawagani (all) | fauna-waterfall › every creature on the roster can be spawned…; › a busy pool renders cleanly and stays cheap (roster-driven) | ✔ |

## Left open
- **No dusk or rain signal.** The creature world has only `mode.night` (night weight ≥ 0.5, which
  covers the second half of dusk), and no weather. So "dusk" is the darker half of dusk, and it
  does not come out by day in rain. A `mode.dusk` / `mode.rain` in `FaunaMode` would need a
  contract change (shared files).
- **The camera fright is a proxy.** The world has no camera, only the art resolution, which rises
  when a close view comes to rest anywhere, not only near the crab. A close view of the other
  side of the garden can startle it too. A `w.camera` (resting view rect) would make this honest.
- **Phone**: a red fleck. The white claws show only on dark wet rock or when cropped.
- **Front view only**: it sidles sideways facing the viewer. It never turns, climbs onto a stone's
  top or swims.
- **A perched dipper on its stone** (within 60 units) keeps it under for the dipper's perch
  spell. That is true to life, but it hides the crab for a while on the foot boulder.
- The studio's falls stage is shared and its stones are small for the crab even at 440×278.
- In the busy pool the heron sends every crab home: when the heron visits, the crab is not seen.
- **Damselfly test is seed-sensitive.** While the crab drew from the shared `w.rng`, the shifted
  stream made `damselfly.test.ts › over a visit it flits…` fail (a damselfly flying 150+ units
  from water, at about 891,890). The crab now uses a fork, so it passes, but the damselfly path
  that leads there is still in `damselfly.ts` (not mine to change).
- Sound: none (S15).
