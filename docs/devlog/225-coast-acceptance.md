# 225 · G8: The Greek coast, acceptance

## What
The acceptance pass of the fourth garden (`coast`, phase 15). It measured the coast on a quiet
machine, looked at it at noon, sunrise, sunset and night in the owner's window (1470 × 750 at
DPR 2), at 1440 × 900 and on a phone (390 × 844 at DPR 3), checked the contract additions against
the tests, audited the docs and wrote down what a release would touch. The garden stays behind
`?dev&scenery=coast`; releasing it is the owner's decision.

**Verdict: ready after a short list.** The painting, the sea, the creatures and the planting flow
work and hold up close, and every cost but one is inside its budget. Before the owner's first
look as a released garden, five things hurt the most (open items 1–5 below): the terraces' ruled
seaward edge, the two pines cut to bare poles in the owner's window, the shared plants' cards
speaking of palm groves and Darija, the cyclamen and ice plant out of scale and pasted on, and
the left side's paper veil over the far hill.

## Measured
Production build (`vite preview` on 4368), Chrome for Testing headless with the GPU on
(`--use-angle=metal --enable-gpu-rasterization`), Apple M3, no other agent running; the owner's
own dev server and browser were open. Scripts in the session scratchpad (`g8/measure.mjs`).
Each cell is three runs; the 1-minute load average is beside each block.

### Frame cost (`frameStats().workAvg`, main-thread ms a frame, 5 s a run, overview at noon)
With 25 plants, the fauna muted (so only the scene, the plants and the ambience draw):

| window | motion on | `waterSurface` muted | reduced motion | difference | with the fauna | load |
|---|---|---|---|---|---|---|
| 1470 × 750 @2 | 1.61, 1.81, 1.76 | 1.49, 1.20, 1.67 | 1.09, 1.31, 1.10 | 0.52, 0.50, 0.66 | 2.10, 2.10, 2.18 | 2.9–3.1 |
| 1440 × 900 @2 | 1.79, 1.83, 1.66 | 1.67, 1.53, 1.60 | 1.26, 1.45, 1.32 | 0.53, 0.38, 0.34 | 1.89, 1.90, 2.05 | 2.5–3.3 |
| 390 × 844 @3 | 1.29, 1.26, 1.06 | 0.80, 0.92, 0.78 | 0.67, 0.72, 0.76 | 0.62, 0.54, 0.30 | 1.33, 1.57, 1.51 | 2.3–2.4 |

