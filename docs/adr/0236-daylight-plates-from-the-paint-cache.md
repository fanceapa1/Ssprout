# ADR 0236: The daylight plates from the paint cache

- Status: accepted
- Date: 2026-10-25
- Amends: ADR 0145 (painted sky plates), ADR 0147 (painted light plates)

## Context
After ADR 0228 the landscape comes from the persistent paint cache (ADR 0227), and the sky and
light plates became the largest work left before it shows on a repeat visit (load report P0b,
T14; devlog 49). Measured on the baseline at 1440×900 @2: every load painted the sky and water
plates of the phase in use (80–85 ms) inside the scene's `init`, which runs in the first boot
task, and the light plate of that phase (56–61 ms, with the wash's noise fields) on the first
frames. Each plate depends only on code, the garden's seed and geometry, and the phase. The
moving parts (the sun, the moon, the blend weights, the lantern) are laid on in the composites,
which are cheap and rebuilt as before.

## Decision
- **What is stored.** One entry per phase and plate:
  - `sky-plate`: the sky plate (1120×518 px) with the phase's water plate (408×141) packed below
    it, so one read and one decode give both.
  - `light-plate`: the light plate (640×400): the grade wash with its shadows, crown lights,
    lamp light and stars.

  Not stored: the composites (they hold the sun, the moon and the blend, which move
  continuously), the sky's close-view composite (an upscale and three punched discs, cheap) and
  the light plate's close-view detail plates (below).
- **Keys** (`skyPlateKey` in `sky-light.ts`, `lightPlateKey` and `castPrint` in `cast.ts`):
  - sky: `s<seed>|<phase>|<w>x<h>|<water rect x,y,w,h>@<w>x<h>`, e.g.
    `s7|midday|1120x518|450,442,816,281@408x141`;
  - light: `<seed>|<phase>|<w>x<h>|g<fingerprint>`, e.g. `ambience-cast|sunset|640x400|gztk5aq`,
    where the fingerprint is an FNV-1a hash of the geometry and the art the plate is painted from
    (pond, waterline, rocks, pavilion, trees, shrubs). The app's geometry is code, but the studio
    paints other scenes with the same seed.

  Scales and rects are code, so the cache version covers them. They are in the key anyway, as
  pixel sizes, so a mismatch can never be read back.
- **Which phases.** The plates are looked up exactly when they were painted before: the phases
  in the blend in use, and the coming phase in idle time (`prepare`), which is now a lookup that
  paints in idle time only on a miss. Over a few visits all four phases are stored: 4.0 MB of
  PNG (sky 0.84–0.91 MB and light 0.03–0.21 MB per phase; two phases, about 2 MB, after a first
  visit). Next to the landscape's 6.8 MB and a
  few resting views that stays well inside the 48 MB cap. They are read on every visit, so least
  recently used eviction drops resting views first. Nothing is pinned.
- **Look up first, compose on the answer or on the first draw.** `update` asks for the plates
  the blend lacks. While a lookup is out, the composite is deferred, and `update` still returns
  true, so callers invalidate as before. The composite is built when the answers are in: from
  the stored plates on a hit, painting a miss as before. Every draw (`drawSky`, `drawWater`, the
  light's `canvas` and `version()`) first composes a deferred change, painting what is still
  missing. A frame never shows a stale composite, so readiness (`renderer.whenReady()`,
  `scenePainted`, `lightDetail().ready`, `settleAmbience`, `freeze`) is unchanged, and so is
  every caller. At boot the sky is drawn only once the landscape is there (its lookup takes
  longer), and the light only once it is revealed (ADR 0121). In practice the answers always
  come first. A dev `setTime` to an uncached phase paints at once, as before.
- **Stored only after a miss.** A painted plate is stored when its lookup missed. If the plate
  was painted before its lookup answered, the put waits for the answer. A plate painted without
  a lookup is looked up first, so the cache never encodes what it already holds. Puts pass
  `{ copy: false }`: nothing draws on a finished plate again.
- **Exactness.** A hit is cut 1:1 (`copy`, no smoothing) into canvases (`cutImage`), never drawn
  from the decoded bitmap, because the close views draw the plates scaled (ADR 0228).
- **Off.** With the null cache (`?nopaintcache`, the dev server, Vitest, no IndexedDB) the
  modules take the old path, painting synchronously. `createSkyLight({ cache })` and
  `createCastLight(…, { cache })` inject a cache. The default is `paintCache()` unless
  `paintCacheOff` says it is off.
- **The light's wash fields are lazy.** `washField` (noise grids and the pond mask) is built
  only when a plate or a detail plate is painted. A detail plate over a stored plate rebuilds
  its grade wash (`gradePlate`, deterministic) when it is first needed.
- **Counters.** `skyStats()` adds `painted`, `cacheHits` and `cacheMisses` (`plates` now counts
  plates held, painted or stored). `sprout.lightPlates()` gives `{ painted, cacheHits,
  cacheMisses }` over the page's light plates. `ambience().lightingMs` stays the plates' paint
  time, so it is 0 on a repeat visit.

## Not cached: the light's close-view detail plates
A resting close view paints each phase's marks again at up to 2 px per unit for its rect, one
phase per idle callback (ADR 0163): 27–126 ms per phase for a zoom-3 view at 1440×900 @2
(1188×760 px). That is idle work after the camera rests, not boot work. Its
key would hold the view rect, so every resting view would add an entry per phase. That is churn
that evicts the landscape and the scene's detail paintings, which save more. It stays painted.

## Measured
Production build, 1440×900 @2, headless Chromium, `nice -n 15` on the shared laptop, at night
(the real clock). One context per run: a first visit, then a traced repeat visit. Scratch
scripts `perf/p18-repeat.mjs` and `p18/measure.sh`. Results in devlog 57.

## Consequences
- The sky's plates no longer paint in the first boot task. On a first visit they paint when
  their lookup misses, between the landscape's paint steps, so the first contentful paint comes
  earlier on both paths.
- The app now also stores plates after load, the coming phase's in idle time, at any moment. The
  specs that count entries count only their own kinds (`storedOf` in `tests/e2e/paint-store.ts`).
  `paint-cache.spec.ts` runs with `?nopaintcache` and its own cache on the app's store
  (`sprout.paintCache.open()`), so the app writes nothing in the middle of it.
- Light detail plates and the plant sprites (T15) remain painted on every visit.
