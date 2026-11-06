# 126 · The oasis's sound bed (O7)

## What
The Ksar oasis now has its own sound instead of the pond garden's (ADR 0303, docs/systems/audio.md
› Oasis).
- **An `oasis` sound profile** (`core/soundscape.ts`) with two new layers: `seguia` (water) and
  `palms` (wind). Palette seguia, palms, birds, crickets, rain; garden levels seguia 60, palms 45,
  birds 40; presets "In the palm grove" and "A warm night by the basin".
- **The beds** (`audio/oasis-bed.ts`): seeded PCM like the falls. The seguia is a stereo trickle
  and a mono murmur; the palms a stereo rustle of dry fronds. All render at a third of the rate.
- **Six voices** (`recipes.ts`): laughing dove, house bunting, bee-eater, a midday insect shimmer,
  the gecko and a distant frog chorus. Their curves and rates are in `params.ts › oasisMix`.
- **Gusts swell the palms** (`backend.ts`), and in a custom mix they follow the palms slider
  (`PLACE_EVENT_LAYER`).
- **The mixer** shows The seguia, Wind in the palms, and, in the oasis only, "Doves and buntings"
  and "Insects and geckos" for the shared birds and crickets layers (`PLACE_SOUNDS`).
- **`Scenery.sound`** of the oasis is `oasis`. `src/main.ts` needed no change: since S15 it
  already starts the audio on the viewed garden's `sound` and follows `state.scenery`, so the
  switch is the one line in `scenery/oasis/index.ts`.
- **Dev**: `sprout.audio.scene({ …, events: true, wav: true })` also plays the planned voices
  (planned a second at a time, as the live ticker does) and returns a 44.1 kHz WAV as base64.
