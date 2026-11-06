# Audio system

`src/audio/` — a fully procedural Web Audio soundscape (no audio files): pond water, wind in
leaves, distant birds, night crickets, rain during rain sessions, a bloom chime and a short
completion phrase. The waterfall garden has its own bed instead of the pond's: the falls, the
gorge's wind, stream birds and the kajika frog at dusk (› Waterfall), and the Ksar oasis has the
seguia's trickle, palm fronds in the wind, doves, buntings and a gecko after dark (› Oasis). **Muted by default**; nothing is created or played until the user has
unmuted *and* a user gesture has unlocked audio. Master fades in/out over 2 s, never abruptly.

## Modules
| File | Pure? | Role |
|---|---|---|
| `params.ts` | yes | time of day / weather / activity / fauna → bed levels, filters, event rates (`mixParams`) |
| `recipes.ts` | yes | each sound as data (`SoundSpec`: tone/noise voices, pitch contours, envelopes) |
| `planner.ts` | yes | seeded Poisson scheduler: which events start in the last `dt`, voice cap, per-kind gaps |
| `gate.ts` | yes | mute/unlock/dispose state machine → engine commands |
| `noise.ts` | yes | seeded white/pink/brown noise loops (click-free) and the reverb impulse |
| `falls.ts` | yes | the waterfall's bed as seeded PCM: plunge (rumble and roar) and stereo spray (ADR 0283) |
| `oasis-bed.ts` | yes | the oasis's beds as seeded PCM: the seguia (trickle and murmur) and the palms (ADR 0303) |
| `standard-loops.ts` | yes | the fireplace, café and lo-fi PCM loops (ADR 0213) |
| `backend.ts` | no | the only Web Audio code: graph, beds, generic `SoundSpec` renderer (`AudioBackend` facade) |
| `garden-audio.ts` | — | controller: bus listeners, gate, planner tick, chimes (`createGardenAudio`) |
| `audio.studio.ts` | — | studio section "Audio": ink sketch of every sound, click to play |
| `debug.ts` | — | `?dev` `sprout.audio`: the controller plus offline renders (`measure`, `scene`) |

Everything above `backend.ts` is unit-tested against a fake backend and fake timers
(`*.test.ts`); no AudioContext is needed in tests.

## Graph
```
  water  brown noise → HP 80 → LP 520 → lap (LFO 0.11 Hz) ─┐
  wind   pink noise → BP (LFO-swept 0.06 Hz) → breath (LFO 0.03 Hz) → gust swell ─┤
  rain   pink noise → HP 900 → LP 7 kHz (0 unless raining) ─┘
            └→ bed gain (activity) → warmth low-shelf 250 Hz ─┐
  events  plip · drip · chirp · warbler · swallow · cricket   │
          voices → spec gain → [distance LP] → pan → eventsBus ┤
                                         └→ send ─┐            │
  chimes  rin bowl · completion phrase            ▼            ▼
          voices → spec gain → pan → chimeBus   convolver → return → air (LP: mist muffles)
                         └→ send → convolver           │
                         └───────────────→ master ◄────┘
  master (2 s fades) → compressor (gentle limiter, −18 dB, 3:1) → destination
```
- Noise buffers (brown 6 s, pink 7 s, white 1 s) are generated **once per context** and shared:
  wind and rain loop the same pink buffer from different offsets; noise voices start at random
  offsets of the white buffer. The reverb impulse (2.6 s, stereo, darkening tail) is procedural.
- Beds are built lazily on the first fade-in. One-shot voices disconnect on `ended`.
- CPU: 3 looping sources + 3 LFOs while unmuted (the context is suspended when muted); at most `MAX_VOICES = 6` planned events sounding,
  `MAX_CHIMES = 2` chimes, hard cap of 12 live sounds in the backend.

