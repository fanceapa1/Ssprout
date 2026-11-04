# 101 · S10c: a left-falling shadow mirrors a right-falling one

## What
A boulder's long shadow on the light plate tilted about 27° up and away from the viewer when it fell
left, and lay almost flat when it fell right. The garden showed it at sunrise. Since S10b the
waterfall showed it at sunrise and sunset too (devlog 97, "Left open"). The owner approved the
change to the garden's sunrise.

- **Cause.** `cast.ts › paintShadows` rotated the boulder's ellipse by `angle * 0.15`, with
  `angle = atan2(dy, dx)`. For a right-falling shadow `angle` is about `dy/dx` (a few hundredths of a
  radian). For a left-falling one it is about π, so the tilt was π × 0.15 ≈ 0.46 rad: the term was
  not mirrored, only offset by a half turn.
- **Fix.** The boulder's shadow geometry is now a pure function, `rockShadow(rock, shadow)`. Its tilt
  is `side × atan2(dy, |dx|) × 0.15`. For `dx > 0` that is the old value to the bit (`1 × a` is `a`),
  so right-falling shadows are pixel-identical. For `dx < 0` it is the negated tilt: the mirror.
  Short shadows (midday, night) have no tilt, as before.
- **Not changed.** Shrub and tree shadows were already mirrored: only their `x` offsets and fade
  direction depend on the side. Plant shadows (`src/plants/shadow.ts`) were already placed as a
  mirror (`π − tilt`). The blot's texture is rotated, not flipped, on the left, so its grain is
  upside down there. It is a soft glaze and reads the same. Flipping it would also change the
  moon's left-falling night shadow, so it was left as it is.

## Proof the garden's sunset is unchanged
Studio entries, each canvas read with `toDataURL` at t = 1 on the dev server (port 5427), before
and after the fix, compared pixel by pixel (`artifacts/tilt/diff.ts`):

| entry | pixels that differ |
|---|---|
| `daylight/garden-sunset` | **0** of 936 360 |
| `daylight/cast-sunset` | **0** |
| `daylight/blend-midday-sunset` | **0** |
| `daylight/blend-sunset-night` | **0** |
| `daylight/garden-midday`, `cast-midday`, `garden-night`, `cast-night` | **0** |
| `waterfall-daylight/waterfall-midday` | **0** |
| `daylight/garden-sunrise` | 67 958 (max channel Δ 43) |
| `daylight/cast-sunrise` | 77 982 (Δ 46) |
| `daylight/blend-night-sunrise` | 59 281 (Δ 21) |
| `waterfall-daylight/waterfall-sunrise` / `-sunset` / `-cast-sunset` | 155 742 / 154 769 / 178 964 |

Only the left-falling phases changed. The unit test also pins the right-falling tilt to the old
formula with `toBe`.

## Look (1440×900; `artifacts/tilt/shoot.ts`, `artifacts/tilt/{before,after}/`)
- Garden at sunrise: `garden-sunrise.png`, and the studio's `studio-daylight--garden-sunrise.png` and
  `studio-daylight--cast-sunrise.png`. Before, the boulder shadows ran up-left in diagonal strips.
  After, they lie flat to the left, like the sunset ones mirrored.
- Close on the garden's big left boulder at sunrise: `garden-sunrise-close.png`. Before, two
  diagonal bands crossed the meadow. After, the shadow lies along the ground from the boulder's foot.
- Waterfall at sunset with tall plants and boulders: `waterfall-sunset.png` and
  `studio-waterfall-daylight--waterfall-sunset.png`. Close on the right-hand boulder (`rock-right`)
  among tall plants: `waterfall-sunset-close.png`. Before, the shadow climbed up-left across
  the bank. After, it lies flat to the left.
- Garden at sunset: `garden-sunset.png` (live: it differs only where koi, birds, sway and the toast
  move) and the studio sunset entries above (0 px).

## Tests
- `src/ambience/cast.test.ts` (new): with sun side −1 against +1, every boulder of both sceneries
  gets the exact mirror (centre offset, size, tilt negated, fade direction turned), at both low suns
  and five sun altitudes. A low shadow lies almost flat, dipping toward the viewer on either side.
  The right-falling tilt is pinned to the pre-S10c formula, bit for bit. Midday and night have no
  tilt and no fade.
- `src/plants/shadow.test.ts`: the blot `drawPlantShadow` places with the sun on the other side has
  the mirrored outline (its four world corners), and `shadowBox` gives `π − angle` and the same size.
- Pinned hashes: none changed. The light plates have no recording-hash pin. The waterfall's pins
  (`water`, `veg`, `rocks`) cover the painting, not the light plate.

TESTING row:
`| S10c.1 | A left-falling cast shadow is the mirror image of a right-falling one (boulders on the light plate, plant blots); right-falling shadows unchanged to the pixel | ambience/cast.test (all), plants/shadow.test › with the sun on the other side… | studio daylight sunset entries diffed: 0 px (devlog 101) | ✔ |`

Devlog index line:
`| 101 | [S10c: the shadow's tilt](101-shadow-tilt.md) | A boulder shadow falling left tilted about 27° up and away (atan2 near π); its tilt now turns with the side, so left mirrors right; the garden's sunset is pixel-identical, its sunrise and the waterfall's low suns lie flat | — |`

## Left open
- A plant blot's texture is upside down when it falls left (see above). An exact mirror would need
  `scale(-1, 1)` in `drawPlantShadow`, which also changes the night shadows.
- No ADR. This is a bug fix under ADR 0284, recorded in docs/systems/daylight.md.

## `src/main.ts`
Not touched.

## Status
S10c done. `npm run typecheck` passes. `VITEST_WORKERS=1 npx vitest run src/ambience src/plants
src/scenery`: 81 files, 648 tests passed (77 s). `tests/e2e/daylight.spec.ts` (E2E_WORKERS=1,
E2E_PORT=4391): 10 passed. The rest of the e2e suite was not run locally.
