# 160 · Laughing dove (OK2, phase 13)

## What
The oasis's second creature: the laughing dove (*Spilopelia senegalensis*), kind `dove`, the
`laughing-dove` row from OK0 (2 plants, announced). The sound bed already listens for
`oasis:laughing-dove` (devlog 126), so its coo now follows a dove in view.

- **Module** `src/fauna/creatures/dove.ts`, found by the registry glob. Nothing else changed.
- **Pacing:** a diurnal visitor, alone or a pair (`group` 1–2, `max` 2), gap 150–340 s, first
  visit 30–90 s, stay 90–170 s. It leaves at nightfall and is never scheduled at night.
- **Where** (`choosePlace`): the `frond`, `wall` and `rim` perches and the `w.ground` plots, by
  kind (fronds 0.36, walls 0.24, the rim to drink 0.2, the plots 0.2; each kind's weight shared
  among its options). It prefers places in view (on a phone: the basin's rims and the middle
  plot). It never takes a perch within 30 units of what another creature holds or is making
  for (`heldSpots`), and gives its own `spot()`, so the bunting keeps off it too. On a frond it
  draws at the perch's own `scale` (the palm's), elsewhere at `w.perspective`.
- **Behaviour:**
  - A pair comes in from one side of the view, the mate a little behind, and lands side by side
    (12 units apart at perspective 1) on the same perch, or a step apart on the same plot.
  - On a frond or a wall top: rests, looks about, turns, shuffles a few units (keeping by its
    mate), and bows and coos in bouts of 2–4 bows (breast down, head down, tail up). The mate
    often bows back a moment later.
  - On a plot: the nodding walk (the head thrusts forward, then holds still while the body
    catches up; the legs swing and lift), pecks in 1–3 dips, looks.
  - At the rim (`drinkPerches`: the near and far coping, not the steep side copings) it stands
    on the coping's water edge (`drinkY`), lowers its head into the water and holds it there
    3–6.5 s with small swallowing pulses, never tipping it back. Faint rings form at the bill.
  - The leader moves on every 10–24 s (16–32 s after arriving). It takes off with a clatter
    (0.65 s of deep, quick beats in a steep climb, the tail spread), then flies in bursts of beats
    between glides on bowed wings. It brakes into the landing with a flutter, body raised, legs
    down and the tail fanned (its white corners show). The mate follows 0.3–0.9 s later.
  - It leaves off the nearer side, the mate after it.
- **Paint** (about 25 cm: 30 units bill to tail at perspective 1, twice the bunting): a slim dove
  with a small pinkish-buff head, a pink breast fading to a cream belly, and a rufous back. The
  cinnamon neck patch is chequered with dark spots. The folded wing shows a blue-grey panel
  under rufous scapulars, with dark primaries. The long graduated tail has a dark band and white
  ends on the outer feathers, and broad white corners when it is spread. Pink legs, a dark eye
  and a slender bill. The plumage is soft feather dabs over wet-in-wet washes, with lost edges
  and broken ink touches, and a cool shadow under it on the ground and the stone. Parts: standing
  body, head, folded tail, fanned tail, leg, flying body, one wing (foreshortened through the
  beat, so flight is smooth), shadow. A frame draws 6–8 of them.
- **Determinism:** everything draws on `w.rng.fork('dove:…')`, then a fork per bird.
- **Reduced motion:** `w.speed` slows flight, walking, bows and drinking, and stretches the
  spells. It still comes, walks, drinks and flies.
- **Studio:**
  - `fauna-dove/alive` and `/parts` (the def's `show` on the oasis stage, a crop with the palms,
    the basin and a plot);
  - `fauna-dove-close` (`dove.studio.ts`): `poses` (rest, bow, three walk phases, peck, drinking,
    clatter up and down, glide, landing), and the real behaviour on close crops of the oasis
    painting: `palms`, `rim` and `plot`.
- **E2E:** `fauna-oasis.spec.ts` now keeps the dove, like the bunting, out of the basin and
  channels when it is on the ground.

## Why
- **Pairs as a leader and a follower.** One dove decides and the other follows a moment later.
  This keeps a pair together without shared state: it is just two creatures, each on its own
  fork, each with a `spot()`.
- **Drinking at the coping's water edge.** The basin is a deep tank. At the far rim the water
  starts just in front of the coping, so a side view with the head lowered over the edge reads
  as drinking. At the near rim the dove stands on the coping's inner edge. Side copings are left
  out: they run steeply to the vanishing point.
- **A choice weighted by kind,** so eleven fronds do not crowd out five plots and seven rims.

## Looked at
Rounds before the rebase are in `artifacts/ok2-dove/`; after it, in `artifacts/ok2/`.
1. `r1-parts`, `r1-alive-t30`: the folded tail read as a stick, the fan as a spiky star with
   cotton balls, and the flying body's neck spots as eyes. The wing sprite was clipped, and the
   dove was too small on the oasis stage to judge, so I added close crops.
2. `r2-poses`: it read as a dove already. But the tail's white end was on the wrong side (the
   offset sign was flipped), the head sat on the body like a ball, and the drinking head dropped
   far below the feet.
3. `r3-palms`, `r3-rim`, `r3-plot`: in context it reads as a laughing dove (pink head, chequered
   patch, blue-grey panel, white-tipped tail). But the wing panel's feather dabs read as polka
   dots, the toes floated under the legs, the pair on a frond overlapped into one bird, and on
   the plot nothing grounded it (no shadow).
