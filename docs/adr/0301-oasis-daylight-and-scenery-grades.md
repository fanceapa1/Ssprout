# ADR 0301: The oasis's daylight, and a scenery's own grades

- Status: accepted
- Date: 2026-11-04
- Builds on: ADRs 0141 (grades), 0145 (sky plates), 0147 (light plates), 0242 (cache keys), 0247 (waterfall daylight), 0284 (sun side), 0300 (oasis sun)

## Context
O5 paints the oasis's daylight. Two things were not like the waterfall's:
- **The grade.** The owner wants a golden, sandy oasis, warmer and more saturated than the other
  gardens. The grade (the light plate's mottled multiply wash, and the UI's paper tint) was global:
  `PHASE_GRADES`. Midday there is almost bare paper, and sunset glows toward the left, where the
  garden's sun sets. A warm glaze painted by the scenery's `lights` hook could warm the plate, but
  not the UI tint, and it would sit on top of a glow in the wrong place.
- **The basin.** The light plates multiply over the whole frame. The garden's amber sunset grade
  over the basin's turquoise gives olive grey (devlog 110).

## Decision
- **`LightArt.grades?: Partial<Record<DayPhase, Grade>>`**: a scenery may give its own phase
  grades. A phase it leaves out takes `PHASE_GRADES`. `createCastLight` paints each phase's wash
  and lantern strength from it, and `gradeFor(weights, own?)` blends it for the UI tint
  (`createAmbience` passes the scenery's light art). The plate fingerprint includes the grades
  only when they are present, so the garden's and the waterfall's light-plate keys do not change.
- **The oasis's grades** (`oasis/light.ts › OASIS_GRADES`): midday a thin gold (0.09) instead of
  bare paper, the sky end kept lighter so the bleached horizon stays pale; sunrise rose with a glow
  over the notch (x 0.62); sunset a deeper amber (0.36) glowing over the notch (x 0.58), not on
  the left; night a violet-indigo a little lighter than the garden's (0.5, ground × 1.15). No
  lantern: the oasis has no lights.
- **The basin keeps its turquoise.** The basin plate is turquoise in every phase, with only a
  little of the horizon at the far edge and the zenith nearer, and the sky's colour laid on as
  broken streaks. The light plate's `lights` hook leaves pale paper over the basin's water by day
  (0.4–0.55), so the warm grade does not grey it, and a cool sheen at night.
- **Sky plates** are clipped to the skyline with a 4-unit hang over the bluff and the ksar, and
  up to 30 units over the far range, held above the bluff's shoulder.
- **Shadows always fall left**, as at the waterfall. The bluff's left ridge, the towers onto their
  neighbours, the terrace walls' faces and the strip below them, the basin's coping onto the
  water, and the big palms' trunks and crowns. The palms' shadows run diagonally toward the
  viewer, because the sun stands beyond the grove.

## Consequences
- Every scenery can now tune its grades without touching the others. The garden's and the
  waterfall's plates, keys and pixels are unchanged.
- The night's 170 extra stars are reserved on the sky plate and on the night light plate. The
  close-view sky detail plate punches only the shared 30, so in a zoomed view the extra stars are
  the upscaled plate's (softer).