## Layers & events
| Layer / event | When | Notes |
|---|---|---|
| water bed | always | low brown noise, gently lapping |
| plip | ~3.5/min | sine with fast pitch drop, sometimes a fainter second drop |
| wind bed + gusts | always; gusts ~0.5/min | swept band-pass; gust = 5–8 s swell |
| chirp | dawn chorus, fewer midday, none at night | 1–3 whistled notes, ×2.2 with `small-birds` |
| bush warbler "hō-hokekyo" | rare, mostly mornings (≥25 s apart) | long held whistle, then ho-ke-kyo |
| swallows | daylight, only with `swallows` | quick high twitter |
| crickets | dusk → before dawn | pulse trains on a ~4.5 kHz sine |
| rain bed + drips | weather `rain` | birds ×0.35, plips ×0.3 |
| mist | weather `mist` | everything except chimes through a 2.4 kHz low-pass, birds ×0.7 |
| session running | | bed ×1.12 and +2.5 dB low-shelf warmth |
| session paused | | bed ×0.55, events ×0.5, wind ×0.7 (the garden holds its breath) |
| bloom chime | `plant:placed`, `playBloom()` | rin bowl: inharmonic partials 1 / 2.74 / 5.1 / 8.2, detuned twin → slow beat |
| completion | `session:complete`, `playComplete()` | 2–3 kalimba notes from the yo pentatonic (D E G A B) |
| falls bed | the waterfall (the falls layer) | seeded plunge and spray loops, › Waterfall |
| splash | the waterfall, ~1.4/min (×0.6 in rain) | a rounded slap of water noise, a little spatter, 1–3 low bubbles; on the `falls` layer |
| brown dipper | the waterfall, by day, most at dawn and late afternoon (≥30 s apart) | 9–15 quick rippling notes around 3.2 kHz, now and then a trill; on `birds` |
| kajika frog | the waterfall after dusk, once a kajika has been seen there (≥25 s apart) | 7–10 rising whistled slides, the gaps closing; ×1.3 in rain; on `crickets` |
| seguia and palms beds | the oasis (the `seguia` and `palms` layers) | seeded loops, › Oasis; gusts swell the palms |
| laughing dove | the oasis, by day, most in the morning and before dusk (≥18 s apart) | five low eased notes climbing to the third, sometimes twice; on `birds` |
| house bunting | the oasis, by day, most in the early morning (≥12 s apart) | 5–8 quick down-slurred notes at 3–4 kHz, stepping down; on `birds` |
| bee-eater | the oasis, warm hours, not in rain (≥25 s apart) | 1–3 burred "prrüp" calls around 2.6 kHz; on `birds` |
| insect shimmer | the oasis, midday, none in rain (≥8 s apart) | a faint 5–6.5 kHz rasp swelling in and out over 4–7 s; on `crickets` |
| gecko | the oasis after dark, rare (≥40 s apart) | 3–8 dry clicks; on `crickets` |
| frog chorus | the oasis on warm evenings (≥30 s apart) | 2–3 distant frogs rattling at ~12 pulses a second; ×1.3 in rain; on `crickets` |
| watering pour | every `session:water` (automatic in focus, tapped in a break), `playPour()` | ~2 s trickle: band-passed water noise swelling in over ≥ 0.25 s, an airy top, 10–15 rising bubbles under the stream; one at a time (ADR 0182) |

## API
```ts
const audio = createGardenAudio({ bus, getState: store.get, clock /*, seed, createBackend, timers */ });
audio.unlock();                 // from a user gesture
audio.setMuted(false);          // also follows 'settings:changed'
audio.isMuted();
audio.setWeather('rain' | 'mist' | 'sun' | null);
audio.setActivity({ sessionActive, paused });
audio.setFauna(['small-birds', 'swallows']);
audio.setTimeOfDay(23);         // override; null → follow the clock's local hour
audio.playBloom(); audio.playComplete(); audio.playPour();
audio.dispose();
```
Bus events consumed: `settings:changed` (mute), `plant:placed` (bloom chime), `session:water`
(the pour), `fauna:arrived` (adds a creature), and the session events below.

**The ambience follows the active session** (SPEC §2 › Parallel sessions, ADR 0150). On every
`session:start`, `session:pause`, `session:resume`, `session:switch`, `session:cancel` and
`session:complete` the audio re-reads `getState().session` (the session controller emits after the
store changed) and takes weather and activity from it; it never uses the event's session id:

| Situation | Weather bed | Activity |
|---|---|---|
| active session running | its weather | running (fuller bed, warmth) |
| active session paused | its weather | paused (the held breath) |
| a switch | the session switched to | it runs (a switch resumes it) |
| a waiting session cancelled | unchanged (no mix is re-applied) | unchanged |
| the active one completes or is cancelled, others waiting | none (clear) | idle; waiting sessions never sound |

`session:complete` also plays the phrase. Sessions that only wait are always silent.
Initial muted/weather/activity/fauna come from `getState()` the same way (a reload mid-session
sounds right). `setWeather` / `setActivity` write the same fields (the studio uses them); the last
write wins until the next session event re-reads the state. A `state/replace` (import) or reset
emits no session event, so the bed changes with the next one.

