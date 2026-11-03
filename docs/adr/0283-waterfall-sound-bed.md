# ADR 0283: The waterfall's sound bed, and a scenery names its sound profile

- Status: accepted
- Date: 2026-11-03
- Builds on: ADRs 0100–0103 (procedural soundscape), 0213 (personal mixes), 0240 (schema v4,
  `waterfall:<id>` sightings), 0243 (runtime switching)
- Replaces the number reserved for S15 in the roadmap (0249)

## Context
The waterfall garden played the pond's soundscape: lapping water and plips under a painted
cascade. A waterfall is the opposite of a pond to the ear: a steady broadband roar, low rumble
from the plunge, a bright spray hiss on top, and the stream birds and frogs that sing over it.
The audio already had sound profiles (`SoundSceneryId`: `pond`, `coast`), but nothing tied a
garden to one. The mixer read `audio.getScenery()`, which nothing ever changed, so it always
showed the pond.

## Decision
- **A `falls` layer.** `SOUND_LAYERS` gains `falls`. A new sound profile `waterfall` has the
  palette falls, wind, birds, crickets and rain (no pond water) and two presets. A stored mix
  from before reads `falls` as 0 (`readSoundscape`, ADR 0240), so no schema change is needed.
- **The bed is seeded PCM, not a filter on the shared noise** (`audio/falls.ts`). A mono
  plunge (rumble under 250 Hz and a roar band around 420 Hz, each with its own slow swell) and
  a stereo spray (a 2.4–7 kHz hiss with a fast flutter and a 1.3 kHz mist). Built once per
  context on first use and looped. The plunge is 13 s and the spray 9 s, so the pair repeats only
  every 117 s. Web Audio's biquads could not give each band its own breath without several
  LFOs and sources, and the spectrum and seams can be unit-tested as plain arrays.
- **Cheap to build.** The plunge has nothing above ~3 kHz, so it is rendered at a third of
  the context rate (at least 8 kHz) and the buffer source resamples it. The right spray channel
  is the left one half a loop on: the halves are uncorrelated noise, so the image stays wide
  for half the work. The swells are evaluated 4096 times per loop rather than per sample.
- **Its own events.** `splash` (a rounded slap of water, a little spatter and low bubbles, on
  the `falls` layer), `dipper` (the brown dipper's rippling warble around 3.2 kHz, by day, most
  at dawn, on `birds`) and `kajika` (the frog's rising, quickening trill, after dusk and only
  once a kajika has been seen at the falls, on `crickets`). `PLACE_EVENTS` lists which kinds
  belong to each place, so a custom mix never brings another place's voices.
- **The garden mix there** (`waterfallMix` in `params.ts`): the falls at 70 %, no pond water,
  the wind at 0.6, distant chirps at 0.6 (the roar hides them; a wagtail seen there brings
  them back to 1.4), house-martin twitter only once the martins have been seen there, fewer
  crickets. Rain quietens the splashes and wakes the frogs.
- **`Scenery.sound: SoundSceneryId`.** Each scenery names the profile it plays: the Japanese
  garden `pond`, the waterfall `waterfall`. `main.ts` starts the audio on the viewed garden's
  profile and calls `audio.setScenery(...)` whenever `state.scenery` changes. The change glides
  over 2 s while the picture cross-fades.
- **Fixes on the way.** `fauna:arrived` now keys a creature with `faunaSeenKey(sceneryId, id)`,
  as `state.faunaSeen` stores it. Before, a waterfall arrival added the bare id, which counted
  as a garden creature and never as one at the falls.
- **Level.** The falls gain is 0.065 at 100 %, tuned by an offline render. The waterfall's beds
  sit at about −39 dBFS RMS at noon against the pond's −41.5, a little fuller, never much louder.

## Consequences
- One required field on the scenery contract (docs/ARCHITECTURE.md › Sceneries). A future
  scenery picks an existing profile or adds one in `core/soundscape.ts`.
- One more looping bed (two buffer sources) while the falls are audible. The PCM is built on the
  main thread the first time the falls play, at the switch to the waterfall or on first unmute
  there.
- Covered by `audio/falls.test.ts` (spectrum, seams, breathing), `params.test.ts` (the
  waterfall mix), `garden-audio.test.ts` (arrivals per garden), `recipes.test.ts` (the three
  recipes), `scenery/registry.test.ts`, and `tests/e2e/sound-mixer.spec.ts` (the palette follows
  the garden on view; offline level and cross-fade renders).
