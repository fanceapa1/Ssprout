# 228 · GA3: Coast plants and creatures after the acceptance

## What
The plant and creature half of the acceptance's short list (devlog 225, open items 4, 7, 11, 12,
16, 17 and the two leftovers of 24). The coast stays behind `?dev&scenery=coast`. Each thing was
looked at in the studio and in the garden at noon, overview and close, before it was changed,
then compared side by side. One commit per defect; nothing under `src/scenery/`, and in the
species files only painting code, sizes and tests (the card texts are GA2's).

## Per defect
1. **Cyclamen and ice plant** (`cyclamen.ts`, `lib/cyclamen-paint.ts`, `ice-plant.ts`,
   `lib/ice-plant-paint.ts`).
   - The cyclamen stood as tall as the rock roses (both are small plants in the same box). Its
     70-unit plan is now drawn at 0.42 of the small class's scale (`CYCLAMEN_LOW`): a 10–15 cm
     rosette about a third of the rock rose's height and a quarter of the lavender's, with the
     flowers a hand's width over the leaves. The size class stays small.
   - Its leaves had heavy dark rims (a pale silver zone filled almost to a dark green margin, a
     stroked rim, a dark-edged dry). Now: no stroke, two green washes, a deeper wash on the half
     away from the light, the marbling lifted out and barely tinted round a darker core, soft
     edges; the back leaves paler, so they no longer build a dark block behind the stalks.
   - The ice plant was a saturated heap. Now a low mat (domes 2.5–7.5 units, were 11–13.5): a thin
     leaf wash under a texture of finger leaves (3 a unit of radius), 90–190 flowers spaced over
     it (were 240–340) on a thin flush of colour (was a 0.9 solid magenta wash), the colourways
     greyed into the painting's range, paler in the sun and deeper on the shaded side and rim,
     longer fingers trailing over the front.
   - **Boxes cut down to the plant** (cyclamen 48×44, ice plant 86×48). Drawing a plant small in
     an 86-unit box left its flower target (`flowerTargets`: the upper part of the box) in the air
     above it, so the bees would have hovered there; the boxes now end above the flowers, at the
     same scale. `SpeciesDef.size` is per species already, so this is no contract change.
2. **Goats** (`goat.ts`). Life size against the temple's 6 m columns (`TEMPLE_SCALE`), a goat
   stood half as tall as a far pine, which the painting draws smaller than the columns imply. They
   are drawn at 0.6 of that measure (`GOAT_K`): about 10 units, a tenth of a tall column and a
   sixth of a far pine. 0.5 was tried first: right against the pines, but at the owner's overview
   a goat was 9 CSS px long; at 0.6 the band still reads as three goats (black, tan, pied) on
   every ledge and at the lookout. Gaps, skip, stride and the rise over the cliff top scale with
   it; a route now keeps every point of a ledge's seam (a 0.5-unit margin skipped a 4-unit step
   in `ledge-west-3`, which the smaller goats' positions exposed). The pine a goat rears against
   is still chosen by the old reach, so a rearing goat stands under the crown, not in it.
3. **The cat behind the lavender** (`cat.ts`, `lib/ground.ts`). The fauna world knows the
   flowering plants by their flower targets (`w.flowers`: a point near the box's top, the foot's
   y, `r` a fifth of the width). `plantCovers` matches each to its slot (span, top, foot; cached
   per planting) and `hiddenByPlant` says whether something standing at a point is behind one and
   under its top. `chooseRest` and `restX` skip such places, so the olive's shade behind a medium
   plant in `top-2`, and a coping behind a tall plant on the terrace below, are not chosen while
   the plant is there. Plants without pollinators give no target (on the terraces the southern
   maidenhair fern on a wall, and the cypress or olive in a tree slot); they are not covered.
4. **Lizard and thrush** (`green-lizard.ts`, `rock-thrush.ts`). The lizard is greyed toward the
   limestone's light, has a pale lit band along the spine, a shaded lower flank over the belly's
   pale edge, a neck narrowing behind the jowls, long hind thighs and toes, and at rest a bowed
   trunk and the tail swept round to one side; its legs settle one forward and one back. The
   thrush's flight frames have broad round-tipped wings (the far one paler behind the body), out
   and down in the mid frame, both held out in the glide, the tail fanned and a little shorter.
5. **Peacock's tail** (`peacocks-tail.ts`). From afar (a sprite at 1.5× its box or less,
   blending to the close look by 4.5×) the bands, hairlines, throats and the stone fade toward one
   pale frond and the water's colour is washed into each frond: a pale clump under the surface,
   not crinkled discs on it. A first try laid a sea-tinted veil over the cluster; its edge read
   as a lens on the pools and it was dropped. Close, nothing changed.
6. **The crab in the sea lavender** (`rock-crab.ts`). The splash rocks' faces are 32–48 units
   wide and a small plant's span is about 70, so no stretch of a planted rock is clear of it. A
   plant whose foot is on a rock's crown (`plantOnRock`) now has the crown and its lip: the crab
   keeps to the waterline of the seaward face in front of it (no lip, no climbing, out at the
   waterline). Where a plant also hangs over the waterline (a tenth of its height below its foot)
   the crab keeps to its side of it (`crabRoom`), comes out from the free end and darts round that
   end; a new rock is one with room left.
