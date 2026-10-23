# ADR 0188 — Creatures sharpen in a resting close view

- Status: accepted (amends ADR 0071)
- Date: 2026-10-23

## Context
Creature parts are painted once at the overview's pixel scale (`ArtCache.res`, 1.5–6 px per unit)
and composed per frame. At 3× on a DPR-2 desktop the bee on the flower you are looking at was a
1.75 px-per-unit bitmap stretched to 5.4: blocky edges on the birds, soft bees and dragonflies
(devlog 19's open gap).

## Decision
- The cache holds parts **per key and resolution**. The fauna system follows the camera like the
  other layers: when the camera rests, the target resolution is the overview's pixel scale or,
  zoomed, the resting view's (`faunaResolution`), bucketed to quarters and capped at 6.
- A part missing at the target is **painted at once only if no other resolution has it**;
  otherwise the copy at the other resolution keeps drawing and the sharp one is queued and painted
  from idle callbacks, 8 ms at a time (`paintPending`). A camera coming to rest never stalls a
  frame on painting.
- Two resolutions are kept at most (the current one and the one before it): memory stays bounded,
  and a return to the overview repaints nothing.
- Every creature uses the higher resolution when it applies (the view is small; those in it are
  the ones near the focused plant: bees, butterflies, the dragonfly, birds, the frog, koi).

## Consequences
Parts at 5.5 px per unit are a few hundred pixels across (the heron's ~800): a few MB. Dev:
`sprout.fauna.art()` and `settleArt()` (screenshots). Tests: `art-cache.test.ts` (old part drawn
while the sharp one waits, idle budget, two resolutions kept, the resolution follows a resting
camera), studio `close-view-fauna/*`.