4. `r4-rim-t8`, `r4-poses`: the drinkers' bills stopped on the coping instead of the water, so
   they now stand at its water edge. In flight the tail fan had no white corners.
   `r5b-poses`: corners added, first as black thorns and white balls, then as a dark band and
   white feather ends.
5. After the rebase, in the app (`artifacts/ok2/`):
   - `app-palms-1440x900`: a pair on a grove crown, close view;
   - `app-rim-1440x900`: a pair drinking side by side at the repainted far rim, bills in the
     water, the bunting on the near rim;
   - `app-sunset-1440x900`: the pair on the grove wall in the warm light;
   - `app-phone-390x844`: the pair on the far rim, in view;
   - `app-overview-1440x900`, `probe-frond-overview`: a speck at the overview, as the other
     birds are.

   A close view needs the dove to be there when the camera rests: `camera.settle()` lets real
   frames (and the sim) run, so look for a perched dove after the camera has settled.

**Bench** (production build, headless Chromium, 1440×900, the whole oasis roster with 25 plants:
striders, bunting pair, leaf, a dove pair, butterflies, bees, swallows, heron; 13 creatures):
`bench(120)` ×3 → **total 0.39–0.46 ms per frame** (update 0.01 ms, draw 0.37–0.44 ms), under
the 1.5 ms budget.

**Tests:** `src/fauna/creatures/dove.test.ts`, 15 tests. `npx tsc --noEmit` is clean.
`registry.test.ts`, `scenery/oasis/fauna.test.ts` and `tests/e2e/fauna-oasis.spec.ts`
(3 tests) pass after the rebase onto main.

## Left open
- **The new back beds** (`bed-1…4` behind the basin, devlog 137) are not in `w.ground`, so the
  dove does not walk them. Adding them is a change to `OASIS_GROUND` in
  `src/scenery/oasis/wildlife.ts`, which OK0 owns. The dove picks any `w.ground` spot, so they
  would join with no change here.
- **On a frond** the pair stands on the crown's top line. Its feet are among the leaves, but it
  can look as if it floats just in front of a dense crown. A frond-hugging stance (the toes
  curled round the rachis, a little of the crown painted over the feet) would seat it better.
- **No bowing display toward the mate** (a male inflating the neck to the female). The bow is a
  plain dip.
- **The coo** is the sound bed's. There is no event per bow for the audio to follow.
- **Drinking at the near rim** reads less well than at the far rim: the head goes down over the
  inner edge, seen side-on.
- **The pair can overlap** when both face the same way on a narrow frond. They read as two birds
  close, but a stranger may see one bird with two heads at a glance.
- **At the overview** it is a speck about 20 px long, as the bunting is.

Status: done.

## For the orchestrator to place
The devlog index line, the row for docs/systems/fauna.md › Creatures and behaviour (the oasis table
already has `laughing-dove`), the Layers line and the TESTING row:

`| 160 | [OK2: Laughing dove](160-laughing-dove.md) | The oasis's calm visitor by day, alone or a pair: sits and bows and coos on the palm fronds and wall tops, walks the plots with a nodding walk, drinks at the basin rim with its head held down, clatters off into a glide; keeps off held perches and stays in view; pinkish-buff head, chequered neck patch, blue-grey wing panel, rufous back, long white-cornered tail; 0.39–0.46 ms a frame with the whole roster |`

`` | `dove` (oasis: laughing-dove) | visitor by day, alone or a pair (group 1–2, gap 150–340 s, stay 90–170 s; leaves at nightfall). Settles on palm fronds (at the palm's `scale`), wall copings, the near and far basin rim to drink (`drinkPerches`), or a `w.ground` plot (`choosePlace`, weighted by kind, in view first), never within 30 units of a spot another creature holds (`heldSpots`); gives its own `spot()`. A pair comes in from one side and lands side by side; the leader moves on every 10–24 s and the mate follows. On a perch: rests, looks, shuffles, bows and coos in bouts (the mate bows back); on a plot: the nodding walk and pecks; at the rim: stands on the coping's water edge and holds its head down in the water 3–6.5 s (rings at the bill). Takes off with a clatter (deep quick beats, steep climb), flies in bursts and bowed-wing glides, lands with a flutter, tail fanned. Side view; pinkish-buff head, chequered cinnamon neck patch, blue-grey wing panel, rufous back, white-cornered tail. | ``

`` - `dove` (oasis) on a frond, a wall coping, the rim or a plot → `entities` (depth: the perch's + 0.5, or its feet y + 0.5 on a plot); arriving, between places and leaving → `air`. ``

`| OK2.1 | The laughing dove: perches only on fronds, walls and the rim, drinks only at the near and far rims at the water's edge, settles inside its perch or plot, keeps off held perches and gives its spot, in view on a phone view, never in the Japanese garden or the waterfall; a pair comes, sits together, bows, walks, drinks, clatters off and leaves; diurnal visitor of 1–2, gone at night; draws only on its own fork; deterministic; slower in reduced motion and still active; lives on its studio stage; a handful of parts per frame and a cheap update | fauna/creatures/dove (all) | fauna-oasis › every creature on the roster can be spawned…the bunting and the dove keep out of the basin; › a busy oasis renders cleanly and stays cheap | ✔ |`
