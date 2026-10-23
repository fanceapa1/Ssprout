# ADR 0182 — A soft pour on every watering

- Status: accepted
- Date: 2026-10-23

## Context
Automatic focus watering (ADR 0153) and tap-to-water in breaks were silent. Devlog 18 left a pour
sound for `src/audio`. It must be procedural, play only when unmuted, and be gentle.

## Decision
- A recipe `pour` (`audio/recipes.ts`), data like every other sound:
  - a band of water noise (band-pass around 1 kHz) that swells in over at least 0.25 s, wavers
    and thins over about two seconds;
  - an airy high-passed top;
  - 10–15 small bubbles whose pitch rises (a shrinking bubble's ring rises). They start only once
    the stream flows and always stay under its level.

  Gain 0.06, light reverb, distance low-pass at 5.2 kHz.
- `createGardenAudio` plays it on every `session:water`, automatic or tapped, through the events
  bus. It plays only when audio is audible (unmuted and unlocked), one pour at a time: a watering
  while a pour still sounds is dropped, never stacked into a louder one. `playPour()` exists for
  the studio and tests.

## Rejected
- A sample file: the soundscape is procedural by design (ADR 0100).
- A chime-like cue: watering is part of the garden's ambience, not a notification.
