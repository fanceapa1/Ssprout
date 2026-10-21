# 14 — Polish: the integrated garden, looked at end to end

## What
Fix list from the orchestrator, then four critique → fix rounds over real browser flows at
1440×900 and 390×844 (plus 1920×1080, 820×1180 and reduced motion).

- **Placeholder sprout** out of the registry: now a test fixture in `src/dev/placeholder-sprout.ts`
  (plant-view tests register it through `setPlantViewSpecies`); studio, shots example and e2e use
  white clover.
- **Tier-1 ground plants read** (ADR 0125): `PLANT_SIZES.small` 86, the five species draw in their
  70-unit design box scaled up, a few more leaves/heads, stronger head values.
- **Pond vs pavilion** (ADR 0122): the lobe is gone, the pond's right end turns back in a bay; the
  engawa stands on the bank with a crawl-space shadow, footing stones and a step stone; no deck
  reflection; the lantern only reflects when water is near its mirror image.
- **Frame line** (ADR 0126): the drying pass treated the canvas edge as a shape edge. Wet layers
  now pass "open sides" to the edge blur.
- **Stone path** (ADR 0122): six broad stones winding up to the water on worn warm earth; mounds
  roll into the path; stones painted after the margins so the near ones stay crisp.
- **Fauna arrival** (ADR 0120): `fauna:arrived` comes from the fauna system on first sight.
- **Tips** (ADR 0124): one at a time by priority (Start studying's note first), sheet notes retire
  when used and follow scrolling, notes wait for the quiet line.
- **Review fixes**: timer slip in the lower-left paper corner on wide screens (ADR 0127); tall
  phones show ≥ 600 world units with paper above/below (ADR 0123); UI slips and dabs dim with the
  garden's light, and the light eases in only once the painting is there (ADR 0121); "your
  Japanese iris" casing; opaque sheet footer on phones; balanced specimen dates; keyboard focus
  lands on Pause after Begin, Escape leaves the end question; dev widget harness bottom-right.
- **Dev**: `sprout.plantsReady()` (sprites painted, nothing snapped), `sprout.frameStats()` /
  `resetFrameStats()` (renderer main-thread cost + rAF intervals).
- Tests: unit tests for open sides, `sightedFauna` + first-sight emission, `uiLight`, tip picking,
  sentence casing, viewport framing; `tests/e2e/polish.spec.ts` (placeholder, tips, keyboard,
  plantsReady/frameStats, edge paper, phone framing); minimal edits to ui-menu/ui-session/fauna/
  studio specs for the changed behaviour.

## Review rounds (screenshots looked at, each round)
1. Baseline: dark frame line; pond under the deck; 3–4 small stones on a pale band; two tips on
   load; tier-1 plants as dots; placeholder in the sheet; koi line on unlock; sheet note pinned
   over plant cards while scrolling; the resting timer's digits mush over the path stones; "your
   japanese iris".
2. After the fix list: panel moved to the paper corner; at night the paper dabs behind icons and
   the quiet line glowed as ovals and the lantern "reflection" was a column of dots on the far end
   of the pond → UI light + no reflection over dry bank.
3. Phones: the crop showed ~8 of 40 plants and only 4 of 9 iris spots → wider portrait framing;
   night seam above the world → lighting rows stretched; sheet footer let card text through;
   speaker note on top of the bloom line → notes wait for the line.
4. HD evening rain, tablet portrait, reduced motion, first frames of a real (non-dev) night load:
   the indigo wash and lantern floated on bare paper before the landscape → light waits for the
   painting; slips dimmed before it → UI light subscribes after ready. Keyboard-only flow fixed.

## Measurements (headless Chromium, Apple M3, after the machine load dropped to ~2)
40 plants + a running session in rain + fauna (7–8 creatures), `sprout.frameStats()` over ~8 s:
| Viewport | main-thread work avg / p95 / max | frame interval avg / p95 |
|---|---|---|
| 1440×900 @1 | 0.81 / 1.0 / 1.3 ms | 16.7 / 16.7 ms (60 fps) |
| 390×844 @2 | 0.73 / 0.9 / 1.4 ms | 16.7 / 16.8 ms (60 fps) |
| 1440×900 @2 | 0.93 / 1.1 / 1.8 ms | 36.9 / 50 ms |
Plant system 0.27–0.39 ms/frame, ambience 0.07–0.12 ms. The DPR-2 desktop interval is GPU/raster
bound in headless software rendering (main thread idle 95 %); not reproducible to judge here.
First paint is paper (body background + paper layer); the painting follows in ~1–2 s.
No console errors or warnings in any flow.

## Left / for others
- **Docs owner** (I did not touch `docs/**` beyond this devlog and ADRs 0120–0127):
  `docs/ARCHITECTURE.md` viewport contract (ADR 0123), `window.sprout.plantsReady/frameStats`,
  `AmbienceSystem.onLight/revealLightAfter`, fauna arrivals (ADR 0120);
  `docs/systems/scene.md` composition map, slot table and path (ADR 0122), `PLANT_SIZES.small`;
  `docs/systems/ui.md` tips one at a time, panel corner; `docs/systems/render.md` portrait framing;
  `docs/systems/studio.md` example `species-placeholder-sprout` → `species-white-clover`;
  `docs/systems/plants-species-a.md` placeholder note; ROADMAP polish row.
- The DPR-2 headless frame interval deserves a look on real hardware (paper multiply over a
  2880×1800 canvas every frame).
- Phones: the bottom sheet still covers the near path; a pan/zoom for placement on phones would
  make every spot reachable on the smallest screens.
