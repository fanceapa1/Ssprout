# 182: The coast's daylight (G5)

## What
G5 replaces the coast's placeholder sky and light with real plates (ADR 0372):
- `src/scenery/coast/sky.ts`: the four skies, cut round the temple, the far shore glazed in each
  light, and the sea's mirrored sky with a broken path of light under each low sun and the moon.
- `src/scenery/coast/light.ts`: shadows to the right, warm and rose light at the low suns, the
  near cove kept teal, moonlight, seven lit windows and the chapel's lamp at night.
- `src/scenery/coast/daylight.ts`: the coast's grades (`COAST_GRADES`) and the sea's mirror
  strength (`COAST_WATER_ALPHA`), the data `index.ts` needs without loading the painters.
- `daylight.studio.ts` (`coast-daylight`, 158) and `daylight.test.ts`.

The phases:
- **Midday**: a clear cerulean overhead thinning to a warm pale haze on the sea's horizon, two
  small soft clouds lifted out of the wet blue. The sea stays the strongest colour: its plate is
  turquoise, laid lightly (0.34), and thinner still over the shallows.
- **Sunrise**: lilac overhead into pale peach, a gold glow round the sun at x 636, a pearly haze on
  the horizon, two quiet lilac bars. The sea goes pearly far out, softened turquoise near, with a
  quiet mirror of light under the sun.
- **Sunset**: violet over rose, apricot low, an ember glow round the sun at x 552, violet bars lit
  apricot underneath. The far sea goes molten apricot and fades to dusky teal near the shore, and a
  broken glitter path runs from the sun down toward the beach. The temple, the village and the
  olive catch warm light; the promontory goes rose.
- **Night**: a deep granulating blue, paler over the horizon, the shared 30 stars and 170 smaller
  ones; the moon on its arc with a pale path on the dark ink-blue sea; seven warm windows in the
  far village and a lamp by the chapel; the terraces and plants stay readable under a blue grade.

Fixes for what the painters left (devlogs 175–177):
- **The pale band down the columns and the wet edge round the tops and the architrave.** The sky
  no longer follows the skyline round each column. Its outline follows the ground without the
  temple, and a second clip takes out the painted shafts, capitals and architrave just inside their
  edges (`TEMPLE_CUT`). The washes run 48 below the outline, so no wet edge falls in view.
