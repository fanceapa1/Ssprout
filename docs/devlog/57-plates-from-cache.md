# 57 — P18: the daylight plates from the paint cache

## What
P8 (devlog 49) left the sky and light plates as the largest work before the landscape shows on a
repeat visit (load report P0b, T14). On the baseline every load painted the plates of the phase
in use: the sky and water plate (80–85 ms) inside the scene's `init` in the first boot task, and
the light plate (56–61 ms, with its wash noise fields) on the first frames. Now they come from
the persistent paint cache (ADR 0236).

- `src/ambience/plate-cache.ts` (new): `createPlateCache` looks a phase's plate up once (`request`,
  `pending`, `load`, `answered`) and stores a painted plate only after its lookup missed
  (`painted`), with `{ copy: false }`. It also has `cutImage` (a 1:1 canvas copy of a decoded
  image), `fingerprint` (FNV-1a over JSON) and `defaultPlateCache()` (`paintCache()`, or null when
  `paintCacheOff`).
- `src/scene/sky-light.ts`: kind `sky-plate`, one image per phase (the sky, with its water plate
  packed below). The key is `skyPlateKey` (`s7|midday|1120x518|450,442,816,281@408x141`).
  - `update` asks for the plates the blend lacks and defers the composite while one is out.
  - `drawSky`/`drawWater` compose a deferred change first.
  - `prepare` is a lookup that paints in idle time on a miss.
  - `stats()` adds `painted`, `cacheHits` and `cacheMisses`, and `plates` now counts plates held.
- `src/ambience/cast.ts`: kind `light-plate`, keyed by `lightPlateKey`
  (`ambience-cast|sunset|640x400|g<fingerprint>`). The fingerprint is `castPrint` of the geometry
  and art the plate is painted from.
  - It defers the same way; `canvas` (now a getter) and `version()` compose first.
  - `washField` is lazy, and a detail plate over a stored plate rebuilds its grade wash.
  - `lightPlateTotals()` is shown as `sprout.lightPlates()` (`src/ambience/dev.ts`).
- `src/ambience/system.ts`: the light's reveal after the landscape (ADR 0121) also waits, at most
  0.3 s, until `lightPlatesPending()` is false. That wait was added after rebasing onto the staged
  boot (P14, ADR 0232): the ambience now starts after the landscape, and the reveal's first lit
  frame painted the light plate a few ms before the cache answered (`painted: 1`, 43–48 ms).
  `settleAmbience` and still frames do not wait. `scene/system.ts`, `ambience/ambience.ts` and
  `main.ts` are untouched.

## Why / decisions (ADR 0236)
- **Cache the per-phase plates, never the composites.** The sun, moon, blend weights and the
  lantern move continuously, and they are laid on in the composites, which are cheap and built
  as before.
- **Compose on the answer or on the first draw.** `get` is asynchronous, and the plates were
  needed synchronously. Instead of awaiting in `init`, which would change readiness and callers,
  the composite waits for the lookup. Every draw path composes a deferred change first and paints
  what is still missing. So no frame is ever stale, and `whenReady`, `scenePainted`,
  `lightDetail().ready`, `settleAmbience` and `freeze` are unchanged. At boot the sky is drawn
  only once the landscape is there, and the light only once it is revealed (ADR 0121). The
  plates' lookups (smaller PNGs) always answered first in the runs below.
- **Which phases.** Exactly the ones painted before: the blend in use, and the coming phase in
  idle time. Over visits all four are stored: 4.0 MB of PNG, against 6.8 MB for the landscape.
  They are read on every visit, so LRU drops resting views first, and nothing needs pinning.
- **Not cached:** the light's close-view detail plates. A zoom-3 view at 1440×900 @2 is 1188×760
  px and costs 27–126 ms per phase, in idle callbacks after the camera rests. Its key holds the
  view rect, so caching it would churn the store. The sky's close-view composite is an upscale
  plus three discs.
- **Exactness:** a hit is cut 1:1 into canvases, following the P8 lesson, because close views
  draw the plates scaled. Plates are opaque (painted over white), so the round trip is exact
  anyway.

