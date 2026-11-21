# 209 · Damselfish shoal (GK11, phase 15)

## What
The coast's shoal: the Mediterranean damselfish (*Chromis chromis*), kind `damselfish`, the
`damselfish` row from GK0 (11 plants, announced: "A shoal of blue damselfish hovers in the shallows.").

- **Module** `src/fauna/creatures/damselfish.ts`, its line in `creatures/sets/creatures-coast.ts` (the
  only shared code file touched: one import, one array entry). Shared docs: a line each in
  `docs/systems/fauna.md` (the set's list, Layers, Creatures and behaviour), `docs/TESTING.md`
  (GK11.1) and `docs/devlog/README.md`. No contract change; `wildlife.ts` and
  `scenery/coast/fauna.ts` are untouched (the `shallows` region and the row were there).
- **One creature, the shoal** (`Shoal`), as the dolphins' pod: 12–20 fish (a hand spawn of 12–25
  sets the size). A resident by day: there from the garden's first frame, rising into view over
  3 s; `resident` 0 at night, when it sinks away seaward and fades (a hand-spawned shoal watches
  `w.mode.night` itself and goes too).
- **Where** (`shoalHomes`, cached per garden): centres on a 10-unit grid in the `shallows` region,
  in its deeper part at that column (10–55 % of the way from the turquoise's edge down to the
  waterline: over the turquoise, not over the pale sand by the foam), where the shoal's whole rim
  (fish, wander and their lift over their shadows) is in the region and 6 units off its rocks (the
  region's holes: splash rocks and shore boulders). The caique is outside the region (its top runs
  under the boat's box). Each home keeps the loosest spread it fits (1, 0.86, 0.73, 0.6, 0.48), so
  by the pine, the splash rock and between plants it hangs closer. Planted water plants are
  `w.pads` (the existing contract): homes within a pad's radius + 4 close (`openHomes`, cached per
  planting), and a plant planted under a hanging shoal sends it to the nearest open home. 176
  homes; with all six shallows slots planted, 94 left for peacock's tail, 39 for cystoseira and 0
  for posidonia (its pad radius is 60–70). With none left it hangs over the plants, as over a
  seagrass meadow, drawn under their sprites, rather than staying away from a garden whose row
  unlocked it. Studio `fauna-damselfish-close/homes` draws them over the
  painting.
- **Behaviour:** hangs in mid-water as one soft cloud (each fish holds a place in a sunflower
  spread with a slow wander and tiny corrections, all within 0.16 of one facing). The facing is
  always mostly along the shore: a turn (every 10–26 s, when it does not drift) goes about or a
  little aside and runs across the shoal from one side (0–0.7 s), each fish's flank catching the
  light while it turns. Drifts (55 %) 24–110 units along the shore on a straight line of homes at
  6 units/s × perspective. A gull (120) or the heron (150) passing over (y counted half: a bird
  high over the water is over it) tightens it to 0.42 of its spread and sinks it toward the bottom
  (depth 0.35 → 0.88: the fish soften, cool and fade, their shadows close in under them) until
  5–10 s after the bird has gone (the octopus, GK12, within 60 does the same: it landed during the rebase); a bird that stays 6 s sends it slipping away along the shore. A
  shadow from beyond the view (a gull high over, a boat's) does the same every 70–200 s for
  3–6 s. Then it loosens again over about 5 s.
- **Paint** (`paintDamselfish`, one `ArtCache` entry): from above and a little to the side (the
  terrace looks down on the cove), a blunt oval body: a dark blue-slate back bled into juvenile
  blue flanks, a faint bright line over each eye, small eyes, clear pectoral fins held out, the
  dorsal fin edge-on; a deeply forked tail with dark trailing edges, composed in three sweeps
  (`frames`) and softened as seen through clear water; cool blurred `deep` copies; a glint streak;
  one dappled shadow for the whole shoal (small fish-shaped smudges, blurred), drawn on the bed at
  its spread. Drawing keeps a fish's body width and foreshortens only its length (a fish nose-on
  to the viewer reads as a dot, which is why the facing stays along the shore). On `underwater`,
  so the swell marks, the mirrored sky and the light plates lie over it and every plant sprite
  draws over it. One `drawImage` a fish plus the shadow (two for a fish while it turns, and for
  some while it sinks); one transform per sprite, no `save`.
  `DAMSELFISH_LEN` 16 units (about 1.4 × a 10 cm adult).
