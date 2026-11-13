# ADR 0372: The coast's daylight: a sea that mirrors the sky, a sky cut round the temple

- Status: accepted
- Date: 2026-11-13
- Builds on: ADRs 0145 (painted skies), 0147 (light plates), 0284 (sun side), 0301 (per-scenery
  grades), 0341 (lazy painters), 0360 (the coast's layout)

## Context
G5 paints the coast's four skies and its light. Three problems were not just paint:
1. **The sea could not take the sky's colour.** A scenery's mirrored sky lies on its water
   source-over at a shared strength (`WATER_SKY_ALPHA`: 0.22 at midday to 0.42 at sunset). That
   suits a pond or a basin. The coast's sea is the strongest colour in the painting and fills half
   the frame. At 0.42 an apricot sunset over deep turquoise mixed to an olive grey, and the warm
   grade made it greyer. The light plates cannot help, because they multiply and only darken.
2. **The sky framed the temple.** The skyline was traced round each column, and its 2-unit reach
   into each side, the 4-unit hang and the wash's wet edge left a sky-tinted band down the shafts
   and a dark frame round the broken tops and the architrave. Between the first two columns the
   wash did not reach the bottom of its narrow notch, and it left a patch of bare paper behind the
   base.
3. **Dark wedges above the broken tops** (the temple's shade marks started above the slanted
   break) and past the architrave's broken end read as the same wet edge.

## Decision
- **`ScenerySky.waterAlpha?`** (contract, minimal): a scenery's own strength of the mirrored sky
  on its water, per phase; a phase it leaves out takes `WATER_SKY_ALPHA`. The coast's
  (`COAST_WATER_ALPHA`) is 0.34 at midday, 0.6 at sunrise, 0.78 at sunset and 0.55 at night.
  The other sceneries do not set it, so they are unchanged.
- **The coast's sea plate thins toward the viewer.** After painting, `paintCoastWaterSky` takes
  the plate's alpha down from 1 at the horizon to `WATER_NEAR` (0.34–0.6) over 280 units
  (destination-out). Far water mirrors the low sky strongly, as open sea does, and the shallows
  keep their own turquoise, seagrass and sand. The plate is stored with its alpha (PNG, ADR 0227).
  The horizon's colour and the near water's are two separate washes lost into each other, not one
  wet-in-wet wash: apricot and teal laid wet together grey out.
- **The sky is cut round the temple, not traced round it.** The washes' outline follows the
  ground without the columns (the far hill, the horizon, the promontory) with a 4-unit hang, 0.5
  over the krepis. A second clip takes out the painted shafts, the two capitals and the
  architrave, each 0.7 inside its painted edge (`TEMPLE_CUT`), so the sky overlaps the edge a
  little and no paper shows. The washes themselves run on 48 below that line, so no wet edge falls
  in view. `SKYLINE` (layout) is unchanged: it still serves the sun's clip, the stars and the slots.
- **The temple's shade starts under the break** on the broken shafts, and the architrave's shade
  is clipped to the fragment (`temple.ts`). This changes the rock's recording hash pins.
- **The moon's arc moves into a phone's crop**: (524, 268) → (640, 198) → (770, 254). The old
  arc began at x 450, left of a portrait phone's frame (x 460–1060).
- **Village lights through the existing hook.** `LightArt.lights` (the hook that paints the
  shoji's lamp light) leaves seven of the village's painted windows and a lamp by the chapel as
  small warm paper on the night plate. `SceneGeometry.lights` was not used: each light there gets
  the lantern's flame sprite, a 70-unit pool and a reflection, which suits one lantern, not a
  village a kilometre away.
- **Its own grades** (`COAST_GRADES`, ADR 0301): the low glows over the sea at each sun's x, no
  lantern, a night 0.5 deep and bluer than the garden's.

## Consequences
- The coast's sea goes molten apricot at sunset and ink-blue at night, while the shallows still
  show their floor. A blend between phases mixes the strengths by weight, as before.
- The other gardens' plates, keys and pixels are unchanged. The coast's sky and light plates
  repaint once (new keys through the light print's grades and the sky layout).
- The sky and light plates still paint in one task each, like every garden's (ADR 0339). The
  coast's cost about the oasis's: 155–250 ms per sky plate (sunset is the dearest) and 70–100 ms
  per light plate on a loaded laptop, dev build.
- Posidonia in the shallows keeps its own teal at sunset (devlog 179); that is the species', not
  the plate's.
