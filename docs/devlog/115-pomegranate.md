# 115 · Pomegranate (OP11, phase 13)

## What
The oasis's middle storey: **pomegranate** (*Punica granatum*, rremman in Darija). It is a tier-4
`large` small tree for the plots and the palms' floor. It adds only files, plus one id in a pinned
test list:
- `src/plants/species/pomegranate.ts`: the definition, the plan (`planPomegranate`) and the
  growth windows (`pomegranateArrivals`).
- `src/plants/lib/pomegranate-paint.ts`: new helpers `calyxOutline`, `paintFlowers`,
  `fruitOutline`, `paintFruits`, `paintTwist` and `shadeSide`. No shared `lib/` helper was edited.
  The tree helpers (`paintSkeleton`, `paintLeaves`, `paintTipLeaves`, …) are only imported, and so
  is `paintBlots` from `katsura-paint.ts`, which paints the crown's body wash. A change to katsura's
  blots would also change the pomegranate.
- `src/plants/species/pomegranate.test.ts`: `treeSuite('pomegranate', planPomegranate)`, plus
  checks that every mark grows in continuously from 0, that marks arrive in order (wood, then leaves,
  then calyx buds, then flowers, then fruit), that every seed has at least 6 flowers and 3–6 fruits
  with no crown pointing down, that all marks stay inside the box, and that the calyx teeth open.
- `src/plants/notes/pomegranate.ts`: the Note from the brief.
- `src/scenery/flora.test.ts`: `'pomegranate'` added to the pinned oasis list (sorted, one per
  line). The garden keeps its 25 and the waterfall its own list.

Fields:
- tier 4, `large` (like the plum blossom; the brief says large, and `treeSuite` allows large and
  tree), box 300×340, anchor .5/.94;
- habitats `meadow` and `back`. In the oasis that is the large plots `plot-3`, `plot-5` and
  `plot-6`, and the tree slots `high-1` and `palm-1`. It does not compete only for the two tree
  slots;
- `range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] }`, cultivated
  only, like the date palm;
