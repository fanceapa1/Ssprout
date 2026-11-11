# G0 — Greek coastline biome research

Research for phase 15 (the Greek coastline). Sources are listed at the end and cited as [n]. Facts
marked *(verify)* came from memory or from weak sources and were not confirmed during this task.

**The scene (owner decisions, 2026-11-12):** a tended clifftop garden terrace over a turquoise cove.
- **On the terrace:** dry-stone walls, gravel paths, one big gnarled olive, lavender, and magenta
  and red flower mats.
- **Around it:** limestone cliffs with Aleppo pine and maquis or phrygana, and a pebble beach.
- **Far and near props:** a far whitewashed village with a blue-domed chapel, a few ancient marble
  columns, and a moored fishing caique.
- **Plantable water is the sea edge:** shallows, rock pools and splash rocks.

**What the repo has:** 54 plant species in `src/plants/species/` in this checkout (the brief said
about 60), and three gardens (Japanese garden, waterfall, oasis).
- **Mediterranean-ready species:** oasis species already carry `mediterranean` in their range
  (caper, oleander, southern maidenhair, grapevine, pomegranate, spearmint and others).
- **Range vocabulary:** `src/plants/biomes.ts` has the realm `mediterranean`. It has the biomes
  `coast`, `heath`, `garden`, `grassland` and `wetland`, but **no Mediterranean climate**, and no
  biome for scrub or for the sea edge (§5).

---

## 1. Region

**Recommendation: the inner Ionian (Kefalonia, Lefkada, Ithaca, Paxos), a limestone coast with Aleppo
pine, olive groves and deep turquoise coves, painted as a tended garden terrace.**

| | **Cyclades** (Paros, Naxos, Santorini) | **Ionian** (Kefalonia, Lefkada, Corfu) | **Saronic** (Hydra, Poros, Aegina) | **Crete** |
|---|---|---|---|---|
| Aleppo pine | Rare. *Pinus brutia* is the Aegean pine (Lemnos, Lesbos, Samos, Chios, Rhodes, Crete) [1] | Native: mainland, Ionian islands, Sporades, Euboea [1] | Yes (planted and natural) *(verify)* | No, *P. brutia* [1] |
| Hermann's tortoise | Absent. A few old marginated-tortoise records on Milos, origin unclear [2][3] | Documented on Corfu, Lefkada, Kefalonia, Zakynthos [2][3] | Marginated tortoise on Salamina [3] | Absent in the wild *(verify)* |
| Dolphins | Few resident | The Ionian Dolphin Project works here, on common and bottlenose dolphins [4] | Few | Some |
| Scopoli's shearwater | Colonies in the Aegean | Strofades hold about 17,000–18,000 visiting birds, the largest colony in the eastern Mediterranean [5] | Few | Some |
| Look | White cubes, treeless, wind-shaved phrygana | Greener, olive and cypress, steep limestone, turquoise water, pastel and Venetian villages [6] | Pine over stone mansions, little turquoise | Big, varied |
| Whitewash and blue dome | Native | Whitewashed chapels exist; the blue dome is mainly Cycladic [6] | Whitewash common | Whitewash common |

**Why Ionian:**
1. **The owner's creatures fit it best.** The tortoise (Hermann's, §3), the dolphins and the
   shearwater are documented here. In the Cyclades the tortoise would be the wrong species and
   hardly present at all.
2. **The pine is right.** The owner wants Aleppo pine, and it is the western Greek pine [1].
3. **It paints well.** Steep pale limestone, dark green pine and olive, and the greenest, most
   turquoise water in Greece. It is the "greener Ionian cove" of the references.
4. **The dry Cycladic garden still fits.** Dry-stone terraces, gravel, lavender, ice plant and a
   whitewashed village exist all over Greece. The one Cycladic borrowing is the blue dome (§6).

**Reference landscape for the painting** (no named real place in the game): the west coast of
Kefalonia and the cliffs of Lefkada's south-west, with a small harbour village below.

**The garden and the wild around it.** A terrace garden is planted (olive, lavender, ice plant,
vine). Above and below it is wild Mediterranean vegetation:
- **Maquis:** dense evergreen scrub, taller than a person.
- **Phrygana:** low, spiny, aromatic scrub on stony ground, grazed by goats. Sarcopoterium,
  *Cistus*, *Phlomis*, thyme and spiny spurge are typical of it [7].
- **The sea edge:** strand vegetation on sand and shingle, a salt-sprayed rocky band, and below the
  waterline seagrass and algae.

The scene is a **cultivated** garden (like the Japanese garden and the oasis) with wild neighbours,
so the profile is cultivated and its own wild species stay wild (§5).

---

## 2. Sixteen coastal plants

Hex values are watercolour mixes under the ART_DIRECTION chroma ceilings. The wash leans on warm
limestone, silver olive, dark pine and turquoise, with magenta, pink, violet and yellow as the
flowers. A Greek or Latin label is given for each plant. Greek spellings were not checked with a
speaker *(verify before shipping)*.

**Ranges.** Proposed tags are in §5 (`mediterranean` realm; new biomes `scrub` and `marine`; new
climate `mediterranean`). A wild species gets `realms: ['mediterranean']`, its biomes and the
climate. A garden plant gets `cultivatedIn: ['mediterranean']`.

**Habitat mapping.** The six slot habitats and the scene's places:

| Slot habitat | Places in this scene |
|---|---|
| `meadow` | terrace beds |
| `rock` | wall tops and cracks, splash rocks, cliff ledges |
| `path` | gravel path edges |
| `back` | scrub, the cliff-top woods |
| `shore` | beach sand and shingle |
| `water` | rock pools and shallows |

**Algae and seagrass.** *Posidonia* is a true flowering plant. *Padina* and *Cystoseira* are brown
algae, not plants. The game calls everything "plants"; the Notes say what they are (§6).

### Tier 1 (small)

