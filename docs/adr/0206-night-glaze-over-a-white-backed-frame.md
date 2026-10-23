# ADR 0206 — The night's saturation glaze over a white-backed frame

- Status: accepted
- Date: 2026-10-23
- Decided by: graphics, Q2 (night zoom artefact, devlog 27)

## Context
A reviewer saw two problems at night, zoomed in to about 3× on a seedling at 1440 × 900. A lighter
rectangle had a hard edge, and a plant sprite was cut off by a hard edge. Both come from one
straight line at world y 500, where the sky plate (`SKY_RECT`, y −240…500) stops. It is lighter
above the line and greyer below. The line also shows in the overview, but there it is less than
a pixel row high.

The frame is built on a transparent canvas. ADR 0021 allows painting "on white (or
transparent)", and the background painting is mostly partly transparent, with alpha from 40 to
250. For multiplies the two are the same: a multiply over clear pixels leaves the source colour,
exactly what it would leave over white. The night's desaturation is different. It is a
`saturation` fill (`LOOK.nightDesaturate` 0.38 × night), and a non-separable blend composites
source-over. Where the frame is still clear it leaves its grey `rgb(120,124,138)` as pigment,
heaviest where the painting is thinnest. Above y 500 the sky plate, multiplied into the
background, has already made the frame opaque, so no grey is left there. That gives the step:
about 10 levels in the meadow (9.7 in the test's view), through any plant standing across the
line. Other phases have no desaturation, so they are unaffected. The sunset→night and
night→sunrise blends are affected in proportion to the night weight.

## Decision
Before the saturation fill, `drawLighting` backs the frame with white
(`destination-over`, over the drawn view). The glaze then only takes colour out, the same
everywhere. The light plate's multiply, the night edge's lift and the lantern after it come out
as before. The saturation fill now covers the drawn view (`visible`), not only the overview's
crop, so a zoomed view that reaches past that crop is desaturated too.

## Alternatives
- **Give the sky region the grey too** (keep the frame clear above y 500). That would grey the
  night sky and the far bank, which have never had it, and there is no cheap way to multiply
  without filling clear pixels.
- **Make the painting opaque in the scene or the renderer** (clear to white). This gives the same
  result for the glaze, but it changes every screen-blend mark drawn before the lighting (glints,
  rims) and the renderer's transparent-frame contract. That is more than this bug needs.

## Consequences
- No line at y 500 in any phase or zoom. `close-view.spec` › "no hard line where the sky plate
  ends…" checks this.
- The night garden is a little lighter where the paint is thin (the path, the pale meadow):
  about 9 levels lower in the frame, about 5 overall at 1440 × 900. The accidental grey haze is
  gone, which is what ADR 0184 wants from a night wash. If the owner wants the old weight back,
  the right tool is the night grade (`PHASE_GRADES.night`), not grey in the clear pixels.
  - Done in Q2b (devlog 29): the night grade went from amount 0.5, sky 0.26, ground 1 to 0.54,
    0.22 and 1.2. The top of the sky keeps its weight. The middle distance is a little deeper,
    and the near ground is deepest, where the paint is thin. The lower frame is back at the
    reference weight (0.64 of midday's luminance, against 0.63 before this ADR and 0.69 just
    after it), glazed indigo rather than grey. `daylight.spec` › "the night keeps its depth…"
    holds it there.
- Cost: one extra full-view fill per frame, only at night.
