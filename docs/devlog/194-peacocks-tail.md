# 194 · Peacock's tail (GP7, phase 15)

## What
The Greek coast's small pale alga: **peacock's tail** (*Padina pavonica*), tier 1, `small`,
habitat `water`. It adds only files:
- `src/plants/species/peacocks-tail.ts`: the definition, the plan (`planPeacocksTail`), the pose
  (`posePeacocksTail`, pure) and `peacocksTailReach` (for the box test). It imports `ribbon` and the
  growth and frame helpers; no shared helper was edited.
- `src/plants/species/peacocks-tail.test.ts`: `smallSuite('peacocks-tail')` plus pose continuity
  over 240 growths (3 seeds), inside the box (30 seeds), five fans with chalk and olive bands, the
  three growth stages, the definition, the range against all four gardens and the coast's slots.
- `src/plants/notes/peacocks-tail.ts`: a brown alga with a holdfast, one of the few seaweeds that
  lay down lime (two sentences).
- Docs: the row in `docs/systems/plants-species-a.md`, `GP7.1` in the `docs/TESTING.md` matrix.

Definition: box 86×86 (`PLANT_SIZES.small`), anchor .5/.74, bloomColor `#c9c0a0`,
`pollinators: false`, `nativeName: 'Padina pavonica'` (`la`), `rimLight: false`, no ground shadow
(the system casts none on `water`), default reflection.

**Range** (ADR 0361's words): `{ realms: ['mediterranean'], biomes: ['marine'], climates:
['mediterranean'] }`, wild only. The vocabulary has no warm-seas realm, so "warm seas" is the
Mediterranean one. The coast offers it; the Japanese garden, the waterfall and the oasis do not
(tested against each).

**Slots.** Being `small` it fits all nine coast water slots: `shallows-1` to `-6` and the rock pools
`pool-1`, `pool-2`, `pool-3` (tested with `compatibleSlots`). It is the only water plant that fits
the small pools `pool-1` and `pool-3`. No scenery code was touched.

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged. The tier-1 boards and the
coast's flora line-up gain a card.

## How it is painted
- **Plan**: five fans from templates (a big face-on fan, a left-leaning one, a nearly edge-on one,
  a small one behind, a small edge-on one in front), each jittered, on one stone, 1.2× the base units.
- **A fan is a cone sector.** From its apex on a short stalk, rays leave in a funnel (cone half-angle
  about 75°, span 140–170°, tilted off the vertical), projected for the cliff's view (bed squashed by
  .42, rise .8). The rim is ruffled and cut by one slit.
- **Layers per fan, back to front**: a wet wash laid `source-over` (light olive-brown, a darker
  throat, a shaded side, the chalk bands as pale ribbons and the inrolled rim lifted pale) so it reads
  lighter than the water, then a dry layer of olive-brown hairline arcs, faint radial veins and the
  rim's shadow lines. Close up a faint aqua and lilac sheen glazes the bands.
- **Under the water**: only 5–9 % of the sea's turquoise is mixed in, so it stays the light note.
- **Growth**: the stone from 0, the five fans in windows from 0–0.52 to 0.62–1; a ring appears as the
  rim passes its radius.

## Cost
`def.draw` at 1.6×, growth 1, seeds 1–12, main thread in headless Chromium on the dev server (a
throwaway probe, pixels read back): median 5.4 ms, 5–11 ms. Well under the 50 ms aim (the layers are
cut to each fan's box).

## Looked at
Studio entries, the app at `?dev&scenery=coast` (pools and shallows, noon and sunset, overview and
close view), and a line-up in the shallows beside the Posidonia and the cystoseira.
- **r1**: grey-green and tent-like (SEA mix 20 %, cones too deep and tall) → shallower funnels,
  warmer pigments, SEA mix 9 %.
- **r2**: body as pale as the paper, bands lost; chalk ribbons too wide covered the wash → narrower
  chalk, olive-brown wash, olive hairlines.
- **r3**: three stacked rim outlines → rim lines laid at radial offsets (0.93, 1, 1.03).
- Final: stages, close view, line-up and garden overview (images in the task's scratchpad).

## Left open
- At the overview the fans read as banded turkey-tail fungus as much as seaweed; more ruffle and a
  hint of the spreading, translucent edge would help.
- Fan stalks are short dark stubs; the holdfast is a plain dark patch.
- The iridescence only shows close up (`near`).
- Not looked at: night, phone, the planting-sheet preview card (e2e specs only).
