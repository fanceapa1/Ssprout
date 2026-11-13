# ADR 0376: The coast's sound bed

- Status: accepted
- Date: 2026-11-13
- Builds on: ADRs 0100–0103 (procedural soundscape), 0213 (personal mixes), 0240 (schema v4,
  `<scenery>:<id>` sightings), 0283 (the waterfall's bed), 0303 (the oasis's bed)

## Context
The Greek coast played a placeholder profile kept for "a future scene": the Standard collection's
pink-noise waves, the pond's wind, the pond's distant chirps and the Japanese bush warbler. The
place sounds otherwise (docs/research/coast-biome.md › Sound notes): a pebble beach, where each
wave washes up the shingle and draws back with a hiss and a rattle of stones; a light breeze in
the Aleppo pine and the olive; cicadas in the heat of the day; a Scops owl's single note through
the night; and now and then goat bells on the far cliff, the moored caique's rope and hull, a far
gull, and a chapel bell across the bay at sunset. People study to it for hours, so the bed must be
calm, low and never loop audibly.

## Decision
- **The `coast` profile gets two new layers, `sea` and `cicadas`.** The palette is sea, wind,
  cicadas, birds, crickets and rain (six sliders). New layers rather than the Standard `waves`:
  a layer is one bed and one slider, and the Standard waves stay the familiar pink-noise surf.
  The cicadas have their own slider because they are the sound most likely to annoy. A mix stored
  before reads both as 0 (`readSoundscape`, ADR 0240), so **the schema is unchanged**. A coast
  custom mix saved before keeps its `waves` level, which the coast no longer plays.
- **Both beds are seeded PCM at a third of the context rate** (`audio/coast-bed.ts`), like the
  oasis's. The sea is one 56 s stereo loop of seven waves 6–10 s apart with weights in sets: each a
  slow wash (1.7–2.3 s rise, a 2 s fall) and, 0.9 s after its peak, a backwash of hiss and a
  rattle of tiny resonant grains (1.6–5.5 kHz), over a far surf and small laps. Its noises are
  short stationary carriers (2.3–5.9 s, never whole seconds) read under the long envelopes, which
  keeps its build to ~150–200 ms (the oasis's two beds take ~185 ms together). The backend
  swells the whole sea by ±15 % over 71 s, so a
  wave never comes back alike. The cicadas are a 23 s loop of nine far singers, each a band of
  noise near 3.6, 4.1 or 4.6 kHz buzzed at 90–170 Hz and pulsed 3.5–7 times a second, coming and
  going in slow bouts, held between 2.5 and 5.8 kHz.
- **The cicadas are a bed, not events.** A chorus is a texture; its level follows `CHORUS_CURVE`
  (0 before 6:30, full at 14:30, 0 from 20:30), 0 in rain, half in mist.
- **The wind is the shared wind**, lighter (× 0.75) and 450 Hz airier: the pines' hush. No new bed.
- **Five voices**: `caique` (on the sea layer), `gull`, `goatbell` and `chapel` (on birds),
  `scops` (on crickets); the garden's crickets at about a third of the pond's. No distant chirps
  or warbler. Each voice is rare (under 0.4 a minute) and gapped (40–150 s); the chapel bell
  sounds only around sunset (`CHAPEL_CURVE`, 19–21 h local) with a 3600 s gap: at most once an
  hour of listening. An owl's spell is up to 42 s, then at least 108 s of silence.
- **The places in the painting set the voices' sides**: the caique and the chapel to the left, the
  goats to the right.
- **Sightings** `coast:<id>` for `gull`, `goats`, `scops-owl`, `cicada` and `swallows` (the ids of
  `scenery/coast/fauna.ts`) make that voice more frequent or, for swallows, bring their twitter.
- **The mixer names the shared layers for the coast** (`PLACE_SOUNDS`): Breeze in the pines,
  Gulls and goat bells, The owl and crickets. Presets "Along the shore" (now with the sea) and
  "A still night on the cove".

## Consequences
- `SOUND_LAYERS` has 16 entries. An older build reading a soundscape with `sea` or `cicadas`
  levels reads them as unknown keys and ignores them (`readLevels` keeps only its own layers).
- Two looping beds while the coast is audible: three buffer sources with the shared wind, one
  oscillator for the sea's swell. The sea's PCM is the largest bed yet (about 1.8 M samples at a
  48 kHz context), built on the main thread at the first switch to the coast.
- `sprout.audio.scene` takes `weather` and `play` (voices at given seconds) for listening renders.
- Covered by `audio/coast-bed.test.ts`, `params.test.ts › the coast`, `recipes.test.ts`,
  `planner.test.ts`, `garden-audio.test.ts`, `core/soundscape.test.ts`, `scenery/registry.test.ts`
  and `tests/e2e/sound-mixer.spec.ts`.
