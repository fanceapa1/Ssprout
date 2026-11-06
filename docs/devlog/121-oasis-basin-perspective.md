# 121 · Oasis basin perspective (O2d)

**What.** The owner found the basin seen from too high, out of step with the ksar, the bluff and
the palms, which are drawn at eye level. The basin was a deep trapezoid (far rim x 560–1060 at
y 476, near rim x 506–1114 at y 640: 164 deep, the sides barely converging) that showed the
water as a tabletop.

It is now a shallow band at eye level:

- **Shape.** The near rim stays (x 506–1114, y 640) so the foreground keeps its room. The far rim
  is at y 562 (78 deep, under half the old 164), and every side, outer and inner, runs to a
  vanishing point on the horizon, `BASIN_VP` (810, 340), via `towardVp`. That puts the far rim at
  x 585–1035, 0.74 of the near rim's width, the same ground the terraces and plots lie on.
- **Stonework seen low.** `BASIN_RIM` far 12 → 6 (the far coping and its inner face a sliver),
  near 26 → 10 (the near coping's top foreshortened), near outer face 18 → 24 (taller, closer).
  The side copings converge too. The steps are now short, foreshortened treads, and the sluice
  gate is at the near right corner. The sluice channel starts there (1100, 628).
- **Mostly reflection.** The bluff and the ksar mirror about their feet onto the waterline,
  squeezed 0.36 → 0.17 so the towers' tops reach the near rim. The water under them is lifted
  harder and glazed warmer, and level breaks cross the mirrored rock. The day's mirrored-sky
  plate fades out toward the far edge, so the sky's shine stays near the rim. Turquoise stays
  between the towers and along the near rim. Rings (painted and moving) are flatter.
- **Neighbours.** The middle terrace wall now runs to the basin's far-left corner (its end
  506 → 572), so the wall meets the basin and the seguia's last fall sits on its face as before.
  The inlet notch (`BASIN_INLET`, shared with motion's rings) is on the new left wall. The
  daylight's pools on the water and the night's moon streaks and coping lights follow the water's
  band, and the far coping's shade is thinner. A pale trodden patch and two ripple sets mark the
  sand behind the basin.
- **Slots.** `basin-1…5` sit in the band (y 590–614), staggered in depth, with `basin-5` (large,
  for the cattail) in the overflow corner by the sluice. The basin's water slots are now tested
  for 30 clear of the side walls and 14 of the far and near edges, down from 30 all round: at eye
  level the water is only 62 deep.

**Looked at** (`artifacts/o2d/`, noon, sunset and night at 1440×900, 1920×1080 and 390×844, with and
without 30 plants, plus `o2d-close-noon`):
- r1: flatter and lower already, but the water was flat turquoise with no reflection, and the
  middle terrace wall ended in the air beside the basin's far-left corner.
- r2: the reflection was too faint to read; the far half of the water was a grey film.
- r3: the reflection read, but its upright streaks looked like joints, so the far water looked like
  a tall inner wall. Swapped them for level breaks and a deeper red.
- r4–r5: reads as water mirroring the bluff, with the turquoise near rim. Sunset and night hold
  (the warm and moon pools sit on the band).
- With plants: the five water slots in one row read as a fence of cattails, so they are now
  staggered in depth.
- Before (`artifacts/shots/pool-now-1440x900.png`) beside after (`o2d-final-noon-1440x900.png`):
  `o2d-before-after.png`. The basin now lies on the same ground as the terraces and plots, at the
  ksar's eye level.

**Left open.**
- The sand between the bluff's foot and the basin's far rim is a wide, quiet band now that the
  basin is shallower. A low feature there (a second wall, a well, palms' shade) would fill it, but
  that is a composition change beyond this fix.
- The near face's joints are regular; dressed stones of varied lengths would read less like a box.
- On the phone the crop still cuts the basin's right end (steps and gate), as before (≥ 85% of
  the water stays in it).
- The reflection greys a little under the sunset's warm grade.

- Devlog index: `| 121 | [Oasis basin perspective](121-oasis-basin-perspective.md) | O2d: the basin at eye level, a shallow band whose sides run to the horizon's vanishing point, mostly reflection |`
- TESTING rows:
  - `| O2d.1 | The basin at eye level: its sides on lines to the vanishing point, its water inside its stone; basin water slots 30 clear of the side walls and 14 of the far and near edges, a large one in the overflow corner; rings inside the water; re-pinned recording hashes (daylight, land, water) | scenery/oasis › puts water slots on the water…, › opens the basin inside its stone rim…, oasis/motion, oasis/daylight, oasis/land, oasis/water (pins) | — | ✔ |`