The empty garden (GS2's setting), fauna muted, gives the cleanest reading of the motion:

| window | motion on | `waterSurface` muted | reduced motion | motion (on − reduced) | load |
|---|---|---|---|---|---|
| 1470 × 750 @2 | 1.26, 1.30, 1.30 | 0.41, 0.42, 0.41 | 0.27, 0.30, 0.28 | 0.99, 1.00, 1.02 | 2.8–4.1 |
| 390 × 844 @3 | 0.99, 0.96, 0.89 | 0.40, 0.43, 0.42 | 0.31, 0.28, 0.30 | 0.68, 0.68, 0.59 | 3.0–3.5 |

**The coast's motion costs about 1.0 ms a frame in the owner's window and 0.6–0.7 ms on a phone:
inside the 1.5 ms budget**, with about 0.5 ms to spare. With plants on the terraces the difference
reads smaller (0.3–0.66 ms), not larger; the plants' own frame grows under both settings, and the
runs were not long enough to say why. Every interval was 16.67 ms (no dropped frames).

**The raised cap.** `motion.test.ts` caps the area the motion draws per frame at 560 k world
units² (GS2 raised it from 400 k). The worst frame over 60 s of the test's run draws 525 k units²
and 247 blits (cap 300). The real cost of that area is the 1.0 ms above, so the cap is justified:
it is a tripwire about 7 % above today's worst frame, not a budget, and any widening of the bands
will trip it, which is what it is for.

### Fauna roster (`sprout.fauna.bench`: `bench(60)` untimed, then `bench(120)` three times, ms)
25 plants; by day everything out: the cat, lizard and crab residents plus 2 gulls, a cicada,
2 butterflies, a crab, 3 bees, 2 swallows, the thrush, the goats, the tortoise, the shoal, the
octopus, the heron and a pod of five (19–23 creatures after the 25 s step that brings them on);
the close view is zoom 3 on the middle terrace; at night the owl, two more crabs and the cat.

| window | day, everything out | close view | night | load |
|---|---|---|---|---|
| 1440 × 900 @2 | 1.66/1.89/1.84 · 1.73/1.61/1.66 · 2.24/1.79/1.49 | 2.08/1.60/1.68 · 1.63/1.57/1.87 · 2.00/1.77/1.63 | 0.63–0.75 | 2.3–2.6 |
| 1470 × 750 @2 | 2.58/2.40/2.12 · 1.87/2.37/2.32 · 1.44/1.43/1.37 | 1.51–1.52 · 1.48–1.68 · 1.86–2.22 | 0.66–0.90 | 2.4–2.7 |
| 1440 × 900 @2, GPU off (the older devlogs' launch) | 1.88–2.06 · 1.89–2.11 | 1.89–2.07 · 1.98–2.10 | 0.27–0.38 | 3.3 |

- **Over budget: the whole coast roster out at once reads 1.4–2.6 ms, against 1.5 ms.** That is
  the fauna doc's stated test (docs/systems/fauna.md › Bench), so it is a fail as written.
- It is a worst case the schedule never builds: the natural roster of a full garden after five
  minutes (9–12 creatures) benches 1.18–1.39 ms in the owner's window.
- The bench reads one pixel after every frame; with the GPU on, that read is a large part of each
  number, and a roster of one kind (the residents come back after `clear()`) never went below
  1.1 ms. The real frame with everything out against the same frame with the fauna muted differs
  by −0.49 to +0.28 ms (six runs): no fauna cost shows above the noise in the real frame.
- No lone first-reading spike of the octopus was seen; it was not hunted in the close view.

### Paint time (a cold switch from the Japanese garden, `sceneStats()`)
| window | wall to `scenePainted` | painting CPU | longest part | load |
|---|---|---|---|---|
| 1470 × 750 @2 | 4.02–4.25 s | 2117–2186 ms | 16.2–22.7 ms (`land`, `maquis`) | 2.7–2.9 |
| 1440 × 900 @2 | 4.17–4.40 s | 2116–2201 ms | 16.9–17.7 ms (`margins`) | 3.0–3.3 |

Per step at 1470 × 750 (total ms / longest part / parts, three runs): walls 329–335 / 9–11 / 679;
land 252–318 / 16–23 / 583; sea 262–266 / 8–15 / 752; maquis 217–221 / 16 / 491; shore-rocks
212–214 / 8 / 947; promontory 201–203 / 11 / 721; beds 100–102 / 4 / 310; shore 98–100 / 5–7 /
594; beach 92–93 / 7 / 276; pine 74 / 12 / 153; olive 70–75 / 12–15 / 31; margins 49 / 15 / 86;
far-hill 36–38 / 1.4 / 249; temple 28 / 3 / 314; cliff-foot 27–28 / 1–2 / 192; pools 22–24 / 2 /
313; village 19–20 / 0.8 / 822; caique 13–16 / 2 / 202. 1440 × 900 is the same within 10 %, but
the promontory once took 277 ms.
- **On a quiet machine every part is under the 20 ms budget but one reading of `land` (22.7 ms)**;
  GR1's 56 ms and GR2's 35–46 ms parts were machine load and raster backlog.
- **First paint from a cold load** (a returning user whose garden on view is the coast, the paint
  cache cleared, reload → `scenePainted`): 3.61–3.75 s in the owner's window, 3.72–3.76 s at
  1440 × 900, 2.36–2.38 s on the phone (painting CPU 2.13–2.20 s, 1.11 s on the phone).
- **A switch from another garden**: cold 4.15–4.41 s (1470 × 750) and 4.23–4.31 s (1440 × 900);
  warm (the oasis → the coast again, from the paint cache) 465–480 ms. The waterfall's cold first
  visit was 5–7 s on a loaded desktop (devlog 95).

### Memory and bundle
JS heap after a forced GC, owner's window, 25 plants: the Japanese garden 13.1 MB, the waterfall
16.3, the oasis 32.4, **the coast 20.6** (twice). The renderer's layer caches are the same for every
garden (8.1 M backing pixels). Without a GC the coast read 96 MB: garbage from its paint, not kept.
Under reduced motion the oasis and the coast both read higher (51 and 63 MB); not explained.

Lazy chunks (raw / gzip kB):

| | garden (painters, motion, data) | creature set | species |
|---|---|---|---|
| coast | 189.7 / 69.2 (`painters` 117.7, `coast` 40.3, `motion` 31.7) | 214.1 / 76.0 (chunk named `tortoise-*.js`) | 16 chunks, 145.9 / 66.8 |
| oasis | 121.6 / 45.5 | 57.9 / 20.4 | — |
| waterfall | 32.5 / 12.1 (its data sits in the shared chunk) | 97.6 / 34.4 | — |

The coast's creature set is the largest lazy chunk in the app (12 painted creatures, the cat's
jointed rig the biggest); it loads only when the coast is on view (ADR 0346).

## Looked at
Screenshots of the production build (copies in the session scratchpad, `g8/`): the owner's window
with a full garden at noon, sunrise, sunset and night, with 15 plants and empty, a second seed;
1440 × 900 full at noon and empty at sunset; the phone full at noon, empty at sunset, 15 at night;
reduced motion; close views (glides, zoom 2.2–3) of the three terraces, `low-4`, the beach, the
pools, the cliff top, the village, the horizon, the temple, the caique and a splash rock at noon,
and the terraces, the beach, the temple, the village and the horizon at sunset and night. Every
coast creature spawned and stepped through four moments each, zoomed on it (the owl and the crab
at night), the cat with a tortoise, every creature at the overview and on the phone. The studio
sections of the 16 coast species, the 5 shared ones and the 12 creatures (all render, no errors).
The planting flow through the UI at 1470 × 750 and on the phone (the sheet's offers and habitat
lines, a sea plant and a scrub plant planted and growing), a plant card on desktop and phone, the
Gardens section and its thumbnails, and the sound bed's levels.

- **Sound** (`audio.scene`, 12 s, the real graph): pond −41.3 dBFS, waterfall −39.2, **coast
  −40.8** (peak 0.041): between the two, as G7 measured. The mixer and its words are covered by
  `sound-mixer.spec`. **No human has listened to the coast's sound.**
- **The planting sheet** at 25 minutes offers 12 species and locks 9 (four need 90 minutes, five
  50). Habitat lines read "in the shallows", "on the beach", "in the terrace beds · along the path",
  "on the walls and rocks"… Markers are 56 CSS px, comfortable under a thumb. An olive goes only to
  `scrub-1` or `top-1`; Posidonia only to `shallows-1`.
- **Gardens thumbnails**: the coast's card paints from its pre-painted overview when another
  garden is on view. While the coast is on view and the page is scrolled down to the Gardens
  section, its own card stays a blank wash; the same happens to the oasis and the waterfall (the
  live take waits for the garden to be on screen), so it is shared behaviour, not the coast's.
- **Reduced motion**: the still painting is complete (the sea, the shore, the caique at rest).
- **Not checked**: the widget with the coast; sunrise close views; every species full grown in each
  of its slots (seeds 11 and 23 at 48 plants were looked at, not an inventory); a real thumb on a
  real phone; the cat's detour rate round a tortoise (left to its unit test, 3 of 90 seeds); the
  marker screenshots of the flow (taken mid-scroll; the sessions started, the e2e covers the markers).

## Fixed
- **The moon was cut in half by the top edge in the owner's window** (1470 × 750 shows the world
  from y 179; the arc peaked at y 198). The arc is now (524, 296) → (640, 240) → (770, 284), whole
  under the deckle in every landscape window, in the phone's crop, clear of the temple and in open
  sky (`layout.ts`). New check in `coast.test.ts` (every landscape window, every moon position).
  No pinned hash moved (the moon is not in the plates). Before: `g8/shots/owner-empty-night.jpg`;
  after: `g8/ui/moon-after-{owner,mac,phone}.jpg`.
