# 95 · S17: waterfall acceptance and release

## What
The rocky waterfall is offered to everyone, not only under `?dev&scenery=waterfall`.
- **Release.** `WATERFALL.available` is `() => true` and `waterfallAvailable` is gone. Nothing
  else in the code assumed one garden: the Gardens section already appears whenever more than one
  scenery is offered, the herbarium names gardens once it holds two, and onboarding has no garden
  step. `DEFAULT_SCENERY` is still the Japanese garden and `state.scenery` is still saved, so a new
  user starts in the garden and an existing user keeps the garden they had on view.
- **Tests that pinned the old offer** now expect both gardens: the registry and waterfall unit
  tests, `sceneries.spec` (both offered without a flag), `gardens.spec`, and the reading-spine
  lists in `ui-shell`, `wayfinding` (five stops) and `backdrops` (five sheets). `fauna-waterfall`
  and `sound-mixer` no longer pass the flag.
- **New tests**:
  - `gardens.spec › released`: without `?dev` (no debug API) both cards show, the garden is on
    view, choosing the waterfall saves it and a reload comes back to it.
  - A **real v3 export**: `src/core/fixtures/garden-v3-export.json`. It was made by building the
    last schema-v3 commit (`fcad95e`) and using that build's own Export button. Before exporting, a
    script drove the build: twelve days of history, plants, a swap that pressed a balloon flower,
    a weekday schedule, a waiting and an active session, and a sound mix set in the mixer.
    `migration-v4.test › a real v3 export (S17)` checks that it imports with every plant, pressed
    flower, session, log entry, schedule, tip and sound level intact, all in the Japanese garden,
    and that it exports again as v4 unchanged.
  - `garden-import.spec`: the same file through Garden data, with the waterfall on view at the
    time. It lands in the Japanese garden, which shows its plants; the waterfall shows none. A v4
    export with plants in both gardens survives a reset and an import, and each garden shows its
    own plants again.
- **Docs audit of the scenery area**:
  - SPEC has §1a Gardens and Gardens in the dock order. §3, §8 and §9 *Status* notes are true
    again (the sound note still said "current shipped scenery: the pond").
  - ARCHITECTURE: layers 0–2 name the waterfall's painting, fish and motion; the Sceneries ADR
    list is complete; the flag text is gone; audio follows `scenery.sound`.
  - `docs/systems/scenery.md`: the contract lacked `sound`; added the host files, the waterfall's
    17 species and switch times; removed the "in progress" and placeholder text; the open items
    are S6b, S10b and S5b.
  - The flag also came out of `ui.md`, `fauna.md`, `species-recipe.md` and the README.
- **Repaired docs**:
  - `docs/adr/README.md` had been cut to its last rows in `dbb65d1`; it is restored from
    `b9c51c4` plus 0281–0283.
  - `docs/TESTING.md` had lost "Beyond the SPEC" and "Open gaps" in `17a0ef6`. Both are restored,
    with three new gaps.
  - The scenery matrix had four copies of S4.1 and rows out of order. It is rebuilt: one row per
    id, S1–S17, then flora, scaffolding, W and C. S11.8 is now ✔ (the fireflies).

## Switch times
Production build (`vite preview` on 4384), headless Chromium, `nice -n 19` on the owner's laptop
while it was busy. Script: `showScenery` timed from the dispatch until it resolves ("ready"),
then until the cross-fade ends ("settled", +0.9 s). Desktop: 3 runs; phone: 2.

| Switch | Desktop 1440×900: ready (settled) | Phone 390×844: ready (settled) |
|---|---|---|
| cold → waterfall (nothing cached) | 5.8–7.0 s (6.7–7.9 s) | 2.4–2.8 s (3.5–3.8 s) |
| cold → Japanese garden (booted on the waterfall) | 4.5–4.9 s | — |
| warm → garden | 0.18–0.29 s (1.08–1.18 s) | 0.01–0.09 s (0.93–0.99 s) |
| warm → waterfall | 0.38–0.57 s (1.24–1.46 s) | 0.16–0.20 s (1.03–1.09 s) |
| after a reload → waterfall (persisted cache) | 0.49–0.56 s (1.35–1.44 s) | 0.20–0.22 s (1.07–1.10 s) |

Warm switches are one cache hit and no paint. They are ready in under 0.6 s and settled in under
1.5 s with the fade, so nothing is "badly slow". The cold first visit is the slow one: 5–7 s on a
loaded desktop. It paints in parts between frames, so the page stays responsive, and the old
garden covers the stage until the new one is ready.

## Shots
`artifacts/shots/s17-{japanese-garden,waterfall}-{noon,sunset,night}-{1440x900,390x844}.png`.
Each has 22 real species from that garden's flora, settled, and the light pinned (one viewport per
run, against the preview build). What I saw:
- **Both gardens read as one watercolour world.** The falls are white-streaked paper with foam, the
  pool is a cooler blue than the pond, the ledges carry their plants, and the waterfall's own
  species (mizubashō, kurinsō, yamabuki, katsura) sit in the right habitats.
- **Sunset**: the waterfall's sun sets right of the buttress over the ridge, and the pool takes the
  warm sky. **Night**: the falls are moonlit, there are fireflies over the pool, and the garden has
  its lamp.
- **Phone**: the waterfall's crop keeps the whole falls, the pool and the trail. At sunset on the
  phone the sun is only half in the frame, cut by the right edge. scenery.md says the phone crop
  shows the setting sun; it shows only part of it. This is minor, but the composition (ADR 0245)
  may want the focus a little to the right.
- **Known, not new**: the buttress's right flank reads see-through against the far ridge,
  strongest at noon and night (S6b). Boulder shadows and rim light fall as in the garden (S10b).
- Nothing broken: no missing sprites, no paper patches, no layer seams.

## Fixed on the way
- The waterfall's flora pin was still named "shares exactly the five" while it listed 17.

## Left open
- **`deferred-dock › Begin only marks “Your plant”` is near its bound.** Begin's click handlers
  must stay under 100 ms. On this loaded laptop they took about 90–95 ms before the release and
  105–110 ms after (2 of 3 runs failed). A CPU profile shows almost all of it is one forced layout:
  `settleAside` reads `scroller.state()` (`scrollHeight`) and `getBoundingClientRect` right after
  the mode change. The Gardens section adds about 16 ms to that layout. Rewriting the Gardens
  marks only on a change did not help. Suggest a task to take the forced layout out of Begin (or
  to measure the bound on CI before changing it). It was not changed here.
- Under three e2e workers on the loaded laptop, the switching specs timed out (cold waterfall
  paints); with one worker they all pass.
- S6b (rock forms), S10b (sun-side shadows and rim light), S5b (painted thumbnails) stay queued.
- The cold first visit (5–7 s on a loaded desktop) could start painting the other garden in idle
  time after boot. It was not attempted.
- Nobody has listened to the waterfall's sound by ear yet (devlog 94).

## `src/main.ts`
Not touched.

## Status
S17 done. Checks: see the report (`npm run typecheck`, `npm test`, and the e2e specs this task
touched, with one worker; the full e2e suite runs on CI, per the coordinator).
