# 12 — Ambience & lighting

## What
- `src/ambience/`: session weather (sun shafts + warm grade + pond glints; rain strokes in three
  depths + ripple rings + cool grade; drifting mist bands), photosynthesis motes from plants (the
  growing one most), the shared wind field `wind(t, x, y, boost?)`, and time-of-day lighting
  (morning / noon / evening / dusk / night keyframes painted as a mottled multiply wash, the lantern
  and its light on the water left as reserved warm paper).
- Envelopes per phase: focus full, break softens (0.55), paused eases to a still trace over ~3 s,
  start/end crossfade over 4 s. Reduced motion: still strokes, no motes, lighting unchanged.
- Registered in `main.ts` with one import + one line (`addAmbience`). Dev: `setTime`, `setWeather`,
  `settleAmbience`, `ambience()`.
- Studio: three sections over a painted test garden (each weather, a 60 s session loop, a strip of
  stills for breaks / paused / reduced motion, motes, the wind field, a keyframe strip, a lantern
  close-up, a 48 s day cycle). Stills share canvases: the studio page is heavy in headless Chromium,
  and a `'high'` smoothing-quality blit had slowed it from ~3 s to ~30 s (now bilinear).
- Tests: 56 unit tests (wind, envelopes, keyframes, motes/sim, lighting wash); e2e
  `tests/e2e/ambience.spec.ts` (previews, session weather, night, pause/end, setTime parsing,
  frame budget, reduced motion).

## Review rounds (screenshots, garden + studio)
1. Night backruns read as camouflage blotches and the lantern as a bright disc → backruns made rare
   and faint, lantern reserve smaller and softer, flame tiny; reflection stripes widened.
2. In the painted studio most weather vanished → shafts, ripples and rain widths raised a notch;
   then shafts looked like streaky "god rays" → streaks softened.
3. Mobile/night/mist pass: rain at night barely visible (accepted: it is night), evening mist subtle,
   motes few and faint (rate raised slightly so 2–4 are alive). Still the same painting.

## Why (non-obvious)
ADR 0080 (engine vs system), 0081 (critically damped envelopes, ambience time), 0082 (lighting as a
reserved multiply wash), 0083 (wind contract), 0084 (Poisson particles + pre-painted sprites).

## After the scene merge
- Switched to `gardenScene`; shots of the real garden (1440×900, 390×844: sun, rain, mist, evening,
  night). Mist heights were right as derived. Rain read too faint at 1× DPR → heavier strokes, a few
  more of them. Shafts were nearly invisible (white pre-paper sky) → stronger warm grade, near-white
  shafts. The lantern's mirrored light hugged the lobe's rim under the deck → stepped onto open
  water left of the post, softer.
- Added the eave drip line (eave from the scene's `pavilionFrame`).
- Studio backdrop painted once per resolution (not per seed): reseeding the studio was timing out.
- Two e2e fixes outside `src/ambience`: the scene colour check pins `setTime('noon')` (lighting
  follows the clock, so it failed at night), and the cancel test plants a tier-1 plant (a random
  tier-3/4 plant could not be replanted by a 25-minute session, so the test failed intermittently).

## Left / for others
- Plant system: use `wind(f.t, x, y, windBoost(phase))` for sway (`src/ambience`).
- The studio still uses its own quick test garden rather than the real scene painting.
- Audio: mirror dev `setTime` / `setWeather` into the audio controller during integration.
- ROADMAP row (orchestrator): ambience + lighting done.