## Measured
Production builds of `a44f548` (before) and this branch (after), each in its own outDir, served
on port 4349. 1440×900 @2, headless Chromium, `nice -n 15`. Each run is one context: a first
visit, then a traced repeat visit. Runs were at about 03:15–03:35, so the phase was night, with
sunrise prepared in idle. The other agent was running at the same time (load 4–15). Scratch
scripts: `perf/p18-repeat.mjs` (p8-repeat plus the plates' counters), `p18/measure.sh`,
`perf/p18-detail.mjs`.

| | before | after |
|---|---|---|
| repeat: landscape on screen (ms after navigation) | 435, 437, 433 | 378, 359, 425, 391, 353 (982 under a load spike) |
| repeat: main-thread busy before it (ms) | 448, 447, 446 | 368, 366, 375, 358, 369 (825) |
| repeat: long tasks before it | 1 (302, 296, 297 ms) | 1 (201, 209, 190, 199, 202 ms; 257) |
| repeat: first contentful paint (ms) | 377, 383, 381 | 271, 281, 291, 275, 269 (573) |
| repeat: sky plates painted / their paint ms | 1 / 80–85 | 0 / 0 (1 hit) |
| repeat: light plates painted / their paint ms | 1 / 56–61 | 0 / 0 (2 hits: night, and sunrise in idle) |
| first visit: landscape on screen (ms) | 1664, 1605, 1601 | 1623, 1772, 1840, 1812, 1748, 1811 |
| store after a first visit (bytes) | 6 778 665 | 8 814 455 (+2.04 MB: two phases) |

A second "before" batch ran during a load spike (landscape 648–760 ms, 2 long tasks) and is left
out of the table. The repeat visit's boot task is about 100 ms shorter, because the sky no longer
paints in `init`. The landscape shows 50–80 ms earlier, and about 80 ms less main-thread work
comes before it (about the sky's share). The light plate's 56–61 ms fell after the landscape in
these runs and are gone as well. The first visit lands within the run-to-run noise of this
loaded machine. Its plates still paint there, as their lookups miss, and their PNG encodes run
in idle time.

All four phases stored: sky 843–913 KB per phase, light 29 KB (midday) to 210 KB (night), 4.03 MB
in all.

## Tests
- Unit `src/ambience/plate-cache.test.ts` (9):
  - one lookup per plate, and a hit installed and never stored again;
  - a miss stored without a copy;
  - a plate painted mid-lookup stored only on a miss;
  - a plate never looked up is looked up before it is stored;
  - a wrong-sized image counts as a miss;
  - no cache means nothing is looked up;
  - the sky and light keys and the fingerprint.
- E2E `tests/e2e/plates-cache.spec.ts` (2), with boots pinned to 12:00 and 01:00 by an init
  script (`&e2eat=HH:MM`) and reduced motion (the lantern's flame):
  - A repeat visit paints 0 sky and 0 light plates, has hits, and has `lightingMs` 0. Its frames
    (painting, sky, light plate and paper) have **0 differing pixels** against `?nopaintcache` at
    midday, at night and in a zoom-3 resting view (`x 1180, y 380`).
  - A plate not in the cache is painted and stored.
- `tests/e2e/scene-cache.spec.ts` counts only `scene`/`scene-sprites` entries
  (`tests/e2e/paint-store.ts` › `storedOf`). `paint-cache.spec.ts` now runs with `?nopaintcache`
  and its own cache on the app's store (`sprout.paintCache.open()`), because the app now stores
  plates in idle time at any moment after load. That also took its two tests from 17–54 s to
  2–3 s.
- daylight, ambience, camera, scene-cache and paint-cache specs pass (single worker).
- TESTING row P18.1; P7.1's status updated.
- Full run: see the end of this entry.

## Left open
- **The light's close-view detail plates** (27–126 ms per phase in idle) are still painted on
  every rest. They could be cached per view like the scene's detail paintings, under a separate
  budget so they never evict the landscape.
- **First visit:** the plates' PNG encodes (about 0.9 MB for a sky) run in idle time with
  `persist.ts`'s 1 s idle timeout. On a loaded machine they may land during the landscape's
  painting. This was not profiled separately.
- **Exactness was checked in headless Chromium only**, as in P7 and P8.
- No studio entry: nothing new is painted.
