# ADR 0144 — Richer pigments, still watercolour

- Status: accepted
- Date: 2026-10-23

## Context
ADR 0005: "more saturated colours everywhere, tying in with the day cycle". v1 kept every pigment
below OKLab chroma 0.12 ("saturation stays low").

## Decision
- Shared pigments (`src/paint/pigments.ts`) raised in OKLab chroma with lightness kept: greens
  ~1.4×, water 1.5×, stones 1.5–1.6× (their warm/cool tints show), wood 1.3×, flowers 1.35×, gold
  and vermilion a little. Everything built from them (scene, plants, fauna) follows.
- Every hard-coded species colour (flower petals, leaves, buds, bloom swatches) raised 1.3× in
  chroma by a one-off script (`saturate(hex, 1.3)`); the spider lily kept a little lower.
- Eight sky pigments join for the daylight phases: cerulean, ultramarine, indigo, rose, crimson,
  ochre, apricot, violet — used thinly in washes.
- Limits (tested): earth and plant pigments < 0.135, sky pigments < 0.145, crimson and vermilion
  < 0.17. Each phase is balanced by its light (night takes colour out, ADR 0147), so the painting
  stays coherent rather than tinted.

## Consequences
The garden reads noticeably richer at midday; transparency, granulation and the paper keep it
watercolour. The ART_DIRECTION palette table lists the new values.
