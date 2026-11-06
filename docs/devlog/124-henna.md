# 124 · Henna (OP8, phase 13)

## What
The oasis's dye shrub: **henna** (*Lawsonia inermis*, lḥenna in Darija), grown as low clipped
bushes in the irrigated plots of the hottest southern oases. It is a tier-2 `medium` plant for the
plots (`meadow`) and the back. It adds only files, plus one id in a pinned test list:
- `src/plants/species/henna.ts`: the definition, the plan (`buildHenna`), the pose (`poseHenna`,
  pure, every mark at a growth value) and `hennaReach` (every painted point, for the box test).
- `src/plants/lib/henna-paint.ts`: new helpers `paintTwigs`, `massShape`/`paintMasses` (the soft
  green body under the leaves), `leafBlade`/`paintLeaves` (smooth elliptic leaves),
  `floretShape`/`capsuleShape`/`paintSprays` (four-petalled florets, buds, capsules). No shared
  `lib/` helper was edited. `ribbonInto` and `inPlantSpace` (`shrub-paint`), `groundShadow` and
  `seedMound` (`small-paint`) and the stem helpers (`small-structure`) are only imported.
  Scenery painters do not import it.
- `src/plants/species/henna.test.ts`: `smallSuite('henna')` (tier 2), plus pose continuity over
  240 growths (3 seeds), inside the box (24 seeds), a much-branched dome with paired leaves,
  sprays with open florets and buds, capsules, the growth order, and the definition.
- `src/plants/notes/henna.ts`: the Note from the brief. It is factual: the dye comes from the
  dried leaves, and it grows in the hot south. There is no ritual, no exotic framing and no named
  community (§6).
- `src/scenery/flora.test.ts`: `'henna'` added to the pinned oasis list (sorted, one per line).
  The garden keeps its 25 and the waterfall its own list.

Definition: tier 2, `medium` (120×160, anchor .5/.92), habitats `meadow`, `back`, bloomColor
`#f1e2bf` (the brief's cream), pollinators yes (strongly scented), `range: { realms: [], biomes:
[], climates: [], cultivatedIn: ['n-africa-arabia'] }`. Name "Henna", native name "Lḥenna"
(`ary-Latn`). Description is the brief's Line: "Henna — green leaves that keep a red secret."
The id sorts after `anemone`, so no shared studio card changes.

## How it is painted
- **Shape:** 6–8 stems fan from one crown and end inside an ellipse (the dome: centre 48 above
  the foot, 44 × 40). Stems near the middle stand upright and the outer ones flare and curve back
  up. Each stem has 3–5 side twigs that run out to the dome's edge (`toDome` measures the distance).
  Stems are grey-brown; the young twigs are flushed toward the brief's reddish `#8a5a44`. All main
  stems sit in the back band, behind every leaf, so the twigs read as structure and not as sticks.
- **Leaves:** opposite pairs every 3.7–4.4 units along every twig, smaller and more upright
  toward the tips. Every other pair is decussate: it is turned toward or away from us, so it is
  drawn foreshortened. Each blade is a smooth pointed ellipse (no teeth: henna's margin is
  entire) in fresh mid-green `#8fa85a`. Its shaded half is glazed olive `#7a8a4a`, with a faint
  lifted midrib.
- **Body:** under the leaves there is a soft crown wash and two shade masses per stem (one per
  twig), wet-in-wet with no hard edge. Masses on the lower right are darker (the light comes from
  the upper left), so the dome has volume and reads as one mound at garden scale.
- **Sprays:** 9–12 twig tips that face the sky (kept 12 apart) carry an airy panicle: an axis
  15–22 long with 5–7 alternate side arms, each with 2–5 florets, and 2–3 florets at the top. A
  floret is four spoon-shaped crinkled petals round a small gold eye. Buds are round and
  flushed pink (`#e6c7b0`), and some stay buds at full growth. Petals are the brief's cream
  lightened toward white, so they still read on the warm sand. Florets and capsules use
  `source-over`, so cream does not multiply into the green.
- **Capsules:** 1–2 lower twig tips that carry no spray hold 3–5 small round capsules, from
  green to brown.
- **Growth:** seed mound → stems (0.1–0.5) → twigs from their nodes → leaf pairs open behind
  the growing tips (gate 0.2–0.62), with the body wash filling in → the sprays rise only after
  their twig has finished growing (0.52–0.92), with pink buds → the florets open from the bottom
  of each spray up (0.74–0.99) → capsules (0.84–0.99). No mark pops in.
- **Cost:** 29 ms median and 32 ms max at growth 1, 1.6×, seeds 2–9, on the main thread in
  headless Chromium against the dev server. In the same run the Damask rose took 109 ms and barley
  80 ms. That is inside the 4–127 ms budget. The probe is `artifacts/op8-henna/time-probe.mjs`.

