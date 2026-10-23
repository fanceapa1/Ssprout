# 40 — A sound mix to travel with, and one for each place

Added a native paper mixer to both Garden tools and the corner menu; the existing speaker
stays a quick mute shortcut. Standard offers rain, ocean waves, leaves, birds, fireplace, café
murmur, an original lo-fi loop and white/brown noise. Scenery offers the current place's palette:
the pond's water, leaves, birds, crickets and rain. Presets make a starting point; sliders/toggles
and Clear make a custom mix. Follow the garden restores weather/hour behavior without erasing
the saved custom levels. Editing never turns sound on. The compact sticky playback bar keeps
Listen and overall volume in reach, and the shared sheet measurement clears keyboard focus.

`core/soundscape.ts` owns the collection/scenery model. The optional validated setting keeps
old garden contents unchanged through the v2 → v3 migration and travels in garden exports.
Standard is shared across places; scenery
mixes are separate. `GardenAudio.setScenery` and `onSceneryChange` provide the integration seam;
a coastal audio profile is tested but no new visual scenery is exposed. The future scene
selector must call the setter on navigation. Garden progression, unlocking, editing and
returning to stored gardens are outside this change.
The controller now notifies settings integrations after a whole-state restore/reset too; before
this, importing settings could change the displayed mixer while the audio retained its old mix.
The sound rows also keep DOM, visual and keyboard order together when the palette changes.

All audio stays local and procedural. Extra beds are lazy, seeded and reused. Per-layer dry
and wet gains fade existing one-shots as well as new ones; master volume uses the original
gating/fades/limiter. The six new continuous beds have clickable studio entries; new ink icons
appear in the shell studio, whose icon sheet now sizes itself to the full catalogue. `src/main.ts` changes only two lines to
install the audio debug hook alongside the other dev hooks.

Validation: unit coverage for preference isolation/validation/export, parameters, controller
gating/volume/scenery and deterministic bounded loops; browser coverage for the UI, reload,
keyboard, reduced motion, 390/320 px layouts and real OfflineAudioContext output. Desktop and
phone captures are in `artifacts/shots/soundscape-*` for visual review. The first long browser
flow was split and the painting frozen during isolated mixer tests to stay within the suite's
time budget. Subjective sound quality remains a listening check; café is synthetic room murmur,
not a recording of people, and lo-fi is an original instrumental loop.

Integrated the newer active-session audio follower and dock styling from main. The schema is
v3, following the contributor rule for new persisted shapes; `migrateV2toV3` changes only the
version. Tests cover v1 chains and v2 gardens with plants, parallel sessions, history and
schedules, plus an actual browser reload from a v2 save. The devlog is numbered 40 to retain
the intervening upstream entries, including the taller garden stage.

Validation: typecheck and all 1,378 unit tests passed. All 18 targeted browser checks passed
serially: the mixer, migration, import/reset, keyboard, 390/320 px layouts, audio levels, studio
playback/icon sheet, smoke tests and the four rendering checks. The original two-worker Windows
run hit rendering/timing failures; those same four checks passed serially on both the unchanged
base and the rebased feature, without changing their thresholds. The full suite runs in PR CI;
its result is available with the PR checks. ADR 0213 documents the contracts and decisions.
