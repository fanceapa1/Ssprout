# Audio system

`src/audio/` — a fully procedural Web Audio soundscape (no audio files): pond water, wind in
leaves, distant birds, night crickets, rain during rain sessions, a bloom chime and a short
completion phrase. **Muted by default**; nothing is created or played until the user has
unmuted *and* a user gesture has unlocked audio. Master fades in/out over 2 s, never abruptly.

## Modules
| File | Pure? | Role |
|---|---|---|
| `params.ts` | yes | time of day / weather / activity / fauna → bed levels, filters, event rates (`mixParams`) |
| `recipes.ts` | yes | each sound as data (`SoundSpec`: tone/noise voices, pitch contours, envelopes) |
| `planner.ts` | yes | seeded Poisson scheduler: which events start in the last `dt`, voice cap, per-kind gaps |
| `gate.ts` | yes | mute/unlock/dispose state machine → engine commands |
| `noise.ts` | yes | seeded white/pink/brown noise loops (click-free) and the reverb impulse |
| `backend.ts` | no | the only Web Audio code: graph, beds, generic `SoundSpec` renderer (`AudioBackend` facade) |
| `garden-audio.ts` | — | controller: bus listeners, gate, planner tick, chimes (`createGardenAudio`) |
| `audio.studio.ts` | — | studio section "Audio": ink sketch of every sound, click to play |

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
Bus events consumed: `settings:changed` (mute), `session:start` (weather + active),
`session:pause` / `session:resume` (also emitted around a `session:switch`), `session:cancel` /
`session:complete` (clear weather and activity, whichever session ended; complete also plays the phrase), `plant:placed` (bloom chime), `session:water` (the pour), `fauna:arrived` (adds a creature).
**Known gap:** there is no `session:switch` handler, so the weather bed keeps the session started
last, and cancelling a *waiting* session (`controller.cancel(id)`) silences the active one's weather
(SPEC §2 › Parallel sessions status; devlog 35).
Initial muted/weather/activity/fauna come from `getState()` (a reload mid-session sounds right).
Setters and bus events write the same fields; the last write wins.

## Integration (as wired)
- `src/main.ts` builds `createGardenAudio({ bus, getState: store.get, clock })` and passes it to
  `createUI({ audio })`.
- Gesture unlock (`src/ui/index.ts`): with sound on (persisted), the first `pointerdown` / `keydown`
  calls `audio.unlock()`; starting a session (`beforeStart`) unlocks too.
- Mute toggle (`src/ui/tools.ts`): the "Garden sounds" tool calls `controller.updateSettings({ muted })`
  (emits `settings:changed`, which audio follows), then `audio.setMuted(muted)` and
  `audio.unlock()` inside the click. Order does not matter: unmute-then-unlock and
  unlock-then-unmute both fade in.
- Fauna: nothing calls `audio.setFauna`; creatures are added by `fauna:arrived` on the bus (emitted
  by the fauna system on first sight and re-emitted by `controller.announceFauna`) and by the
  initial `getState()`.
- Not implemented: there is no `sprout.audio` dev hook, and the ambience's `sprout.setTime` /
  `sprout.setWeather` do not reach audio (use `audio.setTimeOfDay` / `audio.setWeather` in code or
  the studio's "Live soundscape").

## Tuning
- **Rates and levels**: `params.ts` — `BASE_RATES` (events/min), `BED` levels, `MASTER_LEVEL`,
  `FADE_S`, and the hour curves (`BIRD_CURVE`, `WARBLER_CURVE`, `SWALLOW_CURVE`,
  `CRICKET_CURVE`, `WIND_CURVE`). The studio entry `audio/soundscape` plots the curves.
- **Sounds**: `recipes.ts` — every number of a sound lives in its recipe; the studio sketch
  redraws from the same data, so tweak → reload studio → look and click.
- **Spacing / density limits**: `planner.ts` — `MIN_GAP_S`, `PAN_SPREAD`, `MAX_VOICES`.
- **Levels** (measured with an `OfflineAudioContext` render, `createWebAudioBackend(seed,
  { context })`): 30 s scenes sit at about **−38 dBFS RMS** (rain −36, night −40) with peaks
  around −17 dBFS; the bloom chime peaks near −20 dBFS. Keep any change within a few dB.
- Listen in the studio (`/Ssprout/studio.html#audio`): click a card to play it; click
  "Live soundscape" to cycle off → sun → rain → mist → night through the real controller.

## Tests
`params.test.ts` (curves, weather/activity/fauna mapping, low levels), `planner.test.ts`
(determinism, rate accuracy, step-size independence, voice cap, gaps), `gate.test.ts`
(autoplay gating, fades, dispose), `recipes.test.ts` (valid quiet specs, warbler shape,
pentatonic phrase), `noise.test.ts` (spectral tilt, seamless loops, decaying IR),
`garden-audio.test.ts` (controller with a fake backend and manual timers).
