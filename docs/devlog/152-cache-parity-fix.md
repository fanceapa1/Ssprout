# 152 · Fix: cached landscape matches a fresh paint again

Bug fix. CI on `main` was red: `scene-cache.spec.ts › a repeat visit draws the landscape from the
cache, pixel for pixel what a fresh paint gives` saw about 449,000 differing pixels. Bisected to
`837f2d5` (Z7, ADR 0341: each garden's painters in a lazy chunk).

## What differed
CI's failure screenshot was the cached garden with **no sky at all**: no blue wash, the paper
showing through above the hills. The landscape, sprites and paper were fine. The sky plate was the
empty one `sky-light.ts` draws while the garden's painters are still loading.

## Cause
- The test frames at `setTime('noon')`. The dev clock starts at the real hour, so on CI (23:30 UTC)
  the first, caching visit ran at night. It stored the night (and next) sky plates, not midday's.
- On the repeat visit the landscape comes from the cache, so the painters chunk is never loaded.
  `setTime('noon')` then asks for the midday sky plate. The cache misses, and since Z7 the plate
  cannot be painted on the spot. The sky draws an empty plate, starts the painters' load, and
  recomposes when they land.
- Nothing waited for that load. `camera.settle()` → `whenPainted` covered the landscape jobs only,
  and `freeze()` then drew the empty sky. Locally the chunk usually landed in time (the test passed
  at 01:42 here). On CI it never did.
- Before Z7 the midday plate was painted synchronously inside the compose, so the race did not exist.

## Fix
- `PlateCache.whenAnswered(phase)` resolves once a plate's lookup has answered.
- `SkyLight.settled()` resolves once the plates the current light needs are looked up and, on a
  miss, the scenery's painters are loaded. When they land, `onPainters` resets the sky's key, so
  the next update composes the real plate.
- The scene's `whenPainted` awaits `sky.settled()`. This is the readiness signal behind
  `scenePainted()` and `camera.settle()`. It waits only when a needed plate is missing and the
  painters are not loaded, so a warm repeat visit still never requests the chunk (`lazy-painters`
  passes). The first view's size is unchanged.

## How it was found
- `gh run download` of the failing run's traces. The failure screenshot showed the missing sky.
- A local run with a PNG dump of both frames matched (the local frame had its sky).
- The race was made deterministic: the visits open at 02:00 (`e2eat`), and the repeat visit holds
  the `painters-*.js` chunk back for 1.5 s with `page.route`.
- That reproduced 449,231 differing pixels, and the fix brings it to 0.

## Tests
- `scene-cache.spec.ts`: the pixel test now runs for the Japanese garden, the waterfall and the
  oasis. Without the fix all three failed (449,231, 361,864 and 308,824 pixels). It pins the
  visits to 02:00, delays the painters chunk, and checks that the midday sky was painted on the
  repeat visit.
- `openAt` (the `e2eat=HH:MM` init script) is now exported from `fixtures.ts`.
  `plates-cache.spec.ts` and `lazy-painters.spec.ts` still keep their own copies.
- `plate-cache.test.ts`: `whenAnswered`.
- Run: `scene-cache.spec.ts` (6 passed), `lazy-painters.spec.ts` (1 passed),
  `plates-cache.spec.ts` (2 passed), the unit tests `plate-cache`, `scene-cache` and `sky-light`,
  and `typecheck`.

## Left open
- The cast light (`ambience/cast.ts`) has the same shape: a missing light plate draws the grade
  wash alone until the painters land, and only the detail plate has a wait (`whenDetail`'s poll).
  No spec frames the lighting layer at a phase the cache lacks, so nothing fails today. A
  `settled()` like the sky's would close it.

Index row:
`| 152 | [Fix: cached landscape matches a fresh paint again](152-cache-parity-fix.md) | Since Z7 the sky drew an empty plate while the lazy painters loaded and nothing waited; whenPainted now awaits SkyLight.settled() |`

TESTING row:
`| Repeat visit's cached landscape equals a fresh paint, for every garden, with a missing sky plate and a slow painters chunk (devlog 152) | e2e scene-cache.spec.ts |`
