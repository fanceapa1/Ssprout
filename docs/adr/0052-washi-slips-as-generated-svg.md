# ADR 0052 — Washi slips are seeded SVG backgrounds

- Status: accepted
- Date: 2026-10-21

## Context
ART_DIRECTION asks for small cards like washi slips with deckled edges and thin ink borders, and
forbids glossy gradients, glassmorphism, icon fonts, emoji and image assets.

## Decision
`src/ui/paper.ts` generates a few seeded deckled outlines (a smoothed random walk along each edge
of a 1000×1000 box) as SVG `background-image`s stretched with `preserveAspectRatio="none"`. The
outline uses `vector-effect: non-scaling-stroke`, so it stays a 1 px ink line at any size, with two
or three seeded gaps (lost edges). Variants are installed once as CSS custom properties
(`--slip-0…3`, `--slip-dense-*`, `--slip-faint`, `--seal-*` for the vermilion seal button) plus a
seeded paper-grain PNG tile (`--grain`). Icons are inline SVG ink strokes (`icons.ts`).

## Consequences
- The deckle frequency stretches slightly on very wide slips; at the amplitude used (≈0.35 % of
  the box) it reads as fibre, not distortion.
- No `Math.random`: everything comes from `createRng`, so screenshots are stable.
