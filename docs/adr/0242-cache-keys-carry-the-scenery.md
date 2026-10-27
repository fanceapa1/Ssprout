# ADR 0242: Paint-cache keys carry the scenery id

- Status: accepted
- Date: 2026-10-28
- Amends: ADR 0227 (persistent paint cache), ADR 0228 (landscape from the cache), ADR 0236 (daylight plates from the cache)

## Context
Two sceneries will share one paint cache and switch at runtime (ADR 0241). Their paintings can
share a seed, a rect and a scale, and the studio paints other scenes with the app's seeds. The
cache version covers the code, not which scenery a painting is of.

## Decision
- Every paint-cache key starts with the scenery id and a `|`:
  - `scene`, `scene-detail`: `japanese-garden|s7|normal|0,0,1600,1000@1.5|2400x1500`
    (`paintingKey`, from `SceneArt.scenery`);
  - `scene-sprites`: `japanese-garden|s7|normal@1.5` (`spritesKey`);
  - `sky-plate`: `japanese-garden|s7|midday|1120x518|450,442,816,281@408x141`
    (`skyPlateKey`, from `createSkyLight({ scenery })`);
  - `light-plate`: `japanese-garden|ambience-cast|sunset|640x400|g<print>`
    (`lightPlateKey`, from `createCastLight(…, { scenery })`).
- `src/scenery` joins `PAINT_ROOTS`: the sceneries' numbers decide pixels, so they are in the
  paint version.
- The ambience shares one light per scene, scenery and seed.

## Consequences
- The first visit after this deploys repaints once: the version changed with the new root, and
  old keys would not match anyway.
- A future kind (the S5 `scenery-thumb`) follows the same rule.
