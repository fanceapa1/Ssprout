# 04 — Procedural audio

## What
- `src/audio/`: a procedural Web Audio soundscape, muted by default. Pond water (brown noise bed
  + plips), wind in leaves (swept band-passed pink noise + gusts), distant birds (chirps, a rare
  bush-warbler "hō-hokekyo", swallows when unlocked), night crickets, rain bed + drips, mist
  muffling, a fuller/warmer bed while a session runs and a thinner one when paused, a rin-bowl
  bloom chime and a 2–3 note yo-pentatonic completion phrase, all through a procedural reverb.
- `createGardenAudio({ bus, getState, clock })` controller reacting to settings, session,
  plant and fauna events; explicit setters for weather, activity, fauna and time of day.
- Pure, unit-tested planner / params / recipes / gate / noise; controller tested with a fake
  backend and manual timers.
- Studio section **Audio**: each sound drawn as an ink sketch (brush-weight pitch contours,
  stippled noise, envelope wash) and played on click; a live soundscape card cycles
  off / sun / rain / mist / night through the real controller.

## Why (non-obvious)
ADRs 0100 (sounds as data over a thin backend), 0101 (gating + fades), 0102 (audio clock vs
`Clock`), 0103 (levels, measured offline).

## Left for others
- Wire it in `main.ts` and the speaker toggle (snippet in `docs/systems/audio.md`). The toggle
  must call `audio.unlock()` inside its click handler.
- Make sure `settings:changed` is emitted after `settings/update` (or call `setMuted`).
- Feed `setFauna` from `core/fauna-unlocks.ts` if `fauna:arrived` is not emitted for every
  unlocked creature; mirror dev `setTime` / `setWeather` into `setTimeOfDay` / `setWeather`.
- An e2e check of the toggle (e.g. a `window.sprout.audio.muted()` hook) belongs with the UI task.
