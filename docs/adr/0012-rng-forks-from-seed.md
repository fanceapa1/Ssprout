# ADR 0012 — Rng: mulberry32, and `fork(label)` derives from the seed, not the position

- Status: accepted
- Date: 2026-10-21

## Context
Every painted element is seeded. Painters often need independent sub-streams (petals, leaves,
stem wobble). If a sub-stream depended on how many numbers the parent had already drawn, adding
a single draw anywhere would change every later sub-stream and re-paint the whole garden.

## Decision
- `createRng(seed: number | string)`: mulberry32 core; strings hashed with FNV-1a + murmur3
  finaliser; numbers folded to 32 bits (`toSeed`).
- `rng.fork(label)` returns `createRng(mix(seed, hash(label)))` — a pure function of the
  stream's original seed and the label, independent of the parent's position.
- A known-sequence test pins the algorithm; changing it is a visible, deliberate change.

## Consequences
Forks with the same label from the same seed are identical — use distinct labels per purpose
(e.g. `rng.fork('petal-' + i)`).
