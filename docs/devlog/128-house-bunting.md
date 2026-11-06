# 128 · House bunting (OK1, phase 13)

## What
The oasis's first creature: the house bunting (*Emberiza sahari*), kind `bunting`. It is the
`house-bunting` row from OK0, always unlocked and unannounced.

- **Module** `src/fauna/creatures/bunting.ts`, found by the registry glob. Nothing else changed:
  `src/main.ts` and the shared docs are not touched.
- **Role:** a resident pair by day, a cock and a hen (`resident: 2`, 0 at night). At nightfall the
  sim asks them to leave. Each one finishes its act, then flies off the view. In the morning they
  fly back in.
- **Where:** `buntingPerches(w)` returns the `wall`, `rim` and `rock` perches (OK0): 14 copings,
  9 rim stretches and 5 stones. `choosePerch` picks a free perch inside the view (40 units in),
  nearer ones likelier (`reach` 240) and stones a little less likely. It falls back to any free
  perch, and returns null when every perch is held.
  - A perch counts as held when another creature's `spot()`/`perchPoint()` (the `heldSpots`
    helper from C8b) is within its spread plus 12 units.
  - The bird's own `spot()` is its perch, or the perch it is flying to.
  - `needs` asks for a `wall` or `rim` perch, so it never comes to the Japanese garden or the
    waterfall: their rocks alone are not enough. A hand spawn there returns nothing.