## Looked at
All in `artifacts/op8-henna/`.
- **Round 1** (`henna-r1-1440x900.png`, `henna-r1-g1-1440x900.png`): a V of flared stems with an
  empty middle, not a dome. The shade masses were hard-edged pale pads, like lily pads behind the
  leaves. The twigs were dark and thick, and there were only 4–5 sprays. One capsule read as a
  brown stain.
- **Round 2** (`henna-r2-g1-1440x900.png`): flaring now scales with distance from the middle, and
  there is a crown wash, so it is a dome. But the wash and masses spread past the leaves into a
  flat green cloud, and the leaves looked stamped on it.
- **Round 3** (`henna-r3-seeds.png`, seeds 1, 2 and 5): the dome holds on every seed and the
  froth reads. Still a lumpy cloud past the leaf edge, and stems drawn over the leaves look like a
  bundle of sticks. The masses moved inward and got smaller, and the main stems went to the back
  band.
- **Round 4** (`henna-r4-s2-1440x900.png`, `henna-r4-lineup-t2-1440x900.png`,
  `henna-r4-flora-oasis-1440x900.png`, `henna-r4-close-noon-1440x900.png`): the leaf edge is
  leafy now. The silhouette was a little vase-like, so the dome got wider and lower. On the tier-2
  board and the oasis flora board it reads as "a neat green dome frothing with cream". It is
  clearly not the rose (pink cups on arching canes, larger), not barley (gold whiskers) and not
  spearmint (lilac spikes). In the noon close view on the plot it sits well, but the twigs were
  still a little dark.
- **Round 5** (`henna-r5-close-sunset-1440x900.png`, `henna-r5-close-night-1440x900.png`,
  `henna-r5-overview-1440x900.png`, `henna-r5-overview-390x844.png`): the twigs are paler and
  softer, and the sprays have more arms. At sunset the leaves catch the warm rim and the froth
  stays visible. At night the sprays glow softly over the dark dome. On phone it reads as a clean
  green bush with a pale crown. In the desktop overview the froth was weak, a beige haze on the
  sand.
- **Round 6** (`henna-r6-overview-1440x900.png`, `henna-r6-overview-crop.png` as before/after,
  `henna-r6-studio-1440x900.png`, `henna-r6-stages.png`): the petals are lighter cream and a
  little larger, and the stalks are paler. The froth is clearly cream over the sand in the
  overview. Growth stages read twigs → leaves → pink-budded sprays → cream bloom.

## Left open
- In the overview the froth is still delicate. It reads as cream, but quieter than the rose's
  pink. Brighter florets would push them toward white, away from the brief's cream.
- The crown wash shows a little as a pale green halo between the leaves at the close view. It is
  soft, but a sharper leaf-only edge would look crisper.
- There is no clipped-hedge variant. The brief says it is often cut low in rows. One plot plant
  reads as a free-grown bush, and a clipped, flatter top would need its own plan.
- The capsules are small and few (by design). At garden scale they are barely visible.
- The native name "Lḥenna" (Darija) and the Tamashelhit "anella" are *(verify)* in the brief.
  Only the Darija name is used, and it should be checked with a speaker before release.
- Not run here (per the task's CPU rules): `npx playwright test tests/e2e/studio.spec.ts` and the
  full suites.

## For the orchestrator to place
`| 124 | [OP8: Henna](124-henna.md) | A neat, much-branched dome of grey-brown twigs and small opposite elliptic leaves in fresh green over a soft wet-in-wet body, topped with 9–12 airy panicles of tiny four-petalled cream florets with pink-flushed buds, and a few small round green-to-brown capsules |`

`| \`henna\` | Henna · Lḥenna | 2 | meadow, back | 120×160 · .5/.92 | \`#f1e2bf\` | yes | much-branched rounded dome: 6–8 stems fanning from one crown, 3–5 side twigs each reaching the dome's edge; opposite (decussate) pairs of small smooth pointed elliptic fresh-green leaves with an olive shaded half over a soft wet-in-wet body, darker on the lower right; 9–12 airy panicles at the sky-facing tips with tiny four-petalled crinkled cream florets with a gold eye and pink-flushed buds; a few small round green-to-brown capsules on lower tips (oasis only, cultivated) |`

`| OP8.1 | Henna: \`smallSuite\` plus pose continuity of every twig, stalk, mass, leaf, floret and capsule over 240 growths (3 seeds), inside its box (24 seeds), a much-branched dome (≥ 6 stems, ≥ 12 side twigs, every leaf paired, > 250 leaves), ≥ 6 sprays with > 60 open florets and some buds, rising above the leaves, ≥ 3 capsules; twigs → leaf pairs → budding sprays → open florets; tier 2, medium, meadow and back, cultivated range, cream bloomColor, bees; the oasis pin gains \`henna\`, the garden keeps its 25 and the waterfall its own | plants/species/henna; scenery/flora | studio › every entry renders | ✔ |`
