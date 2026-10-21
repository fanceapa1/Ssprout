# ADR 0113 — Sway as skew/bend; a wind adapter with a fallback

- Status: accepted
- Date: 2026-10-22

## Decision
- Sway is a horizontal skew about the base; large plants and trees bend (displacement ∝ heightᵇ)
  drawn as 6 slices whose piecewise-linear skews meet at each seam and whose clip bands are
  snapped to device rows, so there are no seams and the trunk barely moves. Amplitude by size
  class (small 0.06 … tree 0.016 of height), boosted with `windBoost(phase)` during sessions.
- The wind comes from `src/ambience/wind.ts` (ambience task). It was not on main when this
  landed, so `wind-adapter.ts` picks it up with an eager `import.meta.glob` when present and
  otherwise uses a local field with the same signature — no change needed when it merges.