## Integration (as wired)
- `src/main.ts` builds `createGardenAudio({ bus, getState: store.get, clock, scenery })` on the
  viewed garden's `Scenery.sound` and passes it to `createUI({ audio })`. A store subscription calls
  `audio.setScenery(sound)` whenever `state.scenery` changes (ADR 0283); the same id is a no-op.
- Gesture unlock (`src/ui/index.ts`): with sound on (persisted), the first `pointerdown` / `keydown`
  calls `audio.unlock()`; starting a session (`beforeStart`) unlocks too.
- Mute toggle (`src/ui/tools.ts`): the "Garden sounds" tool calls `controller.updateSettings({ muted })`
  (emits `settings:changed`, which audio follows), then `audio.setMuted(muted)` and
  `audio.unlock()` inside the click. Order does not matter: unmute-then-unlock and
  unlock-then-unmute both fade in.
- Fauna: nothing calls `audio.setFauna`; creatures are added by `fauna:arrived` on the bus (emitted
  by the fauna system on first sight and re-emitted by `controller.announceFauna`) and by the
  initial `getState()`. Both use the `state.faunaSeen` keys: the bare id in the Japanese garden,
  `waterfall:<id>` at the falls (`faunaSeenKey`, ADR 0240).
- `?dev` has `sprout.audio` (› Personal sound mixer, › Waterfall). The ambience's `sprout.setTime` /
  `sprout.setWeather` do not reach audio (use `audio.setTimeOfDay` / `audio.setWeather` in code or
  the studio's "Live soundscape").

## Tuning
- **Rates and levels**: `params.ts` — `BASE_RATES` (events/min), `BED` levels, `MASTER_LEVEL`,
  `FADE_S`, and the hour curves (`BIRD_CURVE`, `WARBLER_CURVE`, `SWALLOW_CURVE`,
  `CRICKET_CURVE`, `DIPPER_CURVE`, `KAJIKA_CURVE`, `WIND_CURVE`). The studio entry
  `audio/soundscape` plots the curves. The waterfall's factors are in `waterfallMix`.
- **Sounds**: `recipes.ts` — every number of a sound lives in its recipe; the studio sketch
  redraws from the same data, so tweak → reload studio → look and click.
- **Spacing / density limits**: `planner.ts` — `MIN_GAP_S`, `PAN_SPREAD`, `MAX_VOICES`.
- **The falls**: `falls.ts` — `FALLS_GAIN` (the level), `FALLS_BLEND` (spray under plunge),
  `PLUNGE_S` / `SPRAY_S`, and the filters and swells in `plungeLoop` / `sprayLoop`.
- **Levels** (measured with an `OfflineAudioContext` render, `createWebAudioBackend(seed,
  { context })`): 30 s scenes sit at about **−38 dBFS RMS** (rain −36, night −40) with peaks
  around −17 dBFS; the bloom chime peaks near −20 dBFS. Keep any change within a few dB.
  The garden beds alone (no events, noon, idle) render at −41.5 dBFS for the pond and −39.1 for
  the waterfall (`sprout.audio.scene`, › Waterfall).
- Listen in the studio (`/Ssprout/studio.html#audio`): click a card to play it; click
  "Live soundscape" to cycle off → sun → rain → mist → night through the real controller.

## Tests
Personal mixes (ADR 0213): `core/soundscape.test.ts`, `audio/standard-loops.test.ts`, additions
to `params.test.ts` / `garden-audio.test.ts`, and `tests/e2e/sound-mixer.spec.ts` (including
real OfflineAudioContext renders, UI persistence, scenery changes, keyboard and narrow phones).

`params.test.ts` (curves, weather/activity/fauna mapping, low levels), `planner.test.ts`
(determinism, rate accuracy, step-size independence, voice cap, gaps), `gate.test.ts`
(autoplay gating, fades, dispose), `recipes.test.ts` (valid quiet specs, warbler shape,
pentatonic phrase), `noise.test.ts` (spectral tilt, seamless loops, decaying IR),
`garden-audio.test.ts` (controller with a fake backend and manual timers; the parallel-session
cases run the real session controller and store so events arrive in the app's order).

The waterfall (ADR 0283): `falls.test.ts` (determinism, lengths and RMS, the plunge low and the
spray bright, the blend's octave tilt against white noise, click-free seams, slow breathing),
`params.test.ts › the waterfall` (the falls instead of the water, the dipper and kajika by hour
and by sighting, birds under the roar, rain, custom mixes keep to their place), `recipes.test.ts`
(splash, dipper, kajika), `garden-audio.test.ts › a creature arriving at the falls…`,
`scenery/registry.test.ts` (each scenery's `sound`), and `tests/e2e/sound-mixer.spec.ts › viewing
the waterfall garden…` and `› real audio graph: the waterfall sits as quietly…`.

The oasis (ADR 0303): `oasis-bed.test.ts` (determinism, rates and RMS, the trickle mid, the murmur
low and the fronds bright, click-free seams, a steady trickle and slow gusts, the gust envelope),
`params.test.ts › the oasis` (beds instead of the water, day and night voices by hour, the breeze,
rain, sightings, custom mixes and `eventLayer`), `recipes.test.ts` (dove, bunting, shimmer, gecko,
frogs, bee-eater), `planner.test.ts` (every voice within its planned length; the slow voices'
gaps), `garden-audio.test.ts › the oasis plays its own bed…`, `core/soundscape.test.ts` (the
palette, presets, a mix saved before the oasis, an export round trip), and
`tests/e2e/sound-mixer.spec.ts › viewing the oasis…` and `› real audio graph: the oasis sits as calmly…`.

## Personal sound mixer (ADR 0213)
`core/soundscape.ts` is the shared, pure catalogue and preference model. **Standard** has nine
layers: rain, ocean waves, wind, birds, fireplace, café, lo-fi, white and brown noise. **Scenery**
uses a registered palette: pond water/leaves/birds/crickets/rain, the waterfall's falls/leaves/
birds/crickets/rain, and a coastal waves/leaves/birds/rain profile reserved for future navigation.
`createGardenAudio({ scenery: 'pond' })` defaults to the pond; `main.ts` calls `setScenery(id)`
with the viewed garden's `Scenery.sound`. That changes the mix with a 2 s glide and notifies
`onSceneryChange`; it does not select or unlock visual art.

`settings.soundscape` stores the selected collection, overall volume, one Standard mix and
per-scenery mixes in schema v3. The v2 → v3 migration preserves all old fields and the mute
choice; absent sound preferences keep the original automatic mix.
Scenery's `mode: 'garden'` follows weather/hour; `custom` uses fixed levels. Standard is always
custom and stays identical across scenery changes. Both still follow the **active session**: a
custom or Standard mix ignores the session's weather, but its bed fullness and event rates come
from the active session's activity, so a `session:switch`, a pause or a bloom with others waiting
moves it exactly as it moves the garden mix, and ending a waiting session changes nothing
(`garden-audio.test.ts › the sound mixes follow the active session too`). The parameter mapper filters out layers
outside the active palette even if an imported mix contains values for hidden layers.
The session controller emits `settings:changed` for whole-state restore/reset as well as edits,
so importing a muted mix immediately mutes the real audio gate without a reload.

`standard-loops.ts` makes original fireplace, café and lo-fi PCM: seeded fire rumble/crackle,
indistinct room murmur with occasional cup clinks, and a 75 BPM four-bar instrumental loop with
soft keys, bass and brushed drums. No recordings, downloads, speech or external music services.
The backend builds each extra bed once on first use: waves use filtered pink noise with two
slow swells; white/brown use the shared noise generators. Up to six extra looping sources and
two wave LFOs can remain at zero gain after use; mute suspends the whole context as before.

Each `MixParams` includes `eventLevels` (percent) and `extra` (percent). One-shots route through
their layer's dry and wet gains, so reducing birds/crickets/water/rain also fades existing voices
and future reverb sends. Watering and chimes stay independent of layer sliders but follow overall
volume and mute. New gains glide over 1.5 s; the original limiter and quiet master remain.

The studio has `audio/standard-waves`, `standard-fire`, `standard-cafe`, `standard-lofi`,
`standard-white`, `standard-brown`, each with a waveform and click-to-play/stop. `?dev` adds
`sprout.audio` (controller plus `measure`). E2E verifies each Standard layer has RMS > 0.0001,
peak < 0.2, all-nine peak < 0.3, and zero layer gains silence a scheduled bird. These are
headroom/isolation checks, not a substitute for subjective listening.

## Waterfall (ADR 0283)
The waterfall garden (`Scenery.sound: 'waterfall'`) plays its own profile: the `falls` layer in
place of the pond water, the gorge's wind, birds, crickets (the kajika's layer) and rain. Presets
"By the falls" and "Dusk in the gorge".

**The bed** (`falls.ts`) is seeded PCM, built once per context the first time the falls are
audible and looped:
```
  plunge (mono, 13 s, at a third of the context rate, ≥ 8 kHz)
    rumble  noise → HP 28 → LP 170 ×2           × surge  (1, 3, 7 cycles a loop)
    roar    noise → BP 420 (Q 0.4) → LP 1.6 k   × breathe (2, 5 cycles), at 0.6 of the rumble
  spray (stereo, 9 s; the right channel is the left half a loop on)
    hiss    noise → HP 2.4 k ×2 → LP 7 k        × fizz (7 Hz flutter ±22 %) × shimmer (1, 4 cycles)
    mist    noise → BP 1.3 k → LP 3 k           × (2 − shimmer), at 0.35 of the hiss
  backend: plunge ─┐
           spray × 0.28 ─┴→ falls gain (FALLS_GAIN 0.065 at 100 %) → bed
```
Each loop is normalised to RMS 0.16 and its seam is cross-faded over 0.4 s. The pair repeats every
117 s. The swells have whole cycles per loop (seamless) and are sampled 4096 times a loop. The
plunge carries nothing above ~3 kHz, so its lower rate loses nothing; the buffer source resamples it.

**The mix there** (`waterfallMix`, garden mode): falls 70 %, no water or plips, wind ×0.6, gusts
×0.6. Distant chirps ×0.6 under the roar (×1.4 once a wagtail has been seen at the falls), the
warbler ×0.8, house-martin twitter only once the iwatsubame have been seen there, crickets ×0.5.
Splashes ~1.4/min (×0.6 in rain), the dipper on `DIPPER_CURVE`, the kajika on `KAJIKA_CURVE` once
seen there (×1.3 in rain). A custom mix plays only the events of its place (`PLACE_EVENTS`): the
pond never gets a dipper, the waterfall never a plip.

**Switching gardens** glides every gain over 2 s (time constant 0.67 s) while the picture
cross-fades in 0.9 s. The first switch to the waterfall builds the falls PCM on the main thread
at that moment.

**Measured** with `sprout.audio.scene({ scenery, to?, switchAt?, seconds?, hour? })`, an offline
render (22.05 kHz) of a profile's garden beds, with dB per 250 ms. At noon, idle, no events:
| | RMS | peak |
|---|---|---|
| pond | −41.5 dBFS | 0.039 |
| waterfall | −39.1 dBFS | 0.052 |
| waterfall at 23 h | −39.2 dBFS | — |

Pond → waterfall at 4 s: the largest step between neighbouring windows is 1.7 dB (the plunge's
own breathing is about as large), the lowest window −42.8 dBFS (1.3 dB under the pond), and it
sits at the waterfall's level 6 s on. Waterfall → pond: 1.8 dB, −43.4 dBFS (1.9 dB under the
pond). The e2e test allows 2.5 dB a step, 3 dB under the quieter garden, and 1.5 dB from the new
garden's level at the same moment.

**Studio**: `audio/falls` (the two loops as level traces, click to play the waterfall's garden
mix), `audio/splash`, `audio/dipper`, `audio/kajika`, and the dipper and kajika curves on
`audio/soundscape`.

**Not done**: the yamasemi's rattle, the heron's croak, the house martins' own call (they use the
garden swallows' twitter), a dipper "zit" call on landing, and spray that follows the falls'
animated flow. The bed is checked by unit spectra and offline renders only: it still needs a
listen by ear in the studio and over a long session.

## Oasis (ADR 0303)
The Ksar oasis (`Scenery.sound: 'oasis'`) plays its own profile: the `seguia` and `palms` layers,
birds ("Doves and buntings" in the mixer there), crickets ("Insects and geckos") and rain. Presets
"In the palm grove" and "A warm night by the basin".

**The beds** (`oasis-bed.ts`) are seeded PCM, built once per context the first time each is
audible, and looped. Every loop renders at a third of the context rate (at least 8 kHz):
```
  seguia (SEGUIA_GAIN 0.056 at 100 %)
    trickle (stereo, 9 s; the right channel is the left half a loop on)
      bubbles  ~160/s × flow: sines at 0.6–2.4 kHz (log-uniform), τ ≈ 10 ms + 8/f, pitch rising
               10–25 % per τ, louder when lower (√(900/f)); a phasor re-tuned every 32 samples
      sheet    noise → BP 1.1 k → LP 3.5 k × flicker (11 Hz flutter ±30 %) × flow, at 0.65
      air      noise → HP 2.6 k → LP 6 k × flow, at 0.12
      flow     swell (1, 3, 8 cycles a loop; ±20, 12, 6 %)
    murmur (mono, 14 s) × 0.55
      flow     noise → HP 90 → LP 380 ×2 × drift (1, 3 cycles)
      eddies   noise → BP 520 (Q 1.2) → LP 1.2 k × turn (2, 5 cycles), at 0.4
  palms (stereo, 17 s; PALMS_GAIN 0.056 at 100 %) → palm swell (gusts) → gain
    crackle  noise × grains (0.8 ms and 3 ms decays, 500 + 2000·g² a second) → HP 1.5 k → BP 3.8 k → LP 7.5 k
    whoosh   noise → HP 900 → LP 4.5 k × g^1.2, at 0.55
    g        the gust envelope: 0.2 (lull) to 1 (gust), (1, 2, 5 cycles), shaped ^1.4 so lulls last longer
```
Each loop gets a soft knee at four times its RMS (tanh), is normalised to RMS 0.16, and its seam
is cross-faded over 0.4 s.

**The mix there** (`oasisMix`, garden mode): seguia 60 %, palms 45 % × (0.4 + 0.6 × the breeze),
×0.7 in mist or while paused, ×1.1 in rain; the shared wind at 0.6 × the breeze (some open air
under the fronds, and no dip when switching from the pond); no pond water, plips or warbler.
`OASIS_WIND_CURVE` (the breeze): 0.5 at night, rising from 10 h to 1 at 14 h. Gusts at 0.6/min ×
the breeze, and each gust swells the palms by 1 + 0.8 × (amount − 1) as well as the wind.
Voices per minute at full activity: dove 0.7 (`DOVE_CURVE`, ×1.4 once a laughing dove is seen
there), bunting 0.6 (`BUNTING_CURVE`), bee-eater 0.25 (`BEEEATER_CURVE`), shimmer 1.6
(`CICADA_CURVE`), gecko 0.4 (`GECKO_CURVE`, ×1.5 once seen there), frogs 0.35 (`FROG_CURVE`,
×1.5 once a Sahara frog is seen there); distant chirps at half the garden's, swallows only once
seen there, crickets ×0.8. In a custom mix gusts follow the palms slider (`PLACE_EVENT_LAYER`).

| hour | voices per minute (idle, clear) |
|---|---|
| 7.5 | dove 0.70, bunting 0.54, chirp 0.57, bee-eater 0.04, gust 0.35 |
| 13 | shimmer 1.52, dove 0.32, bunting 0.28, bee-eater 0.24, chirp 0.26, gust 0.57 |
| 20.5 | crickets 3.9, frogs 0.35, gecko 0.27, gust 0.40 |
| 23 | crickets 5.4, gecko 0.35, frogs 0.17, gust 0.33 |

**Measured** with `sprout.audio.scene` (offline, 22.05 kHz, idle, beds only, 250 ms windows after
the first second):
| | noon | 23 h | largest step |
|---|---|---|---|
| pond | −41.7 dBFS | −42.2 | 1.5 dB |
| waterfall | −39.3 | −39.4 | 1.6 dB |
| oasis | −40.8 | −41.4 | 0.8 dB |

At 44.1 kHz the pond and the oasis both read −40.2/−40.3 dBFS and the waterfall −39.2. With the
planned voices (40 s, noon) the oasis is −40.5 dBFS, its loudest quarter-second −37.8 (the
waterfall's −37.5). Pond → oasis at 4 s: largest step 1.9 dB, lowest window 2.0 dB under the
pond; oasis → pond: 1.3 dB, 1.8 dB under. `scene({ events: true, wav: true })` plays the planned
voices too and returns a 44.1 kHz WAV.

**Studio**: `audio/oasis` (the trickle, murmur and palms as level traces; click to play the oasis's
garden mix), `audio/dove`, `audio/bunting`, `audio/beeeater`, `audio/cicada`, `audio/gecko`,
`audio/frogs`, and the dove and gecko curves on `audio/soundscape`.

**Not done**: no hoopoe "oop-oop-oop" or stork bill-clatter; no seasons (bee-eaters only from April
to September, frogs mostly in spring and summer). The voices do not follow the creatures on screen.
Nobody has listened yet: everything here is spectra, rates and offline levels.

