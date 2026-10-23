# ADR 0100 — Procedural audio: pure planner and sound recipes over a thin Web Audio facade

- Status: accepted; amended by ADR 0213 (optional layer routing and additional continuous beds)
- Date: 2026-10-21

## Context
The soundscape must be procedural (no audio files), calm, light on CPU and — like everything
else — deterministic and unit-tested. Web Audio itself is hard to test (no AudioContext in
Vitest/node) and easy to tangle with scheduling logic.

## Decision
- Split `src/audio/` into pure modules (`params`, `recipes`, `planner`, `gate`, `noise`) and one
  impure module, `backend.ts`, behind a narrow `AudioBackend` facade (`now`, `resume`,
  `suspend`, `startBeds`, `setMaster`, `applyMix`, `play`, `gust`, `close`).
- Every one-shot sound is **data**: a `SoundSpec` of tone/noise voices with pitch contours and
  envelopes. The backend renders any spec generically; the studio draws the same spec as an ink
  sketch. Adding or tuning a sound never touches Web Audio code.
- Event timing is a seeded Poisson process per event kind (`planner.ts`), with a concurrent
  voice cap and per-kind minimum gaps, so density is controlled by rates (events/min) that
  `params.ts` derives from time of day, weather, activity and unlocked fauna.
- Noise buffers and the reverb impulse are generated from a seeded `Rng` once per context and
  shared by all layers and voices.

## Consequences
The controller is tested with a fake backend and manual timers; recipes, planner, gate and noise
have direct unit tests. Only `backend.ts` is verified by ear and by an offline render (levels).
