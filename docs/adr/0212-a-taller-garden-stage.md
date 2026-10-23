# ADR 0212 — A taller garden stage (94 % of the window)

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0130 (stage sizing)

## Context
The owner: "i wish the skyline was a bit higher. extend the canvas by 7% more vertically". At
88 % of the window, landscape screens crop the top of the sky: cover scaling fits the world's
width, so a 1440×900 window showed the world from y ≈ 103 down.

## Decision
- `--stage-h` is **94svh** (94vh fallback), up from 88: 7 % taller. The top margin (14 px, 8 px on
  phones), `min-height: 320px`, the `svh` choice and the dissolving edge (`stage-edge.ts`) are
  unchanged. `src/render/viewport.ts` is unchanged.
- **What the extra height shows.** Cover scaling still fits the width on landscape screens, so the
  taller stage shows more of the world's height around the focus point (the pond, y 560), clamped
  to the world. Where the bottom is already at the world's edge, all of it goes to the sky:
  1440×900 now shows from y ≈ 41 (was 103). On 1920×1080 and 1280×720 it splits between the sky
  (+27 / +28 world units) and the foreground. The hills sit a little lower in the frame with
  more sky above them.
- **Phones** (ADR 0123) take the same 94 %. The world is narrower than the screen is tall there,
  so the stage grows by ~50 px around the same garden (the overview shows the same width); the
  sky fills it and nothing on the phone rule changes.
- The dock still peeks out below: ~40 px at 1440×900 and 390×844, ~29 px at 1280×720 (the
  guiding path's first bend shows there, ADR 0202).

## Consequences
- Tests asserting the stage's height read 0.94 (`ui-shell`, `ui-menu · phone`); `ui-shell` also
  checks that the 1280×720 overview shows the world from above y 140.
- The dock starts ~6 % of the window lower; the Study section is one short scroll further down on
  first load.
