# 39 — A sound mix to travel with, and one for each place

Added a native paper mixer to both Garden tools and the corner menu; the existing speaker
stays a quick mute shortcut. Standard offers rain, ocean waves, leaves, birds, fireplace, café
murmur, an original lo-fi loop and white/brown noise. Scenery offers the current place's palette:
the pond's water, leaves, birds, crickets and rain. Presets make a starting point; sliders/toggles
and Clear make a custom mix. Follow the garden restores weather/hour behavior without erasing
the saved custom levels. Editing never turns sound on. The compact sticky playback bar keeps
Listen and overall volume in reach, and the shared sheet measurement clears keyboard focus.

`core/soundscape.ts` owns the collection/scenery model. The optional validated setting keeps
old v2 saves unchanged and travels in garden exports. Standard is shared across places; scenery
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

Status: implementation and targeted mixer checks complete; final whole-suite results are
recorded after the release checks. ADR 0104 documents the contracts and decisions.
