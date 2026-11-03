# 98: S19, the waterfall's sun on a phone

The S17 acceptance shots showed the waterfall's setting sun cut in half by the right edge of a
390×844 phone.

## Cause
The sun is placed in world units, and the phone's camera crops the world. A portrait phone's
overview shows `MIN_VISIBLE_W` = 600 units centred on the scenery's focus (x 760): world x 460–1060.
`WATERFALL_SKY_LAYOUT.sunsetX` is 1040, and `sunDisc` drifts the setting sun right by 2.2 units per
degree. At the pinned sunset (4.5°) the disc's centre is at x 1050 and its right edge at 1072, past
the crop. The S4 test only checked that `sunsetX` itself is inside the crop. It did not count the
drift, the disc's radius or the paper edge round the stage.

## Fix
The smallest fix that fits the design (world-space sun, focus chosen to hold it) is to change the
number. `waterfall/sky.ts` sets `WATERFALL_SUNSET_X` = 980 in `WATERFALL_SUN_SKY`, the layout that
is wired as both `sky.layout` and `light.sky`. The sunset glow in the sky plate and the warm dab on
the far ridge (`light.ts`) read the same layout, so they follow the sun. `layout.ts` was not touched
(another task is editing it), so `WATERFALL_SKY_LAYOUT.sunsetX` still says 1040. The orchestrator
may fold 980 back into `layout.ts` later. No shared code changed, so the Japanese garden is
unchanged by construction.

On desktop the sun moves 60 units left. At the pinned sunset it sits on the buttress's right
shoulder, half set behind the flank, where before it rested on the far ridge. A placement that
depends on the view was set aside: the sky and light composites are view-independent caches, and a
sun that moved with the camera would slide during pans.

## Look
`npm run shots`-style captures from `artifacts/phone-sun-shoot.mjs` against a dev server on 5425,
the camera at the overview (`autoFocus(false)`), `setTime` + `settleAmbience` + `freeze`:
- `artifacts/phone-sun/{before,after}/waterfall-{sunrise,sunset}-{390x844,1440x900}.png`
- `artifacts/phone-sun/{before,after}/japanese-garden-{sunrise,sunset}-{390x844,1440x900}.png`
- close crops of the phone sunset: `artifacts/phone-sun/{before,after}/zoom-phone-sunset.png`

Before: the phone shows half a disc at the right edge. After: the whole disc sits inside the frame
on the flank's shoulder. Desktop sunset: the sun is about 55 px left. Sunrise is unchanged. On a
phone the garden's suns sit well inside its crop (x 500–1100) at both low suns. Byte hashes differ
between runs of the same build (animation, the real clock), so the garden is shown unchanged by the
diff touching no shared file, not by a pixel diff.

## Tests
- `scenery/waterfall/daylight.test.ts › keeps the whole setting sun inside a phone's overview crop`:
  for 390×844, 360×740, 375×667, 430×932 and 768×1024 overviews, at every 0.25° from −3° to 16°
  where the sun shows above the skyline, the disc stays 24 units (the deckle) inside the visible
  rect. It fails with 1040 (390×844 at −0.25°: right edge 1061 > 1036).
- The waterfall's existing sun tests (open sky, clear of tree crowns, the portrait crop) now read
  `WATERFALL_SUN_SKY`, the layout actually in use.
- `npm run typecheck` and `VITEST_WORKERS=1 npx vitest run src/scenery src/ambience` pass. No local e2e
  (CPU). `e2e daylight.spec › at the waterfall the sun sets on the right` checks `sun.x > 800`,
  which still holds (990).

## Left open
- **The rising sun is not in a phone's frame at all** (x ≈ 1258 against a crop ending at 1060).
  Nothing is cut, but a phone sees only the peach glow at sunrise. Bringing it in means moving it
  about 300 units on desktop too, or a sun placed per view. That is a design call for the
  orchestrator.
- The moon's arc (x 990–1300) is mostly outside a phone's crop as well. Same trade-off.
- `WATERFALL_SKY_LAYOUT.sunsetX` (1040, in `layout.ts`) is now overridden. Fold it in once that file
  is free.
- Orchestrator: TESTING row `S19.1` is added. Devlog index line:
  `| 98 | [S19: the waterfall's sun on a phone](98-phone-sun.md) | The setting sun moves to x 980 so its whole disc stays inside a phone's crop; desktop sun about 55 px left; the garden unchanged | |`