- **Studio**: `audio/oasis` (the three loops, click to play the oasis's garden mix), one card per
  voice, and the dove and gecko curves on `audio/soundscape`.

## The design (for the ear that has not heard it yet)
**Water (seguia, 60 %).** Close and small, not a roar.
- Trickle: about 160 bubbles a second, swelling with a slow flow (±20 % over the 9 s loop). Each
  bubble is a sine at 0.6–2.4 kHz that rings for 15–25 ms and rises 10–25 % in pitch. Under it is
  a thin sheet of water noise (1.1 kHz band, flickering at 11 Hz) and a faint airy hiss
  (2.6–6 kHz).
- Murmur (× 0.55): the oued, a low flow under 380 Hz and slow eddies around 520 Hz.

**Wind (palms, 45 % × the breeze).** A dry, papery crackle of tiny noise grains (0.8 and 3 ms)
in a 1.5–7.5 kHz band, over a soft 0.9–4.5 kHz whoosh.
- The grains thicken with a slow gust envelope (17 s loop): lulls at 0.2, gusts at 1, lulls
  longer than gusts. That is an 11 dB swing over seconds, never more than 2.5 dB per quarter-second.
- Gust events (0.6/min × the breeze, 5–8 s) swell the fronds by up to +6 dB: the occasional louder
  gust through the grove.
- The breeze is 0.5 at night and 1 at 14 h. The pond's wind stays underneath at 0.6.

**Day voices.**
- Laughing dove: "oo-oo-OO-oo-ooo", 430–540 Hz.
  - Notes of 0.12, 0.11, 0.17, 0.16 and 0.26 s, with 50–80 ms gaps.
  - The pitch climbs ×1.05 and ×1.16 to the loudest third note, then sinks to ×0.97 on the long last
    one.
  - Every note bends down at its end. A 30 Hz FM wobble of ±2.5 % makes it bubble, with a faint
    second harmonic.
  - One phrase in three is said twice. Gain 0.07, LP 2.2 kHz, 0.7/min, most at 7–8 h and 18 h.
- House bunting: 5–8 quick down-slurred notes (70–100 ms, the last two quicker) from 3.6–4.3 kHz,
  stepping down 1–3 % a note; about 0.8 s. Gain 0.04, 0.6/min, most at 8 h.
- Bee-eater (optional, included): 1–3 burred "prrüp" calls of 6–9 pulses at ~40 Hz on a
  2.4–2.9 kHz rise-and-fall. Gain 0.03, distant (LP 6 kHz, reverb 0.4), 0.25/min at noon.

**Insects.** A midday shimmer: a 5–6.5 kHz sine with a 70 Hz FM rasp and a narrow noise band. It
swells in over 1.2–2 s, holds 1.5–3 s and fades over ~2 s. Gain 0.012 (faint), 1.6/min at 14 h,
none before 8 h or after 19 h, none in rain.

**Night.**
- The garden's crickets (×0.8): 5.4/min at 23 h.
- Gecko: 3–8 dry clicks (triangle ticks at 2.2–3 kHz falling 25 % in 30 ms, a tiny 3–4 kHz noise
  burst), 90–130 ms apart, fading. Gain 0.03, about 0.35/min at night, ≥ 40 s apart: rare.
- Frogs: 2–3 frogs overlapping, each a rattle of 6–12 pulses at 11–13 a second on a reedy 650–950 Hz
  triangle. Distant (LP 1.8 kHz, reverb 0.55), gain 0.035, most at 20–21 h, ×1.3 in rain.

**Day and night** follow the same hooks as the other beds: hour curves through `sampleCurve`.
`DOVE_CURVE`, `BUNTING_CURVE`, `BEEEATER_CURVE`, `CICADA_CURVE`, `GECKO_CURVE`, `FROG_CURVE` and
`OASIS_WIND_CURVE` join the existing ones. Weather and pause work as elsewhere (rain hushes the
insects and bee-eaters and wakes the frogs, mist thins the palms, a pause halves the voices). A
dove, gecko or Sahara frog seen in the oasis (`oasis:laughing-dove`, `oasis:gecko`,
`oasis:sahara-frog`) is heard more often. The garden's `small-birds` and `swallows` never change
the oasis.

## Listened/measured
I could not listen. Everything below is offline renders in headless Chromium (`sprout.audio.scene`)
and unit spectra.
- **Beds, noon** (22.05 kHz, S15's method): pond −41.7 dBFS, oasis −40.8, waterfall −39.3. At 23 h:
  −42.2, −41.4 and −39.4. The oasis is a little fuller than the pond and under the falls.
- **At 44.1 kHz**: pond −40.3, oasis −40.2, waterfall −39.2.
- **Steadiness**: the oasis's largest quarter-second step is 0.8 dB (pond 1.5, falls 1.6).
- **With voices** (40 s at noon): oasis −40.5 dBFS, loudest quarter-second −37.8 (falls −37.5).
  At 23 h the voices barely move the level (−41.4, loudest −40.3): they are short clicks and trills.
- **Switching**: pond → oasis at 4 s: largest step 1.9 dB, lowest window 2.0 dB under the pond.
  Oasis → pond: 1.3 dB and 1.8 dB under. The first version kept only 0.35 of the shared wind, and
  the cross-fade dipped about 3 dB.
- **Tuning on the way**:
  - The first palm crackle scaled grain loudness and density with the gust, which is the fourth
    power, and stepped 2.6 dB. Now only the density scales.
  - The trickle stepped 4.3 dB with sparse bubbles and now steps 2.2 at 160 a second.
  - A tanh knee at 4× RMS took the fronds' crest factor from ~9 to under 4.
- **Build cost** (Node, 48 kHz context): seguia ~110 ms and palms ~90 ms, against the falls' ~140 ms.
  Rendering at half the rate cost ~300 ms; a third and a phasor for the bubbles brought it down.
- **Renders to listen to**: `artifacts/o7/` in this worktree, 45 s each, 44.1 kHz stereo, at the
  app's true level (quiet: about −40 dBFS RMS; turn the volume up):
  - `oasis-morning-07h.wav`, `oasis-noon-13h.wav`, `oasis-dusk-20h.wav`, `oasis-night-23h.wav`;
  - `pond-noon-13h-reference.wav` and `waterfall-noon-13h-reference.wav` for comparison.

  Rerender with `sprout.audio.scene({ scenery: 'oasis', hour, seconds, events: true, wav: true })`.

**Needs a human ear**:
- whether the trickle reads as water over a wall rather than frying or rain;
- whether the fronds read as palms rather than static;
- whether the dove is recognisable;
- whether the night voices are loud enough to notice and quiet enough to ignore.

## Left open
- **Listening by ear**, in the browser and over a long session.
- **Creature ids are guesses**: `laughing-dove`, `gecko`, `sahara-frog` (for the "seen there"
  boosts). When the oasis fauna lands, check they match its ids.
- **No hoopoe** "oop-oop-oop" (the research suggests it for the bed), **no stork** bill-clatter.
- **No seasons**: bee-eaters call all year, and frogs too.
- **The pond's crickets and chirps** still serve the oasis: the oasis's crickets are the garden's
  cricket recipe, and it keeps the garden's distant chirps at half rate.
- **Main-thread build** of ~0.2 s at the first switch to the oasis, untimed in a real browser.
- The pond at 23 h with voices has a −31 dBFS quarter-second, 11 dB over its bed: a pond voice,
  untouched here, worth a look.

## Outside the O7 paths
- `src/scenery/oasis/index.ts`: `sound: 'oasis'` (one line), and its check in
  `scenery/registry.test.ts`.
- `docs/ARCHITECTURE.md`: `SoundSceneryId` lists `oasis`.
- `src/audio/falls.ts`: exports its PCM helpers (`swell`, `flutter`, `render`, `chain`) for reuse.
- `tests/e2e/sound-mixer.spec.ts`: two tests.

## Status
O7 done, pending a listen. Checks: `npm run typecheck`, the vitest files the change touches
(audio, core/soundscape, persistence, migration-v4, scenery/registry), and the e2e specs
sound-mixer and sound-mixer-studio. Results are in the report.

## For the orchestrator
- Devlog index: `| 126 | [O7: the oasis's sound bed](126-oasis-sound.md) | The oasis plays its own sound: a seguia trickle and murmur, dry palm fronds in slow gusts, a laughing dove and house bunting by day, a midday insect shimmer, crickets, a gecko and distant frogs at night; new seguia and palms layers, no schema change | needs a human ear; creature ids guessed; no hoopoe or seasons |`
- ADR index: `| [0303](0303-oasis-sound-bed.md) | The oasis's sound bed | accepted | an `oasis` sound profile with `seguia` and `palms` layers (seeded PCM at a third of the rate), six ambient voices, gusts through the palms (`PLACE_EVENT_LAYER`), place words in the mixer; no schema change |`
- TESTING rows:
  - `| O7.1 | The oasis plays its own sound: the seguia (a trickle of rising bubbles over a sheet of water, a low murmur) and the palms (a papery crackle in slow gusts), deterministic click-free loops; the dove and bunting by day, the bee-eater in the warm hours, a faint midday shimmer, crickets, a rare gecko and distant frogs after dark; gusts follow the palms; a custom mix keeps to its place's voices; the garden's unlocks stay in the garden | audio/oasis-bed (all); audio/params › the oasis (ADR 0303) (all); audio/recipes (dove, bunting, shimmer, gecko and frogs); audio/planner › every voice stays within its planned length…, › keeps the oasis's slow voices apart; audio/garden-audio › the oasis plays its own bed…; scenery/registry › plays its own sound profile… | sound-mixer › real audio graph: the oasis sits as calmly as the pond… | ✔ levels and glide; ◐ listening by ear |`
  - `| O7.2 | The mixer in the oasis shows The seguia, Wind in the palms, Doves and buntings, Insects and geckos and its two presets, and keeps its mix per garden; a mix saved before the oasis (no oasis entry, no seguia or palms levels) loads and follows the garden; an oasis mix round-trips through an export | core/soundscape › the oasis has its own palette…, › a mix saved before the oasis loads…, › an oasis mix round-trips… | sound-mixer › viewing the oasis brings its own sounds… | ✔ |`
