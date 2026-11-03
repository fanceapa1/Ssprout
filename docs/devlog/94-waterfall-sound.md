# 94 · The waterfall's sound bed (S15)

## What
The waterfall garden now sounds like a waterfall, not a pond (ADR 0283, docs/systems/audio.md ›
Waterfall).
- **A `falls` layer and a `waterfall` sound profile** (`core/soundscape.ts`): palette falls, wind,
  birds, crickets, rain; garden levels falls 70, wind 30, birds 40; presets "By the falls" and
  "Dusk in the gorge". A mix stored before reads falls as 0, so the schema is unchanged.
- **The bed** (`audio/falls.ts`): seeded PCM, a mono plunge (rumble under 170 Hz and a roar band
  around 420 Hz, each with its own slow swell) and a stereo spray (a 2.4–7 kHz hiss with a 7 Hz
  fizz, and a 1.3 kHz mist). 13 s and 9 s loops, so the pair repeats every 117 s.
- **Three events** (`recipes.ts`): `splash` in the pool, the brown dipper's warble by day, the
  kajika frog's trill after dusk once one has been seen at the falls.
- **The mix there** (`params.ts › waterfallMix`): no pond water, wind lower, distant birds under
  the roar (a wagtail seen there brings them back), martins' twitter once they've been seen there.
  `PLACE_EVENTS` keeps each custom mix to its own place's voices.
- **The backend** plays the plunge at its own lower rate under the spray (`FALLS_GAIN` 0.065).
- **`Scenery.sound`** (contract change, ARCHITECTURE › Sceneries): `pond` for the Japanese garden,
  `waterfall` for the waterfall. The audio and the mixer now follow the garden on view.
- **Mixer**: a "The falls" row. **Studio**: `audio/falls`, `audio/splash`, `audio/dipper`,
  `audio/kajika`, and the dipper and kajika on the `audio/soundscape` curves.
- **Dev**: `sprout.audio.scene({ scenery, to?, switchAt?, seconds?, hour? })` renders a profile's
  garden beds offline (optionally switching), with dB per 250 ms.

## Why it is built this way
- PCM, not Web Audio filters on the shared noise: each band breathes on its own without a pile of
  LFOs and sources, and the spectrum, seams and breathing are unit-tested as arrays.
- Building it on the main thread had to be cheap. The plunge is rendered at a third of the rate
  (it has nothing above ~3 kHz), the right spray channel is the left half a loop on, and the swells
  are sampled 4096 times a loop instead of per sample.

## Fixed on the way
- `fauna:arrived` added the bare creature id even for a waterfall arrival, so a kajika seen at the
  falls counted as a garden creature and was never heard at the falls. It now adds
  `faunaSeenKey(sceneryId, id)`, as `state.faunaSeen` stores it.
- Nothing ever called `audio.setScenery`, so the mixer always showed the pond's palette.

## Measured
Offline render of the garden beds (no events, noon, idle, 22.05 kHz):
pond −41.5 dBFS RMS (peak 0.039), waterfall −39.1 dBFS (peak 0.052), waterfall at 23 h −39.2.
The first `FALLS_GAIN` (0.12) put the falls 7.5 dB over the pond; 0.065 makes it 2.4 dB fuller.
Switching pond → waterfall at 4 s: largest step 1.7 dB a quarter-second, lowest window 1.3 dB
under the pond, at the waterfall's level 6 s on. Waterfall → pond: 1.8 dB, 1.9 dB under the pond.

## `src/main.ts`
One line changed, one added: the audio starts on `initialScenery.sound`, and a store subscription
calls `audio.setScenery(pickScenery(next.scenery).sound)` (a no-op when unchanged).

## Outside the S15 paths
- `src/scenery/types.ts`, `japanese-garden/index.ts`, `waterfall/index.ts`: the `sound` field (one
  line each), and a check in `scenery/registry.test.ts`.
- `src/core/persistence.test.ts`: the layer count now reads `SOUND_LAYERS.length` (it pinned 11).
- `src/core/migration-v4.test.ts`: a v3 garden's settings keep every stored value and read the
  falls as 0 (it compared them exactly).
- `tests/e2e/sound-mixer.spec.ts`: two tests.

## Left open
- **Listening by ear.** Everything above is spectra and offline levels; nobody has listened in a
  browser yet, nor over a long session. Studio `audio/falls` plays the garden mix.
- No yamasemi rattle, heron croak, own call for the house martins (they use the swallows'
  twitter) or dipper "zit" on landing. The spray does not follow the falls' animation (S9).
- The falls PCM is built on the main thread at the first switch to the waterfall (or the first
  unmute there). It was made cheaper, but not timed in the browser.

## Status
S15 done. Checks: `npm run typecheck`, `npm test` (193 files, 1956 tests), and the e2e specs
the change touches: sound-mixer, sound-mixer-studio, studio, smoke, gardens, sceneries (42 tests).
The full `npm run e2e` was not run.

## For the orchestrator
TESTING matrix (new rows, with the audio rows 8.x or the S rows):

| S15.1 | The waterfall plays its own sound: the falls bed (a low rumble and roar, a bright spray under it, deterministic, click-free loops that breathe slowly) instead of the pond water; splashes, the dipper by day and the kajika after dusk once seen there; distant birds under the roar; a custom mix keeps to its place's voices; a creature counts in the garden it was seen in; each scenery names its sound profile and the mixer and audio follow the garden on view; the waterfall's beds sit 0–4 dB over the pond's (−39 vs −41.5 dBFS) and a switch glides with no step over 2.5 dB and no dip | audio/falls (all); audio/params › the waterfall (ADR 0283) (all); audio/recipes (splash, dipper, kajika); audio/garden-audio › a creature arriving at the falls sounds there…; scenery/registry › plays its own sound profile…; core/soundscape › the waterfall has its own palette… | sound-mixer › viewing the waterfall garden brings its sounds…; › real audio graph: the waterfall sits as quietly as the pond… | ✔ levels and glide; ◐ listening by ear |

Devlog index (`docs/devlog/README.md`):

| 94 | [S15: the waterfall's sound bed](94-waterfall-sound.md) | A seeded falls bed (plunge rumble and roar, stereo spray hiss), splash, dipper and kajika events, and each scenery naming its sound profile so the audio and mixer follow the garden on view |

ADR index (`docs/adr/README.md`):

| [0283](0283-waterfall-sound-bed.md) | The waterfall's sound bed, and a scenery names its sound profile | accepted | a `falls` layer and `waterfall` sound profile: seeded PCM plunge (rumble and roar, at a third of the rate) and stereo spray; splash, dipper and kajika events; `PLACE_EVENTS`; `Scenery.sound` drives `audio.setScenery`; arrivals keyed per garden |

ROADMAP S15 status: done (`falls` layer, seeded plunge and spray bed, splash, dipper and kajika,
`Scenery.sound`; waterfall beds −39 vs pond −41.5 dBFS; ADR 0283, not 0249; devlog 94).
