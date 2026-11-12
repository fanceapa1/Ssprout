# 159 · Z27: The sky waits for its lookup

Follow-up to devlog 155 (its "left open"): the sky got the rule `cast.ts` got in `450571a`.

## The race
- `SkyLight.update` asks the paint cache for the plates the blend lacks and defers the composite
  until they answer. But a draw (`drawSky`, `drawWater`, or a close view's detail) flushes the
  deferred composite at once, and `paint` treated a plate still being looked up like a miss: it
  drew the empty plate and started the garden's painters load.
- Boot draws the sky after the landscape, whose lookup is usually slower, so it never showed. On a
  slow machine a warm repeat visit whose sky read answers after the landscape would request the
  painters chunk for nothing (the class of bug behind CI's `lazy-painters` failure, devlog 155).

## Fix (`src/scene/sky-light.ts`)
- While a plate's lookup is pending, a draw shows the empty plate and loads nothing. The phase is
  remembered as drawn empty.
- When that lookup answers: a hit (or painters already in) resets the key and calls `onPainters`,
  so the next update composes the real plate; a miss starts the painters load as before, and
  their landing recomposes.
- `settled()` is unchanged and still correct: it awaits the lookups of the plates the current
  light lacks and, on a miss, the painters. After a hit the reset key makes the still frame's
  update recompose.
- The `onPainters` option now means "a plate drawn empty can be drawn for real". The scene's
  handler (`system.ts`) already does the right thing (sky check now, background invalidated), so
  `system.ts` is not touched.

## Tests
- `src/scene/sky-settled.test.ts` (new), in the style of `cast-settled.test.ts`: a draw (sky,
  water and a detail view) during a pending lookup loads nothing, a miss then loads the painters
  and `settled()` waits for them; a draw during the lookup followed by a hit calls `onPainters`,
  recomposes on the next update and never loads them; a hit before any draw composes without a
  reset. Without the fix the first two fail.
- `tests/e2e/lazy-painters.spec.ts`: a third visit with `e2eslowsky=1500`, an init script that
  answers the paint cache's `sky-plate` IndexedDB reads 1.5 s late. It must take the plate from the
  cache (`painted: 0, cacheHits: 1`) and never request the garden's painters chunk. Without the
  fix it fails (`painted: 1, cacheHits: 0`).
- Run (one Chrome, `E2E_WORKERS=1`, port 4191, `nice -n 19`): `lazy-painters` 1 passed (and 1
  failed against the pre-fix `sky-light.ts`), `scene-cache` 6 passed. Unit
  (`VITEST_WORKERS=1`): `sky-settled`, `sky-light`, `scene-cache`, `plate-cache`, `cast-settled`
  (35 passed), and `typecheck`.

## Left open
- Nothing known for the sky. The landscape's own lookup already waits (devlog 155).

Index row:
`| 159 | [Z27: The sky waits for its lookup](159-sky-lookup-race.md) | A sky drawn while its plate's cache lookup is pending draws empty and loads no painters; only a miss loads them, a hit recomposes on the next update |`

TESTING row:
`| S5b.6 | Warm repeat visit whose sky plate read answers late takes the plate from the cache and never requests the painters chunk (devlog 159) | sky-settled.test.ts | lazy-painters.spec.ts | ✔ |`
