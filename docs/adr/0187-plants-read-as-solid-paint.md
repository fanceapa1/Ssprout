# ADR 0187 — Plants read as solid paint at every zoom

- Status: accepted (amends ADRs 0111, 0146, 0165)
- Date: 2026-10-23

## Context
Zoomed onto a tree peony, the hill line, the pond's rim and the bank's bands showed through its
leaves and petals as if the sprite were at reduced opacity. It was not a compositing bug: the
sprite was drawn at full opacity, the light plate and the rim are the same at every zoom, and the
close sprite's mean alpha matched the 1× sprite's (0.66–0.67 for the peony at 1.7, 3.4 and 5.7 px
per unit). The sprites are transparent watercolour painted on white; laid once over the landscape
they let a third of it through. At 1× what lies behind a plant is a small, even patch of bank; at
3× it is the hill line and the rim, and they cross the plant.

Separately, the rim light's width was capped in pixels (9 px) per bitmap, so on a close sprite
three times sharper the rim was a third as wide on the plant; and a rim scaled fully with the
resolution became a shifted ghost of every leaf.

## Decision
- A plant sprite's **body is laid twice when it is painted** (`layBodyTwice`, `SPRITE_BODY` = 1):
  the sprite drawn onto itself once more. Over the landscape the plant then lets a ninth through
  (`(1 − a)²`) and reads as solid paint, while its washes, pooled edges and overlaps stay the
  painting's. Done once per sprite (in the workers), so it costs nothing per frame; a per-frame
  second pass doubled the posed, sliced blits and was rejected, as was reserving paper under the
  plant (the leaves turned pale on paper, a cut-out halo).
- **Rim widths follow the bitmap's resolution by √k** (`rimWidth(w, h, k)`, `k` = the sprite's px
  per world unit ÷ 1.7; boulders: the paint scale ÷ 1.5): the rim keeps its place on the plant
  seen close without becoming a doubled outline.

## Consequences
Plants are richer at every zoom (the same at 1× and 3×); their hit-test silhouettes are slightly
fuller. The garden's plant view (widget, dock, studio species pages) uses the same sprites. The
planting sheet's previews (ui) paint species directly and are unchanged. Tests:
`tests/e2e/close-view.spec.ts` (the plant's presence over the landscape — mean |with − without| at
the same world points — at 3× is 0.8–1.25 of 1×; measured 0.9), studio
`close-view-plants/solid`.
