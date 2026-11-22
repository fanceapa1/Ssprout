# 230 · GO4: Coast plants that still looked like placeholders

## What
The owner: "some plants are still placeholders (look at cyclamen)". Every plant the coast offers
was drawn at growth 1, close up and at one world scale, and ranked by placeholder look (flat fills,
even outlines, geometric repeats, no light and shade, hard uniform edges). Four were repainted,
one commit each, in species painting code only (`species/*.ts` and the species' own
`lib/<id>-paint.ts`, which nothing else imports). No sizes, boxes, anchors or plans changed
(sea holly's bract bases moved, see below), so no layout moved.

## Ranking (of what the coast offers, small and medium plants plus the marine ones)
- **Painted:** oleander, lavender, aleppo pine, cypress, olive, pomegranate, sea daffodil, rock rose.
- **Borderline:** caper, cystoseira, southern maidenhair, rock samphire, sea lavender (a good
  wash but a stiff, even stem fan), grapevine and tree spurge (flat lime and green washes with
  a repeated leaf stamp).
- **Placeholder:** cyclamen, sea holly, posidonia, Jerusalem sage (repainted); ice plant (cartoon
  daisies on a flat mat), peacock's tail (concentric contour bands).

## What was done
- **Cyclamen** (`lib/cyclamen-paint.ts`, `cyclamen.ts`). Each leaf in its own wash: green pooled
  dark at the base and along the flank away from the light, a warmer sunlit flank, silver
  marbling as irregular blotches and a few veins (no band, no core), a margin that melts into the
  paper on one flank, and a soft cool shade falling on the leaf or the ground below. Petals graded
  pale tip to magenta mouth with a fold and a lifted lit edge; each flower in its own wash, a
  few seen from the side and from behind (calyx, no mouth). Stalks of uneven weight, a pale lit
  edge, a red-brown that varies per stalk, broken here and there. Size unchanged.
- **Sea holly** (`lib/sea-holly-paint.ts`, `sea-holly.ts`). Leaves in their own washes, so a
  leaf's lifted veins no longer cut through the leaf behind (the white net); graded green with a
  pooled base, a pale margin and frosted blotches; the spines' straight chords softened. Heads: the
  collar of bracts moved down so the blue dome sits above it (it sat inside the dome, reading as
  a flower), the dome of florets as small blobs rather than lifted diamonds.
- **Posidonia** (`posidonia.ts`). One wash per shoot, so shoots glaze over one another instead of
  merging into a flat shape; blades taper to a frayed tip, with parallel veins; the old tips
  step in two washes (no square-cut brown block); dead leaves and sea balls in brown, not grey.
- **Jerusalem sage** (`lib/jerusalem-sage-paint.ts`). Leaves glazed per shoot, with a pale lit
  half, a cooler shaded half and a dark base; flowers a wash per whorl, ochre at the base to pale
  yellow, the brown mouth dots softer; stems of uneven weight with a pale edge.

## Paint cost (median of 9 seeds, `def.draw` at 1.6x, full growth)
| species | before | after |
|---|---|---|
| cyclamen | 9.4 ms | 14.4 ms |
| sea holly | 10.9 ms | 18.8 ms |
| posidonia | 16.7 ms | 24.9 ms |
| jerusalem sage | 27.4 ms | 40.0 ms |

All inside the 4–127 ms species range.

## Looked at
Contact sheets before and after, each plant at DPR 2 close up, the five growth stages of each, and
beside the oleander and lavender at the same zoom. Honest verdict: the cyclamen, sea holly and
posidonia now read as painted; the Jerusalem sage is better but its stems are still straight
ruled sticks and its whorls are plan-identical clones (a plan change).

## What's left
- Ice plant (flat daisy dots) and peacock's tail (contour bands) still read as placeholders.
- Borderline: grapevine and tree spurge repeat one leaf stamp; sea lavender's stems fan evenly;
  caper, cystoseira, southern maidenhair and rock samphire are fine but flat.
- Sea holly and Jerusalem sage keep their symmetrical plans; breaking them needs a plan change.
- Posidonia reads dark at the overview next to the pale sand; check it in the garden.