- **Studio** `fauna-damselfish-close` (`damselfish.studio.ts`): `loose`, `tight`, `turning`,
  `overview` (about the overview's scale), `sunset` (a warm multiply standing in for the light
  plate), `fish` (one fish's frames, deep copy, glint and shadow) and `homes`. The def's `sheet`
  and `show` give `fauna-damselfish/parts` and `/alive`.

## Why
- **A resident by day, not a visitor:** damselfish are always over the rocks by day; the arrival
  line says it hovers there. One creature keeps the frame cost small and the arrival said once.
- **Homes of its own inside the region:** the region is all the water nearer the shore than the
  turquoise's edge, pale sand included; a shoal of these fish hangs in deeper water. The band and
  the rim check keep it there without widening the places contract (no seabed, seagrass or depth
  is in it; the fish cannot read `sea.ts`).
- **No boat shadow:** nothing moves a boat over the cove (the caique is moored and only rocks), so
  "a boat's shadow" is the occasional shadow from beyond the view.
- **Juvenile blue, as the research doc says** (§13 "Choose juvenile blue for the shoal"); seen from
  above the backs read dark, with the blue in the flanks. Adults would be dark brown-grey.
- **No ADR:** nothing here binds other code.

## Looked at
Production build, the coast with 12 plants, `fauna.step(25)` (rounds in the scratchpad, deleted as
they were replaced):
1. Round 1: the fish read as slim grey-blue arrows, crisp, on top of the water (the sprite was
   squashed with the sea plane, which also squashed the body's width).
2. Round 2: drawn keeping the width (only the length foreshortens), a wider body, softened copies,
   darker blue: oval fish with forks, their shadows under them on the sand. At the overview some
   faced the viewer and read as tadpoles: turns and drifts now keep the facing along the shore.
3. Round 3: noon overview (desktop and phone), the close view, sunset (dark fish in the warm sea),
   night (the shoal goes after nightfall: one at noon, `leave` 2 s into the night, none after
   27 s). A swell mark crosses a fish in the close view and reads over it.
4. `homes` over the painting: the lowest homes' rims dipped into the pale sand; the band's foot
   moved from 62 % to 55 %.
5. A bench at 48 plants found no shoal: all six shallows slots held water plants whose pads left
   no home (see Where). Then per-fish shadows were found to cost most of the frame (Bench) and
   became one shadow for the shoal; the studio showed it as a flat disc at first (a base wash
   under the smudges, removed), and the turning glint ran past the head (a dab runs from its point;
   moved back).

## Bench
Production build, headless Chromium, 1440 × 900 at DPR 2, the coast at noon, the overview,
`step(60)`; `bench(60)` untimed, then `bench(120)` per reading. Another agent was running (load
average 2.6–4.8), so readings between page loads differ more than the shoal does.
- **The clean comparison** (a local build with a switch that skips only the shoal's drawing, the
  same page and roster, 12 plants, alternating on / off four times, two page loads):
  - first version (a shadow per fish): on **1.12 / 1.11 / 1.17**, off **0.41 / 0.39 / 0.36 ms**;
    of the 0.7 ms, about 0.5 was the shadows (no shadows: 0.46–0.75) and 0.1–0.2 the clip of
    the water layer (one sprite alone: 0.50–0.62);
  - final (one shadow for the shoal): on **0.70 / 0.75 / 0.82 / 0.74**, off **0.35 / 0.40 / 0.40 /
    0.62 ms**; second load on **0.55 / 0.51 / 0.50 / 0.50**, off **0.36 / 0.35 / 0.41 / 0.37 ms**.
    So the shoal costs about **0.15–0.35 ms** a frame; with the roster the whole stays at
    0.5–0.8 ms, inside the 1.5 ms budget.
- **Without and with, as the checklist asks** (10 plants, no damselfish row; then
  `spawn('damselfish')`, `step(8)`; final drawing; three loads): without **0.76 / 0.58 / 0.56**,
  **0.55 / 0.57 / 0.59**, **0.37 / 0.35 / 0.38 ms**; with **0.47 / 0.52 / 0.52**, **0.91 / 0.93 /
  0.89**, **0.32 / 0.38 / 0.29 ms**. The rosters change between the two halves (drifters come and
  go), which is why the switch above was needed.
- The homes are found once per garden, about 15 ms in a cold unit test (a frame on the coast's first
  load); each later check is a few `roomAt` calls every 2 s.

## Tests
`src/fauna/creatures/damselfish.test.ts`, 15 tests (homes in the shallows only, none in the oasis;
homes close under planted water plants, and it hangs over them when they fill the shallows; one creature of 12–25 fish rising into view; 15 simulated
minutes for six seeds with and without water plants and with gulls, every fish in clear water;
one cloud facing one way along the shore; drifts along the shore, slowly, and turns as one;
tightens and sinks for a gull or the heron and loosens again; slips away from a gull that stays;
shadows from beyond the view now and then; day only and back by day; a hand-spawned shoal goes at
nightfall; deterministic; draw calls).

## Left open
- **Research:** *Chromis chromis* stays marked *(verify)* in the research doc (its range in the
  Ionian shallows, and a shoal of juveniles in a cove this shallow, were not checked against a
  source). The arrival line ("A shoal of blue damselfish hovers in the shallows.") fits the
  juvenile blue painted; from above the fish read dark navy with blue flanks rather than bright
  electric blue.
- **No seabed in the places:** it cannot prefer the seagrass edge or the rocks under water.
- **One painting for every fish:** size and depth vary, colour does not (no brown adults).
- **One shadow for the shoal:** close up it is a dappled cloud under the fish, not each fish's own
  shadow; per-fish shadows cost about 0.5 ms a frame.
- **Cost:** 0.15–0.35 ms a frame is the most of any coast creature; drawing the shoal into a
  cache every second frame measured about 0.3 ms less with per-fish shadows and was not kept.

Status: done.
