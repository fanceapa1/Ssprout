# ADR 0132 — The garden dissolves into the page through a CSS mask; the page is the garden's paper

- Status: accepted; amended by ADR 0184
- Date: 2026-10-23
- Context: ADR 0021 (paint on white, paper multiplied last), ADR 0040 (the scene owns the paper layer)

## Context
The garden must fade into the UI below "like a wash into the paper", with no hard line, and the
UI must sit on the same washi without inventing a second paper tint. The paper layer belongs to
the scene (not this task's paths) and must not repaint on scroll.

## Decision
- **Page paper.** `src/ui/page-paper.ts` makes a 512 px tile with `paperTexture` from
  `src/paint/paper.ts`, the same seed as the garden's paper layer, one grain texel per CSS pixel,
  **without** mottle or vignette (so it tiles), and sets it as `--page-paper` under `html`'s
  washi colour. Generated once, in idle time; the plain colour shows until then.
- **The edge.** `src/ui/stage-edge.ts` computes an alpha mask (pure, unit-tested) and the stage
  applies it to the canvas as `mask-image`: the bottom fades over a ragged band (15 % of the stage,
  64–190 px) with uneven pools and a faint slanting dry-brush grain; the top and sides thin out
  over a narrower ragged band (4 % of the short side, 14–44 px), so the margin never shows a
  machine edge and the slightly deeper tone of the painted paper meets the page softly.
  The mask is half resolution, regenerated only when the stage changes size (first size at once,
  later ones after 150 ms).
- Nothing is painted into the canvas for this: the scene, its paper layer and ADR 0021 are untouched.

## Consequences
- Scrolling moves the canvas element; the static scene is neither repainted nor rescaled
  (asserted in `ui-shell.spec`), and per-frame cost is unchanged (devlog 16).
- At night the indigo painting fades into day-bright paper. That is the intended reading — the
  wash ends, the sheet does not — and the dock is read like a sheet (ADR 0121's sheets rule).
