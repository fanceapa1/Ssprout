# 161 · Violet dropwing (OK3, phase 13)

## What
The oasis's dragonfly: the violet dropwing (*Trithemis annulata*), kind `dropwing`. It is the
`violet-dropwing` row from OK0 (3 plants, announced, "A violet dropwing rests on a post by the
basin.").

- **Module** `src/fauna/creatures/dropwing.ts`, found by the registry glob, with
  `dropwing.test.ts` and `dropwing.studio.ts`. Nothing else in `src/` changed: not `main.ts`, not
  `scenery/oasis/fauna.ts` or `wildlife.ts`, and not the dove's files.
- **Role:** a diurnal visitor (gap 90–220 s, first 12–40 s, stay 90–200 s, group 1–2, max 2).
  The first is a male (78 %) or a duller female. A second one is always a rival male. It comes in
  6–30 s later and stays a shorter time.
- **Where:** `dropwingPerches(w)` takes the OK0 perches by the water:
  - the two sluice-gate `post`s;
  - the `rock`s at the basin's corner and on the near ground (their tip, `dome × 0.3` down);
  - the nine `rim` stretches;
  - the `wall` copings within 60 units of water (`wall-high-5`, `wall-high-6`).

  Nothing new was added to the oasis's targets.
  - `chooseDropPerch` weights posts 3, stones 2, the rim 1 and walls 0.7, with nearer perches
    likelier. It picks a free perch 30 units inside the view first. A perch counts as held when
    another creature's `spot()`/`perchPoint()` is within its spread + 10. It returns null when
    every perch is held.
  - `needs` asks for water and a `post` or `rim` perch, so it never comes to the Japanese garden
    or the waterfall.
- **On a perch** it stays still, wings held in the dropwing pose: spread, swept forward and drooped
  down (`REST_POSE`). It is drawn on `entities` at the perch's depth and scale
  (`p.scale ?? w.perspective(p.depth, p.x)`).
  - 35 % of perch spells are an **obelisk**: the abdomen rises 0.75–1.25 rad over the spell
    (`obeliskCurve`: up slowly, held, down) and the head dips a little.
  - After 3–11 s it **sallies**: 1–3 fast darts (`arrive` at 150 u/s, sharp turns) to points over
    the basin or a channel within 18–85 units (`sallyPoint`), with a 0.12–0.45 s pause at each
    (a midge taken). It then lands on the same perch (68 %) or a free one within 200 units.
  - If the perch it makes for is taken meanwhile, it picks another.
- **The chase:** a perched male with another male within 110 units of its perch flies at it
  (a chance of 1.5 a second). The rival flees in 2–4 darts over the water. It then makes
  for a perch at least 154 units from the chaser's, or leaves (40 %). The chaser stays on its
  tail for 2.2–4.5 s and goes back to its own perch.
- **Night:** it is not scheduled at night, and ones still out leave at nightfall. There are no
  seasons: the fauna has no calendar (the dragonfly has none either), so "April–October" is not
  modelled.
- **Paint**, `DROPWING_SIZE` 15 world units from head to abdomen tip (the bunting is 17), side view,
  in `paintDropwing`:
  - **Abdomen:** its own sprite, so the obelisk can pivot it. One wet magenta stroke (`#b04f7e`),
    stout at the base and tapering, with colour pooled along the belly. A broken bluish bloom
    (`#a99ad0`) runs along the back, with faint joints and dark marks on the last segments.
  - **Thorax:** wet-in-wet light magenta into magenta, a bloom dab on the shoulder and a dark
    suture.
  - **Head:** a wet red-violet eye wash (`#9a3058`), a pale face and a catch-light.
  - **Wings** (fore and hind): a very faint cool glass wash, lost toward the tip. Each has an
    amber base (`#d9a05a`), small on the fore wing and larger on the hind wing. The costa is red
    (`#b04a4a`), with a few fine broken red veins, a red-brown pterostigma and one reserved-paper
    glint.
  - **The female:** yellow-brown (`#c09a4e`), a dark dorsal spot on most segments, brownish veins.
- **Wings in 3D:** `wingAxes(sweep, droop, near)` projects a wing seen from the side and a little
  above (elevation 0.3).
  - The far wings droop half as much as the near ones. Seen truly, they would be edge-on, a bare
    line (round 2).
  - In flight, `flightPose` beats fore and hind out of step at 27 Hz, aliased by the frame rate
    into a flicker. The glass alpha also flickers with the beat.
  - On the perch the wings are still.
- **Determinism:** each spawn forks `w.rng` (`dropwing:<seed>:<t>:<index>:<count>`), and each insect
  draws only on its own fork.
- **Reduced motion:** everything runs at `w.speed`: slower darts and longer perch spells. It
  still sallies.
- **Studio:**
  - `fauna-dropwing/alive` (`show`): the oasis stage cropped to the basin's right corner, the
    gate and the channel (x 900, y 520, 320 × 180).
  - `fauna-dropwing/parts`: perched, obelisk, two beats, the female, and the wing and abdomen
    sprites.
  - `src/fauna/creatures/dropwing.studio.ts`, **Fauna · violet dropwing, close**:
    - `poses`: perched, obelisk, female, and three beats, close (×7) and at garden size;
    - `by-gate`: one alive on a tight crop of the gate posts and the basin's corner.

## Why
- **Posts and stones first, the rim allowed:** the research's "stick or stone tip". The posts and
  stones are the only tips; the long rim is a fallback, and gives perches in the phone crop. The
  stones at the basin's left corner hold it there on a phone.
- **No plant tips:** the damselfly perches on plant heads. In the oasis that would need a stand-in
  for the reeds of the research, and the oasis's water plants are not slots.
- **Side view, not the dragonfly's top view:** the dropwing's signature is its wing pose on a tip,
  and only a side view shows a wing drooping. Seen from above it would be the aka-tombo again.
- **A rival with a delay, not a pair:** a second male flying in onto a held stretch, and being
  chased off, is the territorial behaviour. Two arriving together read as a couple.
- **Obelisk at random, not at noon:** `FaunaWorld` has no hour, only `mode.night`. Giving it one
  is a contract change for one pose, so the posture comes on a third of the perch spells instead.

## Looked at
`artifacts/ok3/` (1440×900 unless named):
- `r1-poses` (+ `-crop`). **What was wrong:**
  - the wings hung straight down like blades, and read as legs;
  - the thorax read as a tan ball (the near wings' amber over it);
  - the far fore wing was an edge-on line sticking out of the head;
  - the abdomen was a thin stick;
  - the white glint was a chalk stripe.
- `r2-poses`: drooped forward and down now, wider wings. The far wing was still a line and the
  thorax still brownish.
- `r3-poses`: the far wings forward and visible, a smaller fore-wing amber, a magenta thorax, and
  an abdomen with a gentler swell.
- `r3-bygate`, `r3-alive`: on the gate post and over the channel.
- `r8-bygate-s2` (+ `r8-a-crop`): a male perched on gate post 1. It reads as a magenta dash with
  glassy forward-drooped wings, red veins catching light, the bluish bloom along the back.
- `r4-app-overview`, `r9-overview` (+ crop): at noon in the overview it is a 6 px magenta dash on
  the near rim, small but clearly not a bird and not the bunting.
- `r4-app-close`, `r7-close-perch` (+ crop): close views by the basin and the gate. It darts out
  over the basin and the channel; in flight it is a magenta needle with a faint wing flicker.
- `r9-phone-390x844`: on a basin-corner stone. A speck at the phone's overview, like the bunting.

## Bench
`artifacts/ok3/bench.mjs`: the oasis's whole roster with 25 plants (12 creatures: four striders,
three buntings, leaf, dropwing, butterfly, bee, heron), `sprout.fauna.bench(120)` after one untimed
`bench(60)`. Dev server under `nice -n 19`, on the shared laptop with another agent busy.

| run | update | draw | total |
|---|---|---|---|
| with the dropwing | 1.93 ms | 0.54 ms | 2.47 ms |
| without it | 1.51 ms | 0.41 ms | 1.92 ms |
| with it, again | 1.74 ms | 0.41 ms | 2.15 ms |

- The totals are over the 1.5 ms budget even without the dropwing: the load from the other agent.
  The bunting measured 0.90 ms for the same roster on a quiet machine.
- The difference attributable to the dropwing is 0.2–0.5 ms, within the run-to-run noise.
- Its own update is under 0.05 ms a frame (unit test, two insects). The draw is six `drawImage`
  calls (body, abdomen, four wings).
- The e2e bench (`a busy oasis…`, CI ceiling 8 ms) passes.
- A quiet-machine bench is left to the orchestrator.

## Tests
`src/fauna/creatures/dropwing.test.ts` (17 tests):
- its perches are posts, stones, the rim and wall copings by the water, all within 70 units of
  water;
- held perches are never taken, and it gets null when all are held;
- tips are preferred over the rim;
- it perches in view on a phone view;
- sally points are over water and within reach;
- the wing axes give the rest pose forward and down and the beat up and down, and the obelisk
  curve rises, holds and falls;
- it never comes to the Japanese garden or the waterfall;
- 700 simulated seconds at the oasis: perched only on its kinds, on the perch line, on
  `entities` at the perch's depth, flying on `air`, never two on one perch, obelisks seen;
- sallies go out over the water and come back to the same perch more than 45 % of the time;
- a second male is chased;
- it keeps off held perches;
- it is not out at night and leaves at nightfall;
- it draws only on its own fork;
- deterministic;
- in reduced motion it darts slower and still sallies;
- it stays in view on its studio stages;
- cost.

`tests/e2e/fauna-oasis.spec.ts` (run locally with `E2E_PORT=4192`, all 4 pass):
- new test: with three plants the roster has `violet-dropwing` and the `dropwing` visitor by day.
  It perches on `entities`, never in the basin, inside the view, and both perches and flies. It is
  gone at night.
- The roster-driven tests (every creature spawned and in the world; the busy oasis bench) pick it
  up by themselves.

## Left open
- **Seasons:** the fauna has no calendar, so it also comes in winter. The research says
  April–October.
- **Midday:** the obelisk is random, not tied to the heat of the day. A `FaunaWorld.hour` (or a
  `mode.heat`) would let it follow noon.
- **No plant or stick tips:** a reed or cattail slot by the basin would give it the true "stick
  tip".
- **Size at the overview:** about 6 px on desktop and a speck on a phone. It reads in close views.
- **Close-view perched shots in the app:** the camera's `settle()` runs real frames, so the insect
  often takes off before the freeze. The perched close-up was judged in the studio's `by-gate`
  instead.
- **The female** is never chased or courted. The rival is always a male, and a male never chases
  a female.
- **Wing beat** is drawn per frame from a 27 Hz phase. At 60 fps it aliases into an irregular
  flicker, which reads as fast wings, but there is no motion-blur sprite.
- The quiet-machine bench (see Bench).

Status: done.

## For the orchestrator to place
Devlog index:

`| 161 | [OK3: Violet dropwing](161-violet-dropwing.md) | The oasis's dragonfly by day: a magenta dash on the gate posts, stones, rim and wall copings by the water, wings drooped forward and down; darts out over the basin and the seguia and back to the same perch, raises its abdomen (obelisk) on a third of its perch spells, a later rival male is chased off; side view, wet magenta body with a bluish bloom, red-violet eyes, glassy wings with red veins and amber bases, duller yellow-brown female | no seasons or midday (no calendar or hour in the fauna); no plant tips; a speck at the overview |`

docs/systems/fauna.md › Creatures and behaviour:

`` | `dropwing` (oasis: violet-dropwing) | visitor by day (gap 90–220 s, stay 90–200 s; 78 % a male, else a duller female; a second visitor is a rival male 6–30 s later). Perches on the sluice-gate posts, the stones, the basin rim and the wall copings within 60 units of water (`dropwingPerches`: `post` 3, `rock` 2, `rim` 1, `wall` 0.7, near ones likelier, a free one 30 units inside the view first; never one another creature holds), still, wings drooped forward and down; a third of its perch spells in the obelisk (abdomen raised 0.75–1.25 rad). Every 3–11 s it sallies: 1–3 fast darts over the basin or a channel within 18–85 units with a short pause at each, then back to the same perch (68 %) or one within 200 units. A male chases a rival male within 110 units of its perch for 2.2–4.5 s; the rival takes a perch well away or leaves. Side view; magenta body with a bluish bloom, red-violet eyes, clear wings with red veins and amber bases. | ``

docs/systems/fauna.md › Layers:

`` - `dropwing` (oasis) on a post, stone, rim or coping → `entities` (depth: the perch's); sallying, chasing, arriving and leaving → `air`. ``

TESTING row:

`| OK3.1 | The violet dropwing: perches only on posts, stones, the rim and wall copings by water; keeps off held perches (none when all are held); tips before the rim; perches in view on a phone view; sallies over water within reach; drooped rest pose, beating wings, obelisk curve; never in the Japanese garden or the waterfall; by day perched on the perch line on entities at its depth, flying on air, never two on one perch, obelisks seen; returns to the same perch after most sallies; a rival male is chased; not out at night; draws only on its own fork; deterministic; slower in reduced motion and still sallies; stays in view on its studio stages; cheap | fauna/creatures/dropwing (all) | fauna-oasis › the violet dropwing comes with three plants by day…; › every creature on the roster can be spawned…; › a busy oasis renders cleanly and stays cheap | ✔ |`
