# 81 · Mizubashō (W7)

## What
A new tier-2 species for the rocky waterfall: **mizubashō** (Asian skunk cabbage, *Lysichiton
camtschatcensis*, ミズバショウ). It adds files only, plus one id in a test list:
- `src/plants/species/mizubasho.ts`: the definition and the plan/draw (`planMizubasho`).
- `src/plants/lib/mizubasho-paint.ts`: new helpers `mapper` (unit outline onto a curved axis),
  `spatheShape`/`spathe` and `paddleShape`/`paddleLeaf`. No shared `lib/` helper was touched.
- `src/plants/species/mizubasho.test.ts`: `smallSuite('mizubasho')` plus two plan tests
  (habitats, size class and reflection; leaves and hood inside the box for 60 seeds).
- `src/plants/notes/mizubasho.ts`: the brief's note.
- `src/scenery/flora.test.ts`: `'mizubasho'` added at its sorted place in the waterfall's list.

Fields: tier 2, `medium` (120×160, anchor .5/.9), habitats `water` and `shore`, `bloomColor`
`#f7f3e6`, pollinators, nativeName "Mizubashō". `reflect` is left at its default (true for
water/shore). Range: realms `japan`, biomes `montane-stream` and `wetland`, climates
`cool-temperate`, no `cultivatedIn`. It is medium, so it takes `pool-3`/`pool-4` and never
competes with the lotus for the two large pool slots. The lotus, scenery and registry tests
still pass.

## How it is painted
- **Hood (spathe)**: one boat-shaped outline authored once in unit space (broadest at about 0.4,
  an acuminate tip with a slight hook) and mapped onto a curved axis, so its brush jitter stays
  the same at every growth. Painted in layers:
  1. reserved white (`petalWhite` toward pure white), four fills dried **source-over**, so it
     covers the leaves behind;
  2. a cool `#cac2d4` band down the flank away from the light, and a green flush graded up from
     the clasping foot;
  3. the hollow, a pale soft shade that is deepest under the overhanging hood;
  4. crisp blue-grey accents: the hood's front edge and the shadow the curled lip casts;
  5. the stubby `#c9c27a` club, a round dab with a pebbled lattice of tiny floret dabs and
     strong granulation;
  6. the curled margin laid over the edge of the hollow and the club;
  7. a faint pooled rim all round, and a stronger pooled stroke down the shaded flank;
  8. a few faint veins converging to the tip.
- **Leaves**: 3–5 paddle leaves in a vase behind the hood, each a winged petiole widening into an
  oblong blade with a blunt tip (`#8fae5e`, toward a deeper green). One wet layer each, dried
  source-over: a shaded half, faint pinnate veins clipped inside the blade, and a pale lifted
  midrib. In 70 % of seeds one outer leaf is shorter and painted in front. Leaf lengths are
  clamped so the blade, flank included, stays 54 to each side.
- **Water**: a celadon glaze where it stands, the feet lost in a second glaze, and two ripple
  lines parting round them. The app's reflection pipeline mirrors the sprite on pool slots.
- **Growth**: seed mound 0–0.16. The hood rises first, from 0.06: a slim, closed, white sail by
  0.3–0.4, green at the foot. It opens over 0.28–0.66 as the hollow widens from a slit and the
  green flush withdraws. The club swells 0.4–0.75. The leaves come after, from 0.32 to 1. Each
  rises as a rolled upright spike, then unrolls and leans out, middle leaves first and the outer
  ones last. Nothing appears at full size: the family continuity test passes.
- **Cost**: 12–17 ms at 1.6×, growth 1, seeds 1–8, measured on the main thread in headless
  Chromium under `nice`. That is inside 4–127 ms.

## Rounds
1. Sheet (growth × 6 seeds): the leaves were a wall of broad overlapping ovals that dwarfed the
   hood (a hosta with a calla in front). The hollow was a big flat lilac disc. A dark outline ran
   evenly round the hood. → Fewer, narrower leaves on longer petioles, a larger hood, a smaller
   and paler hollow, and the rim pooled on the shaded flank only.
2. Zoom: the white was see-through, so petioles showed through the hood. The hollow was an
   evenly outlined egg inside an egg. The florets were polka dots and the leaf mottle looked like
   camouflage. → An opaque reserve, the hollow shaded under the hood and the lip instead of
   outlined, finer florets, calmer mottle.
