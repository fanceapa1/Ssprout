# 215 · Coast perches on the painted wood, in view (GC2, phase 15)

## What
The coast's tree perches were placed from five centreline samples a limb, without the painting
(devlog 211 found them off the wood for every bird), and some perches lay where a wide window
never shows them (the owl sat at y 150 on the owner's 1470 × 750 laptop, which shows y 209–991).
Now the limb data is the painted wood, a tree perch is its limb's upper side, and every perch lies
where every landscape window shows it (ADR 0382). The owl's per-perch seats are gone.

## Census (before, close at the studio's `coast-wildlife/targets-olive`, `targets-pine`)
| Place | Before | On wood or stone | Off |
|---|---|---|---|
| Olive | 3 (`olive-fork`, `olive-limb-3-1`, `-3-2`) | 1 (`-3-2`, on the limb's middle line) | the fork on the trunk's face below the crotch; `-3-1` at the limb's lower edge |
| Leaning pine | 5 (`pine-branch-1-1`, `-4-1`, `-5-1`, `-8-1`, `-9-1`) | 0 | four in the left margin's fade (x 11–46.5), `-8-1` in the needles on no wood, `-9-1` past its twig's tapered end and above the wide window's top (y 152.5) |
| Cliff pines | 2 crowns | 2 | — |
| Copings | 26 | 23 | 3 at the walls' faded ends (x 1538–1564) |
| Jars, splash rocks, temple, caique | 2, 3, 4, 3 | all | — |
| Goat ledges | 92 | all (devlog 195) | — |

After: 133 perches. The olive keeps three, re-placed on its right scaffold limb's bare upper side
(the fork in the crotch where that limb leaves the trunk, and two along it); the pine keeps one,
on its lower limb's bare upper side (66.5, 355.9); the three faded copings are dropped.

## Why the old perches missed
- A chord's midpoint between five samples cuts inside a curved limb.
- The perch was the centreline, not the wood's top: feet in the middle of a 10-wide limb.
- The pine's sampled branches include twigs that taper to half a unit: the perch fell where the
  painting shows only needles.
- The olive's fork was the start of the middle scaffold limb, inside the trunk.

## Changes
- `shapes.ts`: `WoodPt` (a sample with half width `hw` and `leaves`); `OLIVE_LIMBS` (the trunk, the
  three scaffold limbs, the six boughs at least 2.5 thick), `PINE_TRUNK` and `PINE_BRANCHES` as
  nine samples a limb of the painted ribbon. Only these literals changed.
- `paint-veg.ts`: `treeWood()` derives them from the plans as painted (the olive's trunk outline,
  its scaffold limbs as the trunk painter's crotch ribbons, the boughs and the pine's branches as
  `visibleBranches` lays them, wobble included); `leaves` counts the olive leaves or pine tufts
  round a bird's body above each sample. `pineShapes()` now gives only the pads.
- `olive-paint.ts`: the crotch ribbons moved into `scaffoldLimbs` (same pixels) so the scenery
  reads the same wood the painter lays.
- `wildlife.ts`: `limbTop` (a sample lifted by its half width across the limb); a perch where the
  limb is 1.8+ thick (half width) and has at most 8 leaves round the body, the flattest samples 24
  apart; the fork is the flattest scaffold limb's upper side where it leaves the trunk. The bark
  bands now span 0.6 of the painted trunks' half width (the olive's used one stem 10 wide).
- `COAST_SEEN` (x 60–1530, y 240–985) and the filter on every perch but the goats' ledges.
- The owl: `SEATS` and `OWL_FRAME` gone; `seatOf` is the perch line (a coping keeps its 1 up onto
  the cap stones, by kind).
- The crescent: the olive's paper under the trunk was laid normal to the stem with the left and
  right widths swapped, while the trunk painter lays its flanks across: on the leaning trunk the
  paper stuck out above the trunk's top right of the crotch and down the left flank as white
  slivers. It now follows the body's own flanks at 0.85.
- Studio: `coast-wildlife/targets-olive` and `targets-pine`, the perch points and ids over the
  painting close.

## The view
The stage is 94 % of the window's height, 14 px margins aside, fitted by cover. Overview visible
rects (world units): 1470 × 750: y 209–991; 1440 × 900: y 41–1000; 1920 × 1080: y 141–1000;
1280 × 720: y 135–1000; 1366 × 768: y 137–1000 (all full width). The wide laptop is the
tightest; a bird 30 tall needs its perch at y ≥ 240. The side margins lift the painting to paper
over 200 units (more toward the bottom): at x 60 about 70 %. Phones in portrait crop the sides
instead (390 × 844: x 460–1060; 820 × 1180: x 403–1117): there most tree and coping perches are off
the overview. `w.view` is that rect and the cicada already prefers spots in it; the owl, the thrush
and the gull do not. Left open.

## Draw order in the trees
The olive and the pine are painted into the background, so a perched bird always draws over their
leaves. On the old perches this read wrong: the owl on `-3-1` floated over a leaf mass. The new
perches are on bare stretches (at most 8 leaves round the body), so nothing in the painting should
be in front of the bird there, and it reads as sitting on the limb. Foliage in front of a bird
deeper in a crown would need the scenery trees' leaves in a layer of their own drawn over
`entities` (a painting and layer contract change, not made).

## Looked at
Studio `coast-wildlife/targets-olive` and `targets-pine` before and after; the fork close at noon
before and after; the owl on the olive at night and on the pine branch, close; the thrush, the
gull and the cicada on their perches and bark, close; the overview's visible rect at seven window
sizes.

## Pins
`veg.test.ts` recording hash pins (the crescent): overview `89982a9f` → `11a3e672`, detail
`92bd176e` → `6644a587`. Perch counts in the tests held (`branch` ≥ 4: exactly 4 now).

## Tests
See the report below.

## Left open
- Portrait phones: creatures other than the cicada do not prefer perches in `w.view`.
- The pine has one perch; its other painted branches are steep, thin, in the needles or in the fade.
- Foliage never draws over a perched bird (layer change, above).

Status: done.
