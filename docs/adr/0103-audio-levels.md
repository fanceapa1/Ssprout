# ADR 0103 — Audio levels: a quiet, normalised mix with chimes outside the mist filter

- Status: accepted
- Date: 2026-10-21

## Context
SPEC: subtlety — nothing shouts; the bloom chime is "gentle". Levels must be consistent between
weathers and times of day, and the chime must still read when mist muffles the garden.

## Decision
- Each recipe carries its own small output gain (≤ 0.12); beds use `BED` levels; everything
  meets at `MASTER_LEVEL = 0.8` into a gentle compressor (−18 dB threshold, 3:1, soft knee) that
  only catches stacked peaks.
- Levels were measured by rendering into an `OfflineAudioContext`
  (`createWebAudioBackend(seed, { context })`): 30 s scenes ≈ −38 dBFS RMS (rain −36, night
  −40), peaks ≈ −17 dBFS; bloom chime peak ≈ −20 dBFS, completion ≈ −22 dBFS.
- Mist is a low-pass on the ambience path (beds + events + reverb return); chimes go to the
  master directly so they stay clear.

## Consequences
The garden is quiet at typical system volume by design. Re-measure with an offline render when
adding layers; keep scenes within a few dB of the figures above.
