# ADR 0084 — Particles as Poisson spawns drawn with pre-painted sprites

- Status: accepted; amended by ADR 0193
- Date: 2026-10-22

## Context
Rain, ripples, glints and motes must look painted (tapered, broken marks), never confetti, and stay
far under the 1.5 ms/frame budget. The paint engine's primitives are too slow per frame.

## Decision
- A pure simulation (`sim.ts`): each stream spawns as a Poisson process whose rate follows the
  envelope (rain: target count ÷ mean life per depth, so density tracks the level; ripples, glints
  and motes have small caps). Positions and lives come from a seeded `Rng`.
- Marks are textures painted once per scene from seeded noise (`sprites.ts`): tapered rain strokes with
  faint breaks, broken two-tone ripple rings, lifted-paper glint dashes, irregular mote specks,
  tileable mist bands, noise-edged shafts. Per frame only `drawImage` with alpha (rain rotated via
  `setTransform`), ~150 calls in heavy rain.
- Reduced motion: no stepping at all; a still frame of the weather's strokes is laid down once.

## Consequences
Rain costs about 0.35 ms/frame in headless Chromium. Sprite resolution is fixed (not per DPR); the
marks are thin and soft, so this does not show in practice.
