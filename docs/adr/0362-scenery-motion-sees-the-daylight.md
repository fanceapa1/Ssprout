# ADR 0362: A scenery's motion is given the daylight, and the coast's sea moves on one swell

- Status: accepted
- Date: 2026-11-22
- Builds on: ADRs 0282 (scenery motion), 0372 (the coast's daylight), 0374 (the caique over a sea
  plate)

## Context
The owner saw the coast's sea as a still turquoise sheet: its motion (G6) was a few faint dashes
drifting in, foam breathing on unrelated cycles and a caique rocking on its own periods. A living
sea needs things the motion could not do:
- **Light on the water that follows the sun and the moon.** Glints belong on a road under a low
  sun (sunrise x 636, sunset x 552 over the horizon), under the moon at night, and only a few at
  noon. `SceneryMotion.draw(ctx, t)` is given only the time, and the light plates multiplied over
  the marks only tint them; they cannot move them.
- **One swell for everything.** Crests on the bay, the break on the beach, the foam round the
  rocks and the caique's heave read as one sea only when they keep one period and direction.

## Decision
- **`SceneryMotion.draw(ctx, t, light?)`**: the scene system passes the `DaylightState` it already
  holds for `water.ts` (one line in `scene/system.ts`). It is optional: a motion that ignores it
  (the waterfall's, the oasis's) is unchanged, and `draw` stays pure in `t` and `light`. The studio
  and tests pass a pinned state or none (a midday light).
- **The coast's swell is a data module** (`swell.ts`, eager, pure in `t`): crest `n` breaks at
  `n · 10.6 s` plus a seeded offset of up to ±1.6 s, with a seeded strength in sets of about seven.
  It is born at the horizon and runs in at `2 + 0.011 · g` world units of depth a second (`g` up
  from the horizon), so crests are slow and close far out and about 6 units a second at the beach,
  about 100 s horizon to break. The break peels left to right over 2.6 s. `swellAt(depth, x, t)`
  gives the swell's height anywhere; the crests' bands, the shore break, the rocks' foam and rings,
  the cliff's laps and `caiquePose` all read it.
- **Crests follow lines of equal depth** (`shoreContour` at 54 depths, built in `prepare` one per
  part), so they bend round the coves and the headland; a piece whose line climbs steeply fades,
  since there it would read as a streak.

## Consequences
- The coast's sea draws more: about 150–250 blits and two pattern fills a frame instead of up to
  160 blits, and one more clip (7). Measured cost in devlog 213.
- The caique's pose now depends on the swell schedule; `CAIQUE_SWING.dy` grows from 1.15 to 1.25.
- Other sceneries may read `light` later (glints on the garden's pond); nothing changes for them
  now.
- Reduced motion is unchanged: no motion is created, the painting stays complete.

## Rejected
- **A daylight module the motion reads by itself**: hidden state, and the studio could not pin a
  phase.
- **Glints painted into the light plates**: they would not twinkle, and would be there under
  reduced motion as a still mark the painting does not have.
- **A sine swell across the bay**: reads as stripes; the seeded schedule and broken pieces do not
  loop visibly.
