# 186 · The coast's sound bed (G7, phase 15)

## What
The Greek coast has its own sound instead of the placeholder seaside profile (pink-noise waves,
the pond's wind, chirps and the bush warbler). ADR 0376, docs/systems/audio.md › Coast. The twin
of O7 (devlog 126).
- **The `coast` profile** (`core/soundscape.ts`) has two new layers, `sea` and `cicadas`. Palette
  sea, wind, cicadas, birds, crickets, rain; garden levels sea 70, wind 35, cicadas 30, birds 35,
  crickets 30; presets "Along the shore" (now with the sea) and "A still night on the cove".
- **The beds** (`audio/coast-bed.ts`): seeded PCM at a third of the rate. The sea is a 56 s stereo
  loop of seven waves 6–10 s apart, weights in sets: a slow wash up the shingle (1.7–2.3 s rise),
  then the hiss and the rattle of tiny resonant grains as the stones draw back, over a far surf
  and small laps. The backend swells it ±15 % over 71 s, so the loop's waves never come back alike.
  The cicadas are a 23 s loop of nine far singers near 4 kHz, buzzed and pulsed, coming and going
  in slow bouts.
- **The wind** is the shared wind, lighter and 450 Hz airier: the pines' hush.
- **Five voices** (`recipes.ts`): `caique` (two or three hull slaps and one creak of the mooring
  rope, on the sea layer), `gull` (2–4 far mewing notes), `goatbell` (2–3 dull clanks),
  `chapel` (three slow distant strokes, 19–21 h only, at most once an hour), `scops` (a spell of
  8–15 soft notes 2.3–2.9 s apart, then at least 108 s of silence). Crickets at a third of the
  pond's. No chirps or warbler. Curves and rates in `params.ts › coastMix`.
- **Sightings** `coast:gull`, `coast:goats`, `coast:scops-owl`, `coast:cicada`, `coast:swallows`
  (the ids in `scenery/coast/fauna.ts`) make that sound more frequent.
- **The mixer** reads The sea on the pebbles, Breeze in the pines, Cicadas, Gulls and goat bells,
  The owl and crickets.
- **Dev**: `sprout.audio.scene` takes `weather` and `play: [[seconds, kind], …]`.
- **Studio**: `audio/coast`, one card per voice, the cicada and owl curves on `audio/soundscape`.

## Why these choices
- New layers, not the Standard `waves`: the Standard surf stays as it is, and the cicadas need their
  own slider (the sound most likely to annoy). A mix stored before reads both as 0: **no schema
  change**.
- The cicadas are a bed, not events: a chorus is a texture, and its level can follow the hour.
- One long sea loop rather than waves as planned events: the planner is Poisson, and a beach breathes
  far more regularly than that. The swell LFO and the other loops' lengths (23 s, the wind's 7 s)
  keep the 56 s from being heard as a loop.
- Voices sit where the painting puts them: the caique and the chapel left, the goats right.

## Listened/measured
I could not listen. Offline renders in headless Chromium (`sprout.audio.scene`) and unit spectra.
- **Beds, noon, 22.05 kHz** (devlog 126's method): pond −41.3 dBFS, oasis −43.4, waterfall −39.2,
  **coast −40.8** (23 h −41.0, rain −37.3). At 44.1 kHz: pond −40.3, oasis −42.8, waterfall −39.2,
  coast −40.6. The oasis is quieter than devlog 126's −40.8 since its gains were lowered.
- **The breath**: the coast's quarter-seconds swing about 8 dB (wave to lull), at most ~2.2 dB a
  step; the other beds hold within 3 dB.
- **Cicadas** add ~0.2 dB at their loudest at 44.1 kHz: about 15 dB under the sea, in a band where
  little else is. At 22.05 kHz the loops render at 8 kHz and lose them.
- **With voices** (40 s, 44.1 kHz): −40.3 at noon, −40.5 at 23 h; loudest window −36.3 (a wave).
- **Packed voices** (`coast-events.wav`): the first owl stood 6–8 dB over the bed and the bell 5;
  the owl (gain 0.03 → 0.014), gull (0.022 → 0.016) and bell (0.016 → 0.011) were lowered to 2–4 dB.
- **Switching**: pond → coast at 4 s, largest step 1.8 dB, lowest window −43.9; coast → pond
  2.3 dB, −43.5.
- **Cost**: two buffer sources and one LFO while audible (the oasis: three buffer sources). Build
  (Node, 48 kHz): sea ~150–200 ms after two passes (from ~820 ms: short carriers instead of
  per-sample filters, Poisson waits instead of a die per sample, a cheaper knee), cicadas ~90 ms;
  the oasis ~105 + ~80 ms. The cicadas are built only when first audible.
- **Renders** in `artifacts/g7/` (gitignored) and the task's scratchpad: `coast-noon.wav`,
  `coast-sunset.wav`, `coast-night.wav`, `coast-rain.wav` (32 s stereo 22.05 kHz, true level about
  −40 dBFS) and `coast-events.wav` (45 s mono; gull 1 s, goat bells 5 s, caique 9.5 s, gull 14 s,
  chapel 17 s, goat bells 27 s, owl from 30 s).

**Needs a human ear**, first:
- whether the sea reads as a pebble beach (wash, then stones rattling back) rather than surf or
  static, and whether its 8 dB breath is calm enough for hours;
- whether the cicadas are texture or an itch (lower `cicadas` or `CICADAS_GAIN` if an itch);
- the chapel bell: keep, soften or drop (its rate to 0 in `BASE_RATES.chapel`).

## Left open
- Listening by ear, in the browser and over a long session.
- No blue rock thrush, hoopoe or halyard tap; no seasons (cicadas only June to September).
- A coast custom mix saved before keeps its `waves` level, which the coast no longer plays.
- The sea's ~7 MB PCM and its main-thread build at the first switch, untimed in a real browser.

## Outside the G7 paths
- `src/scenery/coast/index.ts`: the comment on `sound: 'coast'` (one line);
  `scenery/registry.test.ts`: a test title.
- `docs/ARCHITECTURE.md`: the coast profile is no longer a fixture.
- `docs/systems/scenery.md` › Coast › Sound.
- `tests/e2e/sound-mixer.spec.ts`: the palette test's coast slider, and two coast tests.

## Status
G7 done, pending a listen. Checks in the report: typecheck, the unit suite, and the e2e files
sound-mixer, sound-mixer-studio, sceneries and gardens.