- **The white patch behind the base between the first two columns.** Its pixels were almost bare
  paper (241, 233, 211 against the margin's 248, 240, 219), so neither the landscape nor the sky
  plate had painted there. The landscape leaves a little paper just above the stylobate, but the
  step at fault was the sky plate's (`paintCoastSky`). Its base wash was shaped to the skyline +48,
  with a narrow notch down each gap between the columns, and in this gap the wash did not reach the
  bottom of the notch. Most likely its deformed layers pinched the notch shut. The new wash shape
  has no notches. The spot now matches the sky above it (223, 216, 193 against 221, 216, 193).
- **Dark wedges above the broken tops and past the architrave's end.** These were the temple's
  own shade marks (`temple.ts`), which started above the slanted breaks. Each broken shaft's shade
  now starts under its break, and the architrave's shade is clipped to the fragment.

**Contract** (ADR 0372, `docs/ARCHITECTURE.md`): `ScenerySky.waterAlpha?`, a scenery's own
strength of the mirrored sky on its water per phase. `sky-light.ts` reads it in one line. The
other sceneries do not set it, so they are unchanged.

**Layout**: the moon's arc moved into a portrait phone's crop, (524, 268) → (640, 198) →
(770, 254). It began at x 450, left of the phone's frame.

**Night lights**: these go through `LightArt.lights`, the hook that paints the shoji's lamp light.
The windows are seven of the village's painted openings (`LIT_WINDOWS`) and the lamp
(`CHAPEL_LAMP`), each a small warm dab of paper on the night plate, with no flicker.
`SceneGeometry.lights` was not used: each of its lights gets the lantern's flame sprite, a
70-unit pool and a reflection.

## Why
- **The sea's mirror strength.** The shared 0.42 at sunset mixed apricot and turquoise into an
  olive grey. The light plates multiply, so they cannot warm a turquoise sea. A stronger mirror,
  thinning toward the viewer, is how open water looks at a low sun, and the shallows keep their
  seagrass and sand.
- **Two washes on the sea plate, not one wet-in-wet.** Apricot and teal laid wet into each other
  went grey, even on the plate alone (studio `coast-water-sunset`, round 2).
- **The glitter's dashes are plain soft strokes.** At 0.5 px per unit, a dash is a pixel or two
  high, so the watercolour engine adds nothing to it. Lifted as washes, its edge rings read as
  dark dashes (round 4).

## Looked at
Probe shots in the session scratchpad (`g5/`), 1440×900 @1, 390×844 @2 and 1920×1080, planted and
empty, `settleAmbience()` then `freeze()`:
- **r0** (placeholder): grey sky, a white patch and blue wedges at the temple, a grey-teal sea at
  sunset.
- **r1/r2**: the skies read, but the sea at sunset stayed olive. The plate alone was grey, and
  the shared strength was too weak (r2 studio).
- **r3**: two washes and the coast's own strength gave an apricot far sea. The temple was clean.
- **r4**: the glitter path showed as dark dashes; the promontory was cool grey.
- **r5**: phone and 1920. The moon's arc start was out of the phone's frame (the test caught it).
  Phone sunset and night read well: the sun, the glitter, the moon and its path are all in frame.
- **r6/r7**: plain dashes, brighter. A broken gold path widens down to the beach. The noon →
  sunset blend at 0.3, 0.6 and 0.9 moves smoothly, with no jump.
- Final: `g5-noon.png`, `g5-sunrise.png`, `g5-sunset.png`, `g5-night.png`,
  `g5-sunset-phone.png`, `g5-night-phone.png`, `g5-temple-close.png`.

## Cost
Each plate's own painting timed in Chromium (dev build, laptop shared with another agent, second
and third runs, `performance.now()` round each painter with a pixel read after):

| plate | coast | oasis (same run) |
|---|---|---|
| sky, midday / sunrise / sunset / night | 155–174 / 174–193 / 230–248 / 107–126 ms | 105–142 / 149–160 / 192–221 / 118–120 ms |
| sea (basin), any phase | 44–64 ms | 41–70 ms |
| light plate's marks, low suns / midday / night | 80–98 / 72–74 / 1 ms | 120–135 / 70–82 / 1 ms |

In the app (`skyStats().paintMs`, `ambience().lightingMs`), the sky plates took 167–277 ms
and the light plates 68–104 ms, against the oasis's 184–189 and 71–110 ms on the same run.
Like every garden's, each sky plate and each light plate paints in one task: they are not split
into parts (ADR 0339 says that splitting is the next step). So the 20 ms part budget is not met
here, and no garden's sky plate meets it. The longest single piece is the sunset sky plate
(about 230–250 ms). The sunset sky costs about a fifth more than the oasis's.

## Left open
- **The promontory's face** is still a cool grey at sunset at the overview. The rose light lifts
  its top and point, but the face reads as shade.
- **The sky and light plates paint in one task each** (above). Painting the sky plates in parts
  would need a cooperative `SkyPainters` for every garden.
- **The night sky** still leans a little violet at the overview: the blue grade multiplies over
  a blue-violet wash.
- **Posidonia** stays teal at sunset. It paints its own colour over the sea, so it is the
  species' to fix (devlog 179).
- **The moving water** still uses the generic surface (`water.ts`). The glitter and the moon's
  path are static on the plate, apart from the shared path that follows the moon on the light
  composite.
- **Rock pins**: the temple's change moves `rock.test.ts`'s recording hash. The shore-rock task
  running in parallel changes the same line, so whichever merges second re-pins it.
- `src/main.ts` unchanged.
