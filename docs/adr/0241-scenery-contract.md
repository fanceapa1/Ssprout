# ADR 0241: The scenery contract

- Status: accepted
- Date: 2026-10-28
- Amends: ADR 0145 (painted sky plates), ADR 0147 (painted light plates)

## Context
Phase 10 adds a second place to grow a garden, a rocky waterfall (S0 audit, ROADMAP phase 10).
The owner decided that the timeline is shared, only plants belong to a garden, sceneries switch
at runtime without a reload (S3), and the weather is global. Before this task the Japanese
garden was hard-wired: `SceneGeometry` required a pond, a pavilion with a lantern and a
waterline; the background's steps, the sky layout (horizon, sun and moon positions, stars), the
sky plates' rect and ridge, the cast light's engawa shadow and shoji light, the lantern in the
grade wash and the flame, the eave drips, the dew boxes, the mist bands and veil, the portrait
focus, the guiding path's origin and the watering can's pavilion avoidance were module constants.

## Decision
- **One `Scenery` per place** (`src/scenery/types.ts`): `id`, `name`, `blurb`, `order`,
  `available(flags)`, `geometry`, `art`, `sky`, `light`, `ambience`, `view`. A registry
  (`registry.ts`) holds the Japanese garden only; `getScenery(id)` falls back to the default for
  an id not registered yet. Ids live in `src/scenery/ids.ts` until the schema task (S1) moves them
  to `src/core/sceneries.ts`.
- **`SceneGeometry` generalised.** `pavilion` gives way to `structure: Box | null`,
  `lights: { id, at, r }[]` and `eave: Eave | null`; `streams: Pt[][]` and `falls` are added for
  moving water. The Japanese garden keeps its exact numbers (`EAVE` is the literal the engawa's
  frame gives; a unit test holds them together). `pavilionOf(scene)` rebuilds the engawa (structure
  + the `lantern` light) for its painters. `gardenScene` stays the Japanese garden's geometry, so
  `main.ts` and the other callers work untouched.
- **Data, not constants.** Each consumer takes the scenery's data as an option and defaults to
  the Japanese garden's: the background runs `art.steps(art, only)` (`backgroundSteps`); the sky
  light takes a `ScenerySky` (layout, rect, open-sky shape, plate painters); `sunDisc`, `moonDisc`
  and `stars` take a `SkyLayout`; the light plates take `LightArt` (trees, shrubs, sky, and two
  hooks: `shadows` and `lights`, where the engawa's shadow and lamp-lit shoji now live); the grade
  wash, the warm pools and the flame loop over `scene.lights`; the drips fall from `scene.eave`;
  dew, mist bands and the veil come from `SceneryAmbience`; `DEFAULT_FOCUS` is the default
  scenery's `view.focus`; the wayfinding takes `pathOut()`; the watering can avoids `structure`.
- **Departures from the S0 proposal**, where the code showed a better shape:
  - The sky is a `ScenerySky` object (layout + rect + shape + two painters), not loose fields.
  - The engawa's light marks are `LightArt` hooks, not a `paintExtras` that also takes grades;
    the phase grades stay global (weather and daylight are global).
  - `fauna`, `sound`, `habitatWords`, `thumbnail` and `surface` are left out: no code reads them
    yet, and their shape is best set by the tasks that consume them (S11, S15, S5, S9).
  - The Japanese garden's painters stay in `src/scene/`; `src/scenery/japanese-garden/` gathers
    them and holds its numbers. Moving them is churn with no behaviour.
- **No runtime switching here.** Systems get the scenery where they are created (`addAmbience`
  passes the Japanese garden); `SystemContext.scenery` and the swap are S3.

## Consequences
- The Japanese garden paints pixel for pixel as before: the recording-canvas hash pins are
  unchanged and full frames at midday, sunset, night, overview and close views diff 0 (devlog 60).
- The light plates' fingerprint now covers `structure`, `lights` and the sky layout.
- A caller that builds `LightArt` by hand gets no engawa marks unless it adds `ENGAWA_LIGHT`
  (the studios use `GARDEN_LIGHT_ART`); `createAmbience` without a scenery keeps the old default
  (no trees, the geometry's own engawa marks).
- `core/soundscape.ts` has its own `SceneryId` (the audio sceneries `pond` and `coast`); the two
  are reconciled when audio follows the scenery (S1/S15).