#### 1. Ice plant — id `ice-plant` — *Lampranthus* (spectabilis group)
- **Names:** English ice plant, pigface. Greek: μεσημβριάνθεμο (mesimvrianthemo) *(verify; it is the Greek name of the family's best-known genus, not a folk name)*.
- **Native or cultivated:** **cultivated.** A South African succulent grown in Greek gardens and on terrace walls. `cultivatedIn: ['mediterranean']` only.
- **Tier and size:** 1, small. Pollinators: yes (bees, butterflies).
- **Habitats:** terrace bed (`meadow`), wall top (`rock`), gravel path edge (`path`). **Never a cliff, the beach or a splash rock** (§6).
- **Flowering:** spring and early summer, March–June *(verify)*. The flowers open in sun and close at dusk and in dull weather. bloomColor `#c23f86` (magenta); a red-orange form `#d4553a` as a seed variant.
- **Illustrator:**
  - **Shape:** a flat, spilling mat of pencil-thick succulent leaves, grey-green and bluish (`#8aa88a`, shade `#6b8a72`), over a rocky edge or down a wall face.
  - **Flowers:** a carpet of daisy-like, shiny flowers with many narrow petals and a pale centre. Magenta (`#c23f86`, pale `#e08ab8`) or red-orange.
  - **At thumbnail size:** a bright magenta cushion with silver-green leaves. It is the loudest colour in the garden. Keep it one patch, not a field.
  - **Do not confuse with:** the cosmos (open flat petals on tall stems) and any pink shrub. It has no stems, only a mat.
  - **Genus choice:** use the narrow-leaved, daisy-flowered *Lampranthus* look, not *Carpobrotus* (fat triangular leaves, big flowers). *Carpobrotus edulis* is the invasive one in Greece [8].

#### 2. Cyclamen — id `cyclamen` — *Cyclamen hederifolium*
- **Names:** English ivy-leaved cyclamen, sowbread. Greek: κυκλάμινο (kyklamino).
- **Native or cultivated:** **native**, wild across Greece, in shade under pines and scrub, on rocks and stone walls [9]. `realms: ['mediterranean']`, biomes `scrub`, `coast`.
- **Tier and size:** 1, small. Pollinators: yes (bees, flies; weak).
- **Habitats:** scrub (`back`), terrace bed under the olive (`meadow`), wall foot and crack (`rock`).
- **Flowering:** **autumn**, August–October, with the first rains [9]. The leaves come after the flowers. bloomColor `#d98aa6`.
- **Illustrator:**
  - **Leaves:** heart or ivy-shaped, dark green marbled with silver (`#5f7a5c` with `#b9c4b0` patterns).
  - **Flowers:** pink, each on its own bent stalk, five petals swept back like a shuttlecock or a small flame (`#d98aa6`, throat `#9a4a6a`).
  - **After flowering:** the stalk coils to a spring and pulls the seed capsule to the ground. That is a good late growth stage.
  - **At thumbnail size:** a pad of silvered leaves with a few pink swept-back flowers.
  - **Do not confuse with:** the balloon-flower, the hydrangea and the cosmos. Swept-back petals on single stalks are the key. Show it in the shade of the olive, where it belongs.

#### 3. Rock samphire — id `rock-samphire` — *Crithmum maritimum*
- **Names:** English rock samphire, sea fennel. Greek: κρίταμο (kritamo); ancient Greek κρήθμον (krethmon) [10].
- **Native or cultivated:** **native.** A rock-crevice and shingle plant of Greek sea cliffs, quays and beaches [10]. `realms: ['mediterranean']`, biome `coast`.
- **Tier and size:** 1, small. Pollinators: yes (flies, small bees).
- **Habitats:** splash rock and cliff crack (`rock`). It also grows on beach shingle (`shore`).
- **Flowering:** summer to autumn, July–October [10]; the pale green umbels of tiny flowers sit above fleshy leaves.
- **Illustrator:**
  - **Leaves:** thick, fleshy, finely cut into narrow blunt lobes like a succulent fennel, grey-green to yellow-green (`#92aa70`, shade `#6f8c58`). They glisten.
  - **Flowers:** flat umbels of tiny greenish-yellow flowers (`#cfd28a`) on short stems.
  - **Habit:** a rounded tuft growing out of a crack, never in soil.
  - **At thumbnail size:** a fleshy, shiny green tuft with flat cream-green heads, jammed into rock.
  - **Do not confuse with:** the wild fennel look-alike and the maidenhair (flat green fronds). Fleshy leaves, flat umbels and the crack are the identity.
  - **Never** show it being picked; its stands grow on dangerous cliffs (§6).

#### 4. Peacock's tail — id `peacocks-tail` — *Padina pavonica*
- **Names:** English peacock's tail, a brown alga. Greek: no common name found *(verify)*; use the Latin as the native name.
- **Native or cultivated:** **native**, a warm-water alga of the Mediterranean, common in rock pools [11]. `realms: ['mediterranean']`, biome `marine`.
- **Tier and size:** 1, small. Pollinators: no.
- **Habitats:** rock pool (`water`), shallows over stone (`water`).
- **Flowering:** none. It has gametes, not flowers. Use a "bloom" of its pale banding if the UI needs a swatch colour. bloomColor `#c9c0a0`.
- **Illustrator:**
  - **Frond:** a flat, overlapping fan or funnel with a curled edge, olive-brown (`#8a7c4e`, light `#b3a574`).
  - **The key:** **concentric chalky bands** across the fan, pale and almost white (`#e4ddc4`), because the frond is coated in calcium carbonate [11]. Paint the bands as dry-brush lifts.
  - **Under water:** a group of 3–6 fans on the rock, with the water tint over them. The only warm-brown thing in the rock pool.
  - **At thumbnail size:** a tiny cluster of banded olive fans.
  - **Do not confuse with:** the lotus or water-lily pads. The fan is brown, banded and **stands on rock**, not on the surface.

### Tier 2 (medium)

#### 5. Lavender — id `lavender` — *Lavandula angustifolia* look
- **Names:** English lavender. Greek: λεβάντα (levanta).
- **Native or cultivated:** **cultivated.** English lavender is a garden plant in Greece. The Greek wild lavender is another species, *L. stoechas* (§3, look-alike). `cultivatedIn: ['mediterranean']`.
- **Tier and size:** 2, medium. Pollinators: yes (strongly: bees and the hummingbird hawk-moth).
- **Habitats:** terrace bed (`meadow`), gravel path edge (`path`), wall foot (`rock`).
- **Flowering:** June–August *(verify)*. bloomColor `#8a78b8`.
- **Illustrator:**
  - **Shape:** a rounded, silvery cushion of narrow grey-green leaves (`#8da78b`), with many bare, straight stems standing above it.
  - **Flowers:** slim, dense spikes of violet-blue (`#8a78b8`, pale `#b6a8d4`), 4–6 cm, at the stem tips. Paint the spikes as dabbed vertical strokes.
  - **At thumbnail size:** a grey-green dome with a halo of violet spikes. Plant it in lines along the path.
  - **Do not confuse with:** spearmint (if shared: lilac spikes on leafy stems, §4) and the sea lavender (a branched froth, below). Keep lavender as the only straight-stemmed violet spike.
  - **Native look-alike:** *L. stoechas* has a pineapple-shaped head topped with two "rabbit ear" bracts. It reads differently at a glance, so it can be a later seed variant, not a second species.

#### 6. Sea daffodil — id `sea-daffodil` — *Pancratium maritimum*
- **Names:** English sea daffodil, sand lily. Greek: κρίνος της θάλασσας (krinos tis thalassas) [12].
- **Native or cultivated:** **native**, wild on beaches and dunes; protected by Greek law and threatened by beach development [12]. `realms: ['mediterranean']`, biome `coast`.
- **Tier and size:** 2, medium. Pollinators: yes (hawkmoths, at dusk; bees by day).
- **Habitats:** beach sand and shingle (`shore`); also the sandy gravel path edge (`path`).
- **Flowering:** late summer, August–October [12]. Very fragrant, mostly at evening. bloomColor `#f6f2e8`.
- **Illustrator:**
  - **Leaves:** a fan of grey-green, strap-like leaves (`#8fa598`), glaucous, half buried in the sand.
  - **Flowers:** 3–8 large pure-white trumpets on a stout stem. Six narrow petals, and a **central cup** (corona) with fine teeth, pale green at the throat (`#d9e0a8`).
  - **Growth:** the bulb sits in the sand; the leaves come first, the flower stem pushes up through them.
  - **At thumbnail size:** a white spidery trumpet with a toothed cup, on a grey-green fan, on sand. A reserved-white flower is the whole painting, so keep the paper clean.
  - **Do not confuse with:** the spider lily (red, narrow, curling stamens, a Japanese garden species). The sea daffodil is white, with a broad cup. Do not offer both in one slot or frame.
  - **Never** suggest picking; the bulb is a protected dune plant (§6).

#### 7. Sea holly — id `sea-holly` — *Eryngium maritimum*
- **Names:** English sea holly. Greek: no certain folk name found *(verify; the Greek flora gives ερύγγιο, eryngio)*.
- **Native or cultivated:** **native**, on dunes and shingle across Greece [13]. `realms: ['mediterranean']`, biome `coast`.
- **Tier and size:** 2, medium. Pollinators: yes (bees, butterflies, wasps).
- **Habitats:** beach sand and shingle (`shore`).
- **Flowering:** summer, June–August *(verify)*. bloomColor `#8fa6c4`.
- **Illustrator:**
  - **Whole plant:** blue-grey (`#8fa8a8`), stiff, spiny, like a holly made of frost. Leaves are rounded and leathery with spiny teeth and pale veins.
  - **Flowers:** round blue-violet heads (`#8fa6c4`) like thistle cones, each with a **collar of spiny blue-grey bracts**.
  - **At thumbnail size:** a spiky blue-grey rosette with a few round blue heads. It is the only cool blue plant on the beach.
  - **Do not confuse with:** the balloon-flower (a smooth bell) and lavender (soft spikes). A hard, spiny silhouette is the key.

#### 8. Cystoseira — id `cystoseira` — *Cystoseira* (the Mediterranean "forest" algae)
- **Names:** English cystoseira, brown bushy alga. Greek: no common name found *(verify)*.
- **Native or cultivated:** **native**, the canopy-forming brown algae of rocky Mediterranean shores, in shallow clear water on rock. Species differ by sea and depth; paint a generic one *(verify which species fit the Ionian)*. `realms: ['mediterranean']`, biome `marine`.
- **Tier and size:** 2, medium. Pollinators: no.
- **Habitats:** rock pool (`water`), shallows over rock (`water`).
- **Flowering:** none.
- **Illustrator:**
  - **Whole plant:** a small, bushy, branching "tree" 10–40 cm tall, with a stalk, many forking branches and tiny hair-like leaves. Olive-brown to golden (`#8a7a3e`, light `#b9a35a`).
  - **Beauty:** under water, a **blue-green iridescent sheen** on the branches *(verify)*; paint it as a cool edge light on the golden-brown (`#6fa0a8` glaze).
  - **Swaying:** the tips stream with the current, a slow wash.
  - **At thumbnail size:** a small golden-brown shrub under the water tint.
  - **Do not confuse with:** the Posidonia (long flat green ribbons) and the peacock's tail (banded fans). Cystoseira is the branching bush.

#### 9. Sea lavender — id `sea-lavender` — *Limonium* (a Greek coastal species)
- **Names:** English sea lavender, statice. Greek: λιμώνιο (limonio).
- **Native or cultivated:** **native.** Greek rocky coasts hold many *Limonium* species, several endemic and hard to tell apart [14]. Paint a generic one; do not name a species. `realms: ['mediterranean']`, biome `coast`.
- **Tier and size:** 2, medium. Pollinators: yes (small bees and flies).
- **Habitats:** splash rock and cliff foot (`rock`).
- **Flowering:** summer *(verify)*. bloomColor `#c0a8d0`.
- **Illustrator:**
  - **Rosette:** a flat rosette of leathery, paddle-shaped, blue-green leaves hugging the rock (`#7f9c8a`).
  - **Flowers:** a wide, airy, branching panicle on a wiry stem, covered in tiny papery lilac-pink flowers (`#c0a8d0`, with white `#f0e8f0`). It looks like a cloud of dried flowers.
  - **At thumbnail size:** a flat green rosette with a pale lilac cloud over it, wedged in a rock.
  - **Do not confuse with:** lavender. Sea lavender is **not** a lavender: no spikes, a branched froth on a bare stem, pale lilac not violet, and always on salty rock. The name is risky, so the card shows the Latin first.

#### 10. Pink rock rose — id `rock-rose` — *Cistus creticus*
- **Names:** English pink rock rose. Greek: κίστος ο κρητικός (kistos o kritikos); folk λαδανιά (ladania) *(verify)*.
- **Native or cultivated:** **native**, throughout Greece in dry open scrub, rocky places and wood edges [15]. `realms: ['mediterranean']`, biomes `scrub`, `coast`.
- **Tier and size:** 2, medium (a low shrub). Pollinators: yes (bees, beetles).
- **Habitats:** scrub (`back`), gravel path edge (`path`), cliff-top ledges (`rock`).
- **Flowering:** late March to June [15]. Each paper flower lasts about a day and drops its petals in the evening, but new ones open for weeks [15]. bloomColor `#c9609a`.
- **Illustrator:**
  - **Shape:** a rounded, rather open small shrub, with sticky, wrinkled, hairy, grey-green leaves (`#7f9470`).
  - **Flowers:** 4–6 cm, five **crinkled tissue-paper petals** in purple-pink (`#c9609a`, pale `#e6a4c6`), a bright yellow boss of stamens (`#e6c050`). A scattering of petals on the ground is a nice detail.
  - **At thumbnail size:** a grey-green mound with scattered pink tissue-paper flowers with yellow centres.
  - **Do not confuse with:** the tree peony, camellia and Damask rose (full, double cups). The rock rose is single, flat, crinkled and has a yellow boss, on a rough grey shrub.

### Tier 3 (large or medium shrubs, and the seagrass)

#### 11. Posidonia — id `posidonia` — *Posidonia oceanica*
- **Names:** English Neptune grass, Mediterranean tapeweed. Greek: ποσειδωνία (poseidonia) [16].
- **Native or cultivated:** **native.** The Mediterranean's endemic seagrass, a flowering plant with roots, flowers and fruit, growing about 1 cm a year and living for centuries to millennia [16]. A priority habitat of the EU Habitats Directive [16]. `realms: ['mediterranean']`, biome `marine`.
- **Tier and size:** 3, large (a patch of meadow). Pollinators: no (water-pollinated).
- **Habitats:** shallows (`water`), on a sandy or rocky bed.
- **Flowering:** rare; flowers on the shoot in autumn and floating, olive-like fruit appear in spring *(verify)*. bloomColor `#6fae8a`.
- **Illustrator:**
  - **Leaves:** dense bundles of long flat ribbons, 30–80 cm and about 1 cm wide, bright green to deep green (`#5f9a78`, shade `#3f7a62`), with brown, tattered tips in late season.
  - **Motion:** a slow, collective sway, in one direction, with the wave.
  - **Under the water tint:** the greens go blue-turquoise. A meadow edge against pale sand is the best read.
  - **At thumbnail size:** a fan of green ribbons leaning with the current, over a sand patch.
  - **Do not confuse with:** the cattail and the susuki (above water, narrow). Posidonia is wholly under water and broad. Keep it out of the rock pool: it grows on sand and rock in open water.
  - **Care:** never draw an anchor or a chain over it (§6).

#### 12. Tree spurge — id `tree-spurge` — *Euphorbia dendroides*
- **Names:** English tree spurge. Greek: δενδρώδης ευφορβία (dendrodis evforvia) *(verify; spurges are folk-called γαλατσίδα, galatsida)*.
- **Native or cultivated:** **native**, a shrub of rocky coasts and sea cliffs across the Mediterranean, in Greece on the Peloponnese, the Gulf of Corinth and the Aegean islands [17]. The Ionian islands are not named in the habitat list I found *(verify)*. `realms: ['mediterranean']`, biome `coast`, `scrub`.
- **Tier and size:** 3, large. Pollinators: yes (small flies, ants; weak).
- **Habitats:** cliff and cliff-top scrub (`back`), cliff ledges (`rock`).
- **Flowering and season:** **dormant in summer**. It carries leaves in winter and spring, flowers in spring, and drops most leaves in the dry season [17][18]. bloomColor `#c6cd5e` (yellow-green bracts).
- **Illustrator:**
  - **Shape:** a **dome** of upright, forked, bare-ish stems, 1–2 m, like a shaggy cushion or a green broccoli. Red-brown branches (`#8a5a44`).
  - **Spring:** the tips carry whorls of narrow leaves and flat yellow-green flower bracts (`#c6cd5e`), lime-bright against the grey limestone.
  - **Late growth:** the leaves go thin and the branches show through (the drought look).
  - **At thumbnail size:** a lime-green dome on a cliff edge. Use it on the cliff, never in the terrace.
  - **Do not confuse with:** the oleander (knife leaves, pink), the yamabuki (yellow, arching, Japanese), and the rock rose. Its colour is yellow-green, its bracts are flat, its shape a dome.
  - **Latex:** it is irritant. The Note may say so as a fact; no line suggests touching it.

#### 13. Jerusalem sage — id `jerusalem-sage` — *Phlomis fruticosa*
- **Names:** English Jerusalem sage. Greek: φλόμος (flomos) *(verify)*.
- **Native or cultivated:** **native** to Greece, the Aegean and the central Mediterranean, in dry scrub, on stony slopes and coastal rocks [19]. Also a common garden shrub. `realms: ['mediterranean']`, biomes `scrub`, `coast`, `cultivatedIn: ['mediterranean']`.
- **Tier and size:** 3, medium. Pollinators: yes (bees, strongly).
- **Habitats:** terrace bed (`meadow`), scrub (`back`), wall foot (`rock`).
- **Flowering:** April–June [19]. bloomColor `#e6c040`.
- **Illustrator:**
  - **Leaves:** thick, soft, felted grey-green above and white below (`#9fae94` over `#d9dcc8`), in a rounded shrub up to 1 m.
  - **Flowers:** whorls of about 20 two-lipped, hooded, bright yellow flowers (`#e6c040`) stacked on the stem like tiers of a pagoda [19].
  - **At thumbnail size:** a grey-silver shrub with yellow tiers.
  - **Do not confuse with:** the yamabuki (flat five-petal yellow cups, green leaves, Japanese) and the olive (small silver leaves, no flowers of note). Tiered hooded whorls on felt leaves are the identity.

### Tier 4 (trees)

#### 14. Olive — id `olive` — *Olea europaea* — **the signature tree**
- **Names:** English olive. Greek: ελιά (elia).
- **Native or cultivated:** **cultivated** here (a planted, tended terrace tree) of an old, native species. The wild form (*O. europaea* var. *sylvestris*) is in Mediterranean maquis. `cultivatedIn: ['mediterranean']`, and wild `realms: ['mediterranean']`, biomes `scrub`, `garden`.
- **Tier and size:** 4, tree (380 × 460 box). Pollinators: no (wind).
- **Habitats:** terrace bed (`meadow`); a second slot in the scrub (`back`).
- **Flowering and fruit:** tiny cream flowers May–June; fruit green in autumn, turning black from October *(verify)*. bloomColor `#e8e0c4`.
- **Illustrator:**
  - **Trunk:** the whole point. A **thick, twisted, hollowed trunk**, split into two or three strands that spiral and lean, with gnarls and holes. Grey-brown with silver and warm shadows (`#8a7a68`, shade `#5a4e44`). The famous ancient trees (the 2,000–4,000-year-old tree of Vouves, Crete, nicknamed "twisted olive") have trunks like wrung rope [20].
  - **Crown:** a broad, low, airy cloud of narrow leaves, grey-green above and silver below (`#8da28a`, silver `#c8d0bc`). It shimmers in a breeze: the silver undersides flicker. Paint it as a wet-in-wet mass with a few lit leaf clusters, not leaf by leaf.
  - **Fruit:** small ovals, green (`#8a9a4e`) in the first half of the year, then purple-black (`#4a3a48`).
  - **Ground:** a dry grass or gravel floor, and a pool of dappled shade.
  - **At thumbnail size:** a gnarled twisted trunk and a silver-green cloud. Keep the trunk wide and low.
  - **Do not confuse with:** the weeping cherry and the Japanese maple (red, pink, bright). The olive is the only silver tree, and the only twisted trunk. Also not the plum blossom (bare black branches).
  - **Seasons:** the only tree that looks almost the same all year. Let the fruit colour and the trunk carry the growth stages.

#### 15. Aleppo pine — id `aleppo-pine` — *Pinus halepensis*
- **Names:** English Aleppo pine. Greek: χαλέπιος πεύκη (chalepios pefki); πεύκη (pefki) is the Greek "pine".
- **Native or cultivated:** **native**, the western and Ionian Greek pine; the Aegean pine is *P. brutia* [1]. `realms: ['mediterranean']`, biomes `scrub`, `coast`.
- **Tier and size:** 4, tree. Pollinators: no.
- **Habitats:** the cliff top and cliff edge (`back`).
- **Flowering:** cones; fresh male cones are small and yellow in spring *(verify)*. bloomColor `#b9b060`.
- **Illustrator:**
  - **Shape:** **irregular and airy**, leaning out over the cliff, often wind-bent, with a twisting trunk, a ragged, open, flat-topped or asymmetric crown and sky showing through.
  - **Needles:** long, thin, soft, in pairs, light yellow-green (`#8fa860`, light `#b5c080`). Cones in clusters, brown-orange (`#a67a4a`).
  - **Bark:** silvery grey on young branches, orange-brown and plated lower down (`#9a7a58`).
  - **At thumbnail size:** a light, ragged green crown on a leaning, orange-grey trunk against the sea.
  - **Do not confuse with:** the black pine (a Japanese tree, dark, dense pads of stiff needles, shaped), and the Italian stone pine (a flat parasol; a cliché, §6). The Aleppo is lighter, wilder and more open. **Never offer both Aleppo and black pine in one garden** (the black pine is not offered here).

#### 16. Mediterranean cypress — id `cypress` — *Cupressus sempervirens*
- **Names:** English Mediterranean (Italian) cypress. Greek: κυπαρίσσι (kyparissi).
- **Native or cultivated:** planted in Greek gardens, chapel yards and farms, and wild or ancient in the south-east Aegean and Crete *(verify)*. `cultivatedIn: ['mediterranean']`.
- **Tier and size:** 4, large (a tall narrow box, not a tree box). Pollinators: no.
- **Habitats:** terrace bed (`meadow`) beside the chapel path.
- **Illustrator:**
  - **Shape:** a **dark, narrow flame**, 8–20 m, tapering to a point, with branches pressed to the trunk. Very dark blue-green (`#4a6454`, shade `#33463c`), a vertical stroke with soft edges.
  - **Role:** the only vertical in the scene. It marks the chapel and anchors the olive's horizontals.
  - **Detail:** tiny scale leaves, small round cones in tight clusters, and a hint of lit green at the tips.
  - **At thumbnail size:** a dark vertical flame.
  - **Do not confuse with:** the date palm (not offered here). Nothing else in the roster is a flame.
  - **Cultural note:** in Greece the cypress is strongly linked to cemeteries and churchyards (§6). Decide before shipping.

### Summary

| Tier | Plants |
|---|---|
| 1 | ice plant, cyclamen, rock samphire, peacock's tail |
| 2 | lavender, sea daffodil, sea holly, cystoseira, sea lavender, pink rock rose |
| 3 | Posidonia (large), tree spurge (large), Jerusalem sage (medium) |
| 4 | olive (tree), Aleppo pine (tree), cypress (large) |

- **Habitat coverage** (own species only; the shared ones in §4 add more):

| Habitat | Own species |
|---|---|
| `water` | Posidonia, cystoseira, peacock's tail |
| `shore` (beach) | sea daffodil, sea holly, rock samphire (shingle) |
| `rock` (wall, splash rock, ledge) | ice plant, cyclamen, rock samphire, sea lavender, tree spurge, Jerusalem sage |
| `path` | lavender, ice plant, rock rose, sea daffodil |
| `meadow` (terrace) | lavender, ice plant, Jerusalem sage, olive, cypress, cyclamen |
| `back` (scrub, cliff top) | rock rose, tree spurge, Jerusalem sage, Aleppo pine, olive, cyclamen |

- **Wild or cultivated:**
  - Wild: cyclamen, rock samphire, peacock's tail, sea daffodil, sea holly, cystoseira, sea lavender, rock rose, Posidonia, tree spurge, Aleppo pine.
  - Cultivated: ice plant, lavender, olive, cypress, and the Jerusalem sage (both).
- **Colours:**
  - Magenta and red: ice plant. Pink: cyclamen, rock rose.
  - Violet and lilac: lavender, sea lavender. Blue-grey: sea holly.
  - White: sea daffodil. Yellow and lime: Jerusalem sage, tree spurge.
  - Greens and browns: Posidonia, cystoseira, peacock's tail, samphire. Silver: olive. Dark: pine, cypress.
- **Seasons:**
  - Spring: ice plant, rock rose, Jerusalem sage, tree spurge.
  - Summer: lavender, sea lavender, sea holly, samphire.
  - Autumn: cyclamen, sea daffodil, olive fruit.
  - All year: pine, cypress, Posidonia.
- **Counts:** 16 own plus 5 to 6 shared (§4) is 21 to 22, inside the 10–30 range, with at least 2 per tier and at least 2 per habitat. The 6-exclusive rule passes with 16.

**Alternates (17th and later):**
- **Thorny burnet** (*Sarcopoterium spinosum*, αστοιβή / astivi *(verify)*): the commonest phrygana dome in the Aegean and Crete, spiny, grey-green, with red fruit [7]. A strong alternate; the tree spurge was chosen for colour.
- **Strawberry tree** (*Arbutus unedo* / *A. andrachne*, κουμαριά / koumaria): red peeling bark, white urns, red fruit. A maquis tree; tier 3 large.
- **Mastic** (*Pistacia lentiscus*, σχίνος / schinos): the dark maquis shrub; reads as a green blob.
- **Fig** (*Ficus carica*, συκιά / sykia): the other terrace tree, big lobed leaves; close to the oasis alternate.
- **Wild thyme / savory** (*Thymbra capitata*, θυμάρι / thymari) and **rosemary**: aromatic path edges; they blur with lavender.
- **Spanish broom** (*Spartium junceum*, σπάρτο / sparto): yellow cliff broom; too close to the existing retama.
- **Golden samphire** (*Inula crithmoides*): yellow daisies on fleshy leaves; too close to rock samphire.
- **Horned poppy** (*Glaucium flavum*): yellow flowers and grey leaves on shingle; a good beach alternate.
- **Wall pennywort** (*Umbilicus rupestris*): round leaves in wall cracks; quiet.
- **Sea lettuce** (*Ulva*): bright translucent green frills in rock pools; an easy extra algae.
- **Cymodocea** (*Cymodocea nodosa*): the small seagrass that grows with Posidonia; a possible tier 1 shallows plant.
- **Red anemone** (*Anemone coronaria*): red spring flowers in Greek scrub; reads as a poppy, and the roster already has a Japanese anemone sprite.
- **Bougainvillea:** see §6.

---

## 3. Creatures

Fourteen new creatures and seven shared ones. **Build order** has two waves: **A** is the core, and **B**
is the later wave, so the 2-agent queue (docs/ROADMAP.md) can stop after A. The thresholds are plants
grown in this garden (`GardenCounts`: plants, pollinator flowers, water plants), as in the oasis table
(0 to 20). No plant count brings two creatures.

| # | Creature | Where | When | Unlock (suggestion) | Rarity | Wave |
|---|---|---|---|---|---|---|
| 1 | Island cat | wall copings, the path, the olive's shade | day and dusk, all year | always (resident) | common | A |
| 2 | Yellow-legged gull | the caique's mast and rail, a splash rock, the cove | day, all year | 1 plant | common | A |
| 3 | Cicada | olive and pine trunks and branches | day, June–September | 2 plants | common | A |
| 4 | Balkan green lizard | sunlit dry-stone wall and path edge | day, April–October | 3 plants | common | B |
| 5 | Cabbage white (shared) | terrace beds | day | 4 pollinator flowers | common | A |
| 6 | Marbled rock crab | splash rocks, the rock pool edge | day and night | 5 plants | common | A |
| 7 | Bees (shared) | lavender and flowers | day | 6 pollinator flowers | common | A |
| 8 | Swallows (shared) | over the cove, the terrace, the village eaves | day, April–October | 7 plants | common | A |
| 9 | Blue rock thrush | the chapel's roof and cross, cliff ledges, wall tops | day, all year | 8 plants | uncommon | A |
| 10 | Swallowtail (shared) | terrace flowers | day | 8 pollinator flowers | uncommon | A |
| 11 | Goats | the far cliff ledges | day, all year | 9 plants | common, distant | A |
| 12 | Hermann's tortoise | scrub, the terrace foot, the path | day, March–October, in the cool hours | 10 plants | uncommon | A |
| 13 | Damselfish shoal | the shallows | day | 11 plants (or a water plant) | common | B |
| 14 | Scops owl | olive branch, wall top, a pine | night | 12 plants, night only | uncommon | A |
| 15 | Hoopoe (shared) | the terrace floor, the olive's shade | day, April–September | 13 plants | uncommon | B |
| 16 | House gecko (shared kind) | the lit wall and village wall | dusk and night | 14 plants, night only | common | B |
| 17 | Hummingbird hawk-moth | lavender and rock rose | day, summer | 15 pollinator flowers | uncommon | B |
| 18 | Common octopus | the rock pool and the shallows | day, rare | 16 plants, rare | rare | B |
| 19 | Scopoli's shearwater | far offshore, low over the waves | dusk, April–October | 17 plants, rare | rare | B |
| 20 | Grey heron (shared) | the cove edge, a rock | day, winter and spring | 18 plants, rare | rare | B |
| 21 | Common dolphins | far out in the bay | day, rare | 20 plants, rare | rare | A |
| 22 | Loggerhead turtle (optional) | the open cove surface, far | day, summer | 25 plants, legend | very rare | B |

**Calm-garden check.** Most are slow: the cat sleeps, the tortoise walks, the goats graze. The
loudest, the cicada and the gull, are tied to light and the sound bed. Never more than a handful of
visitors on screen. A sleeping cat and a walking tortoise are the "slow" signature.

### The owner's four

**1. Island cat — *Felis catus*, domestic** [21]
- **Range:** Greek island and village cats are free-ranging, many unowned, fed at harbours and tavernas, and often struggling in winter [21].
- **Behaviour:**
  - It sleeps in a loaf pose on a sunny wall coping or on the warm gravel, tail wrapped round the paws.
  - It stretches, washes a paw, walks the wall top with its tail up, and drops to the path.
  - At dusk it sits and watches the gecko or the cicada. It never catches anything on screen.
  - It lets the camera come close, like the oasis bunting. A slow blink is the nicest animation.
- **Illustrator:**
  - **Coat:** a tabby and white or ginger and white island cat, with a warm sand shadow (`#c98a4e`, white `#f2e8d8`, tabby `#7a6a58`). A variant per individual: ginger, tabby-white, black-white.
  - **Detail:** a **clipped ear tip** (the mark of a neutered feral cat, trap-neuter-return) is a respectful and true detail on one variant [21].
  - **Read:** a loaf on a wall, an ear tip, a tail. Keep the body simple.
- **Unlock:** always. It is the first friend. (Note: it is a domestic animal, not wildlife. The card says "island cat", not "wild".)

**2. Hermann's tortoise — *Testudo hermanni boettgeri*** [2][3][22]
- **Which species fits:** **Hermann's tortoise**, not the marginated tortoise. In Greece Hermann's is documented across the mainland and on Euboea and the Ionian islands (Corfu, Lefkada, Kefalonia, Zakynthos) [2][3]. The marginated tortoise (*T. marginata*) is the mainland and Peloponnese species, with island records mostly on Elafonisos, Evvia, Kythera, Salamina, Skiathos and Skyros, and a few possibly introduced on the Cyclades, such as Milos [2][3]. **For a Cycladic scene, neither is native; for the Ionian, use Hermann's.**
- **Habitat:** open maquis, phrygana and olive groves bordering hillsides with scrub [22]. Italian work shows it prefers open maquis and warms itself in the sun before moving [22].
- **Behaviour:**
  - It walks the scrub edge and the terrace foot very slowly, stops, and eats a flower (a cyclamen leaf, a rock rose petal on the ground).
  - It is most active in the early morning and late afternoon; in midsummer it hides in the shade for the heat [22].
  - It basks head-out in the first sun, then retreats under a shrub. In late autumn it is gone (hibernation, about November to March [22]).
  - A tortoise is one of the safest, calmest creatures to animate: just a slow plod and a pause.
- **Illustrator:**
  - **Shell:** a domed, high shell with yellow-and-black patterned scutes (`#c9a24a` over `#4a3c2a`), a **yellow-orange** head and legs (`#c9a25a`), and a single split plate above the tail (the Hermann's sign).
  - **Size:** about 15–20 cm; paint it a little smaller than the cat.
  - **Read:** a small domed shell with a yellow, black-flecked pattern, a bit like a wet pebble with a head.
- **Protection:** a protected species (Habitats Directive; CITES) [22]. Never show it handled, caged or on a road.

**3. Common dolphins (rare, far out)** — *Delphinus delphis* [4]
- **Which species:** the Ionian Dolphin Project studies **short-beaked common** and **common bottlenose** dolphins around Lefkada, Kefalonia, Ithaca, Kalamos and up to Corfu [4]. The common dolphin once lived here in strong numbers (about 150 near Kalamos about ten years before 2008) and fell sharply, with prey depletion from overfishing named as the main cause; only 15 were counted near Kalamos in 2008 [4]. That makes "rare" the honest rarity. **Recommendation:** paint the common dolphin (its pale hourglass flank pattern reads as watercolour); use the bottlenose as an alternative if a plain grey animal is preferred (it is the commoner species in Greek waters *(verify)*).
- **Behaviour:**
  - A small pod of 3–5 surfaces far out: a dark back, a fin, a quick arc, a breath mist, and gone. A calf stays at an adult's side.
  - Now and then one leaps clear in the far light. They do not approach the cove or the boat.
  - It is a sight of 6–10 seconds, three or four times, then silence.
- **Illustrator:**
  - **Body:** very small on screen, a few strokes. Dark grey-blue back (`#4a5a6a`), pale belly (`#e0dccf`), and the **yellow-ochre and grey hourglass** on the flank (`#d9c48a`, `#8a96a0`).
  - **Read:** a curved dark back and a fin with a white splash. Make the ripples carry it.
- **Rule for the code:** a distant sea creature. Do not tie it to the boat, and never let it follow the caique (§6).

**4. Goats** — *Capra hircus*, domestic [23]
- **Range:** goats are grazers of the phrygana across Greece. Phrygana is traditionally used as livestock pasture, and goats and sheep spread what they do not eat [7]. These are herded village goats, not wild ones; the Cretan agrimi is another animal and lives on Crete only.
- **Behaviour:**
  - A small herd of 3–5 stands on the far cliff ledges, browsing the scrub, heads down and tails flicking. One climbs a ledge. One looks up at the camera.
  - Very slow. A kid follows an adult. They shift along the ledge now and then.
  - **Sound:** a bell (kodoni) on one of them, a clank that carries across the cove. A soft "meh" is optional.
- **Illustrator:**
  - **Coat:** brown, black and white, with variants: sandy brown with a dark stripe, black with a white blaze, cream. Horns on adults (`#8a7a68`).
  - **Size:** tiny. On the far ledge they are a few strokes and two or three colours.
  - **Read:** small dark and pale flecks on a ledge, with horns and a beard. The ledge is the reason they are readable.
- **Placement:** the far, high cliff ledges only. They never come down to the terrace and never touch the garden's plants.

### Eight or more wild ones

**5. Cicada — *Cicada orni* (the ash or Mediterranean cicada)** [24]
- **Range:** the Mediterranean cicada is common in warm, dry woodland and scrub, and the sound level in pine woods is higher than in scrub, with olive groves in between [24].
- **Behaviour:**
  - It clings to the olive or pine trunk, still, for a long time. Then the abdomen throbs and the wings tremble. It is more often heard than seen.
  - It starts when the heat is up and the light strong, and stops at dusk.
- **Illustrator:** about 3 cm, a grey-brown and green body (`#8a8a6a`), with clear, veined wings folded over the back in a roof, and large dark eyes. On the trunk, camouflaged. **A show of the sound bed** more than an animated creature.
- **Unlock:** 2 plants. Cicadas are the summer sound (§5).

**6. Yellow-legged gull — *Larus michahellis*** *(verify the species, the commonest Greek coastal gull)*
- **Behaviour:** it perches on the caique's mast or rail, preens, lifts off in one slow beat and glides over the cove, lands on a splash rock. It stands still for long periods. It is the cheapest "sea" signal.
- **Illustrator:**
  - **Body:** a big, white gull with a pale grey mantle (`#a9b0b4`), black wing tips with white spots, a heavy yellow bill with a red spot and **yellow legs** (`#d9b840`).
  - **Read:** a white bird on the mast. Young birds are mottled brown (a variant).
- **Alternative:** a Scopoli's shearwater (no. 19) is rarer and more distinctive; the gull is the everyday one. Keep the gull quiet in the sound bed.

**7. Balkan green lizard — *Lacerta trilineata*** *(verify the species and its Ionian record; the wall lizards of the Ionian, *Podarcis* spp., are the other candidate)*
- **Behaviour:** it basks on the sunlit stones of the dry-stone wall, head up, then darts into a crack when the cat passes, and slides out again. It uses the wall's warm face.
- **Illustrator:** a big, slim lizard, 30 cm or more with the tail. A bright green body (`#7fae4e`) with pale stripes, a yellow throat and a blue patch on the male in spring. A small body, long tail.
- **Read:** a flash of green on a pale wall. It is the brightest green in the scene.

**8. Blue rock thrush — *Monticola solitarius*** [25]
- **Range:** a bird of rocky cliffs, ruins and old village roofs in the Mediterranean; Greek recordings include males singing from village roofs and from a church cross [25]. Residence on the Greek islands is not clear from the sources *(verify)*.
- **Behaviour:**
  - It sits at the highest point it can find: the chapel's dome or cross, a cliff tip, a wall top. It sings a slow, fluting, thrush-like phrase [25], flicks its tail and bobs.
  - It drops to the ground for an insect and flies back to the same perch.
- **Illustrator:**
  - **Male:** dark slate blue all over (`#4a5a7a`), in sun a deeper cobalt, with dark wings and a long, straight bill. A female is brown and scaled.
  - **Read:** a blue-grey bird with an upright stance on the chapel dome. The blue is cool against the white.

**9. Scops owl — *Otus scops*** [26]
- **Range:** Greek island birds are placed in the subspecies *cycladum*, and Greek recordings include Kefalonia [26]. Some populations migrate to Africa in winter, while others stay *(verify for the Ionian)*.
- **Behaviour:**
  - After dusk it appears on an olive branch or a wall top, with ear tufts raised, **eyes half-closed**, looking like a broken branch. It sits for a long time.
  - It calls a **short, deep, whistled "tiu"** every few seconds for long stretches, which is the sound of the night [26]. Never a hoot.
  - It flies a short hop to the next perch.
- **Illustrator:** a very small owl, 19 cm, **grey-brown streaked and mottled** (`#8a7a68`, dark `#5a4e44`), with a pale eyebrow, two short ear tufts and **yellow eyes** (`#d9c04a`). It must be camouflaged against the bark.
- **Night signature**, as the gecko is the oasis's and the firefly is the waterfall's.

**10. Hummingbird hawk-moth — *Macroglossum stellatarum*** *(verify)*
- **Behaviour:** it hovers in front of a lavender spike or a rock rose with a blur of wings and a long tongue, then moves to the next flower without landing. It is a day flyer in summer.
- **Illustrator:** a small, chunky, grey-brown moth (`#8a7a68`), orange hind wings (`#d9884a`) and a banded, fan-shaped tail. Wings are a blur.
- **Read:** a tiny hovering dart. A new `bee`-like visitor; draw its own kind, not a bee variant.

**11. Marbled rock crab — *Pachygrapsus marmoratus*** [27]
- **Range:** on Mediterranean rocky shores. In a non-tidal sea like the Mediterranean it lives in the splash zone, stays on emerged rock and seldom enters the sea; it feeds on algae through the day and night [27].
- **Behaviour:** it scuttles sideways over the splash rock, stops, grazes the algae film, and slips into a crack when a shadow passes. It waves a claw.
- **Illustrator:** a square, flat carapace about 3–4 cm, **marbled** dark olive and pale yellow (`#6a6a4a`, `#c9b87a`), with a few pale lines and red-brown legs. Tiny.
- **Read:** a dark marbled square with claws on a pale rock.

**12. Common octopus — *Octopus vulgaris*** [28]
- **Range:** shallow rocky seabeds of the Mediterranean. It hunts crabs, bivalves and gastropods, and makes a den in a crevice, often piling shells at the entrance [28].
- **Behaviour:**
  - Rare, a short appearance: an octopus in the rock pool or the shallows, on the stones, the colour of the stones. It changes colour and texture, ripples its way across, and goes into a hole [28].
  - A pile of crab shells at a hole is the clue. It may be seen by day [28].
- **Illustrator:** a rounded head, eight soft arms, a horizontal pupil, in stone-brown, grey and sand (`#8a7a68`, `#b3a58a`), with pale mottles that shift. Paint it as a wash that matches the rock and lifts when it moves.
- **Never** show it caught, hung or dried.

**13. Damselfish — *Chromis chromis*** *(verify)*
- **Behaviour:** a loose shoal of 8–15 small fish hovers over the rocks and seagrass edge. It turns as one, drops toward the bottom when a shadow passes. Calm.
- **Illustrator:** adults are dark brown-grey with a forked tail (`#6a6a60`). **Juveniles are bright electric blue** (`#3f78b8`), the loveliest. Choose juvenile blue for the shoal; it reads in the turquoise water. Tiny fish: a stroke and a fork.
- **Alternative:** a saddled seabream (*Oblada melanura*) shoal if a plainer fish is wanted.

**14. Scopoli's shearwater — *Calonectris diomedea*** [5]
- **Range:** Strofades, south of Zakynthos, has the largest colony in the eastern Mediterranean, about 17,000–18,000 birds visiting before laying [5]. It nests in burrows and crevices on remote islands [5]. They are seen at sea.
- **Behaviour:** a few brown-and-white birds glide in the evening, wings stiff, **the wingtip nearly touching the waves**, never flapping much, far out in the bay. Quiet; no scenery.
- **Illustrator:** a long, narrow-winged bird, 45 cm, brown above (`#6a5a4a`) and white below, with a pale yellow bill. A dash and a tilt.
- **Rare.** An evening bird: dusk is its time.

**15. Loggerhead turtle (optional legend)** — *Caretta caretta* *(verify)*
- **Range:** the Ionian is the main Greek nesting region (Zakynthos, Kefalonia, the Peloponnese west coast) *(verify)*.
- **Behaviour:** a head surfaces in the far turquoise water, breathes, and goes under. A shell flashes. A single appearance.
- **Rarity:** the legend tier at 25 plants, with the dolphins at 20. The nesting beaches are protected and not for decoration: **do not show a nest or a hatching** in the pebble beach.

### Shared creatures

| Creature (kind, variant) | Share? | Why |
|---|---|---|
| Bees (`bee`) | **yes** | The honeybee is native across Greece; the islands are known for thyme honey *(verify)* |
| Butterflies, swallowtail (`butterfly/swallowtail`) | **yes** | *Papilio machaon* and the scarce swallowtail (*Iphiclides podalirius*) both fly in Greece *(verify)*; the sprite fits either |
| Butterflies, white (`butterfly/white`) | **yes** | The small white and the cabbage white are common in Greek gardens |
| Swallows (`swallow`) | **yes** | The barn swallow nests in Greek villages and boathouses, and the red-rumped swallow too *(verify)* |
| Hoopoe (`hoopoe`, from the oasis) | **yes** | A summer visitor across Greece in olive groves and orchards *(verify)* |
| Gecko (`gecko`) | **yes, new variant** | The oasis sprite is Böhme's gecko. In Greece the wall gecko is the Mediterranean house gecko (*Hemidactylus turcicus*) *(verify)*, a similar shape in a paler, pinker colour; use a variant, and a Greek name on the card |
| Heron (`heron`) | **yes, rare** | The grey heron fishes along Greek shores and lagoons *(verify)*; keep it rare, a rock-edge visitor |
| Falling leaf (`leaf`) | **no** | Olive and pine are evergreen and do not drop single leaves onto water the way a maple does |
| Violet dropwing (`dropwing`) | **no** | It needs fresh water; the scene has none (a terrace cistern is not a pond) |
| Laughing dove, house bunting, bee-eater (persicus), stork, Sahara frog | **no** | Saharan or not Greek; the Greek bee-eater (*Merops apiaster*) is a different, chestnut and yellow bird (a look-alike, not a share) |
| Strider, koi, frog, dragonflies (aka, ochre), firefly, all the Japanese stream animals, bird (wagtail, sparrow) | **no** | Fresh-water or Japanese (§4 of the oasis research) |

**Eleonora's falcon — dropped.** The owner suggested it. It is the great Greek raptor (over 80 % of
the world population breeds on Greek islands; about 13,000 pairs in Greece in the 2024 census, most
in the southern Aegean) and it breeds late, from late July to October, on sea cliffs, feeding on
migrating songbirds [29]. But in the **Ionian** there are only five known colonies against 302 in the
Aegean [30]. It does not fit the Ionian; it is the best rare raptor for a **Cycladic or Aegean**
variant. If the owner wants a falcon, offer it as a legend tier (25 plants, rare, on the far cliff in
autumn). Otherwise the shearwater is the Ionian's rare sea bird.

---

## 4. Shared plants

**Rule:** a species is shared only where it really grows wild in Greece, or is really planted in a
Greek garden, in the form the sprite shows.

### Existing plants offered in the coast too

| Species | Share? | Why |
|---|---|---|
| **Caper** | **yes** | Grows wild on walls, old towers and sea cliffs all round the Mediterranean, Greece included. The oasis research said the same (its §4). Tier 1, `rock`: wall top, wall crack, splash rock. Its range already has `mediterranean` |
| **Oleander** | **yes** | The native shrub of Greek stream-beds and, planted, of coastal gardens and beaches. Tier 3 large. Range already has `mediterranean`. In this scene: the beach back (`shore`) and terrace edge. Toxic: facts only |
| **Grapevine** | **yes** | The sprite is a cultivated grapevine; vines on pergolas are everywhere in Greek gardens. Needs its `cultivatedIn` to add `mediterranean` *(it has only `n-africa-arabia` today)* |
| **Pomegranate** | **yes** | An old Greek garden tree and a Greek symbol. Add `mediterranean` to `cultivatedIn`. A second, smaller T4 at the terrace |
| **Southern maidenhair** | **yes** | *Adiantum capillus-veneris* grows on wet rock, wells and cisterns across the Mediterranean, including Greece [31]. A good plant for the wall's cistern or a seep; range already has `mediterranean` |
| **Spearmint** | **maybe, lean no** | A Greek kitchen herb, but its lilac spike is too close to the lavender (§6). Offer it only if lavender is dropped |
| **Jujube** | **no** | The sprite may be *Z. lotus* (Saharan); the Greek jujube (*Z. jujuba*) is a different, cultivated tree *(verify the sprite)* |
| **Retama** | **no** | *Retama raetam* is a Saharan and Levant broom, not Greek |
| **Date palm** | **no** | Date palms are planted ornamentals in Greece and Crete's wild palm is another species (*Phoenix theophrasti*, Vai). The sprite is the oasis crop palm; not Greek enough. A planted palm is an alternate |
| **Damask rose, alfalfa, barley, henna, colocynth, cattail, desert hyacinth** | **no** | Saharan or crop plants with no place on a Greek terrace. (Cattail grows in Greek freshwater marshes, not on a sea cove.) |
| **White clover, dandelion** | **no** | Native to Greece, but both grow in cool damp grass; the sprite does not fit a dry gravel terrace *(a path-edge lawn would be a stretch)* |
| **Violet, wild strawberry, forget-me-not** | **no** | Cool wet woods and meadows; not a dry coast |
| **Chrysanthemum, anemone, cosmos, tree peony, camellia, hydrangea, azalea, plum, cherry, maple, ginkgo, wisteria** | **no** | Japanese garden plants; none grows in Greece in the form of the sprite |
| **Black pine** | **no** | The Japanese black pine; Aleppo pine replaces it (§2) |
| **Lotus, water lily, white water lily, the 12 waterfall plants** | **no** | Fresh water and Japanese mountains |

**Total:** 16 own + caper, oleander, grapevine, pomegranate, southern maidenhair = **21**, or 22 with
spearmint.

### Coast species a later scenery could offer

| Species | Where | Why |
|---|---|---|
| Olive, lavender, cypress, ice plant | an Italian or Provencal garden (`mediterranean` realm) | Old Mediterranean garden plants; `cultivatedIn: ['mediterranean']` |
| Rock samphire, sea holly, sea daffodil | a Mediterranean or Atlantic dune and cliff scenery | Native to many European coasts |
| Aleppo pine, rock rose, tree spurge, Jerusalem sage | a Spanish, Provencal or Levantine coast | Western and eastern Mediterranean scrub |
| Posidonia, Cystoseira, peacock's tail | any Mediterranean sea scenery | The sea edge is shared by all |

---

## 5. Habitat taxonomy: the Greek coast row

Proposed row for the scenery table (the oasis research §5):

| # | Scenery | Realm · biome · climate | Signature plants | Signature fauna | Shares (biology) |
|---|---|---|---|---|---|
| 4 | **Ionian clifftop terrace and cove** | mediterranean · coast, scrub, garden, marine · mediterranean (new), **cultivated** | olive, Aleppo pine, cypress, lavender, ice plant, sea daffodil, Posidonia, tree spurge, rock rose | island cat, Hermann's tortoise, goats, dolphins, blue rock thrush, Scops owl, shearwater | caper, oleander, grapevine, pomegranate, southern maidenhair; bees, swallowtail, cabbage white, swallow, hoopoe, gecko (variant), heron |

**Flora profile:** `{ realm: 'mediterranean', biomes: ['coast', 'scrub', 'garden', 'marine'], climate: 'mediterranean', cultivated: true }`.

Tag changes (`src/plants/biomes.ts`, one line each, as in docs/systems/scenery.md › Flora):
- **New climate `mediterranean`** (hot dry summers, mild wet winters). The oasis research already
  flagged this gap.
- **New biome `scrub`** for maquis and phrygana. `heath` is moor, and does not fit.
- **New biome `marine`** for seagrass beds, rock pools and algae. `coast` stays for cliffs, dunes and
  shingle.
- **Existing shared species** must add the new tags: the caper (`coast`, `scrub`, climate
  `mediterranean`), oleander, southern maidenhair, grapevine and pomegranate (`cultivatedIn`).

**Habitat words for the planting sheet** (`habitatWords`), as a suggestion for G1:

| Habitat | Coast words | Where in the scene |
|---|---|---|
| `water` | in the shallows | the rock pool and the cove's shallows |
| `shore` | on the beach | the pebble beach, shingle and sand |
| `meadow` | in the terrace beds | the beds behind the walls |
| `path` | along the path | gravel path edges |
| `back` | in the scrub | the cliff top and the maquis |
| `rock` | on the walls and rocks | wall tops and cracks, splash rocks, cliff ledges |

**For G1 (slots):**
- A shallow water slot set needs **large** slots (Posidonia) and **small or medium** slots (peacock's
  tail, cystoseira). The oasis had no large water slots; the waterfall had 2.
- Splash rocks and the rock pool need small and medium slots at the water line; the ledge scale
  rules (0.64–0.72) apply to the cliff.
- The ice plant must not be offered on cliff or beach slots: give the terrace wall tops their own
  slots, or accept that `rock` includes the splash rocks (§6).
- Tree slots: the olive (terrace) and the pine (cliff top) are the two obvious ones. The cypress is
  `large`, in a tall box.

**Fauna habitat data** (`SceneryFauna`): perches on wall copings, the chapel dome, the caique's mast,
the olive's branches and cliff tips; **stands** for the heron on the cove's rocks; **ground** for the
tortoise and lizard on the terrace and scrub; **water** the cove (still, with a wave line); a far
**sea band** for the dolphins and the shearwater. The caique is a prop, not a creature.

---

## 6. Pitfalls

**Region and look**
- **Cyclades or Ionian.** The brief mixes both. The blue-domed chapel is a Cycladic motif (Oia on
  Santorini is the picture) [6]; Ionian villages are Venetian and pastel (Corfu, Assos on Kefalonia) [6].
  Decide: keep the blue dome as the one Cycladic nod (a small white chapel with a blue dome is also a
  common Greek roadside shrine), or switch the chapel to a white campanile with terracotta tiles. The
  dome is the owner's reference, so it stays unless the owner says otherwise.
- **The postcard cliché.** Santorini blue-and-white, a donkey, a windmill, a tourist group, sunbeds,
  umbrellas, a taverna table. None of these. The scene is a private garden above a quiet cove.
- **No people, no flags, no named real church or beach.** A chapel is a living place of worship.
  Paint it as a place, with a plain cross.
- **The ancient columns.** Greek antiquities are protected and carry meaning.
  - Paint a few fallen drums and one or two standing columns, weathered, with grass and a lizard on
    them, **not** a copy of a known temple (the Parthenon, Sounion).
  - Choose a plain Doric (no capital detail) or Ionic by one rule and stay with it.
  - Creatures sit on them naturally (cat, lizard, thrush). No creature "plays" on them.
- **Cypress.** In Greece it is strongly linked to cemeteries and churchyards. As a single spire by a
  chapel it is true and pretty, but it can read as mourning. Owner decision.

**Botanical**
- **The ice plant is a South African plant.** The owner's photo mats are *Lampranthus* or
  *Carpobrotus* type. They are very common in Greek coastal gardens [8].
  - ***Carpobrotus edulis* is an established invasive in Greece**, including Crete and the Aegean
    islands, spreading onto cliffs, rocks and coastal habitats and outcompeting natives [8]. It is
    not on the EU list of invasive species of Union concern, though many European countries prohibit
    its release into natural areas [8]. I found no Greek records of *Lampranthus* itself *(verify)*.
  - **Treatment:** paint the **daisy-flowered *Lampranthus* look** (narrow leaves, many-petalled
    shiny flowers), not *Carpobrotus*; give it a `cultivatedIn` only, so it counts as a planted
    terrace plant; the Note says it is South African and kept in the terrace and on the wall tops;
    never place it on the cliff, the beach or a splash rock.
  - **Native look-alike?** No Greek native makes a bright magenta succulent carpet. *Mesembryanthemum
    nodiflorum* is a small native with tiny pale flowers *(verify)*. The nearest native colour is
    the **pink rock rose** and the **cyclamen**, and for a mat on a wall, the **sea lavender** and
    **rock samphire**. They do not give the owner's photo. Recommendation: keep the ice plant as a
    cultivated terrace plant, honestly labelled, and let the rock rose and cyclamen carry the same
    magenta in the wild part. If the owner wants no alien at all, drop it and use the rock rose as the
    pink mat (low, many flowers).
- **Other aliens to keep out:** *Agave*, prickly pear (*Opuntia*) and the Canary Island date palm are
  American or Canarian and appear all over Greek coasts, but they are not Greek plants; they are
  invasive in places. *Bougainvillea* (South American) is **the** Cycladic wall cliché, magenta and
  cheerful, and the owner's magenta may have been bougainvillea. It is cultivated and harmless
  (it is not invasive in Greece), so it is an alternate (a T3 wall or pergola climber, `cultivatedIn:
  ['mediterranean']`), not a recommended species, as it would compete with the ice plant. Eucalyptus,
  *Acacia* and *Washingtonia* are introductions.
- **The Italian stone pine** (*Pinus pinea*), the flat umbrella, is a Roman cliché. The Greek coast
  pine is the Aleppo, ragged and open. East of the Ionian it is *P. brutia* [1].
- **Wrong region:** *Retama raetam* (Saharan), date palm, tamarisk as a Greek signature, and olive
  trees in the shape of Tuscan groves in rows. Keep the olive a single gnarled tree.
- **Posidonia and anchors.** Boat anchors are the main pressure on Greek Posidonia meadows [16].
  The caique rides on a mooring line to the rock, or sits in the sand-bottom shallows, never at
  anchor over the meadow. A subtle good detail: an eco-mooring buoy.
- **Protected and edible plants.**
  - The sea daffodil is protected in Greece and declining where beaches are developed [12].
  - Rock samphire is pickled in Greece [10]. Notes may say so as a fact, but no line says "pick it".
  - Euphorbia latex irritates, and oleander is poisonous: facts only, no suggestion to touch or taste.
- **Algae are not plants.** *Padina* and *Cystoseira* are brown algae. The Notes must say so ("an
  alga, not a plant"). The game's "plant" word is a loose label. Owner decision: ship them or keep
  only Posidonia and a green alga for the sea edge.
- **Seasons are compressed.** The cyclamen (autumn), the rock rose (spring), the lavender (summer)
  and the sea daffodil (late summer) flower together, a gentle cheat, as at the waterfall. The tree
  spurge's leaf loss is summer; paint it only in the late growth stage.

**Animals**
- **Cats.** Island cats are a welfare issue: many are unowned, and the winter is hard [21]. Paint
  them well-fed and relaxed, one with a clipped ear tip. No kittens in peril, no feeding scene, no
  cat catching a bird or a lizard on screen. The Note is kind and factual.
- **The tortoise** is a protected species and a Hermann's, not a marginated, nor a spur-thighed
  (*T. graeca*) one; the cards must say which [2][3][22]. Never handled, caged or on a road.
- **Dolphins.** Wild and far. No jumping show, no boat chase, no tourist boat. The common dolphin is
  in decline around Kalamos [4], and the Note may say so in one line.
- **The Eleonora's falcon is not Ionian** (§3). Do not paint it in an Ionian scene unless the
  region changes [30].
- **Octopus.** The Greek image of a drying octopus on a line is a tourist cliché: never.
- **Loggerhead nesting beaches are protected.** No nest, no hatchlings, no beach lights.
- **Goats are herded, not wild.** Do not call them "wild goats", and keep them off the near terrace.
- **A thrush is not a bluebird.** The blue rock thrush is blue-grey and shy; do not tint it turquoise.

**Too similar (blurs within the coast set or against the other gardens)**

| Pair | Keep them apart by |
|---|---|
| Lavender vs sea lavender vs spearmint (violet and lilac, spikes or froth) | straight violet spikes over a grey-green dome (lavender) vs a branched pale lilac froth on bare stems over a flat rosette, on rock (sea lavender) vs lilac spikes on leafy stems (mint, not offered by default) |
| Ice plant vs rock rose vs Damask rose and tree peony (magenta and pink) | a flat mat of narrow leaves with many-petalled shiny daisies (ice plant) vs a grey shrub with crinkled five-petal papery flowers with a yellow boss (rock rose) vs double cups (the roses) |
| Aleppo pine vs black pine | light, airy, ragged, long soft needles, leaning over the cliff vs dark dense pads of stiff needles. The black pine is not offered here |
| Olive vs weeping cherry, plum, Japanese maple | silver crown and a twisted trunk, no bright flowers, vs the Japanese trees |
| Sea daffodil vs spider lily | white broad trumpet with a toothed cup on sand vs red, narrow, curled stamens. The spider lily is not offered here |
| Jerusalem sage vs yamabuki | grey felt leaves and tiered hooded yellow whorls vs green leaves with flat five-petal cups. The yamabuki is not offered here |
| Tree spurge vs oleander | a lime-yellow dome of forked stems vs knife leaves and pink pinwheels |
| Posidonia vs cattail and susuki | wholly under water, broad ribbons, bright green vs above-water straps. Not offered here |
| Peacock's tail vs lily pads | a banded olive-brown fan standing on rock under the water vs a round green pad on the surface |
| Island cat vs any garden animal | a loaf on a wall with an ear tip |
| Goats vs the far cliff scenery | seen as dark and pale flecks on a ledge |
| Blue rock thrush vs the sparrow and wagtail | slate-blue, upright, long bill; not offered together |
| Scops owl vs night shapes | camouflaged on bark, yellow eyes, two ear tufts |

---

## Sound notes (for a later sound bed)

The `coast` profile is reserved in `docs/systems/audio.md` (waves, leaves, birds, rain). Suggested ids for
the sound bed to listen for (as the oasis uses `oasis:<id>`): `cat`, `cicada`, `scops-owl`, `goats`, `gull`.

| Sound | When | Notes |
|---|---|---|
| **Waves on pebbles** | always, the base layer | Greek pebble beaches give a long wash and a rattle as the stones roll back; a gentle, non-tidal swell (the Mediterranean has almost no tide). Scale volume by the wave motion. A quiet distant version over the cove; a nearer one on the beach |
| **Cicadas** | day, June–September, louder in the hot hours | The chorus is loudest in pinewood, and less in olive groves and scrub [24]. It starts when the heat is up and stops at dusk. Make it a slow swell, not a constant roar, and keep it low under focus sessions |
| **Scops owl** | night only | A short, deep, whistled "tiu" every few seconds, for long stretches [26]. No hooting |
| **Goat bells** | day, very far | One or two bell clanks, irregular, from the far ledge. Pairs with the goats' appearances, never constant |
| **A boat's ropes** | day, quiet | The creak of a mooring line and a faint knock of the hull on the water or a fender; a thin halyard tap on the caique's mast in wind. Under the waves, low |
| **Gull** | day, rare | A single call now and then; never a flock |
| **Blue rock thrush** | day, morning and evening | A slow fluting song of short phrases [25] |
| **Swallows** | day | Small twitters, brief |
| **Wind in pine** | any, windy | A soft hiss in the Aleppo pine; a light layer |
| **Crickets** | dusk and night | After the cicadas stop, a low evening chorus |
| **Church bell** | optional, rare | A single distant bell from the village at the hour. Optional and respectful: it is a sound of a living church; decide with the owner |

Real recordings for reference: free and licensed Greek and Mediterranean gravel-beach waves exist
(Greece and Italy packs, Corfu beaches, a Greek rural night shoreline), but none found with goat bells
or boat ropes together [32]. Record or synthesise them separately.

---

## Decisions for the owner

1. **Region:** Ionian (recommended) or Cycladic. The tortoise, pine, dolphins and shearwater are
   Ionian; the blue dome is Cycladic.
2. **The blue-domed chapel** (a Cycladic motif) in an Ionian scene: keep as the single nod, or use a
   terracotta-roofed white campanile.
3. **The ice plant:** keep as a labelled cultivated terrace plant (*Lampranthus* look, never
   *Carpobrotus*), or replace it with the native rock rose as the pink mat.
4. **Cypress:** a chapel spire (true to Greece, but a cemetery tree) or leave out.
5. **Algae as plants:** ship peacock's tail and cystoseira (labelled as algae), or keep the sea edge to
   Posidonia plus one more seagrass or green alga (*Cymodocea*, *Ulva*).
6. **Dolphin species:** common dolphin (beautiful, rare, in decline) or bottlenose (plainer, commoner).
7. **Eleonora's falcon:** dropped for the Ionian. Keep a falcon as an optional legend or leave out.
8. **Cat:** always present (a domestic animal, welfare-sensitive), or unlocked.

---

## Sources
1. Aleppo pine and *Pinus brutia* in Greece (west and east) — EUNIS: https://eunis.eea.europa.eu/habitats/8215 ; Wikipedia ecoregion page: https://demo.azizisearch.com/lite/wikipedia/page/Aegean_and_Western_Turkey_sclerophyllous_and_mixed_forests ; RBGE (*Pinus halepensis* s.l.): https://journals.rbge.org.uk/ejb/article/download/1033/924
2. Hermann's tortoise in Greece, Ionian islands and Euboea — Greek herpetofauna: https://hellenolacerta.blogspot.com/2021/08/hermans-tortoise-testudo-hermanni-greek.html ; Fritz et al. 2005: https://iucn-tftsg.org/wp-content/uploads/file/Articles/Fritz_etal_2005b.pdf
3. Marginated tortoise in Greece (Peloponnese, island records, Milos) — IUCN TFTSG: https://iucn-tftsg.org/wp-content/uploads/file/Accounts2/crm.5.122.marginata.v1.2023.pdf ; Wikipedia: https://www.Wikipedia.org/wiki/Testudo_marginata ; Milos record (Tzoras et al. 2022): https://www.danieljablonski.com/a/soubory/Tzoras_et_al_2022_Testudo_hermanni_Milos_HN.pdf
4. Ionian Dolphin Project (common and bottlenose dolphins, decline around Kalamos) — Tethys: https://www.tethys.org/ionian-dolphin-project/idp-research/ ; https://whalesanddolphins.tethys.org/ionian-dolphin-project/idp-study-areas/ ; 2008 post: https://istitutotethys.blogspot.com/2008/06/still-13-common-dolphins-around-kalamos.html
5. Scopoli's shearwater at Strofades (about 17,000–18,000 birds, burrows and crevices) — ACAP: https://www.acap.aq/latest-news/scopoli-s-shearwaters-get-counted-on-two-islands-in-the-greek-ionian-sea ; Karris et al. 2024 (breeding at the largest Greek colony): https://www.mdpi.com/1424-2818/16/3/150
6. Greek architecture, Cyclades whitewash and blue domes versus Ionian Venetian and pastel — Culture Trip: https://theculturetrip.com/europe/greece/articles/the-secret-charm-of-the-mykonian-architecture ; Elxis: https://elxis.com/5-traditional-building-styles-in-greece ; The Mediterranean Traveller: https://www.themediterraneantraveller.com/greece-white-buildings/
7. Phrygana (Sarcopoterium, *Cistus creticus*, *Phlomis fruticosa*, thyme, spiny spurge; grazing) — EUNIS: https://eunis.eea.europa.eu/habitats/8172 ; https://eunis.eea.europa.eu/habitats/23011
8. *Carpobrotus edulis* invasive in Greece, including Crete — EPPO: https://gd.eppo.int/taxon/CBSED/distribution/GR ; EPPO, the alien flora of Greece: https://gd.eppo.int/reporting/article-2454 ; Mugnai et al. 2022 (impacts): https://flore.unifi.it/retrieve/c715c961-87bd-4faf-820b-42b5e34bc8c4/2022_Mugnai_et_al_Plants_Carpobrotus_Giglio.pdf ; Carpobrotus monograph: https://bohrium.dp.tech/paper/arxiv/813004495993700352
9. *Cyclamen hederifolium* in Greece (autumn flowering, pines, rocks, Ionian walls) — Cyclamen Society: https://www.cyclamen.org/plants/species/cyclamen-hederifolium/ ; Zakynthos field study: https://www.cyclamen.org/field-studies/cyclamen-society-field-study-zakinthos-greece-2008/ ; Kefalonia field study: https://www.cyclamen.org/field-studies/cyclamen-society-field-study-kefalonia-greece-2011/
10. Rock samphire in Greece (*krethmon*, rock crevices, Kythera, July–October, pickles) — Visit Kythera: https://visitkythera.com/rock-samphire/ ; Greek Farms portal: https://portal.greekfarms.gov.gr/en/?p=15354 ; Wikipedia: https://en.wikipedia.org/wiki/Crithmum
11. *Padina pavonica* (calcified concentric bands, rock pools, warm water) — MarLIN: https://www.marlin.ac.uk/species/detail/1423 ; Wikipedia: https://en.wikipedia.org/wiki/Padina_pavonica ; Wildlife Watch: https://wildlifewatch.org.uk/wildlife-explorer/marine/seaweeds-and-seagrass/peacocks-tail
12. Sea daffodil in Greece (Aug–Oct, beaches, protection, Greek name) — Cretan Flora: https://cretanflora.com/pancratium_maritimum_text.html ; Cretan Beaches: https://www.cretanbeaches.com/en/flora/sea-daffodil ; Wikipedia: https://www.wikipedia.com/wiki/Sea_Daffodil
13. Sea holly in Greece (dunes, shingle) — Cretan Flora: https://www.cretanflora.com/eryngium_maritimum_text.html ; Kew POWO: https://powo.science.kew.org/taxon/841903-1 ; Strandline and dune vegetation of Greece: https://research.wur.nl/en/publications/strandline-and-sand-dune-vegetation-of-coasts-of-greece-and-some-
14. *Limonium* on Greek rocky coasts (many endemics, hard to separate; *Crithmo-Limonietea*) — Scienza della Vegetazione 2017: https://scienzadellavegetazione.it/wp-content/uploads/2023/07/506.pdf
15. *Cistus creticus* (late March–June, 4–6 cm purple-pink, one-day flowers, throughout Greece) — Cretan Flora: https://www.cretanflora.com/cistus_creticus_text.html ; Mecklenburgh Square Garden: https://mecklenburghsquaregarden.org.uk/cistus-creticus-a-tough-little-plant-with-history-as-old-as-europe/
16. Posidonia in Greece (priority habitat, 1 cm a year, anchors, roots, flowers, fruits) — WWF Greece: https://www.wwf.gr/en/our_work/nature/marine/posidonia_seagrass ; To Vima: https://www.tovima.com/society/posidonia-project-enters-new-phase-to-protect-seagrass/ ; EU habitat 1120 (Greek page): https://biodiversity-info.gr/wp-content/uploads/Arxeia-Dedomena/Typoi-oikotopon/2007-2014/1120.pdf
17. *Euphorbia dendroides* (rocky coast, summer dormancy, Greek range) — EUNIS: https://eunis.eea.europa.eu/habitats/854 ; Cretan Flora: https://www.cretanflora.com/euphorbia_dendroides_text.html ; Mediterranean Garden Society: https://www.mediterraneangardensociety.org/109-bare.html
18. Tree spurge, drought-deciduous — Hellenic Communication Service: https://helleniccomserve.com/survivalofthefittest.html ; Cielo Mare Terra: https://www.cielomareterra.org/en/scheda/dendroides
19. *Phlomis fruticosa* (Greece, April–June, 1 m, yellow whorls, felted leaves) — Cretan Flora: https://www.cretanflora.com/phlomis_fruticosa_text.html ; First Nature: https://www.first-nature.com/flowers/phlomis-fruticosa.php
20. Olive tree of Vouves, Crete (twisted, hollow, 2,000–4,000 years) — Zenodo/DOAJ record: https://zenodo.org/records/6562702 ; Plants (MDPI) 2021: https://www.mdpi.com/2223-7747/10/11/2374/xml ; Argophilia: https://www.argophilia.com/news/olive-tree-vouves/221272/
21. Greek island cats (numbers, tavernas, winter hardship, sterilisation) — Britannica: https://www.britannica.com/explore/savingearth/?p=8185 ; Argophilia: https://www.argophilia.com/news/too-many-cats-too-little-care/245201/ ; Syros cats: https://syroscats.com/?p=28
22. Hermann's tortoise ecology (open maquis, olive groves and phrygana, activity, hibernation, protection) — Greek herpetofauna: https://hellenolacerta.blogspot.com/2021/08/hermans-tortoise-testudo-hermanni-greek.html ; Tortoise Trust: https://tortoisetrust.org/articles/sysherm.html ; Animal Diversity Web: https://animaldiversity.org/accounts/Testudo_hermanni
23. Phrygana as pasture, goats and sheep — EUNIS: https://eunis.eea.europa.eu/habitats/8172 ; Rangeland review: https://journals.uair.arizona.edu/index.php/jrm/article/download/7061/6673
24. *Cicada orni* (song, pine versus scrub versus olive loudness) — Scilit record, the density of *Cicada orni* in Mediterranean coastal habitats: https://www.scilit.net/publications/ea3932aeab05660741e4a69144e08486 ; Karits: https://karits.eu/?p=11018
25. Blue rock thrush (Greek village roofs, church cross, song) — Wikipedia: https://en.wikipedia.org/wiki/Blue_rock_thrush ; xeno-canto: https://www.xeno-canto.org/species/Monticola-solitarius?pg=6 ; BirdForum Opus: https://www.birdforum.net/opus/Monticola_solitarius
26. Eurasian scops owl (the "tiu" call, subspecies *cycladum*, Kefalonia recordings) — Wikipedia: https://en.wikipedia.org/wiki/Eurasian_scops_owl ; xeno-canto: https://xeno-canto.org/species/Otus-scops?pg=8 ; BirdForum Opus: https://www.birdforum.net/opus/Eurasian_Scops_Owl
27. Marbled rock crab (splash zone, feeding on algae, crevices) — Cannicci et al. 1999, *Marine Biology*: https://link.springer.com/doi/10.1007/s002270050481 ; Wikipedia: https://en.wikipedia.org/wiki/Pachygrapsus_marmoratus
28. Common octopus (dens, middens, crabs, camouflage, daytime activity in the Mediterranean) — Animal Diversity Web: https://animaldiversity.org/accounts/Octopus_vulgaris/ ; Scientia Marina (den ecology): https://scientiamarina.revistas.csic.es/index.php/scientiamarina/article/download/1545/1755/2135
29. Eleonora's falcon (Greek population, late breeding, cliffs, migrating songbirds) — Kassara et al. 2013, *Wildlife Biology*: https://bioone.org/journals/wildlife-biology/volume-19/issue-2/12-040/Factors-influencing-the-occurrence-of-Eleonoras-falcon-Falco-eleonorae-breeding/10.2981/12-040.full ; Greek Reporter (2024 census, 13,262 pairs): https://greekreporter.com/2026/08/22/greece-records-highest-ever-count-eleonora-falcons/ ; Avocetta (Antikythira): https://avocetta.org/down/eqh ; MDPI (Northern Sporades): https://www.mdpi.com/2673-6004/5/1/6
30. Eleonora's falcon colonies, five in the Ionian and 302 in the Aegean — Kassara et al. 2013 (as above); LIFE project page: https://webgate.ec.europa.eu/life/publicWebsite/project/LIFE13-NAT-GR-000909/conservation-measures-to-assist-the-adaptation-of-falco-eleonorae-to-climate-change
31. Southern maidenhair on wet rock across the Mediterranean — see the oasis research (docs/research/oasis-biome.md, source list); not re-checked for Greece *(verify)*.
32. Pebble-beach and Greek seashore recordings — Stormwave Audio Mediterranean pack: https://stormwave-audio.itch.io/mediterranean-sea-ambience-pack ; free Greek seashore recording: https://medium.com/shapingwaves/wave-sounds-abea154670b6 ; Pebble beach soundscape, Cyprus: https://www.audible.co.uk/podcast/A-Pebble-Beach-SoundScape-Cyprus/B0CKRHYY9H
