# ADR 0245: The waterfall's geometry, slots and per-slot scale

- Status: accepted
- Date: 2026-10-28
- Amends: ADR 0043 (slot perspective scale)

## Context
Phase 10's second scenery is a rocky waterfall (S4). It needs a composition in the 1600 × 1000
world, a `SceneGeometry` (pool, stream, falls, boulders, trail, slots), sky numbers and a view,
before its painters (S6–S8), its animated falls (S9) and its daylight (S10). Three constraints
shaped it:
- ADR 0043 made every slot's `scale` exactly `perspectiveScale(y)`, linear in y. Plants on a cliff
  face stand high in the frame but at the cliff's depth, so a y-only rule would draw a plant on a
  ledge at y 330 at the far bank's 0.55 while the cliff's foot is at 0.76.
- The sky layout's star field is a band (`top`, `depth`) with one gap; it does not clip to the
  open sky. The sun and the moon do not clip either: their positions must be in open sky.
- Every species needs a compatible slot, the lotus at least two large ones on still water, and
  neighbours must still read at the garden's 1.25× (ADR 0148).

## Decision
- **Composition** (docs/systems/scenery.md › Waterfall): the falls drop from a notch in the cliff
  top at x 542–688, a little left of centre. The crown woods are highest at the left edge, and a
  buttress, the tallest rock beside the falls, stands to their right. Its flank falls away to a low
  far ridge (y 344–372), which leaves the right 40 % of the frame as open sky for the sun and the
  moon. The plunge pool's back edge is the cliff's foot. The stream leaves its right end and winds
  in an S toward the viewer. Six ledges at three heights sit either side of the falls. A trail of
  six stepping stones climbs from the bottom to the pool's near edge.
- **Per-slot scale, no type change.** `Slot.scale` was already a field every consumer reads
  (`plantScale`, fauna). The rule "scale = `perspectiveScale(y)`" becomes the Japanese garden's
  rule, not the contract's. The waterfall's ground slots keep it. Ledge slots take their ledge's
  scale (0.72 low, 0.68 mid, 0.64 high: the cliff leans back from its foot at 0.76), and crown
  slots take `CROWN_SCALE` 0.6. No optional field, no default: the contract is unchanged and the
  garden is untouched.
- **Slots** (49): ids say where (`pool-`, `ledge-`, `stream-`, `bank-`, `trail-`, `cliff-`),
  habitats say what grows (the garden's six kinds). Water 4 (2 large for the lotus), shore 9,
  meadow 12 (one tree), path 6, back 7 (one tree), rock 11. Every species has a compatible slot.
- **Sky**: horizon y 384 under the far ridge, the sun rising at x 1270 and setting at x 1040 (just
  right of the buttress, inside the portrait crop), the moon's arc (1300, 296) → (1150, 196) →
  (990, 292), stars from y 26 down 160 units (the skyline's highest point is y 200), with a gap
  round the moon's arc. Tests hold the sun at 8–16° altitude, the moon's whole arc and the stars
  inside the open sky, and the sun clear of the tree slots' crowns.
- **View**: focus (760, 560). The portrait crop (x 460–1060) holds the falls, most of the pool,
  the stream's start, the trail and the setting sun. `pathOut` is the trail's near edges.
- **Placeholder painting**: flat fills in the composition's places (sky, far ridge, banks, cliff,
  ledges, pool, stream, falls, trail) and a flat sky wash per phase. S6–S8 and S10 replace them.
- **Behind a dev flag**: registered, `available` only with `?dev&scenery=waterfall`. Nothing
  switches to it yet (S3).
- **Habitat words** are not in the contract (ADR 0241 left them to S5). The waterfall records
  them as `WATERFALL_HABITAT_WORDS` in its `layout.ts`.

## Consequences
- A consumer that recomputes a slot's scale from its y would be wrong for ledges. Today only the
  Japanese garden's meadow painter calls `perspectiveScale` directly, for its own ground.
- `fauna/targets.ts` `perspectiveFit(slots)` fits a line through every slot's (y, scale). The
  ledges would bend that fit for the waterfall. S11 gives the fauna a per-scenery perspective.
- The star band is shallow (y 26–186), because the crown woods stand high on the left. A star
  field clipped to the open sky would put stars low over the far ridge too (S10).
- A plant can still stand in front of the sun or the moon (as in the garden). Only the tree slots
  are kept clear of their paths.
