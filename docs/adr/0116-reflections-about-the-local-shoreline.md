# ADR 0116 — Reflections about the local shoreline

- Status: accepted
- Date: 2026-10-22

## Decision
- The mirror line is the plant's base when it stands in the pond, else the pond edge straight
  below it (searched across the foliage width) within 70 world units; no water below → none.
  This follows `SceneGeometry.waterline`'s note ("reflect about local shore y") without a
  global line, and naturally hides front-bank reflections.
- Reflection images are built once per sprite (half resolution, flipped, blurred, tinted,
  depth-faded, lift strokes) and drawn per frame in wavering slices clipped to the pond.
