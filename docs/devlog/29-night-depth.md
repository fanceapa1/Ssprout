# 29 — The night's depth (Q2b)

## What
ADR 0206 removed a hard line at night. The night's `saturation` fill had left grey wherever the
frame was still clear, so the frame is now backed with white before it. That fix stays. Its side
effect was that the night lost weight wherever the paint is thin: the meadow, the path and the
lower half of the frame. The garden read milky and flat. This task brings the weight back with
the night grade, not with grey.

## Measured
Same scene (`seed(4)`, `addPlants(20)`, overview). "Lower frame" is the canvas from 55 % to 82 %
of its height, without 5 % at each side. The figures are luminance, and the ratio is to midday.

| | lower frame at 1440 × 900 | ratio (e2e viewport) | saturation ratio |
|---|---|---|---|
| reference (before ADR 0206: grey in clear pixels) | 122.0 | 0.634 | 0.32 |
| main after ADR 0206 (milky) | 132.6 | 0.688 | 0.30 |
| this task | 122.8 | 0.638 | 0.43 |

By band at 1440 × 900 (reference → main → now): sky 111 → 111 → 110, far bank 108 → 108 → 105,
middle 116 → 121 → 116, near ground 124 → 137 → 126. On a 390 × 844 phone, the lower frame went
119 → 127 → 117. The blends land between their phases as before. For example, sunset→night's
lower frame went 147.5 → 153.5 → 148.6.

## Change
`PHASE_GRADES.night` (`src/ambience/timeofday.ts`):
- `amount` 0.5 → 0.54
- `sky` 0.26 → 0.22
- `ground` 1 → 1.2

`amount + sky` is unchanged, so the top of the sky keeps its weight. The far bank is a touch
deeper. The extra weight eases in from the middle of the frame (`ground` acts from 45 % of the
world's height down), and is greatest on the near ground, where the stray grey used to sit.

This is a multiply of the night's indigo, so the lower frame is glazed blue rather than veiled:
it keeps 0.43 of midday's saturation, against 0.32 with the old grey. Plants keep their contrast
with the ground they stand on. The wash at the bottom edge (0.65) is still lighter than at the
top of the sky (0.76). The lantern's reserve, the shoji's lamp light, the moon's path on the pond
and the night edge are unchanged: they lift relative to the wash. The margin stays paper, and
the "margin is paper" e2e still passes.

The unit test that asked for `ground ≤ 1` now asks for what it meant: the near ground deeper than
the middle distance, but lighter than the sky.

## Tests
- `daylight.spec` › "the night keeps its depth: the lower frame is glazed indigo to the reference
  weight, not hazed (ADR 0206)" checks three things:
  - the lower frame is 0.60–0.665 of midday's luminance (main measured 0.688 and fails);
  - it keeps at least 0.36 of midday's saturation (the grey reference measured 0.32 and fails);
  - b > r + 10.

  TESTING.md row 5.3b.
- `close-view.spec` › "no hard line where the sky plate ends…" still passes. The row step is
  1.63 at night, 2.01 sunset→night and 1.79 night→sunrise (the limit is 3).
- `timeofday.test` › night grade readability, as above.

## Screenshots (`artifacts/shots/`, gitignored)
- `q2b-before-*`: the reference look (the grey put back temporarily for the capture)
- `q2b-main-*`: main as it was (milky)
- `q2b-after-*`: this task

Each set has `night`, `sunset-night`, `night-sunrise`, `midday`, `zoom-meadow` and `zoom-pond`
(3×), at `1440x900` and `390x844`. The owner's reference overview is
`night-reference-before.png`.

## Left open
- No new visual, so no studio entry. No change to `src/main.ts`.
- The night's middle distance on a phone is about 3 levels deeper than the reference (portrait
  crops more meadow into the middle band). It still reads.
