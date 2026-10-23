# ADR 0189 — Edges of the frame: a phone's painting, the plant view's can and its framing

- Status: accepted (amends ADRs 0003, 0094, 0163); the growth framing's cap is 8× since devlog 25 (a just-planted seed must read)
- Date: 2026-10-23

## Context
Three things showed at the edge of a frame:
- **A phone's first glide toward its cropped sides** showed the painting's edge for about a
  second: the overview painting covers only the visible strip (+60 units), and the whole world
  was painted only when a view first left it (devlog 19's open gap).
- In the dock's "Your plant" view the **watering can** glides in from the side and leaves up and
  out; in that small frame a sliver of it (the spout's tip) showed alone at the upper right edge.
- In the 64 px "Growing now" thumbnails a **seedling** was tiny: the view fits the full-grown
  species.

## Decision
- A painting of a strip of the world is **extended to the whole world in idle time 1.5 s after
  the first paint** (`extendDelayMs`), swapped in at once as before; a view that leaves the strip
  sooner still starts it at once. Meanwhile a strip painting's **cut sides fade to paper** over 36
  units (inside its 60-unit margin, so the overview never shows the fade; a resize reuses a
  painting only if the view stays clear of it).
- In a framed plant view the **can fades by how much of it is in the frame**
  (`canVisibility`): it appears once mostly in and fades as it leaves, so no fragment is drawn at
  the edge. The garden's watering is unchanged.
- `renderPlantView` takes **`framing: 'growth'`**: the plant is enlarged about its base so what has
  grown fills the frame (content to ~70 % of the height, ~84 % of the width, at most 4×; the
  sprite is painted at the enlarged size). The "Growing now" thumbnails use it; everything else
  keeps the species framing (a seedling grows into its frame).

## Consequences
A phone paints the whole world once, about a second of cooperative painting after load (the strip
is ≈ 5 MB, the world ≈ 14 MB). `PlantViewOptions` gains an optional field (ARCHITECTURE.md).
Tests: `watering.test.ts` (the can is in the frame while it pours, mostly out while it glides in),
`view.test.ts` (growth zoom, zoom about the base).
