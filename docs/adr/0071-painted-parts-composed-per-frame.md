# ADR 0071 — Creatures are engine-painted parts composed per frame

- Status: accepted
- Date: 2026-10-22

## Context
The paint engine is far too slow to call per frame (ART_DIRECTION, paint.md "Don't call primitives
per frame"), yet creatures must move — koi bend, wings beat, tails bob — and must never be flat
vector shapes.

## Decision
- Each creature paints a few **parts** once with the engine (`paintSprite`: washes, wet-in-wet,
  dabs, ink lines, clipped wet layers) into small transparent canvases at `ArtCache.res` (bucketed
  device px per world unit; the cache is dropped when it changes). Parts are painted lazily on the
  first draw.
- Per frame they are composed with `drawImage` transforms only: rotations, foreshortening scales
  (butterfly wings horizontally, the heron's wing vertically through edge-on), frame swaps (bee and
  dragonfly wing blur, bird up/down/fold, swallow spread/up/swept).
- **Koi**: the painted body strip is cut into 9 segments laid along a spine that follows the head's
  trail (natural turns for free) plus a travelling swim wave; caudal and pectoral fins are separate
  parts. The composition is drawn at full opacity into a shared scratch canvas and laid down faded,
  so overlapping segments don't show doubled-alpha seams. Under-water muting is a precomputed
  `deepCopy` (down/up-sampled blur + cool tint) cross-faded by depth.

## Consequences
All fauna costs < 1 ms per frame at DPR 2 with 17 creatures. Motion is limited to what transforms
of a few parts can express; that has been enough for these small, quiet animals.