- **On a perch** it stands on `standY` (a stone's top sits `dome × 0.35` lower), at
  `p.scale ?? w.perspective(p.depth, p.x)`, depth `p.depth`, layer `entities`. One act after
  another:
  - **hops** 3–8 units along the spread, mostly the way it faces;
  - **pecks** 1–4 seeds, each a quick dip and a slower rise (`bobCurve`, the body leaning 0.62 rad
    about a mid-body pivot, the tail lifting a little with it);
  - **drinks**, only on the long rim stretches (22 % of acts there): 1–3 sips, each a lean down
    (`SIP_DOWN` 0.78), a hold, then the bill lifted (`SIP_UP` −0.38) to swallow (`sipPitch`);
  - **looks** about or **turns**;
  - and now and then a **tail flick**.

  After 7–20 s it dips to another perch.
- **Flight:** a short dip, a cubic that drops off the coping, sags 8–40 units across the gap and
  swings up onto the next perch.
  - It eases off the perch and slows into the landing.
  - Finch-like bounding: bursts of beats (up, mid, down, mid at 9 beats a second) lift it a
    little, and 1.9 times a second a shut-winged glide lets it sink. It never glides on take-off
    or landing.
  - The scale eases from the old perch's to the new one's. The feet's point is kept through the
    flight (the frames are drawn `LIFT` above it), so take-off and landing do not jump.
- **Paint**, about 14 cm (`BUNTING_SIZE` 17 world units; the sparrow is 19), in `paintBunting`:
  - **Body:** one wet-in-wet wash for the body and head, the grey hood (`#8a8c90`) bleeding into
    the cinnamon body (`#c98a52`) along a line from the nape to the breast. Shade (`#a8703e`) drops
    and a glaze darken the belly and rump; the glaze is lost before the hood, so the throat stays
    grey and never reads as a bib.
  - **Head:** about 23 fine dark streaks (`#55555c`) over the crown, nape and throat, a faint pale
    brow and moustache, and a darker line through the eye.
  - **Light:** a lighter wash over the mantle and crown.
  - **Folded wing:** plain rufous wet-in-wet, softly darker feather centres, broken warm edges and
    dusky primary tips. No wing bars, no white.
  - **Tail:** long and slightly notched, rufous at the root into dark brown.
  - **Bill:** conical, a dark upper mandible over a yellow-orange lower one.
  - **Eye:** a soft socket, the iris and a catch-light.
  - **Legs:** slender and pinkish, three toes forward and one back, the far leg greyer.
  - **Flight frames:** up, mid (the far wing a pale blur), down and a glide, with the tail spread
    and the feet tucked.
  - **The hen** is duller: a brownish-grey hood (`#9c9288`), fainter streaks, a sandier body
    (`#c49c74`).
- **Determinism:** each spawn forks `w.rng` (`bunting:<seed>:<t>:<index>:<count>`), and each bird
  draws only on its own fork.
- **Reduced motion:** everything runs at `w.speed` (0.6): slower flights and slower acts. It still
  hops, pecks and dips.
- **Studio:**
  - `fauna-bunting/alive` (`show`): the oasis stage cropped to the middle wall's end, the stones,
    the basin's left corner and the near rim (x 330, y 450, 480 × 270), a pair.
  - `fauna-bunting/parts`: the sheet.
  - `src/fauna/creatures/bunting.studio.ts`, **Fauna · house bunting, close**:
    - `poses`: perched, peck, sip, swallow, flick, the hen, and the four flight frames, close and at
      garden size;
    - `on-wall`: a pair alive on a tight crop of the middle wall's coping, the stones and the
      basin's corner.
  - The bunting also appears in `fauna-oasis/all`.

## Why
- **A pair, resident:** the research has it breeding round houses and tame. A pair, cock and hen,
  gives the oasis a steady small life and shows both plumages. It is the only bird there from the
  first plant.
- **Perches inside the view first:** the phone crop (x 430–1030) holds only the rim and the
  basin's stones. Without this rule the pair spent much of its time on the far walls, off the
  screen.
- **The hood in the same wash as the body:** in round 1 the grey was laid over the cinnamon, and
  the multiply turned the head muddy brown. In one wet-in-wet wash the hood stays a clean cool
  grey and bleeds softly into the breast.
- **Pecks pivot mid-body:** in round 2, rotating about the feet tipped the bird nose-first off its
  legs.
- **No song:** the sound bed (O7) plans its bunting phrases internally. Nothing is exposed that the
  fauna could follow, and wiring one would touch `src/audio` and `src/main.ts`.

## Looked at
`artifacts/ok1-bunting/` (1440×900 unless named):
- `r1-parts`, `r1-alive`. **What was wrong:**
  - the hood read as muddy brown (grey multiplied over cinnamon);
  - the body was a round sparrow ball;
  - the tail was a long square plank;
  - the folded wing looked like a pasted leaf.
- `r2-poses`, `r2-onwall`. The hood now read grey. **What was wrong:**
  - the legs hung below a gap under the belly, like a wader's;
  - peck and sip tipped the bird off its feet;
  - the tail was a stick stuck into the rump in the flight frames.
- `r3-poses`, with crops. **What was wrong:**
  - the tail stayed level and grey while the body leaned;
  - the tucked feet floated under the belly in flight;
  - the throat darkened towards a bib.

  All fixed: `r7-poses` shows the tail lifting with the lean, a grey throat with no bib, and the
  feet tucked against the belly.
- `r4-app-overview`: the pair on the high and middle walls' copings, small (about 10 px) but
  bird-shaped. A bird on `wall-high-1` (x 10) sat in the vignette, so perches must now be 40 units
  inside the view.
- `r4-app-close`, `r5-app-close`: in flight across the walls (wing-up and glide frames). Against
  the pisé the cinnamon nearly disappears, as the research says it should, and the grey hood
  carries it.
- `r6-close-rim`: a close view on the basin's left corner. The cock pecks on a stone, its feet on
  the stone's top. The hen stands on the near rim's coping with the water behind her.
- `r6-sunset-close`: both birds on the near rim under the sunset grade. The cock's grey head still
  reads; the hen's hood goes warm grey-brown.
- `r6-phone-390x844`: the portrait view. The pair is on the far and near rim, both in view; they
  are specks at the overview's scale.

## Bench
With the oasis's whole roster spawned (25 plants: striders, the bunting pair plus one more,
leaf, butterfly, bee, heron; 11 creatures), on the dev server under `nice -n 19`:
`sprout.fauna.bench(120)` gives update 0.73 ms + draw 0.17 ms = **0.90 ms a frame**. The pair's
own update is under 0.05 ms a frame (unit test).

## Tests
`src/fauna/creatures/bunting.test.ts`:
- its perches are only walls, rim and stones, never in the water;
- held perches are never taken, and it gets null when all are held;
- it picks perches in view on a phone view;
- the peck and sip curves;
- it never comes to the Japanese garden or the waterfall;
- 900 s at the oasis: always two by day, a cock and a hen. Every act shows up (hop, peck, drink,
  look), more than 30 dips, never off its perch or below it, never in the water, never two on one
  perch;
