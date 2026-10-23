# ADR 0163 — Detail painted for the camera's resting view

- Status: accepted (amends ADRs 0041, 0145, 0147); amended by ADRs 0185, 0186, 0189
- Date: 2026-10-23

## Context
At 3× on a DPR-2 desktop a world unit is ~5.4 device pixels. The overview painting is capped at
1.5 px/unit, the sky plates are 0.7 px/unit and the light plates 0.4 px/unit: soft washes upscale
well, but the moon's edge, the stars, the painting's marks and the shadow blots turn into a
blurry bitmap — not "a painting you lean into".

## Decision
Once the camera **rests** closer than the overview resolves, each layer paints detail for that
view, off the frame path, and keeps the overview for everything else:
- **Scene** (`createSceneSystem`, `maxDetailScale` 2.8): the visible rect (+40 units) is painted
  again at the view's scale by the same cooperative job (same seeded marks), then cross-fades in
  over the overview painting (`1−e` / `e`, no darker pulse). Boulders and tufts come from the
  detail paint too. Back at the overview the detail painting is dropped. The first time a view
  (or a glide's destination) leaves the overview painting's area — a phone looking at the sides
  its overview crops — the overview painting is extended to the whole world in the background
  (swapped in at once, not counted as a repaint).
- **Sky** (`SkyLight.setDetail`, ≤ 3 px/unit): the plates' part under the view is upscaled (washes
  are soft) and the hard edges are punched at full resolution — the stars' paper flecks, the sun
  and the moon with its phase. Composed lazily, a few ms.
- **Light plate** (`CastLight.setDetail`, `CAST_DETAIL_MAX` 2 px/unit): each phase's grade wash
  (kept before its marks) is upscaled for the rect and the **marks are repainted** at the detail
  scale — cast shadows, crown lights, window light, stars — one phase per idle callback; the
  moving lights are lifted in the detail composite. Until it is ready the overview plate is used;
  rows beyond the world still take the overview plate's edge rows.
- A layer uses its detail only when the detail covers the whole visible world rect of the draw
  (no seams: the detail's edge is always off screen).

## Consequences
A close view sharpens one to three seconds after the camera stops (the paint is cooperative and
yields between 20 ms slices; frames stay smooth). Measured: a 600×400-unit view at 2.8 px/unit
paints in ~2 s wall on a laptop (it was 2.7 s at 3.2, hence the cap), a phone's in ~1.4 s. Memory: one detail painting (~10 MB), one sky and one light composite (a few MB).
Dev: `sceneDetail()`, `lightDetail()`, `skyStats().detail`; `camera.settle()` waits for all three.
Ambience particles are sprites at their own resolution and stay as they were (they are soft).
