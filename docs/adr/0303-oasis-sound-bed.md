# ADR 0303: The oasis's sound bed

- Status: accepted
- Date: 2026-11-06
- Builds on: ADRs 0100–0103 (procedural soundscape), 0213 (personal mixes), 0240 (schema v4,
  `<scenery>:<id>` sightings), 0283 (the waterfall's bed, `Scenery.sound`)

## Context
The Ksar oasis borrowed the pond garden's sound (O1): lapping pond water, wind in broad leaves,
a Japanese bush warbler. The oasis is a different place to the ear. Its water is small and close:
the seguia slipping over the terrace walls into the basin, and the oued's slow flow. Its wind is
dry fronds rustling in slow gusts. Its birds are the laughing dove and the house bunting, with a
midday insect shimmer, and after dark crickets, a gecko's clicks and frogs at the basin
(docs/research/oasis-biome.md §3).

## Decision
- **An `oasis` sound profile with two new layers, `seguia` and `palms`.** The palette is seguia,
  palms, birds, crickets and rain, with two presets ("In the palm grove", "A warm night by the
  basin"). New layers rather than retuned `water` and `wind`: a layer is one bed in the backend
  and one slider in the mixer, and the pond's lapping and leafy wind should stay as they are. A
  mix stored before reads both as 0 (`readSoundscape`, ADR 0240), and a missing `oasis` entry
  follows the garden, so **the schema is unchanged**.
- **Both beds are seeded PCM** (`audio/oasis-bed.ts`), as the falls are (ADR 0283). The seguia is
  a stereo trickle (a dense patter of small rising bubbles over a flickering sheet of water noise)
  and a mono murmur under it. The palms are a stereo crackle of tiny noise grains whose density
  follows a slow gust envelope, over a soft whoosh. **All three loops render at a third of the
  context rate**: nothing in them needs more than ~7 kHz, and it keeps the main-thread build near
  0.2 s at 48 kHz. A soft knee at four times the RMS keeps any grain or bubble from ticking out.
- **Six voices**, all ambient (the creatures are not built yet): the laughing dove's five-note coo
  and the house bunting's song by day, a bee-eater overhead in the warm hours, a faint midday
  insect shimmer, and after dark the gecko's clicks and a distant frog chorus. A gecko, laughing
  dove or Sahara frog seen in the oasis (`oasis:<id>`) makes its voice more frequent. The garden's
  unlocks (`small-birds`, `swallows`) never add birds there.
- **A place can move an event to another layer** (`PLACE_EVENT_LAYER`, `eventLayer()`). In the
  oasis a gust swells the palms as well as the shared wind, so in a custom mix gusts follow the
  palms slider; the oasis has no "wind in the leaves" slider.
- **The garden mix keeps 0.6 of the shared wind under the fronds.** Without it the cross-fade from
  the pond (whose bed is mostly wind and water) dipped about 3 dB halfway through a switch.
- **The mixer can name a shared layer for a place** (`PLACE_SOUNDS` in `ui/sound-mixer.ts`): in the
  oasis, `birds` reads "Doves and buntings" and `crickets` "Insects and geckos".
- **Level.** `SEGUIA_GAIN` and `PALMS_GAIN` are 0.056 at 100 %. At noon the oasis's beds sit
  between the pond and the waterfall: −40.8 dBFS RMS against −41.7 and −39.3 (offline render at
  22.05 kHz, as in ADR 0283).

## Consequences
- `SOUND_LAYERS` has 14 entries and `SoundSceneryId` adds `oasis` (docs/ARCHITECTURE.md › Audio).
  An older build reading a garden with an `oasis` mix rejects that soundscape, as it would a
  `waterfall` one.
- Two more looping beds (four buffer sources) while the oasis is audible. Both are built on the
  main thread the first time the oasis plays.
- `sprout.audio.scene` can play its planned events and return a WAV, so a bed can be listened to
  away from the app (the owner's renders are in `artifacts/o7/`).
- Covered by `audio/oasis-bed.test.ts`, `params.test.ts › the oasis`, `recipes.test.ts`,
  `planner.test.ts`, `garden-audio.test.ts`, `core/soundscape.test.ts`, `scenery/registry.test.ts`
  and `tests/e2e/sound-mixer.spec.ts`.
