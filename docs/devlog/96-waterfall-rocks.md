# 96 · S6b: the waterfall's rock forms

**Status: done**, with the open points below.

Index line for `docs/devlog/README.md`:

`| 96 | [S6b: the waterfall's rock forms](96-waterfall-rocks.md) | A stepped skyline and a jointed, opaque buttress flank; the rock reserved and clipped to its exact outline; ledges as rock shelves; the upper gorge as spurs receding into mist; a jointed cliff face | — |`

## What
- **Why the buttress was see-through.** A wash smooths its outline at a spacing set by its
  perimeter (perimeter / 24, `organicOutline`). For the whole cliff that is about 130 units, so the
  cliff's reserve and body wash were a rounded blob that cut inside the real outline. The flank
  showed the far ridge and the plain through that margin, and the sky plate hung 40 units over
  the flank as well. Both are fixed:
  - The rock is reserved with a full paper fill of a hand-cut outline (`roughOutline`: resampled
    every 4 units, nudged by noise). The cliff and buttress washes cover a rectangle clipped to
    that outline, so the edge is exactly where `CLIFF` says.
  - `plateSky()` hangs 4 units under the cliff, follows the buttress's right edge
    (`BUTTRESS_END`), then hangs 40 over the ridge. Each phase's base sky wash covers
    `openSky(48)`, so its smoothed edge falls under the plate's clip and leaves no paper at the steps.
- **Layout (`layout.ts`).** `SKYLINE` is broken rock. The crown steps down to the falls in blocks.
  The notch is raised to y 250–258 (the lip is 37–40 units below; the test allows 15–40). The
  buttress's crest steps up, and its flank steps down to the ridge in four jointed blocks of uneven
  size. `BUTTRESS_END` replaces the round lobe at (1040, 420)–(1030, 500), and `FAR_RIDGE` follows it.
  Slots, ledges, perches, `FALLS`, `POOL` and the light layout are unchanged. The crown slots stay
  within 30 units of the skyline, and every waterfall, daylight, fauna and falls test passes unchanged.
- **Buttress.** Alternating cool and warm block planes between the risers (`buttressSteps`). A dark
  rim under each tread. A broken sumi contour gives the flank a found edge on the sky and is lost
  at its foot. A joint drops from each riser's foot, cut by axe strokes (short slanted dry brush)
  on its shade side. The wet-in-wet no longer fades out toward the flank.
- **Ledges.** Each ledge is a bed's outcrop:
  - the bed runs on into the face either side;
  - a lit top, thickest in the middle;
  - a shaded front face under a slightly broken lip, with short joints;
  - an undercut in two or three soft pools with no edge darkening, dying into the face (this was
    the tray's visible lower edge);
  - a broken lip line, heavier on the shaded left;
  - moss in clusters with gaps, a few strands spilling down.

  The lip stays on `Ledge.edge`.
- **Gorge.** Seen from below, the river above the lip is hidden, so there is no river surface. The
  gorge is three spurs overlapping from either side ("deep distance"): the farthest is a cool haze
  whose top is the notch's skyline, then a shaded right spur and a lit left one. Each spur is
  clipped to its own hand-cut outline, with mist at its foot, a crease and beds on the near ones,
  and far trees.
- **Cliff face.** Joints drop under the strata beds. Some have the block's shaded side turning away
  from the light, so the face reads as bedded, jointed rock rather than stripes.
- Studio: `waterfall-rocks/gorge` and `/buttress` added. Hash pins updated in `rocks.test.ts`
  and `veg.test.ts` (the crown woods follow the skyline). The paint cache version changes.
- `src/main.ts` untouched. `src/ambience` and `src/scenery/types.ts` untouched.

## Looked at
All in `artifacts/rocks-b/` (gitignored). Each shot has 24 plants from `sprout.addPlants(24)`,
settled, with the light pinned. The shot script is `artifacts/rocks-b/shoot.mjs` (dev server on
5423, one viewport per run).
- Before: `r0-noon-1440x900.png`, `r0-sunset-1440x900.png`, `r0-night-1440x900.png`,
  `r0-close-1440x900.png` (buttress), `r0-ledges-1440x900.png`, `r0-sunset-390x844.png`,
  `r0-noon-390x844.png`.
- After: `final-noon-1440x900.png`, `final-sunset-1440x900.png`, `final-night-1440x900.png`,
  `final-close-1440x900.png`, `final-ledges-1440x900.png`, `final-gorge-1440x900.png`,
  `final-sunset-390x844.png`, `final-noon-390x844.png`.
- Rounds in between: `r1`–`r12` (r3: the margin found with a contrast-boosted crop,
  `r3-crop-studio-lobe.png`; r6/r7: the gorge's first two tries, a river "fan", dropped).
- What reads now:
  - The buttress is solid stone against the sky in every phase, including sunset on the phone.
  - Its flank steps down in blocks.
  - The ledges are pale shelves with moss whose shadow dies into the face.
  - The gorge shows receding spurs at a close view.

## Left open
- At the overview and on the phone the gorge is still small. It reads as a pale, misty notch, which
  is right for the distance, but it has little drama there.
- The left cliff's upper-left (x < 150) is a pale, smooth shoulder under the crown woods, where the
  body wash and the margin fade together.
- The buttress's crest (x 700–850) is a gentle dome under the woods. The woods hide it in the scene,
  but `waterfall-rocks/buttress` (no woods) shows it.
- `light.ts` still lays a soft ellipse of shade under each ledge in every phase. With the new
  undercut it adds little. It could go, or follow the ledge's pools.
- The joint shade strips on the left face can still line up a little like brickwork at close zoom.
- `docs/TESTING.md` S6.5 could name the new studio entries (`/gorge`, `/buttress`). It is outside
  this task's paths.
