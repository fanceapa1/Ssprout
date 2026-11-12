# 178 · Sea daffodil (GP4, phase 15)

## What
The Greek coast's white beach lily: **sea daffodil** (*Pancratium maritimum*, krinos tis thalassas),
a tier-2 `medium` plant for the beach sand. It adds only files:
- `src/plants/species/sea-daffodil.ts`: the definition, the plan (`buildSeaDaffodil`), the pose
  (`poseSeaDaffodil`, pure, every mark at a growth value) and `seaDaffodilReach` (for the box test).
- `src/plants/lib/sea-daffodil-paint.ts`: new helpers (twisting strap leaves, soft washes, the
  flower's shapes, the reserved-paper backdrop, the flower shading, the stalks). Only `ribbonInto`,
  `inPlantSpace`, `groundShadow`, `seedMound` and the stem helpers are imported; no shared helper
  was edited.
- `src/plants/species/sea-daffodil.test.ts`, `src/plants/notes/sea-daffodil.ts`.
- Rows in `docs/TESTING.md` (GP4.1) and `docs/systems/plants-species-a.md`.

Definition: tier 2, `medium` (120×160, anchor .5/.92), habitats `['shore']`, bloomColor `#f6f2e8`,
pollinators yes, `nativeName: 'Krinos tis thalassas'` (`el-Latn`, to check with a speaker).

## Range and slots
`range: { realms: ['mediterranean'], biomes: ['coast'], climates: ['mediterranean'] }` (ADR 0361's
words), wild, not cultivated. The test uses the coast's real profile (`COAST_FLORA`) and shows that
the Japanese garden, the waterfall and the oasis do not offer it. Habitat: only `shore`. The research
also lists `path`, but every coast `path` slot is small, and a medium plant does not fit a small slot,
so `path` would offer it nowhere. The coast's medium or larger beach slots are `beach-2` (large) and
`beach-3` (medium).

## How it is painted
- **Leaves:** 10–13 long strap leaves (`#8fa598` toward a deeper blue-grey), arching outward, fitted
  under a cap so the stalk rises above them. Each is a tapered ribbon whose width narrows and
  widens along its length (the twist) with a thinner pale glaucous midline that slides across it.
  Inner ones are painted before the stalk, outer ones after.
- **Stalk and umbel:** a stout pale green-grey stalk, bare, then 4–6 pedicels fanning out. Flowers sit
  on two rings (inner ones close and upright, outer ones farther out), mostly seen from the side, one
  face-on.
- **White flower:** a white flower is the paper. Three steps per umbel: an opaque near-white
  (`PAPER_WHITE`) fill of every flower shape, so the white stays white over sand and over the sea
  (a transparent sprite would show the water through it); a cool grey-green halo laid back to front
  round each flower with the flower's own shape lifted out of it, so the edge is a soft pooled rim and
  never a black line; then each flower is shaded: a cool shadow on the side away from the light, a warm
  cream base on each tepal, a pale midline, and the cup (cool toothed rim, green throat, six filaments
  with pale-yellow anthers).
- **Growth:** seed mound, a few grey leaves (0.06–), the tuft (to ~0.7), the stalk (0.26–0.48), buds
  on the umbel (0.47–), tepals unfurl and the cup opens (to 1.0).
- **Cost:** `def.draw` at 1.6×, growth 1, seeds 2–9, main thread in headless Chromium on the dev
  server (a throwaway probe): 14–23 ms, median about 16 ms. Under the 60 ms aim.

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged.

## Looked at
Scratchpad `gp4-sea-daffodil-stages.png`, `-close.png`, `-lineup.png`, `-garden.png`.
- **Round 1:** the flowers were pale blue spikes: a white tint on a white sprite is invisible, and the
  blue shadow strips drew the flower.
- **Round 2:** negative painting (halo with the shape lifted) made them white with toothed green cups,
  but overlapped heavily and read as a flat umbrella; two rings and side views separated them.
- **Round 3:** in the garden the flowers vanished into the sea behind them (reserved white is
  transparent). Painting opaque paper under them fixed it: white star lilies on a pale sand and on a
  turquoise sea.
- In the tier-2 line-up it stands apart from the iris (violet), the spider lily (red, hair-fine
  stamens), the white water lily (floating pads), the mizubashō (one hood) and the lavender.

## Left open
- The umbel is still rather flat and horizontal, and the pedicels show as straight ribs; a rounder
  head with a few flowers turned away would be closer to the plant.
- The flowers are small against the leaf tuft at overview; the tepals look a little spiky at close view
  and the opaque white shapes have hard edges under the halo.
- The coast has no medium `path` slot; if one is added, add `path` to the habitats.
- The plant card text, "Krinos tis thalassas" and the sunset and night looks were not checked in the
  garden; phone not looked at.
- Not run: the full e2e suite (the task's CPU rules).