- `nativeName: 'Rremman'`, `nativeLang: 'ary-Latn'`; bloomColor `#d0503a`; `pollinators: true`;
- description: "Pomegranate — little crowns ripening in the palms’ shade." (the brief's Line).
- The id sorts after `anemone`, so `allSpecies()[0]`, `ui-shell` and `widget` are unchanged. On
  `plants-trees` it stands between the plum blossom and the weeping cherry.

## How it is painted
- **Stems:** 3–5 grey stems (`#908d84`) from one foot, the centre ones upright and the outer ones
  leaning out, 140–170 units. The back stems are paler. `paintTwist` lays dark furrows with a pale
  ridge beside each, spiralling round each stem and limb. They are drawn only where they cross the
  front, so the bark reads as twisting. There are 1–2 suckers at the foot.
- **Branches:** 3–4 limbs per stem, each with 2–3 slender twigs that sag a little. One or two thin
  whips arch out from the outer stems: these make the untidy edge.
- **Crown:** a lobed, rounded dome over the twig tips, with 2–3 sky holes. Like the katsura, it is a
  soft body wash in pads, shaded under each clump. The wash fades toward the rim (alpha 0.62 → 0.3),
  so the leaves make the silhouette, not the wash. Twigs and whips that reach past the dome carry
  small clumps out along them.
- **Leaves:** small, narrow (width 0.26–0.34 of length), 6.5–9 units, in 1–3-leaf spurs that point
  outward on the rim. The palette is the brief's `#8aa456` family: light `#a9c062`, mid `#7f9c48`,
  shadow `#4f7036`. Front leaves dry source-over and crisp (glossy), and back leaves are thinner.
  About 12 % of the lit rim spurs stay bronze (`#b2664a`), and the sapling's tip leaves are
  bronze-green.
- **Flowers** (9–13, at least 7): at twig tips round the rim, facing out and up. The corolla is a
  crumpled scarlet-orange blob (`#ea5a36`) with 2–3 deeper folds. It comes out of a fleshy crimson
  calyx (`#a8302a`, shaded flank `#6e2024`): a swollen base, a waist and a mouth with three visible
  teeth that splay open as the petals burst. A few petals lie at the foot.
- **Fruit** (4–6): leathery globes (r 7.5–9.5) on the crown's flanks and lower rim. Each is
  gold-red (`#d9925a`) with a rose-red blush (`#bf4438`) on the lit side, a shade crescent and a
  lifted gloss. The calyx crown (`#8a3a30`) points out and a little up, never down. About a third
  of the fruits sit behind the front leaves.
- **Growth** (tested continuous over 400 steps):
  - 0–0.5: the stems and branches;
  - 0.42–0.77: the pads and leaves;
  - 0.6–0.82: the calyx buds (flowers and fruits alike);
  - 0.76–0.96: the petals burst out and the teeth open;
  - 0.78–1: the fruit swells behind its calyx, which rides out on it;
  - 0.86–1: the fruit ripens from green-yellow to red;
  - 0.93–1: petals fall at the foot.
- **Cost:** 60 ms median and 76 ms max at growth 1, 1.6×, seeds 2–9, on the main thread in
  headless Chromium against the dev server. In the same run the katsura took 82 ms and the plum
  blossom 35 ms. That is inside the 4–127 ms budget.

## Looked at
All shots are in `artifacts/op11-pomegranate/` (gitignored). The app shots plant pomegranates into
`plot-6`, `plot-3` and `palm-1` and a date palm into `high-1`. Each uses
`sprout.start(120, { speciesId, sceneryId: 'oasis', slotId })`, `completeSession()` and
`sprout.plants.settle()`, then pins the time. The oasis sky was not judged, because O5 is redoing
its daylight.
- Round 1, `r1-studio-1440x900.png` and `r1-g1-1440x900.png`:
  - the leaves splayed in 3–4-leaf fans and read as bird footprints or stars;
  - the crown wash was a pale, flat sheet with hard scallops;
  - the calyx and the petals were the same red, so the flowers read as red bows;
  - the fruit was faceted (18-point outline) and brownish;
  - at growth 0.3–0.55 the bronze tip leaves read as pink blossom on bare twigs, which looked like
    a plum or cherry.
- Round 2, `r2-seeds.png` (seeds 1–6):
  - narrower fans and more spurs helped, but the wash still dominated: a green paper cut-out with
    stickers on it;
  - long horizontal limbs and whips carried pads out like shelves or wings (seeds 3–6);
  - the darker calyx, the brighter petals and the redder, smoother fruit now read.
- Round 3, `r3-seeds.png`, `r3-overview-noon-1440x900.png`, `r3-close-noon-1440x900.png`:
  - I raised the limbs (up 0.15, narrower angles), shortened the whips, added fit margin and
    nearly doubled the leaves, and the crowns came together;
  - in the overview the small-size read works: a green rounded crown studded with scarlet points
    and red globes, and nothing else in the oasis looks like it;
  - the close view still showed the wash as a hard-edged sheet at the silhouette.
- Round 4, `r4-close-noon-1440x900.png`, `r4-overview-sunset-1440x900.png`,
  `r4-close-sunset-1440x900.png`, `r4-overview-night-1440x900.png`, `r4-close-night-1440x900.png`,
  `r4-overview-noon-390x844.png`, `r4-close-noon-390x844.png`, `r4-lineup-1440x900.png`:
  - with the rim fade, the leaves make the edge;
  - the scarlet holds at sunset, and at night the colours fade under the indigo without going
    muddy;
  - on the phone the overview still reads: the crown, the red points and the globes;
  - on the tier-4 board it is the small round bush between the plum and the cherry, distinct from
    both (bare dark wood, a pink weeping tree) and from the maple's tiered red;
  - in the growth row, 0.55 is a bare twiggy frame and 0.8 a green crown whose buds are just
    starting.

## Left open
- In the close views (most on the phone), the crown's body wash shows as overlapping round
  discs behind the leaves. The katsura has the same look. A more broken wash would help.
- Seen very close, a flower can still read as a red bow; the crumpled petals could have more
  inner folds.
- Some seeds grow a flat-topped crown with a low shelf on one side (seed 3, `r3-s3-1440x900.png`).
  This reads as untidy, but it is the least tree-like silhouette.
- The bronze spurs barely show at app scale.
- The close view on `plot-6` cuts the crown at the top of the frame on desktop. That is the
  camera's framing of a large slot near the back of the plots, not the sprite.
- There are no autumn colours (the golden yellow from the brief): the sprite shows late summer,
  with flowers and fruit together.

## For the orchestrator to place
`| 115 | [OP11: pomegranate](115-pomegranate.md) | A small multi-stemmed tree of grey twisting stems under a rounded, untidy crown of narrow glossy leaves, with scarlet crumpled flowers in fleshy crowned calyces and red-blushed fruits wearing the little crown |`

`| \`pomegranate\` | Pomegranate · Rremman | 300×340 · large | meadow, back | \`#d0503a\` | yes | a small multi-stemmed tree: 3–5 grey twisting stems leaning out from one foot, slender sagging twigs and an arching whip or two under a rounded, slightly untidy crown of small narrow glossy leaves (a few bronze shoots); 9–13 waxy scarlet flowers bursting crumpled out of fleshy crimson calyces with splayed teeth; 4–6 red-blushed globes each wearing the calyx's little crown; scarlet petals at the foot (oasis only) |`

`| OP11.1 | Pomegranate: \`treeSuite\` plus continuity of every pad, leaf, calyx bud, corolla, fruit swell and ripening over 400 growths, wood then leaves then calyx buds then flowers then swelling fruit, ≥ 6 flowers and 3–6 fruits per seed (12 seeds) with no crown pointing down, every flower, fruit and leaf inside the box, the calyx teeth opening; the garden keeps its 25 and the waterfall its own | plants/species/pomegranate; scenery/flora | studio › every entry renders | ✔ |`
