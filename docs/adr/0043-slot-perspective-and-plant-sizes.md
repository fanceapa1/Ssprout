# ADR 0043 — Slot perspective scale and canonical plant sizes

- Status: accepted; amended by ADR 0148
- Date: 2026-10-22

## Context
Plant agents need one shared answer to "how big is a medium plant?", and slots need a
perspective `scale` that matches the painted ground plane so plants recede with the banks.

## Decision
- `perspectiveScale(y)` (`src/scene/slots.ts`) is linear in world y from **0.55 at y = 400** (far
  bank) to **1.15 at y = 960** (bottom), clamped, rounded to 0.01. Every slot's `scale` is exactly
  this (tested), so slots can be moved without hand-tuning scales.
- `PLANT_SIZES` defines the canonical sprite box at scale 1: small 70×70, medium 120×160,
  large 200×220, tree 380×460 (world units). Species should stay within ±15 % of their class.
- Only `back` slots offer `tree`; tree slots sit in the sky gaps between the painted tree groups
  and are spaced ≥ 0.6 × the mean full-size tree width apart (tested).

## Consequences
Changing the ground plane (e.g. moving the far bank) means changing `FAR_Y`/`NEAR_Y`, not 52
numbers. The dev overlay draws every slot's max-size box for review.
