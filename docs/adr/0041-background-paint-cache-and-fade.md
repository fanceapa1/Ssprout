# ADR 0041 — Background painting: paint view, 10 % repaint rule, cooperative paint, fade

- Status: accepted; amended by ADRs 0161, 0163, 0185, 0228
- Date: 2026-10-22

## Context
The garden painting costs ≈ 1.2–2 s of CPU at DPR 2 (hundreds of wet layers). The renderer
re-inits systems on every resize (debounced 200 ms) and blocks nothing, `sprout.ready()` waits for
all inits, and screenshots `freeze()` right after `ready()`. We need: no blank flash, no jank
during long paints, no repaint for small resizes, screenshots that are never half-faded.

## Decision
- **Paint view**: the visible world rect plus a 60-unit margin, at `min(pixelScale, 1.5)` bitmap
  px per world unit. Above 1.5 the bitmap is upscaled — visually identical (watercolour is soft;
  the paper grain lives in the full-resolution paper layer) and ~40 % cheaper than 1.8.
  Portrait phones paint only their strip (~584 × 1000 world units).
- **Repaint rule** (`canReuse`): repaint only if the scale changes by more than 10 % or the
  visible rect leaves the painted rect; otherwise keep the bitmap and let `drawImage` rescale it.
- **First paint blocks `init`**, so `ready()` means "painted"; the paper system shows washi
  meanwhile. **Later repaints don't block**: the old painting stays and the new one cross-fades in.
- **Cooperative painting**: the paint is a generator of steps (`paintJob`); `paintScene` runs
  steps until ~20 ms have passed, then yields a macrotask. The same generator drives the
  synchronous studio path (`paintSceneSync`), so both produce identical pixels. A newer job
  cancels an older one.
- **Fade**: 1.2 s smoothstep, advanced by `FrameInfo.dt`. A frame with `dt = 0` (`freeze()` /
  `renderOnce()`) or reduced motion completes the fade immediately. While fading the system calls
  an injected `invalidate('background')` (main.ts passes `renderer.invalidate`) every frame,
  because `background` is a cached layer.
- Big soft washes (sky, hills, banks, margins) are painted with a second, `draft`-quality painter
  on the same canvas (steps flagged `soft`).

## Alternatives
- Painting in a Worker with OffscreenCanvas: no main-thread cost at all, but a second bundle
  entry, transfer of ~20 sprite bitmaps and a fallback path; cooperative slicing is enough for
  now and keeps one code path. Left as a future option (the generator is worker-ready).
- Painting the whole world always: simpler, but 3.5× the work on phones.

## Consequences
`sprout.sceneStats()` reports paints, rescales and per-step timings; `sprout.scenePainted()`
resolves when no repaint is pending (use it in tests after resizing).
