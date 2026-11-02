# 90 · Iwatsubame house martins (C6)

## What
The waterfall's cliff swallows, **iwatsubame** (イワツバメ, Asian house martin, *Delichon dasypus*),
row `iwatsubame` of `WATERFALL_FAUNA` (14 plants, announced). Only new files:
- `src/fauna/creatures/iwatsubame.ts`: the art, the behaviour (`Martin`, the shared `Flock`), pure
  helpers (`cliffFace`, `nestSites`, `sprayPoint`, `facePoint`, `inRect`) and the default-exported
  `CreatureDef` (kind `iwatsubame`, role `drifter`, `show` on the `falls` stage with a flock of 5,
  a parts `sheet`).
- `src/fauna/creatures/iwatsubame.test.ts`: the face, the cups, a whole visit, scheduled flocks by
  day and none at night, the rng fork, determinism, reduced motion, the studio stage (9 tests).

## How it is painted
Plan view, painted facing right, `MARTIN_SPAN` 34 world units across the wings at perspective 1 (a
touch over life size beside the wagtail, so it reads high on the cliff at 0.64–0.72).
- **Wings** apart from the body, so a wingbeat or a roll foreshortens the wings and never the bird:
  each wing is a broad arm to the wrist and then a tapering hand swept back to a sharp tip
  (`wingGeometry`). Three poses (`beat` a little forward, `glide` stiff, `swept` a crescent for the
  dart). Seen from above: glossy blue-black coverts (`#3a3f5c` toward `sumi`) bled wet-in-wet into
  sooty flight feathers, two broken primary lines. From below: grey-brown, a little translucent.
- **Body from above**: a stubby cigar, wet-in-wet from the dark cap into a bluer mantle, a lifted wet
  gloss along the back, and the **white rump**: an opaque wash band across the lower back, spilling
  onto the flanks, the mantle's colour bleeding into its front edge and a cool shade toward the tail.
  A short tail with a shallow notch between two blunt prongs. No red face, no streamers.
- **Body from below**: dusky white (`#e6e1d8`) with a fuller breast, a dusky breast wash, greyer
  flanks, the dark cap only at the bill and whiter undertail coverts lost into the belly.
- **At the cup** (`cling`): from behind, head up in the entrance, the back, the white rump, folded
  wings crossing past the short tail.
- **Mud cups**: three lopsided bowls (granulating stone-warm mud, faint pellet dabs, a dark entrance
  slot, a soft shadow on the rock), 1–3 huddled under the lip of most ledges.
- Per bird per frame: two `drawImage` (wings, body), plus one per cup from the flock's first bird.

## Behaviour
- **Drifter** (scheduled, not counted against the visitor cap: a flock small and far on the cliff):
  `visit { gap 110–280, first 20–60, stay 70–150, group 3–7, max 8, diurnal }`. Since the sim only
  sends counted visitors away at nightfall, each martin leaves by itself when `mode.night` is set;
  the scheduler brings none at night.
- **The face** (`cliffFace`): the box of the ledge perches and the falls, a little wider, inside the
  view (on a phone the flock stays on the visible part). A `Flock` shares it, a centre that drifts
  slowly over it on noise, and the cups. Without ledges there is no face: `needs` fails and a hand
  spawn makes nothing, so it never comes to the Japanese garden.
- **Arrival**: in from one side at the face's height, or down over the skyline, one after another
  0.2–1.1 s apart.
- **Swirl**: constant-speed flight (120–175 u/s × perspective) with a turn-rate limit (radius 24–52),
  so every path is an arc. It makes for points round the flock's centre, 24 % of them low in the
  falls' spray (`sprayPoint`); a waypoint that sits inside its turn or goes stale is replaced, and at
  16 % of waypoints it throws a tight loop. Speed and heading wander a little on noise.
- **Dart to the cup** every 6–20 s: a cubic swoop from its heading up to a free cup from below,
  braking at the end (`dart`); it **clings** 0.7–2.6 s, then **drops** away down and out and swings
  back along the face. At most two birds at the cups at once, one per cup.