- Docs: README and SPEC §1a listed two gardens (the oasis was missing since O8); ARCHITECTURE, the
  scenery and UI docs said "both gardens"; the scenery doc's coast leftovers named fixed things
  (the placeholder file, the Japanese-looking pine, the placeholder sky's puff) and the unpainted
  rows; two TESTING rows (GK4.1, GK10.1) had three columns instead of five; ADR 0351 sat between
  0376 and 0380 in the index.

## New tests
- `sceneries.spec` › the coast's moving sea: the sea at the overview differs two frames apart;
  under reduced motion it is the same (scene and paper only, everything else muted).
- `sceneries.spec` › the coast has its own daylight: sunset warmer than noon, night darker and
  bluer, its sky plates stored under `coast|`. (A "noon bluer than red" check over the whole frame
  failed: the paper and the sand outweigh the sea.)
- `coast.test.ts`: the whole moon under the deckle in every landscape window.

## Contract additions against the tests
| addition | unit | e2e | gap |
|---|---|---|---|
| `ScenerySky.waterAlpha` (ADR 0372) | the coast's values (`daylight.test`) | the coast's daylight (new) | the mix in `sky-light.ts` (`spec.waterAlpha ?? WATER_SKY_ALPHA`) has no unit test; it needs a canvas the node tests do not have |
| `SceneryMotion.under` (ADR 0374) | the coast's `under` draws its plate (`motion.test`) | — | nothing checks that the scene system calls `under` before the mirrored sky; seen in shots |
| motion given the daylight (ADR 0362) | the coast's motion at each phase (`motion.test`, `swell.test`) | the sea moves (new) | the scene system passing `light` is untested |
| slot sites (ADR 0383) | placement, reducer, fill, sheet, `sites.test` | `sceneries` › slot sites | — |
| wildlife places (ADR 0373) | `wildlife.test`, `fauna/targets` | — | — |
| ground creatures (ADR 0381) | `cat.test` › ground creatures keep off each other; `gull.test` | — | `lib/ground.ts` has no test of its own |
| coast perches (ADR 0382) | `wildlife.test` (wood, every window) | — | phones are not covered: most tree and coping perches fall outside the portrait crop |
| the wide window (ADR 0384) | `coast.test` › every landscape window (now with the moon) | — | — |

## Open items, by how much they hurt a first look
Screenshots `g8-open-<n>.png` in the session scratchpad.
1. **The terraces' seaward edge is a ruled straight line** with a dark rim from the shelf down to
   the beach steps: the least painted line in the picture, at the overview and on the phone
   (`g8-open-1.png`). Break it into a worn rock lip with boulders and wet feet, as G2b did the shore.
2. **The shared plants carry the oasis's words at the coast**: Darija native names (Caper "Kebbar",
   Southern maidenhair "Qesbour l-bir", Grapevine "Dalia", Pomegranate "Rremman", Oleander
   "Defla") and card notes about seguias, palm trunks, the palmeraie, oueds and khettaras
   (`g8-open-2.png`). Notes can differ per garden (`in`, as the olive's); native names cannot: a
   per-garden native name is a contract change.
3. **In the owner's window both pines are bare poles**: the leaning pine's crown is above the
   window, so its trunk is a pale stripe across the bay in a white wedge of the side fade, and the
   tree on `scrub-1` shows only its trunk under the corner buttons (`g8-open-3.png`). Lower or
   lean the crowns into view at 1470 × 750, or move the tree slot.
4. **The cyclamen and the ice plant look pasted on and out of scale**: the cyclamen's rosettes
   have heavy dark outlines and stand as tall as the rock roses; the ice plant is a saturated
   magenta or red heap (`g8-open-4.png`). Soften the outlines, shrink the cyclamen, mute the mats.
5. **The left side's paper lift shows as a veil with an edge** over the far hill and the leaning
   pine: white by day, a pink sheet with a hard curve at sunset (`g8-open-5.png`).
6. **The phone first shows an empty sky**: the top 40 % of the stage is sky with the arrival line;
   the olive, the village, the cicada's trees, the cat's olive spot and the dolphins' bay (x < 460)
   are outside the crop (`g8-open-6.png`). Panning and zooming reach them; nothing invites it.
7. **The goats are too big for the headland**: a goat stands half as tall as a far pine, and the
   ledge scrub reads as flat cut-paper blobs (`g8-open-7.png`).
8. **The pools read as puddles on sand** under a wide band of near-empty paper in close views of
   the beach and the lower terrace (the painting's foot) (`g8-open-8.png`).
9. **`low-4`'s medium plant is cut by the right edge's fade** (confirmed; `g8-open-9.png`). No room
   on the lower terrace further left (`scrub-4` is at 1498); make it small or move it.
10. **Sunset**: the far glint road is pale and the sea a flat orange; the promontory stays cool
    grey (confirmed; `g8-open-10.png`).
11. **The dozing cat hides behind a planted lavender**: its shade spot under the olive is behind
    the `top-2` bed (`g8-open-11.png`). Drop that spot when the bed holds a medium plant.
12. **The green lizard still reads as a flat bright cut-out**, stiff like a salamander; the rock
    thrush's glide frame reads as a fish (`g8-open-12.png`, studio).

The rest:
13. The roster bench with every coast creature out is over 1.5 ms (above); the natural roster is not.
14. The lizard's arrival line ("basks on the dry-stone wall") stays on screen at night.
15. Card text: names in two styles ("Ice Plant", "Aleppo Pine", "Mediterranean Cypress",
    "Southern Maidenhair" against "Sea daffodil", "Pink rock rose"); descriptions mix "—" and ":";
    the sea lavender's habitat line says "on the walls and rocks" though it grows only on the
    splash rocks.
16. Peacock's tail reads as crinkled beige discs on the water at the overview.
17. A crab on a splash rock walks inside the plant on that rock (seen with the sea lavender).
18. Perched birds draw over the painted trees' leaves (confirmed with the owl; it reads well).
19. The lizard does not use the path edge (confirmed); the thrush has no female (confirmed).
20. Only `scrub-1` takes a large wild plant (confirmed: the Aleppo pine and the tree spurge share
    it; the olive goes to `scrub-1` or `top-1`).
21. The rock pools sit at the top of the bottom fade at 1470 × 750 (confirmed, faint).
22. Research "verify" notes: the damselfish (*Chromis chromis*) and the Balkan green lizard's
    Ionian record are still unverified; neither has user-visible text. The rock rose's ladanum
    line matches the classical account (Herodotus, *Histories* 3.112) but no source was opened;
    the ice plant's native name (Mesimvrianthemo) is still marked verify in the research.
23. The coast's creature chunk is named `tortoise-*.js` in the build (the set module is not in it).
24. Not reproduced in these shots: a water plant covering a crab on a pool's rim; the crab's legs
    past splash rock 1; the octopus's first-reading spike.
25. Shared: the garden on view's thumbnail stays blank while the stage is scrolled away.

## Phone portrait
Works: the temple, the sea, the shore and all three terraces fit; the moon (now) and both low
suns are in the crop; markers and plant cards are large enough for a thumb; the card reads well;
the creatures in the crop (the gull, the crab, the shoal, the goats, the tortoise, the cat on the
lower terraces) are visible. At the overview the view cannot move sideways (x stays 460–1060);
zoomed in (1.6×) it reaches the village (x 113–488) and the olive (x 1103–1478), checked with
camera glides, not with a finger. Does not: the first view is mostly empty sky; the olive, the village, both pine trunks (so the cicada) and the dolphins'
bay are off-screen, and most perches with them (ADR 0382; only the cicada chooses by the view,
and here it chose the pine and the olive, both outside the crop).

## The release, step by step (not done)
How the oasis was released: devlog 140 (O8, no ADR): `available` became `() => true`, the tests
that list released gardens were updated, the docs stopped saying it hides behind a flag. For the
coast:
1. `src/scenery/coast/index.ts`: `available: () => true`; delete `coastAvailable`.
2. `SCENERY_IDS` (`src/core/sceneries.ts`) already lists `coast`; no schema change (state v4 takes
   any scenery id); no migration.
3. Unit tests: `scenery/coast/coast.test.ts` › "is offered only with ?dev&scenery=coast" → offered
   to everyone; `scenery/registry.test.ts` › "holds the Greek coast…" and the "available without
   flags" loop (`s.id !== 'coast'`); `scenery/flora.test.ts` (`RELEASED` then holds the coast; the
   released invariants pass for it today, checked here with a temporary edit: 30 of 30).
4. E2E: `sceneries.spec` › "the three gardens are offered without a flag" (four, and no rejection
   of `coast`); `gardens.spec` › "released: … offers all three" and "lists the three gardens" (four
   cards, the thumbnails list gains `{ id: 'coast', source: 'painted' }`); the per-garden loops in
   `scene-cache.spec` (line 65), `light-plates-wait.spec` (79) and `lazy-species-painters.spec`
   (26) gain `'coast'` if they are to cover every released garden. The coast's own specs can keep
   `scenery=coast` in their URLs.
5. Thumbnails: nothing to add; the coast's card already paints from its pre-painted overview. A
   released coast is one more garden for the Gardens section to pre-paint (about 2.1 s of CPU,
   in idle time, ADR 0339).
6. Docs: SPEC §1a (a coast bullet, its flora and fauna; drop the status note added here), README
   ("Four gardens"), ARCHITECTURE and the scenery and UI docs ("the coast only with
   `?dev&scenery=coast`"), fauna.md, a TESTING row like O8.1, a devlog; the ROADMAP by the orchestrator.
7. Deploy: CI on `main` publishes it (ADR 0014); the service worker needs nothing new.

## Suites
On the final tree, rebased on `main` (ad1ab35):
- `npm run typecheck`: clean.
- `VITEST_WORKERS=3 nice -n 10 npm test`: 285 files, 3040 tests, all passed (155 s).
- e2e, production build on 4368, two workers, three shards one after another (load 4–6: the
  owner's machine was in use):
  - shard 1/3: 113 passed, 4 failed: `ambience` › rain is still (reduced motion), lighting
    unaffected (delta 0.36 against < 0.05); `backdrops` › desktop text contrast at sunrise and at
    midday, and hd sunset idle (every dock text read 1.00 : 1, as if the sheet had not painted).
    All four pass alone.
  - shard 2/3: 117 passed.
  - shard 3/3: 115 passed, 1 failed: `wayfinding` › with reduced motion the path is simply there
    (one animation left where 0 is expected). Alone it failed again, then passed twice in three
    repeats: flaky, not the coast's (the Japanese garden's dock).
- The new coast e2e (`sceneries.spec`, four coast tests) passed in the shards, and the two sea
  tests three times each alone.
