# 190 · Coast pines, the cliff-top slot and the beds (G4b)

## What
A polish pass on the coast's scenery (phase 15, `?dev&scenery=coast`):
1. **The left-edge pine is the `aleppo-pine` species' tree** (ADR 0380).
   - Planned with `planAleppoPine(101, { lean: -1 })` at growth 1 and drawn at 1.9× its box.
   - Its foot moved from (30, 770) to (166, 762), on a low rock on the beach, with its shadow cast
     right. The side branches below the fork are pruned with their needles and cones.
   - The species paints the skeleton (silver) and its red bark. The scenery adds paper under the
     trunk and an accent on the lower trunk: red washes, a shaded right flank and scaly plates.
   - The crown is the species' cloud washes, cones and needles, in thirds. The marks are painted
     in world units at 1.3× the species' size, so the clouds stay fine with sky between them.
   - It leans out over the left edge, not in over the cove. A foot this far in, leaning right,
     would put the trunk across the village. Leaning left, the trunk climbs past the village's left
     end and the crown frames the corner, under the shared stars and off the chapel.
2. **The far pines on the promontory's back** are seven small Aleppo pines of varied height
   (30–64) and lean (−0.22…0.3), a few strokes each:
   - a slender stem forking into two to four limbs;
   - a pale flat needle cloud at each tip, with sky between;
   - a lit fringe of needle flicks on top;
   - hazier toward the temple.

   `PROMONTORY_PINE_SHAPES` carries their trunk, limbs and clouds, and the painter reads it.
3. **`scrub-1` moved from (1580, 512) to the cliff top at (1468, 306)**, right of the olive.
   - Its 1.25× box lies inside the 16:9 frame (x 1338–1598, y 6–306). Its trunk stands 87 right of
     the olive's farthest limb point, and its crown sits above the olive's crown.
   - Its ground is a pocket of soil with straw tufts either side, and no maquis on its foot
     (`CLIFF_TOP_SLOT`).
   - It stands at `perspectiveScale` (0.55), no lift. It is the one slot allowed on the promontory,
     just under its edge (the slot test's exception).
   - The far pines keep 100+ from it.
4. **The empty beds** are each dug by hand:
   - their back edge wanders (1.2–3.2 units over 28–52) and swells or sags a little;
   - one end is fuller than the other;
   - the soil is a little warmer or greyer at 0.36–0.46 opacity;
   - the furrows run at the bed's own spacing and tilt, and about half are broken once.

   The ground under the bed slots stays mid-toned.

Also: `shallows-5` moved from (140, 640) to (188, 650), on its sand window right of the trunk.
The night's extra stars keep off `PINE_PADS`. The far-pine perches now sit on each pine's highest
cloud, off the slots.

## Shapes other code reads
- `PINE_TRUNK` (8 points, foot to top), `PINE_BRANCHES` (10 limbs and big branches) and `PINE_PADS`
  (12 clouds in the frame) are literals generated from `pineShapes()`. `veg.test.ts` checks that
  they equal it. `PINE` is (166, 762) → (51, 218).
- `PROMONTORY_PINE_SHAPES` gained `limbs` and `clouds`. `x, y, rx, ry` are the crown's box, and
  `trunk[0]` is the foot.
- Perches: 55 (was 54). Five `pine-branch-*` and two `pine-crown-*` (952 and 997). The others are
  behind the olive or past x 1590. The regions `shallows`, `bay`, `sky-cove` and `bark-pine`
  follow the new trunk and pads by themselves.

## Cost
Measured in headless Chromium against the dev server: `paintSceneSync` of the whole coast at the
overview (scale 0.9, DPR 1), five warm runs, main and this branch one after the other, load
22–26 (other agents running). Medians of the five runs, ms, with the longest part:

| step | main | this branch |
|---|---|---|
| land | 253 (14.7) | 245 (14.6) |
| beds | 101 (6.3) | 99 (6.3) |
| maquis | 161 (9.9) | 161 (9.8) |
| olive | 60 (11.7) | 60 (11.0) |
| pine | 79 (9.8) | 72 (20.4) |
| whole coast | 2151 | 2042 |

- No added cost: the pine is a little cheaper, and the maquis (far pines plus the soil pocket) and
  the beds are level. An earlier branch run at load 21 gave the same steps within 6 ms.
- **The longest part is the pine's skeleton or bark at 17–20 ms warm** (28 ms on the first, cold
  run). On main the pine's longest part was 10 ms. These are one call each of the species' painters
  (`paintSkeleton`, `paintPineBark`), so they cannot be split without changing the tree. Under this
  load the numbers are about twice what devlog 177 measured at load 5.

## Looked at
Shots are in `artifacts/g4b/` (gitignored); the copies for review are in the session scratchpad.
- `g4b-base-*`: main. The pine's dark pads and its foot in the margin; the far pines as umbrellas.
- `r1`, `r2`: the species' tree at 1.9× in the corner.
  - Its marks at 1.9× read as cotton balls.
  - The bark was invisible in the margin.
  - The cones were big dark fruit.
- `r3`: the crown in world units at 1.3× (open needle clouds). The far pines read as small pines.
- `r4`: a close view (zoom 2). The trunk at x 95–120 was a ghost in the margin's lift (0.4–0.65),
  so the foot moved to x 166 (lift about 0.3). Seed 101 was picked by a probe: the trunk 30+ from
  every slot and left of the houses, no tuft near a shared star, the crown off the chapel.
- `r5` and the final set: noon, sunset and night, desktop and phone, empty and planted, and close
  views of the pine and of `scrub-1` with the Aleppo pine, the olive and the pomegranate.

## Left open
- **The pine leans away from the sea.** The brief asked for "in over the cove". The village, the
  margin, the stars' band and four slots round the beach's west end leave no foot that does that
  and keeps the bark readable.
- **The crown sits in the top-left corner**, partly under the margin and the "Start studying"
  button. It is lighter and smaller than the old pads.
- **The phone overview** (x 460–1060) does not show the left pine at all, before and after. Its
  close view does.
- **The far pine at 1590** is in the right margin's fade.
- **A plant on `scrub-1` stands over the maquis and the cliff's edge.** Plants are drawn over the
  scenery, so the soil pocket is what grounds it.