7. **Leftovers.** The water plant over a crab was seen in this task's shots (a peacock's tail's
   frond over a crab's legs on pool-1's back rim) and is fixed: `padOnRim` gives the stretch of a
   pool's rim a water plant (`w.pads`) stands in front of, and the crab keeps to the rest. The
   crab's legs past splash rock 1 were not seen in these shots; its fit is the existing unit test
   (GK4.1), and the waterline is unchanged.

## Measured
- **Frame cost** (`sprout.fauna.bench`: `bench(60)` then `bench(120)` three times, ms; production
  build, the owner's window, 48 plants of seed 11 at noon, the natural roster after `step(300)`:
  8–13 creatures; the close view zoom 3 on `mid-3`; three runs each):

  | | overview | close | load |
  |---|---|---|---|
  | before | 1.28/1.22/1.26 · 1.35/1.39/1.34 · 1.34/1.45/1.99 | 1.41/1.21/1.69 · 1.63/1.37/1.52 · 1.64/1.65/1.45 | 2.8–3.2 |
  | after | 1.15/1.16/1.22 · 1.35/1.53/1.31 · 1.12/1.20/1.19 | 1.27/1.20/1.24 · 2.67/1.26/1.47 · 1.23/1.10/1.09 | 3.2–3.3 |

  No change beyond the noise (one 2.67 reading after, one 1.99 before). Nothing new runs a frame:
  the plant covers are cached per planting and read only when the cat picks a place or a crab
  starts a run; the goats draw the same sprites smaller; the lizard and thrush the same number of
  `drawImage`s.
- **Paint cost** (`def.draw` at 1.6× its box, growth 1, seeds 1–12, median and range, ms; the
  dev server in headless Chromium, two runs each; the olive is the unchanged yardstick):

  | | olive | cyclamen | ice plant | peacock's tail |
  |---|---|---|---|---|
  | before | 55.5 (50–66) | 10.9 (10.2–12.3) | 18.7 (17.3–20.0) | 5.6–5.9 (5.2–12.1) |
  | after | 56.7–56.9 (51–72) | 7.9–8.2 (7.4–9.3) | 17.7–18.4 (16.4–19.2) | 5.8–7.4 (5.4–8.0) |

  All inside the recipe's 4–127 ms. The cyclamen's sprite at 1.6× its box is smaller now (its box
  is 48×44), so its number is not the same measure as before; at the same pixel scale its marks
  cost about the same (the leaf wash lost a stroke and gained a shadow fill).

## Tests
- `cyclamen.test` › stands low in its small box; the box test uses the cut-down box.
- `ice-plant.test` › a low mat with 80–200 flowers, lobes at most 7.5 high; the box test.
- `goat.test` › drawn at 0.6 of the temple's measure (against the tallest column and the
  shortest far pine, on every way).
- `cat.test` › does not doze behind a planted plant (the acceptance's spot is among those skipped,
  the other shade is still chosen, an hour on three seeds never dozing out of sight).
- `rock-crab.test` › keeps to the waterline of a rock a plant stands on; › keeps along a pool's
  rim clear of a water plant.
- TESTING.md rows GA3.1–GA3.4.

On the final tree, rebased on `main` (GA2's card texts):
- `npm run typecheck`: clean.
- `VITEST_WORKERS=1 npm test`: 286 files, 3055 tests, all passed.
- e2e against the production build, one spec at a time, one worker: `planting-previews` 2,
  `plants` 8, `plant-card-phone` 5, `lazy-species-painters` 1, `sceneries` 13, `fauna` 6,
  `lazy-creatures` 2, `studio` 38: all passed. The rest of the e2e suite was not run.

## Looked at
Production build, the owner's window (1470 × 750 at DPR 2), noon, before and after (copies in the
session scratchpad, `ga3-*-before.png` / `ga3-*-after.png`): the acceptance's framings (the lower
terraces close at zoom 2.2 with seed 11's 48 plants; the goats and the cat at zoom 2.6), the
terraces planted with the cyclamen, ice plant, rock rose, lavender and Jerusalem sage side by side
(close and at the overview, also at sunset and night after), the beach and pools at the overview
with a peacock's tail in four water slots, the headland's goats at the overview and zoom 1.6 on
the cliff top and the east ledges, the cat over 400 s with lavender in `top-2` and `low-3`, crabs
on the pool rims and the splash rocks; the studio's growth stages of the three plants and the
close sections of the lizard and the thrush. Iterating, the dev server at DPR 1 and 2.

## Left open
- The lizard is better (form, a curve, quieter colour) but still a little clean-edged against
  the wall close up; a second pose at rest would help.
- A rearing goat stands under the far pine's crown; a lower browse target would need the pines'
  lowest boughs as perches (the scene's).
- The cat and the crab know only flowering plants and water plants (the fauna world's targets);
  a fern on a wall or a cypress does not hide or block anything for them.
- In the flight frames the thrush's body and tail are still one long horizontal shape; it reads as
  a bird by its wings.