3. Close crop: the shade under the hood was a saturated violet dome, three parallel contours ran
   down the lip side, and vein hairs poked out past the leaf tips. → Blue-grey accents, a soft lip
   edge, veins clipped to the blade.
4. Waterfall close view: the hood read as a squat teardrop or onion dome. → A slimmer hood,
   broadest higher, with a longer tip above the opening. A pale green ball at its foot became a
   graded, ragged flush.
5. Garden set (noon, sunset, night, phone, flora line-up, studio stages): the leaves were a
   little acid and sticker-edged beside the scene's greens. → A deeper tone and a softer edge.

## Looked at
Scratchpad sheets (not in the repo): `r1-sheet`, `r2-sheet`, `r2-zoom`, `r3-zoom`, `r3-crop`,
`r4-crop`, `r5-wf`, `r5-close`, `r5-refl` (contrast-boosted reflection crop), `r6-sheet`,
`r7-crop`, `r8-sheet` (growth 0.3/0.6/1 × seeds 1–8). In `artifacts/shots/`:
- overview, noon: `mizubasho-r1-wf-1440x900.png`
- close view (`pool-4` with `pool-3`, `bank-3`, `bank-4`), noon: `mizubasho-r1-close-1440x900.png`, `mizubasho-r2-close-1440x900.png`
- sunset close view: `mizubasho-r1-sunset-1440x900.png`
- night close view: `mizubasho-r1-night-1440x900.png`
- phone: `mizubasho-r1-phone-390x844.png`
- flora line-up: `mizubasho-r2-flora-1440x900.png`
- studio growth stages: `mizubasho-r2-growth-1440x900.png`

What reads well:
- At overview and phone size it is "a white sail standing in the shallows". No other waterfall
  species is white and upright, and it has no pads or petals, so it is unlike the water lily and
  the lotus.
- Close up, the pointed boat hood, the club in its shaded hollow and the paddle leaves on their
  petioles all read.
- On `pool-4` a soft celadon reflection of the leaves and the pale hood lies under it.
- At sunset the hood and the leaf edges take the warm rim light. At night the hoods stay as pale
  lavender sails above dark leaves.

## Tests
`npm run typecheck` passes. `VITEST_WORKERS=1 npx vitest run src/plants/species/mizubasho.test.ts
src/scenery/flora.test.ts`: 2 files, 24 tests pass. Also `src/scenery`,
`src/plants/species/lotus.test.ts` and `src/plants/registry`: 12 files, 124 tests pass. No local
e2e (the orchestrator runs it on CI).

## For the orchestrator to place
- **docs/systems/plants-species-a.md** › Species:
  `| \`mizubasho\` | Asian Skunk Cabbage · Mizubashō | 2 | water, shore | 120×160 · .5/.9 | \`#f7f3e6\` | yes | one upright pure-white boat-shaped spathe (reserved white, cool pooled shade, curled lip) round a stubby yellow-green club, standing in a celadon shallows glaze; fresh paddle leaves unroll behind it after the hood (waterfall only) |`
  and in the helper list: `mizubasho-paint.ts`: `mapper` (unit outline onto a curved axis),
  `spatheShape`/`spathe` (the white hood in reserve, shade, club, lip and rim layers),
  `paddleShape`/`paddleLeaf` (winged-petiole paddle blade, source-over, shaded half, clipped
  veins, lifted midrib).
- **docs/TESTING.md** matrix:
  `| W7.1 | Mizubashō: \`smallSuite\` (deterministic, seeded, grows continuously); water and shore, medium, reflects; leaves and hood inside the box; offered only at the waterfall | plants/species/mizubasho; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order**: `mizubasho` sorts after `maidenhair-fern`, so it is not `allSpecies()[0]`.
  It joins the tier 1–2 review boards, where later cards shift by one.

## Left open
- The hood's opening still reads a little like an arched niche: its top is a rounded arch, and
  the hood does not visibly curve forward over it in 3-D.
- The hood's shaded flank shows two or three close parallel lines (band edge, rim and pooled
  stroke). They read as a fold up close, but they could be fewer.
- The leaves are flat planes: none twists or shows its underside. At full growth they stay
  modest, not the huge summer leaves of the real plant, so the hood stays the signature.
- The seed mound is earth even on a water slot.
- The reflection was only checked on `pool-4` (faint but present). On the shore slots it was not
  checked.
- The paint time was measured on the main thread, not in the worker.