- **Flight look**: bursts of quick beats (9.5 Hz, the wings foreshortened 0.45–1) between short stiff
  glides, swept wings on the dart. A hard turn on screen rolls it toward edge-on (wings and body
  narrow); coming out of a roll it shows its back 70 % of the time, its pale underside otherwise:
  that is the dark-and-white flicker of the flock.
- **Leave**: at the end of its stay (each bird its own, so they go one by one), or at night: up and
  out over the skyline toward the nearer side. The cups fade in with the flock and out once all are
  going.
- **Sizes**: `w.perspective(y, x)` clamped to the face, × 1.1 in flight (a little in front of the
  rock), the cup's scale at the cup, eased so crossing into the open sky does not pop.
- **Randomness**: one `w.rng.fork(…)` per flock (labelled by the sim's seed, time, index and count)
  and a fork of it per bird; the cups from `w.rng.fork('iwatsubame:colony:<ledge>')`, the same for
  every flock. A flock never draws from the world's stream (tested).
- **Reduced motion**: 2–3 birds, everything at `w.speed` (0.6), wider turns, a third of the loops,
  darts 1.5 × rarer.
- **Layer**: `air` always (flying, clinging and the cups).

## Looked at
Probe shots from a small Playwright script (`artifacts/iwatsubame/probe.ts`) against my own dev server
on port 5415, under `nice -n 15`. Copies in `artifacts/shots/iwatsubame-*.png`:
- r1 (`iwatsubame-r1-parts-1440x900.png`): leaf-shaped wings straight out like a moth or a plane,
  primary lines floating outside the wings, a sausage body with the rump a hard white bandage, too
  light a blue → arm-and-hand wings swept back to a point, darker, softer edges.
- r3 (`iwatsubame-r3-alive-crops.png`): on the stage the flap and roll squashed the whole sprite, so a
  bird became a stick with a bow tie, like an insect → wings and body as separate sprites, only the
  wings foreshorten.
- r5 (`iwatsubame-r5-wf-zoom.png`): in the garden, dark blue flecks the size of flies, the cups not
  drawn (their fade ran in `draw`, and `step` does not draw) → span 24 → 34, × 1.1 in flight, less
  squash, cups fade in `update`.
- r7 (`iwatsubame-r7-wf-cliff2x.png`): small swallow shapes along the cliff, a clinging bird under a
  ledge, brown cups.
- r8 close view (`iwatsubame-r8-close-crops.png`): the rump a round white pom-pom, the belly a pale
  rolling-pin with a dark ball at each end, speckled granulating wings like a moth, the cups biscuit
  halves with polka dots → a rump band, a fuller belly with only the bill dark, almost no
  granulation, faint pellets.
- r9 (`iwatsubame-r9-close-crops.png`): five of seven birds showed their pale bellies, so the flock
  read pale; the undertail was a white button; the cups were perfect half-coins → backs 70 %, the
  vent glazed in, lopsided cups.
- r10 sunset (`iwatsubame-r10-sunset-small.png`, close view): dark birds against the warm cliff; the
  cups too pale to see then (warmed back up). Phone (`iwatsubame-r10-phone.png`, 390×844): small dark
  birds swirling beside the falls, inside the visible part of the cliff.
- r12 (`iwatsubame-r12-sheet.png`): the parts sheet and `fauna-iwatsubame/alive` at t 10 and 30 (seed
  2): two at the cups under the stage's ledge, the rest swirling round the fall.
- r13 (`iwatsubame-r13-close-small.png`, `iwatsubame-r13-wf-cliff.png`): close view at noon (backs
  with the white rump band, two pale undersides, one at its cup); the overview: small dark martins
  along the ledges and the falls.

What reads well: at garden size a loose flock of small dark swallow shapes working the cliff in
arcs; in a close view the blue-black back, the white rump band and the short notched tail, and the
dart up under a ledge to a mud cup.

## Bench
`sprout.fauna.bench(300)` at the waterfall, 1440×900, DPR 2, headless Chromium, 25 plants, the whole
roster spawned (23 creatures, 5 of them martins), art settled, one untimed `bench(60)` first:
**update 0.03–0.05 ms + draw 1.06–1.09 ms = 1.11–1.12 ms a frame**. The same roster without the
martins (18 creatures): 0.96 ms. The flock costs about 0.15 ms. Under the 1.5 ms budget.
(`iwatsubame-r11-bench.png` is that frame.)

## Status
- `npm run typecheck`: clean.
- `VITEST_WORKERS=1 npx vitest run src/fauna src/scenery/waterfall`: 20 files, 197 tests pass (with
  `iwatsubame.test.ts`, 9 tests).
- No local e2e (CI runs it). `fauna-waterfall.spec.ts` picks the martins up from the roster.
- No shared file changed (`main.ts` untouched).

## Rows for the orchestrator
fauna.md › Creatures and behaviour:

| Kind (unlock id) | Behaviour |
|---|---|
| `iwatsubame` (waterfall: iwatsubame) | drifter by day (scheduled, not counted against the visitor cap), a loose flock of 3–7 (2–3 in reduced motion), gap 110–280 s, stay 70–150 s. Swirls in arcs along the cliff face (`cliffFace`: the ledges and the falls, inside the view) round a slowly drifting centre and down through the falls' spray, with now and then a tight loop; every 6–20 s one darts up under a ledge to its mud cup (`nestSites`: 1–3 cups under most ledges), clings 0.7–2.6 s and drops away (at most two at the cups). Rolls edge-on in hard turns and comes out showing its dark back and white rump (70 %) or its pale underside. Leaves one by one at the end of its stay, and by itself at nightfall, up over the skyline. Plan view; wings and body apart so a beat foreshortens only the wings. |

fauna.md › Layers: `iwatsubame` (waterfall) flying, clinging at its cup and the cups → `air`.

TESTING matrix:

| C6.1 | The iwatsubame house martins: work the cliff face (the ledges and the falls, inside the view), never in the Japanese garden; cups just under the ledges' lips, the same for every flock; a visit swirls on the face, darts to the cups and clings exactly at one (at most two at once), drops away and leaves; scheduled by day in flocks of 3–7, not counted as visitors, gone at night; draws only on its own fork; deterministic; 2–3 slower birds in reduced motion that still reach the cups; swirls on the studio's falls stage | fauna/creatures/iwatsubame (all) | fauna-waterfall › every creature on the roster can be spawned…; › a busy pool renders cleanly and stays cheap (roster-driven) | ✔ |

Devlog index (`docs/devlog/README.md`):

| 90 | [C6: iwatsubame house martins](90-iwatsubame.md) | A loose flock of small blue-black martins with white rumps swirling along the cliff, darting up to mud cups under the ledges |

## Left open
- **The white rump at garden size**: at the overview a martin is about 15 px across, and the rump
  band is 2–3 px. It shows as a pale fleck on some birds, but "white rumps flashing" really reads only
  from a close view. A bigger rump would be untrue to the bird.
- **The cups come and go with the flock.** The creature world has no permanent scenery props, so the
  cups fade in when a flock arrives and out after it. A colony painted into the waterfall's ledges
  (scenery files) would be truer; the martins' `nestSites` could then read it.
- **Plan view only.** Edge-on is a narrowed plan sprite, not a true side view (no head-and-belly
  profile in a hard turn). It is quick on screen; a close view of a turn shows it.
- **Flock cohesion is loose by design** (shared centre, own waypoints). No separation between birds:
  two can cross over one another for a moment.
- **No spray interaction**: they fly through the spray's box, but there is no mist dimming or a
  splash of light on them there.
- **Phone**: small dark birds; the rump and the cups are not visible at that size.
- Cling is drawn on `air`, so a trailing plant hanging over a ledge's lip would pass behind a
  clinging bird. None of the current species trail that far.
- Sound (twittering calls at the colony): none (S15).
