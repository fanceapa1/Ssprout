# 205 · Blue rock thrush (GK5, phase 15)

## What
The coast's blue rock thrush (*Monticola solitarius*), kind `rock-thrush`, the `blue-rock-thrush`
row from GK0 (8 plants, announced). One male, alone, by day, on the coast's high stone.

- **Module** `src/fauna/creatures/rock-thrush.ts`, its line in `creatures/sets/creatures-coast.ts`
  (the only shared file touched: one import, one array entry). No contract change, no ADR.
- **Role:** a drifter by day (gap 150–360 s, stay 150–360 s, group 1, max 1; the spawn also refuses
  a second while one lives). Not counted against the visitor cap. Leaves by itself at nightfall.
- **Where:** `thrushPerches`: the temple (`ruin`, but not the fallen drum), the copings (`wall`) and
  the cliff-top and goat ledges (`ledge`). Higher perches are likelier (e^−(y − top)/140), the
  temple three times over, a ledge 0.15 (there are some sixty). Never a perch another creature holds.
- **Behaviour:** flies in from beyond the view, stands upright with its feet on the perch line and,
  act by act, stands still, flicks its tail up, bobs, turns, or sings a phrase (head up, the bill
  parts and opens in pulses with the throat full; the sound belongs to the sound bed). About once in
  20 s it drops in a steep dive to a spot below on the same plane (`dropSpot`: a walk, scrub, a
  lower ledge or the drum within 260 units, at a similar perspective scale, so a temple bird lands on
  the cliff top, not on the near terrace), snatches 0.6–1.4 s and flies straight back to the same
  perch. After 25–70 s it may move perch. A cat, goat or heron within 110 units sends it away low
  off the nearer side.
- **Paint** (`paintThrush`): an upright, slim thrush in one slate wash (#56647e, lighter crown and
  breast), faint scaling, darker wings and tail with pale fringes, a long straight dark bill drawn
  shut, parted and open (three body sprites for the song), dark legs; a level flight body with four
  wing frames. Male only.
- **Size:** `THRUSH_SIZE` 25 units (about 21 cm). The temple and cliff are far (scale 0.13), so
  the bird would be 3 units there; it is drawn at least at scale 0.45 (`minDraw`, about 3.5 × life,
  as the cicada) so it reads in the close view. Flight speed uses a floor of 0.4 for the same reason.
- **Studio:** `fauna-rock-thrush-close`: `poses` (standing, tail flicked, singing parted and open,
  the snatch, flight up/mid/down/glide) and `temple` (the real behaviour on the temple's crop).

## Looked at
`artifacts/gk5/`: `poses-crop` (first: plump and crow-like, the shut bill gaped at the tip, the
flight frames were the upright body turned bill-down); `poses2` (slimmer, the bill shut, level
flight bodies; reads as an upright slate thrush with a long bill); `scene2` (zoom 6 on the temple:
standing on the architrave, feet on the stone, but a 14 px speck at 2 × life); `scene3-crop` (after
`minDraw` 0.45: on a stone of the cliff top, feet on it, slate blue, upright, long bill).

## Bench
Production build, headless Chromium, 1440 × 900 at DPR 2, the coast at noon, 25 plants, the cat,
2 gulls, the heron, 3 bees, 2 butterflies spawned plus the schedule (cicadas, a tortoise, a goat);
`bench(60)` untimed, then `bench(120)` three times: without the thrush **2.87 / 2.18 / 2.06 ms**,
with it **2.02 / 2.06 / 1.91 ms**. No change inside the spread (three `drawImage`s perched). The
whole roster reads above the 1.5 ms budget on this machine under load (two other agents), with or
without the thrush; the cicada's run (devlog 201) read 1.1–1.4 with a smaller roster.

## Tests
`rock-thrush.test.ts`, 10 tests: high stone only, the temple most and higher likelier, never a held
perch, drop spots below on the same plane, not in the oasis; a visit (in, perch with feet on the
line, sing, flick, drop, ground, back to the same perch); one at a time; flees low from the cat and
is gone; leaves at night; deterministic; the song's bill pulses.

## Left open
- The song pose is small at the overview; the throat movement reads only in the studio.
- No female (brown, scaled); no sound (the sound bed's).
- The drop at the temple lands on the cliff-top ledges or the drum; there is no ground spot on the
  stylobate itself.
- Not checked: the bird on every wall coping in the painting (checked on the architrave and a
  cliff-top stone).

Status: done.
