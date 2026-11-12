# 173 · Lavender (GP3, phase 15)

## What
The Greek coast's garden lavender: **lavender** (*Lavandula angustifolia*, levanta in Greek), a
tier-2 `medium` plant for the terrace beds (`meadow`) and the gravel path edge (`path`). It adds
only files:
- `src/plants/species/lavender.ts`: the definition, the plan (`buildLavender`), the pose
  (`poseLavender`, pure, every mark at a growth value) and `lavenderReach` (every painted point,
  for the box test).
- `src/plants/lib/lavender-paint.ts`: new helpers `paintRibbons` (thin tapered strokes in dry
  brush), `patchShape`/`paintPatches` (soft wet-in-wet washes) and `floretShape`/`paintFlorets`
  (the flower dabs). `ribbonInto` and `inPlantSpace` (`shrub-paint`), `groundShadow` and
  `seedMound` (`small-paint`) and the stem helpers (`small-structure`) are only imported; no shared
  `lib/` helper was edited.
- `src/plants/species/lavender.test.ts`: `smallSuite('lavender')`, pose continuity over 240
  growths (3 seeds), inside the box (24 seeds), the shape (a low leafy dome under 46+ spikes with
  open flowers and tip buds), the growth order, the definition, and the range against a
  Mediterranean garden, the Japanese garden, the waterfall and the oasis.
- `src/plants/notes/lavender.ts`: the note (cut for linen, bees on the flowers; two sentences).

Definition:
- tier 2, `medium` (120×160, anchor .5/.92), habitats `meadow` and `path`, bloomColor `#8a78b8`,
  pollinators yes;
- `range: { realms: ['mediterranean'], biomes: ['heath', 'grassland'], climates: ['warm-temperate'],
  cultivatedIn: ['mediterranean'] }`. It is native to the Mediterranean hills and grown in its
  gardens, using only existing words. A cultivated Mediterranean scenery (the coast, once it has a
  profile with realm `mediterranean`) offers it through `cultivatedIn`; the Japanese garden, the
  waterfall (realm `japan`) and the oasis (realm `n-africa-arabia`) do not. The wild part is only
  there for the truth of the data: no profile matches it until a Mediterranean climate word
  exists (docs/research/coast-biome.md §5);
- name "Lavender", `nativeName: 'Levanta'` (`el-Latn`, to check with a speaker);
- description: "Lavender — a silver-green cushion hazed with violet spikes."

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged. The tier-2 boards gain a card.

## How it is painted
- **Dome:** 18–22 soft washes inside a half-ellipse (46 × 38 units), darker toward the lower right
  (light from the upper left) and cooler than the leaves. Over them 440–480 short leaf strokes
  (4.5–6.5 units, 0.6–0.95 wide) in grey-green mixed toward silver, pointing outward from the
  crown. Interior strokes are painted before the stems and the rim strokes after them, so the
  stems rise out of the leaves.
- **Stems and spikes:** 46–56 pale grey stems (`#b4bfa8`) fan out of the dome's upper surface
  (centre stems straight and taller, outer ones leaning and shorter), each squashed sideways and
  shortened to stay in the box. The last 13–19 units of each stem are the spike. Along it sit 5–9
  whorls of three small violet-blue dabs (two at the sides, one in front, elongated across the
  axis), over a faint violet-grey axis. Open dabs mix `#9784c4` and a pale `#bfb2dc`; the last
  whorls stay half open and go darker violet (`#6f5eaa`), the closed buds are grey-violet. Back
  spikes (band 0) are greyed a little and painted before the haze and the front spikes.
- **Haze:** 7–9 large faint pale-violet washes over the spike tops, rising with the bloom, so
  the spikes read as one soft violet haze at overview size.
- **Growth:** seed mound → a small grey tuft of short strokes with soft washes (0.05–0.3) → the
  dome fills out and widens (to 0.55) → stems rise one after another (0.38–0.8), their spikes
  show first as grey-violet buds → the dabs open from the base of each spike to its tip (to 1.0)
  and the haze comes up. Nothing pops in: each mark grows in size and opacity.
- **Cost:** `def.draw` at 1.6×, growth 1, seeds 2–9, main thread in headless Chromium on the dev
  server (a throwaway probe, not committed): median 27–33 ms, max 40 ms on quiet runs, and 45 ms
  in a run on a loaded machine. Inside 4–127 ms and under the 60 ms aim.

## Looked at
Probe contact sheets (scratchpad `lav/r1`…`r5`): stages, six seeds, a 4× close-up, and a tier-2
line-up (iris, toad lily, cosmos, balloon flower, lavender, anemone, henna, desert hyacinth,
barley).
- **Round 1:** the dome was a tiny ring of grass blades under a bouquet of tall black-violet spikes;
  the flower dabs were dark and clumped. Wrong proportion for lavender.
- **Round 2–3:** a bigger dome, shorter stems, lighter pigments, bluer haze. It read as lavender
  but the dome was a dark green grassy tuft and the dabs were round beads.
- **Round 4–5:** shorter, paler and more numerous leaf strokes under bigger washes, so the dome
  is a silvery grey-green mound; elongated three-dab whorls with a front dab, so a spike is a
  tapered spike with gaps rather than a string of beads; smaller, fainter haze. In the line-up it
  stands apart from the iris, the toad lily, the balloon flower and the cosmos by its grey dome
  and its mass of violet spikes. The stages read as a tuft, a dome, then a dome in bloom.

## Left open
- The dome is still a little spiky at the rim at close view; a real hump has a smoother, more
  clipped outline.
- The stems are straight and rather stiff and uniform; real stems lean and cross.
- The haze washes show soft but visible outlines at the close view.
- Not looked at in the garden (the coast scenery is not in this tree): close view, sunset, night,
  phone, and the line-up beside alfalfa, spearmint and susuki.
- `src/scenery/flora.test.ts` "each species is offered by at least one scenery" fails for
  `lavender` until the coast scenery (realm `mediterranean`, cultivated) lands in `main`. It
  is the only unit failure.
- "Levanta" needs checking with a speaker.
- Bee targeting on the spikes was not looked at.
- Not run: the full e2e suite (per the task's CPU rules).
