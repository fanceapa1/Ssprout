# ADR 0162 — Camera glides and gesture follow

- Status: accepted
- Date: 2026-10-23

## Context
The camera moves on its own (to a seedling, a clicked plant, back to the whole garden) and under
the hand (wheel, pinch, drag, buttons, keys). The art direction asks for slow, organic motion,
nothing that snaps, and `prefers-reduced-motion` respected.

## Decision
- **Glides** follow van Wijk & Nuij's smooth zoom-and-pan path (ρ = 1.35, as d3's
  `interpolateZoom`): a long move at high zoom eases out a little, travels, then eases in, so the
  eye keeps its place. Time along the path is eased like a breath (`0.5 − 0.5·cos πu`, still at both
  ends, never linear); the duration grows with the path length, 0.75–1.9 s. Poses are clamped every
  frame.
- **Gesture follow**: ctrl/⌘ + wheel and trackpad pinch accumulate a target zoom about the pointer
  and the pose approaches it exponentially (τ = 75 ms), so a mouse wheel's notches ease in and a
  trackpad's many small deltas feel direct. Two-finger touch pinch and drag apply at once.
- **User input interrupts**: a drag, pinch or wheel stops a glide where it is and takes over;
  buttons and keys start a new glide from the current pose.
- **Reduced motion: cuts** (no glide, no follow; a cut counts as resting at once). A short
  cross-fade was considered and dropped: it needs a frame snapshot for little benefit.
- **Detail view**: during a glide the camera already reports its destination
  (`detailView()`), so sprites at the destination's resolution paint while it travels; after a
  gesture it reports the view once it has rested for 0.25 s.

## Consequences
`camera.test.ts` covers the path (ends exact, no jumps, eases out on long moves), the easing, the
duration bounds, interruption, the follow about the pointer, reduced-motion cuts and `settle()`.
