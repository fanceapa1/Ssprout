# 155 · Z26: Light plates wait for the lazy painters

Follow-up to devlog 152 (its "left open"), plus the CI failure of `lazy-painters.spec.ts` that
turned up while the new spec was being checked.

## The light plate race (devlog 152's twin)
- On a repeat visit the landscape comes from the paint cache, so the garden's painters chunk is
  not loaded (ADR 0341). A light plate the cache lacks is then drawn as its grade wash alone
  (no shadows, no crown or window light) until the painters land, and nothing waited for them.
- `CastLight.settled()` resolves once the plates of the last blend are looked up and, on a miss,
  the painters are in. `lightPlatesSettled()` (in `cast.ts`) runs it for every light whose last
  blend lacked a plate. The scene's `whenPainted` (so `scenePainted()` and `camera.settle()`)
  awaits it beside `sky.settled()`. It waits only when a plate is missing, and the miss had already
  started the painters' load, so a warm repeat visit still never requests the chunk.
- A composite drawn while a plate's lookup is still pending is drawn as the wash too, but no
  longer starts the painters' load: only a miss does. A hit resets the key, so the next update
  composes the real plate.

## Why the warm repeat visit asked for the painters (CI's `lazy-painters` failure)
- The first run of the new spec passed without the fix, because the painters chunk was already
  requested at boot. A stack trace logged in `lazyPainters().load` (unminified build) showed
  `init → produce → paintScene → painters.load()`.
- `produce` waits for the landscape's cache lookup for at most `cacheWaitMs` (300 ms), then starts
  the paint job. A late hit cancels that job, but the job's first act is loading the painters.
  The lookup alone measures about 285 ms (scene.md), so a busy machine (CI, two agents here)
  crosses 300 ms. It is a timing race, not the clock or the time zone.
- Fix: past `cacheWaitMs`, a painting that the cache's index lists, or whose index has not
  answered yet, is still reading and decoding. It is now waited for up to `cacheHitWaitMs`
  (4 s) before painting. When the index reports it missing, the 300 ms rule stays as it was.

## Tests
- `light-plates-wait.spec.ts` (new). For the Japanese garden, the waterfall and the oasis, the
  visits open at 02:00 and frame at noon. The first visit stores all 8 plates, then the midday
  light plate is deleted from IndexedDB. The repeat visit holds `painters-*.js` back for 1.5 s and
  must give the `?nopaintcache` frame (painting, sky, light plate, paper) with 0 differing pixels.
  Without the light wait: 499,252, 408,471 and 434,985 differing pixels. Before the scene fix the
  spec could not fail, since the chunk had already landed.
- `cast-settled.test.ts` (new). A light missing its plate settles once the lookup answers and the
  painters land. A cached plate settles without loading them. A draw during the lookup loads
  nothing, and a hit recomposes.
- `scene-cache.test.ts`. A listed hit slower than `cacheWaitMs` is waited for and no paint job
  starts. A listed hit later than `cacheHitWaitMs` is painted over. The mid-paint hit test sets
  `cacheHitWaitMs: 1`.
- Run (one Chrome, `E2E_WORKERS=1`, port 4192): `light-plates-wait` 3 passed, `lazy-painters`
  1 passed (local time zone and `TZ=UTC`), `scene-cache` 6 passed, `plates-cache` 2 passed. Unit:
  `cast-settled`, `cast`, `plate-cache`, `sky-light`, `switch-parts`, `lazy-sprites` (29 passed),
  `scene-cache` (15 passed), and `typecheck`.

## Left open
- `sky-light.ts` has the same "draw while the lookup is pending" path: a draw before the sky
  plate's lookup answers starts the painters' load. Boot draws the sky after the landscape, whose
  lookup is slower, so it has not shown up. The same `pending` check would close it.

Index row:
`| 155 | [Z26: Light plates wait for the lazy painters](155-light-plates-wait.md) | whenPainted awaits lightPlatesSettled(); a listed cache hit is waited for up to 4 s instead of painted over, so a warm repeat visit on a slow machine never loads the painters (CI lazy-painters) |`

TESTING row:
`| S5b.5 | Repeat visit missing its light plate, with a slow painters chunk, frames the same lit noon as a fresh paint, for every garden (devlog 155) | cast-settled.test.ts, scene-cache.test.ts | light-plates-wait.spec.ts | ✔ |`
