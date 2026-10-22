# 17 — Daylight & colour: four painted phases on the real sun, richer colour, bigger plants

Phase 6 task from ADR 0005 (owner requests 5, 8, 9). ADRs 0140–0149.

## What
- **Real sun times** (`src/ambience/solar.ts`, `zones.ts`): NOAA sunrise, sunset and civil
  twilight for the solar day around now at a location guessed from the IANA time zone (a table of
  ~110 zones, else the UTC offset's longitude and a regional mid latitude). Polar day, polar
  twilight and deep polar night handled. No prompt, no network, no time-zone maths (the solar day
  is defined by longitude alone).
- **Four phases** (`daylight.ts`): night → sunrise at civil dawn, → midday at sunrise + 60 min,
  → sunset at sunset − 60 min, → night at civil dusk, each a 40-minute smoothstep blend; short
  days, white nights and polar days have their own rules. One shared `DaylightSource` (main.ts)
  feeds the scene, the ambience, the plants and the fauna, so `sprout.setTime` moves all of them.
  `setTime` takes the four phases, blends `{ from, to, t }`, hours and null; the v1 names are
  aliases.
- **Painted, not filtered**:
  - a watercolour **sky plate** per phase multiplied under the trees in the background, sun and
    moon left as paper (the sun sinks behind the far ridge; the moon shows its real phase);
  - the **mirrored sky** laid on the pond;
  - a **light plate** per phase over everything: grade wash, long cool shadows of boulders, trees,
    shrubs and the engawa away from a low sun, light caught on the crowns, the lit shoji and
    lantern, stars;
  - **cast shadows and rim light** on every plant and boulder (sprite masks);
  - dawn **mist** on the pond lifting with the sun, **dew** glints, midday **sparkle**, the moon's
    broken **path** on the water;
  - night **takes colour out** before its indigo.
  Plates are painted once per phase on demand (sky ≈ 100 ms, light ≈ 30 ms) and the next phase in
  idle time; composites rebuild only when the light moves.
- **Colour** (ADR 0144): shared pigments ~1.4× chroma, species colours 1.3×, eight sky
  pigments. All 25 species checked in the studio galleries (tiers 1–4): richer, still watercolour.
- **Plants 1.25×** (ADR 0148): `GARDEN_PLANT_SCALE` in every garden plant box (sprites painted
  larger, labels, reflections, ghost, watering, fauna targets, motes, overlay). `meadow-11`
  (now medium) and `meadow-7` moved; geometry tests for stones, the engawa and neighbours.
- **Bug fix** (ADR 0149): `plantsReady()` right after a non-awaited `addPlants(n)` resolved while
  the new plants were still fading in (or at once before the plant system's first init); it now
  waits for init, the store change, the sprites and the fade-in.
- Studio: **Daylight · four painted phases** (each phase and each halfway blend over the garden,
  every sky and light plate, the moon through its phases). Dev: `sprout.daylight()`,
  `sprout.skyStats()`, `sprout.fauna.night()`, `plants.state().finished[].shown`.

## Why this way
- Repainting the 1.5 s landscape per phase was out; multiply is commutative, so a sky plate
  multiplied over the finished painting looks as if it had been laid in first. Plants stand in
  front of it, so the night's darkness lives in the light plate that covers them too.
- The sun and moon are holes (reserved paper), which is how a watercolourist paints lights — and
  lets the hills hide the setting sun without masks.
- Rims and shadows are cheap sprite post-processes rather than per-phase sprite variants (which
  would quadruple the worker load and the cache).

## Main.ts
Five lines: create the daylight source and pass `{ daylight }` to the scene, plants, fauna and
ambience.

## Left open / weakest spots
- The midday clouds are the least convincing element (soft, but still "cloud-shaped"); the sky
  plate is 0.7 px/unit, so sky textures are soft at 2× DPR.
- At night the unpainted paper margins read a little milky (a choice: moonlit paper).
- Sun and moon positions are art-directed for this scene (altitude and side are real, azimuth is
  not); the moon is always up at night.
- Plant rims use the nearer growth step's sprite while a plant grows (slightly off between steps).
- Audio still follows the clock hour, not the phases (ADR 0102).
- Fireflies at night were optional and are not done.

## For the camera task (zoom up to ~2.5×)
- Plant sprites are painted at `size × plantScale(slot) × resolutionBucket(viewport.pixelScale)`,
  capped at 2.4 px/unit (`src/plants/sprites.ts`); zooming in needs the bucket to follow the zoomed
  pixel scale (re-request sprites; the cache already draws the nearest resolution meanwhile) and
  the cap raised for 2.5× (≈ 4.5 px/unit at DPR 2), budget permitting.
- The light plate is 0.4 px/unit and the sky plate 0.7 px/unit: soft washes that upscale well,
  but the stars, the moon's edge and the shadow blots will look soft at 2.5×. Composite
  resolution can be raised (`CAST_SCALE`, `SKY_SCALE`) or the plates repainted for the zoomed
  view.
- The sky composite is drawn into the **cached background layer**; any camera move must
  re-composite the background (or move the sky draw out of the cache).
- Rim masks and shadow blots are keyed by sprite bitmap: new resolutions build new masks
  (one-off cost, ~1 per visible plant).
- The light plate is drawn over the world rect; the code extends its top/bottom rows for paper
  beyond the world (tall phones) — a camera that shows beyond the world should keep that.
