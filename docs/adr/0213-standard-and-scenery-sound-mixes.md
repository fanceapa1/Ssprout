# ADR 0213 — Standard sounds travel; scenery sounds belong to a place

- Status: accepted; amended by ADR 0240 (the viewed scenery is stored; the audio type is `SoundSceneryId`; a missing layer reads as 0)
- Date: 2026-10-23

## Context
The garden is intended to be filled, revisited and followed by other scenery. A sound mixer
inspired by independent ambient layers needs both familiar study sounds and a palette that
belongs to the current place. Mixing sound must preserve the paper-and-ink interface, local
storage, quiet levels and procedural audio decisions.

## Decision
- One mixer sheet, two collections. Standard has rain, waves, leaves, birds, fireplace, café
  murmur, an original lo-fi loop and white/brown noise. Scenery has only its registered layers.
- One Standard mix across places. Scenery mixes are keyed by stable scenery ID, so a pond mix
  returns when the pond does. Collection choice and overall volume are shared preferences.
- A scenery initially follows the original weather/hour mix. A level edit, toggle, preset or
  Clear creates a custom mix, independent of visual weather, hour and fauna unlocks. Follow
  the garden is reversible and keeps the saved custom levels. Neither collection edits nor
  level changes unmute; Listen and the existing speaker shortcut control the same mute bit.
- Schema v3 adds optional `settings.soundscape`, validated and deeply copied, included in exports.
  The pure v2 → v3 migration changes only the version; missing preferences preserve the original
  automatic mix and mute choice. v1 saves chain through both migrations. The storage key stays
  `studysprout:v1`. Views write through the controller.
- `audio.setScenery(id)` supplies runtime context; `onSceneryChange` updates the sheet. The
  pond is the only shipped scene; a coastal sound profile prepares this seam without adding a
  scene selector or garden progression.
- Standard beds are synthesized from seeded noise and original sample loops. Extra buffers
  and sources are built on first use and reused. Lo-fi keeps its beat across the loop boundary;
  café is an indistinct synthetic murmur with porcelain clinks, without recorded speech.
- Per-layer dry/reverb gains fade scheduled events too. Overall volume scales the gated master;
  the mute/unlock state machine, two-second fades and suspension policy stay in place.
- The sheet reuses deckled washi, serif type, drawn ink icons, brush marks and native ranges.
  A compact sticky playback bar keeps Listen and overall volume reachable; the shared sheet
  measurement clears it for keyboard focus. No new assets, libraries, animations or requests.

## Verification
Unit tests cover collection/scenery isolation, validation, exports, copying, controller gating,
master volume, parameter mapping and deterministic bounded loops. Browser tests cover the
actual sheet, reload, keyboard, mobile widths, scenery changes and offline renders through the
real backend (every layer audible, zero channels silent, stacked peaks bounded). New beds have
clickable studio entries. Musical taste and realism still benefit from listening on real devices.
