# 189 · Yellow-legged gull (GK2, phase 15)

## What
The coast's second own creature: the yellow-legged gull (*Larus michahellis*), kind `gull`, the
`gull` row from GK0 (1 plant, announced). One bird for long spells, now and then a second, by day.

- **Module** `src/fauna/creatures/gull.ts`, its line in `creatures/sets/creatures-coast.ts`. No
  contract change; `wildlife.ts` is untouched (every place it needed was there).
- **Role:** a drifter (scheduled, not counted against the visitor cap, like the iwatsubame): gap
  260–520 s, first 10–40 s, stay 220–440 s, one a visit, at most two at once. Over three simulated
  hours it is there most of the time and two are about now and then. A drifter is not sent away at
  nightfall by the sim, so the gull watches `w.mode.night` and its stay itself.
- **Places,** read by name: the caique's `boat` perches (mast top, two rails: it rides the carrier,
  drawn where `carried` puts the perch and tilted with the boat), the `rock` and `ruin` perches where
  its whole body clears every planting slot (`standX`: half a length either side of its feet and its
  height above; at the coast that leaves `rock-4`, the architrave, the two broken columns and the
  drum: the other splash rocks carry a slot under a gull's body), and the water (`floatSpots`: the
  `shallows` region on a 12-unit grid, 14 in from its edge, 18 off its rocks, 58 from every slot and
  heron stand; 86 spots). It circles inside `sky-cove` (`soarCircle`). An arrival takes the mast top
  first when it is free and in view (75 %).
- **Behaviour:** stands 45–110 s (the first spell 70–150 s), floats 35–85 s: mostly still, a look
  about, a shift of the feet, preening the back or the breast, a wing and leg stretched down and
  back, a turn, and every 40–110 s the long call (bows, head thrown up with the bill open, brought
  down; silent). Flies on slow deep beats (2.3 a second, bursts of 2–5) and long glides (1.6–4.2 s);
  35 % of its flights first circle the cove 1–1.8 times on set wings; it glides in to land with the
  wings raised and the legs let down. Off the water it patters 1.1 s with a ring at each step.
  Afloat it drifts on the swell with a ring now and then. It leaves out over the sea.
- **Others:** it gives its `spot()`, so small birds keep off its perch through `heldSpots` (the
  existing mechanism). It never goes within 110 units of a heron and moves off when one comes that
  close; the heron is not changed. Nothing reacts to it otherwise, and it chases nothing.
- **Arrival line:** "A yellow-legged gull stands on the caique's mast." became "A yellow-legged gull
  glides in over the cove.": the line shows at first sight, while it is still flying, and it lands
  elsewhere when the mast is taken or out of the view.
- **Paint** (`paintGull`, 11 parts, one `ArtCache` entry): the white as an opaque white wash (the
  sea must not show through) with no edge darkening, turned by a cool blue-grey glaze under the
  belly and a warm touch above, broken cool touches along the belly; the mantle and folded wing one
  soft wet grey with a darker ridge, the tertials' white crescent, the crossed primaries crisp black
  with small white tips; a stout yellow bill with a paler hooked tip and a red gonys spot; a pale
  iris in a red ring that only shows close; a soft white neck under the body joining the head, so
  the call and the preen stretch it. Flight is a three-quarter view from below: both wings show,
  each an arm and a swept-back hand foreshortened apart (`wingsAt`: the hand trails the arm through
  the stroke; set wings make a shallow arch), an opaque white ground under their grey. Afloat it is
  one sprite cut at the waterline with a faint squashed reflection, painted once.
- **Scale:** `GULL_LEN` 70 units at perspective 1 (about 58 cm); drawn up to 1.4 × life when very
  far (`gullScale`, continuous) so the fleck on the mast top (about 9 units) still reads as a gull.
- **Determinism:** its own fork of `w.rng`; time from the sim. Reduced motion slows it through
  `w.speed`.
- **Studio:** `fauna-gull/alive` and `/parts` (the coast stage over the cove);
  `fauna-gull-close` (`gull.studio.ts`): `poses` (standing, looking, shifting, both preens, the
  stretch, the call bowing and thrown up, afloat), `flight` (eight frames of one beat), `glide`
  (gliding, soaring banked, braking to land, the patter), and the real behaviour on crops: `boat`,
  `rocks`, `temple`.

## Why
- **A drifter, not a visitor:** it stays for minutes and would hold one of three visitor places
  most of the day. Not a resident either: it comes and goes, and a second one comes now and then.
- **The body's footprint, not the perch point:** the coast's perches keep 20 units off a slot,
  enough for a wagtail, not for a bird 66 units long on a splash rock beside a planted slot.
- **The shallows for floating, not the open sea:** the open water between the shallows and the bay
  has two scales (the land's `perspectiveScale` and the sea plane's `seaScale`) that disagree by
  six times; the shallows are where the land's holds.
- **No ADR:** nothing here binds other code.

## Looked at
`artifacts/gk2/`:
1. `r1` (studio): it read as a gull at once, but the head was a disc sitting on the body, the white
   was grey with an outline, the stretched wing a grey slab, and the flying wings stacks of boxes
   pointing straight up and down.
2. `r2`, `r3`: wings rebuilt (a broader arm, the hand swept back from the wrist, tucked under it),
   larger glide foreshortening; then the wings were see-through (the body showed through the near
   wing): an opaque white ground under them. A neck sprite; the stretch turned back along the tail.
3. In the app (dev server, then the production build): `a1`–`a3`, `f1`, `f2`: overview at noon
   with 25 plants (one gull on the mast top, one on `rock-4`, then two on the boat); the mast gull
   reads as a white bird with a grey back at about 12 px; the close view at 2.8× on `rock-4`; a
   flight strip over the shallows at 2.4×. The outline around the white went (no edge darkening);
   the neck moved under the body (it read as a bib).

**Bench** (production build, headless Chromium, 1440×900 at DPR 2, the coast with 25 plants,
`bench(120)` medians of five): the gull alone or two gulls with the cat 0.05–0.07 ms; two gulls
with the heron, or with butterflies and bees 0.08 ms; the whole roster without a gull 0.07 ms; the
whole roster with the gulls (cat ×2, gulls ×2, butterflies ×2, bee, heron) **0.83–0.97 ms**. A
gull flying, standing or afloat costs the same alone; the jump only comes with the whole roster
and was not pinned down (it looks like the canvas's image cache rather than a creature's work).
Within the 1.5 ms budget, but ten times the roster's cost without it: the first thing to look at
next.

## Tests
`src/fauna/creatures/gull.test.ts`, 15 tests (places by name and clear of the slots, float spots,
the soaring circle, choices off held spots and herons, only at the coast, three simulated hours,
riding the caique, nightfall, spot, moving off for a heron, fork and determinism, reduced motion,
the studio stage, draw calls, cost).

## Left open
- **The bench jump with the whole roster** (above).
- **The flying head and neck** still read as a ball on a collar close up; the inner wing is pale
  and a little flat.
- **The stretch** is one wing swung back as a whole; no fanned primaries.
- **No turn animation on the water:** a facing change squeezes the sprite through edge-on.
- **The legs are straight sticks**; no knee, no step when it shifts its feet, only a lift.
- **No juvenile** (mottled brown) variant.
- **Far scale:** the temple and the caique use the far measure, the flights between the near and
  the far places shrink linearly along the path, which is fast near the boat.
- **The flight strip** in the report caught a glide; the beat is in the studio's `flight` entry.

Status: done.