- with stand-ins holding every perch but three, it only ever stands on those three;
- gone at night, back in the morning;
- it draws only on its own fork;
- deterministic;
- in reduced motion it flies slower and still dips and pecks;
- it stays in view on both studio stages;
- cost.

`tests/e2e/fauna-oasis.spec.ts` (not run locally, CI runs it):
- the oasis roster has striders and the pair by day, and none at night;
- every creature on the roster can be spawned and stays in the world, and buntings keep out of
  the water;
- a busy oasis renders and stays under the CI bench bound.

## Left open
- **Song:** no puffed-throat song. The sound bed's bunting phrases are planned inside
  `src/audio` with no event out. If the planner ever emits one (an `audio:event` on the bus), the
  bird could puff its throat in time.
- **Size at the overview:** at the oasis's overview the bird is 8–12 px, and on a phone a speck.
  That is true to a 14 cm bird, but it only really reads in a close view.
- **The far rim and the side copings:** on the far rim's sliver (0.73) it stands on a thin pale
  line, which is right but hard to see. The side copings (`rim-left`, `rim-right`) are steep and
  5 units wide, so it only pecks and looks there, never hops.
- **No ksar window slits** (OK0: too small at `KSAR_SCALE`), and no plot edges. The research
  lists plot edges, but the bird has no ground walk; it could take `w.ground` later.
- **Drinking** is a lean over the near or far coping, not a dip to the actual water surface (the
  basin's water is below and behind the coping). It reads as drinking at the size it is seen.
- **Flight frames:** four drawn frames switching at 36 a second, with no in-between. At garden
  size they read as a flutter, and close up the up-frame wing is a plain rounded paddle.

Status: done.

## For the orchestrator to place
The devlog index line, the row for docs/systems/fauna.md › Creatures and behaviour (the oasis table already has `house-bunting`), the Layers line and the TESTING row:

`| 128 | [OK1: House bunting](128-house-bunting.md) | The oasis's resident pair (cock and duller hen) by day: hops along the wall copings, the basin rim and the stones, pecks seeds with small head-bobs, drinks at the rim with a lift of the bill, dips from wall to wall in bounding flight, keeps off held perches and stays in view; cinnamon body, grey streaked hood, plain rufous wings, no bib or bars | no song (no audio event to follow); a speck at the overview; no plot edges or ksar slits |`

`` | `bunting` (oasis: house-bunting) | resident pair by day (a cock and a duller hen; 0 at night: each finishes its act and flies off the view, and they fly back in the morning). Perches on the wall copings, the basin rim and the stones (`buntingPerches`: `wall`, `rim`, `rock`), a free one 40 units inside the view first, near ones likelier (`choosePerch`); never one another creature holds (`heldSpots` within its spread + 12). On a perch: hops 3–8 units, pecks 1–4 seeds with quick head-bobs, drinks at the long rim stretches (1–3 sips, a lean down and the bill lifted), looks, turns, flicks its tail; every 7–20 s a short dip to another perch, bounding (bursts of beats, shut-winged glides). Side view; cinnamon body, grey streaked hood, plain rufous wings, no bib or bars. | ``

`` - `bunting` (oasis) on a wall coping, the rim or a stone → `entities` (depth: the perch's); in flight, arriving and leaving → `air`. ``

`| OK1.1 | The house bunting: perches only on the walls, rim and stones, never in the water; keeps off held perches (none when all are held); perches in view on a phone view; peck and sip curves; never in the Japanese garden or the waterfall; a resident pair (cock and hen) by day that hops, pecks, drinks and dips, never off or below its perch, never two on one perch; only the free perches when others hold the rest; gone at night and back in the morning; draws only on its own fork; deterministic; slower in reduced motion and still active; stays in view on its studio stages; cheap | fauna/creatures/bunting (all) | fauna-oasis › a new oasis garden has striders…the bunting pair by day; › every creature on the roster can be spawned…; › a busy oasis renders cleanly and stays cheap | ✔ |`
