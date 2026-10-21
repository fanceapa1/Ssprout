# 07 — Scene: the painted garden

## What
- `src/scene/`: real geometry (`gardenScene`: kidney pond with a lobe running to the engawa,
  11 boulders with 5 perches, 5 stepping stones, pavilion + lantern, sky band) and 52 slots
  (water 7 · shore 9 · meadow 16 · path 7 · back 7 incl. 3 tree · rock 6) with perspective scale
  and canonical plant sizes (`PLANT_SIZES`).
- The landscape painted only with the paint engine, as ordered steps: barely-there sky, two pale
  hill ridges and a scalloped far tree line, receding banks, the pond (reserved rim, banded
  celadon, sky band, ripples, far-shore ink), static reflections (bank, trees, shrub, boulders,
  pavilion posts, broken by lifted strokes), the earthen path with stepping stones, two tree
  groups, shrubs, the engawa corner with a hanging lantern, soft tufts and unpainted-paper margins.
- Boulders and foreground tufts are entity sprites (depth = base y). Animated water surface
  (shimmer, ripple rings every 9 s, glints). Paper layer system. `?dev&slots` overlay.
- `createSceneSystem` replaces the placeholder background in `main.ts`; the placeholder files are
  gone. Studio section `scene` (9 entries). 28 unit tests, 4 e2e tests. ADRs 0040–0043.
- Outside my paths (minimal, needed to keep things green): `renderer.test.ts` imports
  `gardenScene`; `tests/e2e/studio.spec.ts`, `docs/systems/studio.md` and the `scripts/shots.ts`
  usage comment point at `scene/full` instead of the removed `scene-placeholder/background`.
  No paint engine changes.

## Critique → improve rounds
1. First paint: pond, rocks, stones read as watercolour. Hard horizontal bank stripes, a stark
   straight "road", far tree line as bubbles, no visible margins, heavy pavilion wall, stiff trees.
2. Banks rebuilt, path lifted, scalloped tree line, wider margins, bent stems + more pads.
   Still pasted-looking bank bottoms, dark spiky tufts, stick-like trunk reflections, teal pond.
3. Banks with lit lips that dissolve downward, softer/fewer tufts, greyer celadon, weaker trunk
   reflections, trees shifted so foliage frames the phone crop. Path now a crisp white strip.
4. Mounds reshaped around an unpainted path, rim thin at the far edge / wider near
   (perspective), pavilion painted after the margins so it runs off the sheet, greyer rocks.
5. Perf: draft painter for soft washes, paint scale capped at 1.5 (indistinguishable from 1.8 at
   DPR 2, ~40 % cheaper). Slot review with the overlay; a few slots moved off the water.
6. Contact shadows under boulders (darkest accents), foreshortened softer rock reflections.
7. Path widens toward the viewer between diagonal mound edges; mobile crop checked.

## Left / known weaknesses
- Paint time at DPR 2 measured 1.4–1.9 s CPU on a loaded machine (load avg ≈ 4), likely ≈ 1.2 s
  idle; boulder sprites are the biggest item. A Worker + OffscreenCanvas path would remove all
  main-thread cost (the paint job is already a generator) — not done.
- Near-mound lips are still fairly straight horizontals; foliage pads are uniform in hue; the
  trunks are thin single strokes without bark texture.
- The pavilion is simple (no roof tiles' depth, no shadow under the deck on the water).
- Plants are not reflected yet (the plants task owns plant reflections, ARCHITECTURE layer 2).

## Full-garden screenshot
`npm run shots -- --eval "await sprout.addPlants(30)" --name full` (once species exist), or
`npm run shots -- --query slots` to review slot placement.
