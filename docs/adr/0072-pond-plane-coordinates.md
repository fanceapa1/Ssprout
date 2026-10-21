# ADR 0072 — Water creatures move in a "pond plane"

- Status: accepted
- Date: 2026-10-22

## Context
The pond is seen at a low angle: its polygon is about 2.5× wider than tall. Koi, striders and
leaves moving in world coordinates would swim faster across than toward the viewer, and turning
circles would be squashed ellipses.

## Decision
- Water creatures simulate in a plane where `y_plane = cy + (y − cy) / pondSquash` (`pondSquash`
  0.36 in `tuning.ts`, tuned to the painted kidney pond, 904 × 261 world units, `cy` the pond centroid). The pond polygon is mapped once; containment
  (`insideWithMargin`, `containPoint`), targets and steering happen there; positions are mapped back
  to world for drawing and depth.
- Bodies are drawn foreshortened: koi with a gentler squash (0.62, so they don't read as slivers),
  striders and floating leaves with the pond squash.
- Everything derives from `SceneGeometry.pond`; nothing assumes the placeholder's shape.

## Consequences
Isotropic, natural motion on any pond polygon the scene provides. The squash constant is a single
tuning value if the painted scene's viewing angle differs.
