# ADR 0114 — The watering moment: a pure timeline over cached paintings

- Status: accepted
- Date: 2026-10-22

## Decision
- The whole animation is a pure function of progress `u` and a seed (`wateringTimeline`,
  `canPose`, `rosePoint`, `dropletsAt`), shared by the garden and `renderPlantView`, so the widget
  and the garden show the same moment and it is unit-testable.
- The can (copper jōro, brass rose), the droplet atlas and the damp-soil wash are painted once per
  pixel-size bucket with the watercolour engine; per frame only `drawImage`.
- Droplets follow ballistic arcs solved per drop from the rose (at its emission time) to a landing
  point, with gravity chosen so the stream leaves almost level — an arc, not a vertical drip.
- In the garden the can draws on the `air` layer so a nearer plant never hides the moment; the
  soil stays damp for 9 s after. On `water` slots there is no soil wash.
- Reduced motion: no can or droplets, only the soil and the leaves' lift.
