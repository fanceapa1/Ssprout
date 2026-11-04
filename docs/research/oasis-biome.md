# O0 — Oasis biome research

Read-only research for phase 13. Sources are listed at the end and cited as [n]. Facts marked
*(verify)* came from memory and were not confirmed during this task.

**What the repo already has:**
- Draft A, "Ksar & palmeraie" (devlog 102), is the chosen scene. It has a red-ochre bluff with a
  ksar close behind on the left, terraces held by pisé walls, a seguia that falls over each wall
  into a big stone basin, four big palms on the right, and an oued that bends in from the right edge
  around a sand bar. Dunes and lilac ranges show beyond.
- It has 25 draft slots (`src/scenery/oasis/drafts/a/layout.ts` › `SLOTS`):
  - upper and middle terraces (5);
  - basin terrace (1 tree, 1 large);
  - basin rim (4);
  - between the basin and the oued (1);
  - foreground (7);
  - oued banks (4, one large);
  - shallows (1) and the sand bar (1).
  They carry no habitats yet (O1). There are **no rock slots** and **no large water slots**.
- Species have `range` (ADR 0250). The oasis is the first scenery in the `n-africa-arabia` realm,
  and no existing species has that realm.
- The texts follow the B0 brief:
  - `description` is the poetic Line, under 80 characters.
  - `notes/<id>.ts` holds the Note: two or three plain sentences.

  Here the Notes are about the plant's place in the oasis, not in Japan.

---

## 1. Region

**Confirmed: a tended palm grove (palmeraie) of the pre-Saharan valleys of south-eastern Morocco.**

| Valley | Palmeraies | What it adds |
|---|---|---|
| **Draa** | From Agdz to M'Hamid: six oases strung along about 200 km of river (Mezguita, Tinzouline, Ternata, Fezouata, Ktaoua, M'Hamid) [47]; about 2 million palms [1][2] | The scene itself: ksour on bluffs over the river, terraced plots, henna fields near Zagora [1][16] |
| **Dadès** | Skoura (near Ouarzazate), the Dadès and M'Goun valleys | Kasbahs in the palms, the Damask rose hedges of Kelaat M'Gouna [12] |
| **Ziz / Todgha** | The Tafilalt (Erfoud, Rissani), Tinghir on the Todgha | The origin of the Mejhoul date [13] |

The painted scene reads as the middle Draa around Agdz–Tamnougalt. A red bluff carries a ksar over
the palms, the seguia fills a basin, and dunes lie downstream.

**The three storeys.** A palmeraie is farmed in three layers [3][4]:
1. **Top:** date palms. They shade everything below and cut the wind and the heat. Together the
   three layers make the "oasis effect", a cooler and more humid microclimate [3].
2. **Middle:** fruit trees. In the Moroccan oases the middle storey is mostly olive, with
   pomegranate, fig, almond, apricot and vine where water allows [4].
3. **Ground:** barley, wheat, alfalfa, broad beans, vegetables, herbs and henna. They are grown on
   small walled plots that each fill with water in turn [3][4].

Downstream, where water is scarce, the middle storey disappears first [5].

**Water.** It is shared by time: each family's plot gets the seguia for its turn. A grove is not a
wild place. Every palm has an owner, sometimes a different owner from the land under it *(verify)*.

**Disease.** The palms have suffered from **bayoud**, a soil fungus (*Fusarium oxysporum*
f. sp. *albedinis*) first seen in the Draa about 1870. Over a century it killed about two-thirds of
Morocco's palms, some 12 million trees [6]. Drought has thinned the groves further [7].

---

## 2. Twelve oasis plants

Hex values are watercolour mixes kept under the ART_DIRECTION chroma ceilings (OKLab < 0.135 for
plant colours, < 0.17 for the scarlet accent). The owner wants a golden, sandy feel, so the set
leans on gold, straw and ochre, with pink, scarlet and lilac as the flowers.

**Native names.** Each card gives a Darija name (Moroccan Arabic, BCP 47 `ary`) and, where known,
an Amazigh name (Tashelhit `shi` or Central Atlas Tamazight `tzm`). The middle Draa speaks both.
Suggestion for `nativeName`: the Darija name with `nativeLang: 'ary-Latn'`. It is the most widely
understood name, and the Amazigh name can go in the Note. Transliterations are simplified.

**Ranges.** The flora profile proposed in §5 is
`{ realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true }`.
- A wild species gets `realms: ['n-africa-arabia'], biomes: [...], climates: ['arid']`.
- A crop or garden plant gets `cultivatedIn: ['n-africa-arabia']`, with empty or real wild lists.

### 1. Spearmint — *Mentha spicata* — naʿnaʿ (نعناع)
- **Range:** cultivated: `{ realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia', 'mediterranean'] }`. It is a cultigen of uncertain wild origin *(verify)*.
- **Habitat and slot:** beds at the edge of the plots and along the seguia, in damp soil. Every oasis garden keeps some for tea. Shore (basin rim, seguia lip), path.
- **Tier and size:** 1, small. Pollinators: yes.
- **Bloom:** lilac, July–September. bloomColor `#b9a0c8`.
- **Illustrator:**
  - **Stems and leaves:** an upright clump of square stems. Opposite, lance-shaped, wrinkled, toothed leaves, the freshest green in the scene (`#86a75a`, shade `#5f7d45`). It should look cool and wet against the gold.
  - **Flowers:** slender tapering spikes at the stem tips, built of whorls of tiny lilac flowers (`#b9a0c8`, pale `#d6c6dc`).
  - **Small size:** a bright green tuft with a few lilac candles.
  - **Unmistakable:** paired, wrinkled leaves and tapering spikes. The alfalfa's lilac comes in short, rounded clusters over leaves of three.
- **Note:** Every oasis garden keeps a bed of mint by the water channel. Moroccan tea is green tea brewed with a fistful of fresh spearmint and sugar, and it is poured from high above the glass to raise a foam.
- **Line:** "Spearmint — a fistful for the teapot, picked at the channel's lip."

### 2. Alfalfa — *Medicago sativa* — fessa (فصة)
- **Range:** cultivated: `cultivatedIn: ['n-africa-arabia', 'mediterranean']`.
- **Habitat and slot:** the ground storey [4]. It is sown in the plots under the palms and cut many times a year for the animals. Meadow (plots), path.
- **Tier and size:** 1, small. Pollinators: yes (bees).
- **Bloom:** violet, April–October. bloomColor `#8f6fb3`.
- **Illustrator:**
  - **Shape:** a low, dense mound of fine stems.
  - **Leaves:** small leaves of three narrow leaflets, toothed only at the tip, blue-green (`#8aa65e`).
  - **Flowers:** short, compact clusters of tiny pea flowers, violet (`#8f6fb3`) to lilac (`#b39ccc`). Older clusters go bluish.
  - **Close view:** the seed pods are coiled like tiny snail shells (`#a8a06a`). They are a good detail.
  - **Small size:** a soft blue-green cushion with violet dots.
  - **Unmistakable:** violet clusters over leaves of three. White clover (round white pompons) is not offered here.
- **Note:** Alfalfa is the oasis's lowest storey. It is sown under the palms and cut again and again through the year to feed the household's animals, and its roots feed the soil with nitrogen. Its Darija name, fessa, and the English word alfalfa, which came through Spanish, both go back to the Arabic al-faṣfaṣa [37].
- **Line:** "Alfalfa — the lowest storey, cut and cut again, and still in flower."

### 3. Caper — *Capparis spinosa* — kebbar (كبار)
- **Range:** wild: `{ realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert'], climates: ['arid'], cultivatedIn: ['mediterranean'] }`.
- **Habitat and slot:** rocky and clayey slopes, rocks, wadi banks and **old walls** in Morocco [8][9]. Rock (wall copings, the bluff's talus), path.
- **Tier and size:** 1, small. Pollinators: yes (bees, hawkmoths).
- **Bloom:** white with violet stamens, May–August. bloomColor `#f4ece6`.
- **Illustrator:**
  - **Stems and leaves:** arching, trailing stems that hang down the wall. Round, fleshy, blue-grey-green leaves (`#8ea47a`, glaucous), with a pair of tiny hooked spines at each leaf base.
  - **Flowers:** 5–7 cm across. Four crinkled white petals (`#f4ece6`), the upper two often flushed pink (`#e8c4cc`). From the centre bursts a fountain of long violet-pink stamens (`#a35a8c`) tipped gold.
  - **Buds:** small green balls (`#8a9a52`). These are the capers.
  - **Small size:** a cascade of round grey-green leaves with one white starburst.
  - **Unmistakable:** the stamen fountain. Nothing else in the set is a pom of threads.
- **Note:** The capers in a jar are its unopened flower buds. It roots in the cracks of rock and old walls, and each flower lasts only about a day [38].
- **Line:** "Caper — a flower for a single day, on the crumbling wall."

### 4. Colocynth — *Citrullus colocynthis* — lḥdej (الحدج); Arabic ḥanẓal
- **Range:** wild: `{ realms: ['n-africa-arabia'], biomes: ['desert'], climates: ['arid'] }`.
- **Habitat and slot:** sandy and gravelly ground, oued beds and field margins. It is common throughout the Sahara, Morocco included [10][11]. Path (sand), rock (gravel, the talus).
- **Tier and size:** 1, small. Pollinators: yes (bees).
- **Bloom:** pale yellow, April–July [11]. The fruit lasts all year. bloomColor `#e8c75a`.
- **Illustrator:**
  - **Vine:** it lies flat. Rough trailing stems radiate over the sand, with deeply lobed, watermelon-like leaves, grey-green (`#93a067`).
  - **Flowers:** small, solitary, five-lobed, pale yellow (`#e8c75a`).
  - **Fruit:** the star. Orange-sized balls, green mottled and striped with pale yellow (`#7f9a52` over `#e3d38a`), ripening to straw-gold (`#e6c766`). Growth: the vine first, then flowers, then 1–3 balls.
  - **Small size:** a green star of runners with gold balls lying on the sand.
  - **Unmistakable:** balls on the sand and no upright stem.
- **Note:** Colocynth looks like a small wild watermelon, its cousin, but its pulp is fiercely bitter and poisonous. The dry gourds lie on the sand long after the vine has withered, and in Morocco they were packed with woollens to keep the moths away [10].
- **Line:** "Colocynth — small gold moons on the sand, bitter to the core."

### 5. Southern cattail — *Typha domingensis* — berdi (بردي) *(verify the Darija)*
- **Range:** wild: `{ realms: ['n-africa-arabia', 'mediterranean'], biomes: ['wetland'], climates: ['arid', 'warm-temperate'] }`. It is near-cosmopolitan in warm regions, so add other realms only when a scenery needs them.
- **Habitat and slot:** emergent plants are scarce in Saharan riverbeds but grow along irrigation channels and around oases, mostly *Phragmites* with *Typha* [14]. Water (shallows, the basin's overflow corner), shore.
- **Tier and size:** 2, medium. Water plant. Pollinators: no (wind).
- **Bloom:** brown spike, June–August. bloomColor `#8a5a3a`.
- **Illustrator:**
  - **Leaves:** tall, flat, slightly twisted straps, grey-green (`#9aa86a`) going straw at the tips (`#d8c38a`). This gives the golden feel even at the water.
  - **Spike:** a brown velvet cigar (`#8a5a3a`, shade `#6a4430`). Above it, after a small **bare gap**, a thin pale male spike (`#c9b07a`). The gap is usually there in this species, though it is sometimes almost closed [39]. Paint it: it makes the cigar read as a cattail, not a sausage on a stick.
  - **Late season:** the cigar breaks into a soft halo of fluff, as a lifted, dry-brushed edge.
  - **Small size:** a sheaf of blades with a brown cigar.
  - **Unmistakable:** the cigar. Barley has whiskered ears and no velvet.
- **Note:** Cattail grows where water stands still: the basin's overflow, the seguia's quiet corners and the oued's shallows. Its long leaves have long been woven into mats and baskets, and in late summer the brown heads burst into fluff *(verify the local use)*.
- **Line:** "Cattail — brown velvet candles where the basin spills over."

### 6. Barley — *Hordeum vulgare* — shʿir (شعير); Tamazight timẓin
- **Range:** cultivated: `cultivatedIn: ['n-africa-arabia', 'mediterranean']`.
- **Habitat and slot:** the ground storey [4]. It is sown in autumn on the plots under the palms and cut by hand in spring. Meadow (plots).
- **Tier and size:** 2, medium. Pollinators: no.
- **Bloom:** ears ripening gold, March–May. bloomColor `#e2bd62`.
- **Illustrator:**
  - **Shape:** a small stand of 5–9 stems with narrow blades (`#a6b56a`).
  - **Ears:** dense, with **long awns**. They nod a little as they ripen. Growth runs from green ears (`#a6b56a`) to gold (`#e2bd62`, shade `#b98d3e`).
  - **Awns:** paint them as fine lifted hair lines that catch the rim light at sunrise and sunset.
  - **Small size:** a tuft of golden, whiskered ears.
  - **Unmistakable:** the awns. Nothing else in the set has whiskers.
- **Note:** Barley is the oasis's first grain of the year: sown in autumn on the small plots between the palms, and cut by hand in spring before the summer heat. It is made into bread, and into belboula, a barley couscous *(verify)*.
- **Line:** "Barley — the spring's gold, cut by hand before the heat."

### 7. Desert hyacinth — *Cistanche phelypaea* — danun (ذنون) *(verify the local name)*
- **Range:** wild: `{ realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'coast'], climates: ['arid'] }`. It occurs from Macaronesia across the western and central Mediterranean to the Sahara, Morocco included [15].
- **Habitat and slot:** a root parasite, mainly of tamarisk and saltbushes [15]. It grows on sandy, often salty ground: oued banks and sand margins near tamarisk, **not** watered plots. Path (sand bank, sand bar), back.
- **Tier and size:** 2, medium. Pollinators: yes (bees).
- **Bloom:** golden yellow, March–April in Iberia [41]; spring in Morocco too *(verify the months)*. bloomColor `#e5b63c`.
- **Illustrator:**
  - **No green anywhere.** A stout, fleshy stalk rises straight out of the sand, cream to buff (`#e8d9b0`), with brownish scale leaves (`#b39a6a`).
  - **Flowers:** a dense cylindrical spike of tubular flowers, bright yellow (`#e5b63c`), the lobes paler (`#efd27a`).
  - **Growth:** the tip pushes up through the sand like asparagus. A little crack of sand rings the base. Then the spike opens from the bottom up.
  - **Small size:** a golden candle standing straight out of the sand.
  - **Unmistakable:** a golden candle with no leaves. The cattail is brown and leafy.
- **Note:** The desert hyacinth has no green leaves and is not a hyacinth at all. It is a broomrape that lives on the roots of tamarisk and saltbushes, and only its golden spike comes up through the sand in spring.
- **Line:** "Desert hyacinth — a golden candle lit from under the sand."

### 8. Henna — *Lawsonia inermis* — lḥenna (الحناء); Tashelhit anella *(verify)*
- **Range:** cultivated: `cultivatedIn: ['n-africa-arabia']`. Its wild origin is uncertain *(verify)*.
- **Habitat and slot:** irrigated plots in the hottest oases of the south-east: Zagora, Tazzarine, Foum Zguid, Alnif, and the Maïder basin, which has a geographical indication [16][17]. It is cut back two or three times a year, so it stands as low bushes in rows [18]. Meadow (plots), back.
- **Tier and size:** 2, medium. Pollinators: yes (strongly scented).
- **Bloom:** cream to pinkish, fragrant, in summer [42]. bloomColor `#f1e2bf`.
- **Illustrator:**
  - **Shape:** a small, many-stemmed, twiggy bush. Reddish-brown stems (`#8a5a44`).
  - **Leaves:** small, opposite, pointed ovals, mid green (`#8fa85a`, olive shade `#7a8a4a`).
  - **Flowers:** loose sprays at the tips of tiny four-petalled flowers with crinkled petals, cream (`#f1e2bf`), with buds flushed pink (`#e6c7b0`).
  - **Seed:** small round brown capsules.
  - **Small size:** a fresh green bush topped with a cream froth.
  - **Never paint the plant orange.** The red is in the paste, not in the leaf.
- **Note:** The dye is hidden in its green leaves: they are dried, ground to powder and mixed into a paste that stains hands and hair red-brown. Henna grows in the hottest oases of the Moroccan south, and the hotter the summer, the richer the dye [17].
- **Line:** "Henna — green leaves that keep a red secret."

### 9. Oleander — *Nerium oleander* — defla (دفلة); Tamazight ilili *(verify)*
- **Range:** wild: `{ realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'wetland'], climates: ['arid', 'warm-temperate'] }`.
- **Habitat and slot:** seasonally dry or flooded riverbeds. With *Tamarix* it forms the riparian scrub of North African wadis [14][19]. Shore (the large oued-bank slot), back.
- **Tier and size:** 3, large (shrub). Pollinators: no. Its showy flowers have no nectar: they attract insects from afar and reward them with nothing [40]. Keep bees off it.
- **Bloom:** pink, May–September. bloomColor `#d9708f`.
- **Illustrator:**
  - **Shape:** a dense, upright shrub of many stems from the base.
  - **Leaves:** long, narrow, leathery, in whorls of three, dark grey-green (`#6f7f52`) with a pale midrib. They point upward like knives.
  - **Flowers:** clusters at the branch tips of five-petalled flowers twisted like pinwheels, rose-pink (`#d9708f`, pale `#efb2c2`), with a fringed throat.
  - **Seed:** long, paired, bean-like pods in autumn.
  - **Small size:** a fountain of dark knives with pink bunches at the tips.
  - **Unmistakable:** knife leaves and pinwheels. The rose has ruffled cups on soft, arching canes.
- **Note:** Oleander lines the dry beds of oueds across North Africa, its roots reaching water that has sunk below the sand. Every part of it is poisonous, so goats leave it alone, and it often stands green and pink where everything else has been grazed bare.
- **Line:** "Oleander — pink pinwheels in the dry bed of the oued."

### 10. Damask rose — *Rosa × damascena* — lward lbeldi (الورد البلدي, "the country rose")
- **Range:** cultivated: `cultivatedIn: ['n-africa-arabia', 'mediterranean']`. It is an old hybrid with no wild range.
- **Habitat and slot:** hedges along the plots and channels of the Dadès and M'Goun valleys around Kelaat M'Gouna, next to the Draa [12]. Meadow (plot edges), back.
- **Tier and size:** 3, large (a stretch of hedge). Pollinators: yes.
- **Bloom:** pink, late April–May, for about three weeks [12]. bloomColor `#e2899b`.
- **Illustrator:**
  - **Canes:** arching, thorny, grey-brown (`#7b6a4a`), with reddish young shoots.
  - **Leaves:** 5–7 soft, greyish-green leaflets (`#8ea064`).
  - **Flowers:** loose, semi-double cups of many ruffled petals in clusters of 3–5. Warm pink (`#e2899b`) with paler edges (`#f2c0c8`) and a glimpse of gold stamens. Add tight buds.
  - **Small size:** a green mound sprinkled with soft pink cups.
  - **Unmistakable:** ruffled cups and leaves of many leaflets. The oleander has knives and pinwheels and a cooler pink.
- **Note:** Each May the rose hedges around Kelaat M'Gouna are picked in the early morning, before the heat, and the petals sold to distilleries for rose water and oil. The season lasts barely three weeks, and the valley celebrates it with a festival [12][43].
- **Line:** "Damask rose — picked before the heat, a valley's scent in a sack."

### 11. Pomegranate — *Punica granatum* — rremman (رمان); Tamazight aremman *(verify)*
- **Range:** cultivated: `cultivatedIn: ['n-africa-arabia', 'mediterranean']`. Wild only from Iran to the Himalaya *(verify)*.
- **Habitat and slot:** the middle storey, under the palms with olive, fig and almond [3][4]. Meadow (the large basin-terrace slot), back.
- **Tier and size:** 4, large (a small tree, like the plum blossom). Pollinators: yes.
- **Bloom:** scarlet, April–June. Fruit September–November. bloomColor `#d0503a`.
- **Illustrator:**
  - **Shape:** a small, rounded, multi-stemmed tree with twiggy, slightly spiny shoots.
  - **Leaves:** narrow and glossy (`#8aa456`). Young leaves are bronze-red in spring (`#b2664a`), and the tree turns golden yellow in autumn (`#e2bd52`).
  - **Flowers:** waxy scarlet tubes with crumpled scarlet petals bursting out (`#d0503a`).
  - **Fruit:** leathery spheres, rose-red to yellow-red (`#c45a48`, `#d99a5a`), each with **a little crown**, the dried calyx, at the end.
  - **Small size:** a rounded twiggy crown dotted with red.
  - **Unmistakable:** the crowned fruit. The plum is bare branches in blossom.
- **Note:** In the palmeraie the pomegranate is the middle storey, shaded by the palms and shading the crops below. Its fruit wears a small crown and ripens in autumn, in the same weeks as the dates.
- **Line:** "Pomegranate — little crowns ripening in the palms' shade."

### 12. Date palm — *Phoenix dactylifera* — nkhla (نخلة); Tamazight tazdayt (ⵜⴰⵣⴷⴰⵢⵜ) *(verify)*
- **Range:** cultivated: `cultivatedIn: ['n-africa-arabia']`. Its wild ancestor is uncertain, and every palm in a palmeraie is planted and tended. Add `'mediterranean'` only if a Mediterranean scenery is a planted palm grove (Elche).
- **Habitat and slot:** the top storey; also along the oued, from offshoots and seed. Meadow (the tree slot on the basin terrace), back, shore.
- **Tier and size:** 4, tree. Pollinators: no. Wind and the farmer's hand pollinate it.
- **Bloom:** dates, ripening September–November. Cream flower sprays in March–April. bloomColor `#d99a3e`.
- **Illustrator:**
  - **Trunk:** one tall trunk with a slight lean and curve, wrapped in the diamond lattice of old leaf bases (`#9a7a56`, shade `#6b5440`). Two or three offshoots at the foot show that the palm is tended.
  - **Crown:** 20–30 feather-shaped fronds. The upper ones are stiff and rising, the lower ones arch and droop. Grey-green to blue-green (`#7f9268`) with lit upper faces (`#b5b98a`).
  - **Fronds:** the leaflets are set in a V along the rib. Paint the crown as wet-in-wet masses first, then a few fronds. Draft A's palms are too inky and alike (devlog 102).
  - **Dates:** heavy clusters hang below the crown on orange stalks (`#d9883e`). They ripen from yellow (`#e5c05a`) to amber (`#c98a3e`) to brown (`#7a4a32`). In a tended grove the dead fronds are cut, so there is no brown skirt.
  - **Box:** the 380×460 tree box is tall but not tall enough for a full-grown palm. Paint a young palm, with the crown taking up the top half.
  - **Small size:** a slender stalk with a green starburst and amber clusters.
  - **Unmistakable:** nothing else is a palm.
- **Note:** Each date palm is male or female, and every spring farmers climb the female palms to tie in sprigs of male flowers by hand. New palms are grown from the offshoots at a mother palm's foot, so each keeps its variety; the famous Mejhoul date began in the Tafilalt, east of the Draa [13].
- **Line:** "Date palm — the roof of the oasis, with honey hung in its shade."

### Summary and alternates

| Tier | Plants |
|---|---|
| 1 | spearmint, alfalfa, caper, colocynth |
| 2 | cattail, barley, desert hyacinth, henna |
| 3 | oleander, Damask rose |
| 4 | pomegranate (large), date palm (tree) |

- **Habitats:**
  - **Water or shore:** cattail (water), spearmint and oleander (shore), date palm (shore).
  - **Rock or path:** caper (rock), colocynth (rock, path), desert hyacinth and spearmint (path).
  - **Meadow (plots):** alfalfa, barley, henna, rose, pomegranate, palm.
- **Wild or cultivated:** the wild flora is colocynth, caper, desert hyacinth, cattail and oleander. The oasis garden is mint, alfalfa, barley, henna, rose, pomegranate and the date palm.
- **Colours:**
  - **Gold:** barley, colocynth, desert hyacinth, dates.
  - **Pink:** oleander, rose.
  - **Scarlet:** pomegranate.
  - **Lilac:** mint, alfalfa.
  - **White:** caper, henna.
  - **Brown:** cattail.
- **Seasons:** late winter (desert hyacinth), spring (barley, rose, pomegranate flowers, palm flowers), summer (henna, caper, colocynth, mint, cattail, oleander), autumn (dates, pomegranate fruit).

**For O1 (slots):**
- The draft has no rock slots. Add 3–4 small or medium rock slots on the terrace-wall copings and the bluff's talus, for the caper and colocynth (and as a perch line for the gecko).
- A large water slot in the basin's overflow corner would let the cattail stand in water.
- The tree slot is the only place for the date palm, so give the scene at least two tree slots. The waterfall has two.

**Alternates** (13th and later):
- **Tamarisk** (*Tamarix aphylla* / *T. gallica*, tlaya / ṭarfa): the feathery pink-grey shrub of oued banks and the desert hyacinth's host [14][15]. Tier 3, large, shore. It is the strongest alternate, but a third pink at tier 3.
- **Fig** (*Ficus carica*, kerma): the middle storey with big lobed leaves, tier 4 large. It is a good second fruit tree but close to the pomegranate in role.
- **Olive** (*Olea europaea*, zitoun): really the commonest middle-storey tree in Moroccan oases [4]. Its silver-grey reads quiet. Best saved for a Mediterranean scenery and shared back.
- **Retama** (*Retama raetam*, rtem): a white broom of sandy oueds, with fragrant white pea flowers in spring.
- **Jujube** (*Ziziphus lotus*, sedra): a spiny, tangled shrub with small red fruit.
- **Acacia** (*Vachellia tortilis* subsp. *raddiana*, talh / amrad): the flat-topped tree of the lower Draa and the Bani; better for a hamada scenery.
- **Southern maidenhair** (*Adiantum capillus-veneris*): on the wet walls of wells, springs and khettaras. A real oasis fern, but not the garden's kujakushida sprite (§4).
- **Saffron crocus** (*Crocus sativus*): grown at Taliouine, west of the Draa. Not of the palmeraie itself.
- **Calotropis** (*Calotropis procera*, krenka): the Sodom apple, with purple-white flowers and green balloon fruit. Toxic (§6).
- **Common reed** (*Phragmites australis*) and **giant reed** (*Arundo donax*, qsab): the reed edges of seguias and the oued. Paint them as scenery, not as species. *Arundo* is an ancient introduction.

---

## 3. Eight creatures

Suggested order (counts as in `fauna-unlocks.ts`):

| # | Creature | Where | When | Unlock (suggestion) |
|---|---|---|---|---|
| 1 | House bunting | wall copings, the basin rim, plot edges | day, all year | always (resident) |
| 2 | Laughing dove | palm fronds, wall tops, the plots, drinking at the basin | day, all year | 2 plants |
| 3 | Violet dropwing | a stick or stone tip over the basin and seguia | day, April–October | 3 plants |
| 4 | Sahara frog | half in the basin, the seguia lip | day and evening, most of the year | 5 plants (the basin, not a water plant) |
| 5 | Hoopoe | walking the damp plots | day | 8 plants |
| 6 | Böhme's gecko | the warm pisé walls and the basin coping | dusk and night | 10 plants, dusk and night only |
| 7 | Blue-cheeked bee-eater | a frond tip or dead stalk, sallying over the grove | day, April–September | 14 plants |
| 8 | White stork | a ksar tower top; now and then the plots | day, rare, late winter–summer | 20 plants, rare |

**Calm-garden check:** all eight are slow or rest often. The dove's soft laugh and the hoopoe's
low "oop-oop-oop" suit the sound bed (O7). The bulbul is left out because it is loud and busy. The
fennec is a dune animal that is only an occasional visitor to a tended grove.

**Optional legend tier** for 25 plants: the **desert hedgehog** (*Paraechinus aethiopicus*)
*(verify Draa records)*. It is a slow night visitor that snuffles along the foot of the terrace
walls.

**Optional fish:** a native barbel (*Luciobarbus* sp.) in the basin *(verify which species reach
seguia basins)*. Only add it if the basin needs life under water. Never a stocked carp or
*Gambusia* (§6).

**1. House bunting — *Emberiza sahari* — tibibt** *(verify the name's spelling)* [20][21]
- **Range:** a resident of dry country in north-west Africa. It breeds around houses.
- **Behaviour:**
  - It is very tame in Morocco, where it is traditionally regarded as sacred. It freely enters and feeds inside houses, shops and mosques, and nests in holes in walls [20].
  - It hops along the wall copings, the basin rim and the plot edges, picking seeds. It flies in short dips from wall to wall, now and then slips into a window slit of the ksar, and comes out again.
  - It lets the camera come close: the only creature that does.
- **Illustrator:**
  - **Size and body:** about 14 cm. The male's body is sandy orange-cinnamon (`#c98a52`, shade `#a8703e`), with plain rufous wings.
  - **Head:** grey, finely streaked darker (`#8a8c90`, streaks `#5a5a60`).
  - **Female:** duller, with a brownish-grey head.
  - **Read:** a small cinnamon bird with a grey hood, the colour of the pisé itself. Not the sparrow: no black bib, no wing bars.

**2. Laughing dove — *Spilopelia senegalensis*** [22][23]
- **Range:** it lives in date palms in oases and villages deep in the desert [23]. The Moroccan subspecies is *phoenicophila*, "palm-lover" [22]. It spread across Morocco from western Algeria from the 1990s and is now nearly everywhere [24].
- **Behaviour:**
  - Pairs sit close together on a palm frond or a wall top and bow and coo.
  - It walks the plots with small nodding steps, picking seeds.
  - It comes down to the basin rim to drink. Doves suck water up like a straw, without tipping the head back [48]: a lovely, still moment.
  - The call is a soft, bubbling five-note laugh.
- **Illustrator:**
  - **Body:** a small, slim dove about 25 cm. The head and breast are pinkish-buff (`#c99a8a`) and the back is warm rufous-brown (`#a8704e`), with a blue-grey wing panel (`#8a92a8`).
  - **Bib:** a necklace of copper-and-black speckles across the breast (`#7a4a32` dabs).
  - **Tail:** long, with white corners that show when it lands.
  - **Read:** a rosy-buff dove with a speckled bib, twice the bunting's size.

**3. Violet dropwing — *Trithemis annulata*** [25]
- **Range:** most of Africa, the Middle East and southern Europe, Morocco included. Adults tolerate semi-arid country and still or slow fresh water [25].
- **Behaviour:**
  - It perches on a stick tip or stone at the basin's edge with its wings **drooped forward and down**, the "dropwing".
  - In strong sun it points its abdomen at the sky (obelisk posture) *(verify for this species)*.
  - It darts out after a midge and returns to the same perch. It does not hover like the aka-tombo.
- **Illustrator:**
  - **Male:** a brilliant violet-red body, a powdery magenta (`#b04f7e`, light `#c97aa0`), with red wing veins and small amber patches at the wing bases (`#d9a05a`). The eyes are red-violet.
  - **Female:** yellow and brown.
  - **Read:** a magenta dash on a stick tip. Make it a new `dragonfly` variant (`violet`), not a new kind.

**4. Sahara frog — *Pelophylax saharicus* — jrana (جرانة)** [26][27]
- **Range:** North Africa from Western Sahara to Egypt. It is aquatic, in streams, **oasis pools, irrigation canals and artificial basins** [26][27]. It is the commonest amphibian of Morocco, and in the arid south it stays active all year [27].
- **Behaviour:**
  - It floats in the basin with only its eyes and snout above the surface, or sits on the coping half out of the water.
  - It plops in with a ring when anything moves, and surfaces again a little way off.
  - On spring and summer evenings it calls, with a white vocal sac ballooning at each corner of the mouth *(verify)*.
- **Illustrator:**
  - **Body:** green to olive-brown with dark blotches (`#7f9a52`, blotches `#5a6a3a`), pale ridges along the back, and often a pale green line down the middle.
  - **Read:** a green head and two gold eyes at the waterline.
  - **Unlock:** unlike the garden frog it needs no pad: use the basin rule (the B1 lesson from kajika).

**5. Hoopoe — *Upupa epops* — hudhud (هدهد)**
- **Range:** it breeds in north-west Africa, where it is a partial migrant or resident, in orchards, cultivated country and large gardens [49]. It has been seen at Ouarzazate and Rissani [49]. Breeding in the Draa palmeraies is likely but not confirmed here *(verify)*.
- **Behaviour:**
  - It walks the damp plots after watering, probing the soil with its long curved bill and tossing up grubs.
  - On landing or alarm it fans its crest into a crown, then lays it flat again.
  - It flies with slow, butterfly-like flaps that flash black-and-white wings, and calls a soft, low "oop-oop-oop".
- **Illustrator:**
  - **Body:** about 27 cm, pinkish-cinnamon (`#d39a6a`).
  - **Wings and tail:** barred black and white like a zebra (`#3a3430` dabs on reserved white).
  - **Crest:** a fan crest tipped black.
  - **Bill:** long, slender and curved.
  - **Read:** a cinnamon bird with zebra wings and a fan on its head. It is the oasis's most recognisable creature.
- **Fact for the arrival line:** it is the bird that carries messages for Solomon in the Qur'an (sura 27). Use it only as a gentle aside, or not at all (§6).

**6. Böhme's gecko — *Tarentola boehmei*** [44][45]
- **Range:** southern Morocco: Tazzarine, the southern Anti-Atlas, **the Draa valley** and the Jebel Bani. It lives on cliffs, walls, ruins, rural gardens and towns [44].
  - The familiar Moorish gecko (*T. mauritanica*) is the Atlantic-coast and Mediterranean species. Inland in south-west Morocco, *T. boehmei* takes its place. The two may meet around Ouarzazate [45].
  - The two are hard to tell apart in the field, so the sprite is the same shape. The name and the card must be Böhme's gecko.
- **Behaviour:**
  - At dusk it comes out of a crack onto the warm pisé, on a terrace wall, the ksar's foot or the basin coping.
  - It holds still for a long time, head down, then makes a quick dash after a moth and freezes again.
  - It is never seen by day. This is the oasis's night signature, as the firefly is the waterfall's.
- **Illustrator:**
  - **Body:** flat and broad-headed, grey-brown (`#8a7a68`) with pale and dark bands (`#b8a88e`, `#5a4e42`).
  - **Skin:** rows of small tubercles. Dab them, do not stipple evenly.
  - **Toes:** broad, padded toes splayed on the wall.
  - **Size:** small, about 11 cm with the tail [44].
  - **Read:** a small, banded lizard flat on a lit wall.
  - **Rendering:** at night it needs the wall's moonlit or warm-lit side. No glow, no eyeshine effect.

**7. Blue-cheeked bee-eater — *Merops persicus*** [28][29]
- **Range:** it breeds in the Tafilalt, Saghro, Dadès, Draa and the western Anti-Atlas, in river basins and oases, and winters in tropical Africa [28].
- **Behaviour:**
  - A few sit on the tips of palm fronds or dead stalks. One sallies out on triangular wings, snaps up a bee or dragonfly, glides back, and beats its prey on the perch before swallowing.
  - It nests in tunnels dug in sandy banks, which fits the oued bank [29].
  - It is present April–September only.
- **Illustrator:**
  - **Body:** slim, about 30 cm with **long central tail streamers**. Grass-green (`#6f9a5a`).
  - **Face:** pale blue cheeks and brow (`#8ab0c0`), a black eye mask, a yellow chin and a chestnut throat (`#b0603a`).
  - **Underwings:** coppery, flashing in flight.
  - **Read:** a green arrow with a tail spike on a frond tip.
- **Note:** it eats bees. Let it sit near the bee flowers, but never animate it catching one of the oasis's bees on screen.

**8. White stork — *Ciconia ciconia* — bellarej (بلارج)** *(verify the name)* [30][31]
- **Range:** stork nests on minarets, houses and kasbahs are a classic sight in Morocco [30]. In popular belief storks are sacred and bring happiness to a house they nest on [46]. White storks nest on the Kasbah Taourirt in Ouarzazate, at the head of the Draa [31]. Breeding further down the Draa is uncertain *(verify)*.
- **Behaviour:**
  - It comes in on broad, slow wings and lands on the crown of a ksar tower.
  - It stands, preens, and now and then throws its head back to clatter its bill, a silent visual beat. Sound is optional, and it is not a song.
  - Rarely, it walks the plots after frogs and insects, then flies off.
- **Illustrator:**
  - **Body:** large, white (reserved paper with a warm shade `#d8cfc4`), with black flight feathers (`#3a3430`).
  - **Bill and legs:** red (`#c9603e`).
  - **Nest:** a nest of sticks on a tower top is optional. If used, it sits on an intact tower, never as a sign of ruin.
  - **Read:** a white bird with black wing-ends on the ksar's skyline. It is the stork that the scene's composition invites.

---

## 4. Shared species

**Rule:** a species is shared only where it really grows wild in, or is really planted in, a
middle-Draa palmeraie, in the form the sprite shows.

### Existing plants offered in the oasis too

**None.** Every one of the 37 species in `src/plants/species/` fails the test:

| Species | Why not |
|---|---|
| anemone, balloon-flower, camellia, ginkgo, plum-blossom, tree-peony, japanese-maple, black-pine, susuki-grass, violet, wild-strawberry, wisteria, japanese-iris, spider-lily, azalea, hydrangea, weeping-cherry, chrysanthemum | East Asian wild plants or Japanese garden forms. None is grown in Moroccan oases. *Wisteria* and *chrysanthemum* turn up as ornamentals in Moroccan towns *(verify)*, but not in a palmeraie |
| lotus | *Nelumbo* is Asian. The "lotus" of North Africa is the Nile's *Nymphaea*, and that is Egyptian, not Moroccan (§6) |
| water-lily | The sprite is the Japanese hitsujigusa. Water lilies are not grown in palmeraie basins |
| cosmos | Mexican, and not a crop or a plant of the grove |
| white-clover | *Trifolium repens* is native to northern Morocco's damp grassland, but the oasis's fodder clovers are alfalfa and berseem. Not in an arid palmeraie |
| dandelion | European grassland. Not a plant of the Saharan oases *(verify)* |
| forget-me-not | Wet European meadows |
| maidenhair-fern | The sprite is *Adiantum pedatum*. The oasis has a different species, *A. capillus-veneris*, on well and khettara walls: a candidate alternate (§2), not a share |
| the waterfall's 12 (iwatabako, daimonjisō, iwakagami, wasabi, kurinsō, baikamo, mizubashō, hototogisu, yamabuki, taniutsugi, katsura, tochinoki) | Cool, wet Japanese mountains |

This matches the B0 forecast ("almost nothing: maximally unique"). The uniqueness test (at least 8
exclusive species and 60 % of the offer) passes with 12 of 12.

### Creatures

| Creature (kind, variant) | Share? | Why |
|---|---|---|
| Bees (`bee`) | **yes** | The oases of south-eastern Morocco have their own honeybee, *Apis mellifera sahariensis*, from Ouarzazate to Figuig, adapted to the date palm and Saharan flora [32][33]. The generic sprite fits. A slightly yellower tint would be a nice variant |
| Butterflies, swallowtail (`butterfly/swallowtail`) | **yes** | The Saharan swallowtail, *Papilio saharae*, flies from Morocco to Arabia on desert umbellifers [34], and *P. machaon* uses the oasis's fennel and carrots *(verify)*. Both look like the sprite |
| Butterflies, white (`butterfly/white`) | **yes** | Cabbage whites follow cabbages and turnips into the oasis plots *(verify the south)* |
| Water striders (`strider/margin`) | **yes** | In the basin's still margins. Pond skaters live in oasis pools *(verify the genus)* |
| Swallows (`swallow`) | **yes** | Barn swallows breed in Moroccan villages and ksour, nesting inside houses *(verify the Draa)*. In the oasis they belong |
| Heron (`heron`) | **yes, rare** | Grey herons winter along the Draa and its reservoir *(verify)*. Keep it rare. A cattle or little egret would be the more typical oasis heron later |
| Falling leaf (`leaf`) | **yes, as a pomegranate leaf** | Use the gold tint (`katsura`), as a pomegranate or fig leaf in autumn on the basin. Palm leaflets do not drift down like this |
| Dragonfly, aka (`dragonfly/aka`) | **no** | Aka-tombo (*Sympetrum frequens*) is Japanese. Add the violet dropwing as a new variant (§3). The red-veined darter (*Sympetrum fonscolombii*) is a possible second |
| Dragonfly, shiokara / ochre | **no** | The shiokara-tombo is East Asian. North Africa's look-alikes are other *Orthetrum* |
| Small birds, wagtail (`bird/wagtail`) | **no** | The sprite is the Japanese wagtail. Morocco has its own white wagtail, *Motacilla alba subpersonata*, with a black face mask: a possible later variant |
| Small birds, sparrow (`bird/sparrow`) | **no** | The house bunting replaces it. The oasis has house sparrows, but the sprite is the Japanese tree sparrow |
| Koi (`koi`) | **no** | Carp are an introduction in Moroccan reservoirs (§6) |
| Frog (`frog`) | **no** | It needs a pad and is the Japanese pond frog. Replaced by the Sahara frog |
| Firefly (`firefly`) | **no** | No Genji firefly in the Sahara. The gecko is the night signature |
| iwana, sawagani, kajika, iwatsubame, yamasemi, dipper, damselfly | **no** | Japanese mountain-stream animals. The North African freshwater crab, *Potamon algeriense*, lives in Atlas streams, not palmeraies *(verify)*. The oasis's look-alike of the iwatsubame is the rock martin |

### Oasis species a Mediterranean scenery could offer later

| Species | Mediterranean? | Why |
|---|---|---|
| Oleander | **yes, wild** | Its home is the riparian scrub of Mediterranean riverbeds [19] |
| Caper | **yes, wild and grown** | On old city walls and towers and on sea cliffs all round the Mediterranean [9] |
| Cattail (*T. domingensis*) | **yes, wild** | Mediterranean coastal marshes *(verify)* |
| Desert hyacinth (*C. phelypaea*) | **yes, wild, coastal** | Native from Macaronesia across the western Mediterranean [15]: on salty coastal sands in Spain and Portugal *(verify)* |
| Pomegranate, Damask rose, barley, alfalfa, spearmint | **yes, cultivated** | Old Mediterranean crops and garden plants (`cultivatedIn: ['mediterranean']`) |
| Date palm | **only planted** | Planted in groves like Elche. Crete's wild palm is another species, *Phoenix theophrasti*. Offer it only in a planted Mediterranean garden |
| Colocynth | **no** | A Saharo-Arabian desert plant that rarely reaches the coast [10] |
| Henna | **no** | Needs desert heat. It is not a Mediterranean crop |
| White stork, hoopoe, violet dropwing | **yes** | All are Mediterranean animals |
| Böhme's gecko | **no, but its look-alike yes** | It is pre-Saharan. The Mediterranean's wall gecko is the Moorish gecko (*T. mauritanica*), a near-identical sprite under another name [45] |
| Laughing dove | **partly** | Only in the eastern Mediterranean (Turkey, the Levant) and urban Spain *(verify)* |
| Sahara frog | **partly** | North African Mediterranean coast, yes. In Iberia the look-alike is Perez's frog |
| House bunting, blue-cheeked bee-eater | **no** | Saharan. Europe has the European bee-eater instead. The house bunting first bred in Spain only in 2023 [20] |

---

## 5. Habitat taxonomy: the oasis row

The B0 table's row 9 said: "Desert oasis (Sahara or Arabia) | n-africa-arabia · desert, wetland ·
arid | date palm, oleander, tamarisk, papyrus | fennec, sandgrouse, desert locust | almost nothing:
maximally unique". Updated:

| # | Scenery | Realm · biome · climate | Signature plants | Signature fauna | Shares (biology) |
|---|---|---|---|---|---|
| 3 | **Draa palmeraie (oasis)** | n-africa-arabia · desert, wetland · arid, **cultivated** | date palm, pomegranate, henna, Damask rose, barley, desert hyacinth, colocynth, oleander | house bunting, laughing dove, hoopoe, Sahara frog, blue-cheeked bee-eater, white stork, Böhme's gecko | no plants; bees (Saharan honeybee), swallowtail, cabbage white, striders, swallows, heron (rare), the falling leaf (gold) |

Changes and why:
- **The profile is cultivated.** A palmeraie is a planted garden, like the Japanese garden, so it
  needs `cultivated: true`. Seven of the twelve are crops.
- **Papyrus is out.** *Cyperus papyrus* is a plant of the Nile and tropical Africa, not of Moroccan
  oases (§6).
- **The fennec, sandgrouse and locust are out.** They belong to the open desert and dunes, not a
  tended grove. A future **erg or hamada** scenery (dunes, acacia, fennec, sandgrouse, desert
  wheatear) should take them, with `biomes: ['desert']` and `cultivated: false`.
- **Tamarisk is now an alternate:** the oued's shrub and the desert hyacinth's host.
- **`wetland` is kept** for the oued, the seguia and the basin (cattail, oleander, frog). Nothing in
  another realm leaks in, because the realm must match.
- **A mediterranean climate is missing.** `CLIMATES` has no Mediterranean climate (hot dry summers,
  mild wet winters). The future Mediterranean scenery will need one, and the shared species above
  must then add it to `climates`.

**Habitat words for the planting sheet** (`habitatWords`), as a suggestion for O1:

| Habitat | Oasis words | Where in draft A |
|---|---|---|
| water | in the shallows | oued shallows, the basin's overflow corner |
| shore | by the water | basin rim, seguia lip, oued banks |
| meadow | in the plots | the terrace and basin-terrace plots |
| path | on the sand | foreground sand, the sand bar |
| back | under the palms | the grove's edge, far oued bank |
| rock | on the walls | terrace-wall copings and the talus (new slots) |

---

## 6. Pitfalls

**Cultural**
- **The ksar is someone's home and heritage.** Ksour are fortified villages with families and
  owners, and many are still lived in.
  - Paint it as a place, not an exotic ruin. Crumbling comes from rain and from people leaving, and
    a painting should not celebrate it.
  - No figures, no flags, no named real ksar (such as Tamnougalt) as a reward or a prop.
  - Never let creatures "play" on it, apart from the natural stork and bunting. A stork nest
    belongs on an intact tower.
- **The land and water are owned.** Every plot and palm has an owner, and water turns are shared
  by rule.
  - The metaphor is tending a garden, not taking land.
  - Notes should never suggest digging up or "collecting" wild plants. This matters for the desert
    hyacinth, a parasite that cannot be moved anyway.
- **No Orientalist set dressing.** Leave out:
  - camel caravans, "Arabian Nights" motifs and lamps;
  - veiled figures, snake charmers;
  - decorative Arabic script, crescents or a mosque used as a prop;
  - Tifinagh letters used as ornament.

  The Draa's pattern language is the chevron and lozenge band on pisé towers, which draft A
  already uses.
- **People and languages.** The Draa is home to Amazigh, Arabic-speaking Drawa and Haratin
  communities. Do not call it "Arab", and do not present one language as the only one. Give native
  names in Darija and, where known, Tamazight, and check spellings with a speaker before shipping.
- **Respected birds.** The house bunting is traditionally regarded as sacred [20]. Storks are
  protected and, in popular belief, sacred: they bring happiness to the house they nest on [46]. Hoopoes are sold in some markets for traditional remedies and
  charms *(verify)*. Never show a creature caged, caught or sold, and keep the Qur'anic hoopoe
  story (if used at all) factual and brief.
- **Fennec.** It is caught and shown to tourists. If it ever appears, it is wild, distant and at
  night, never a pet.

**Botanical**
- **Not Saharan:**
  - *Washingtonia* fan palms are American, planted in Moroccan cities and criticised there [35].
  - The Canary Island date palm (*Phoenix canariensis*) is an ornamental of avenues, not a
    palmeraie palm.
  - Prickly pear (*Opuntia*) and agave are American.
  - Bougainvillea, jacaranda and eucalyptus are introductions of towns and roads.

  None of these goes in the oasis.
- **No papyrus and no blue lotus.** Both are Nile plants. Moroccan palmeraie basins hold water
  for irrigation, not water gardens.
- **Toxic plants:**
  - Oleander, colocynth and *Calotropis* are poisonous.
  - Notes may say so, as a fact, but no line or card should suggest eating, tasting or touching
    them.
  - *Calotropis* stays an alternate because its milky latex burns the eyes.
- **Invasive associations:**
  - Carp and *Gambusia* (mosquitofish) were introduced into Moroccan waters *(verify)*. Never put
    koi or "goldfish" in the basin.
  - *Arundo donax* is an ancient introduction. Paint it in the scenery, but not as a signature
    plant.
- **Place each plant where it grows:**
  - The desert hyacinth goes on sand near tamarisk, not in a watered plot.
  - Henna goes in the hot plots, not by the oued.
  - Saffron is Taliouine's, not the Draa's.
  - The Damask rose is the Dadès valley's, next door. That is justified by Skoura and the
    "region" reading of the brief, but the Note should name Kelaat M'Gouna, not the Draa.
- **No wild date palms.** All palms in the grove are planted and tended. Show offshoots and a
  pruned crown rather than a shaggy wild skirt.

**Misleading or inaccurate details**
- **Bayoud.** A note that celebrates "ancient eternal palms" ignores that most were lost to bayoud
  and drought [6][7]. A short, factual mention (in the palm's note or a devlog) is better than
  silence, but keep the garden hopeful.
- **The oasis is green and humid.** The three-storey shade makes it cooler and damper than the
  desert around it [3]. The golden feel should come from light, sand, straw, barley and dates, not
  from a dead, dry grove.
- **Seasons are compressed.** Barley is gold in spring and dates are amber in autumn. A tier-2
  barley and a tier-4 date palm both at full colour together are a gentle cheat, as with the
  waterfall's mixed seasons.
- **Bee-eaters eat bees.** Never animate one catching a visible bee sprite.

**Too similar (blurs within the oasis set or against the other gardens)**

| Pair | Keep them apart by |
|---|---|
| Oleander vs Damask rose (pink shrubs, tier 3) | knife leaves and twisted pinwheels in a cool rose-pink vs ruffled cups and soft leaflets in a warm pink |
| Spearmint vs alfalfa (lilac, tier 1) | upright square stems, paired wrinkled leaves and tapering spikes vs a low cushion, leaves of three and round clusters |
| Barley vs cattail vs susuki (tall blades) | whiskered gold ears vs a brown velvet cigar. Susuki is not offered here |
| Desert hyacinth vs colocynth flower (yellow) | an upright leafless candle vs flat runners with small flowers and balls |
| Pomegranate vs plum blossom (tier 4 large) | leafy, red flowers and crowned fruit vs bare branches with blossom |
| House bunting vs sparrow | cinnamon body, grey streaked hood, no bib |
| Laughing dove vs any garden bird | pink-buff, speckled bib, long white-cornered tail |
| Violet dropwing vs aka-tombo | magenta, perched with drooped wings vs red and hovering |
| Sahara frog vs garden frog | in the water or on the coping, no pad |
| Bee-eater vs wagtail | green, perched high, long tail spike |

---

## Sources
1. Draa Valley oases — MedOMed: https://medomed.org/featured_item/draa-valley-cultural-landscape-agdez-zagora-mhamid-and-other-oases-morocco/ ; https://medomed.org/?p=13317
2. Draa valley, date groves — Plizio: https://www.plizio.com/en/morocco/ma-08/draa-valley/ ; Michelin, Agdz: https://www.viamichelin.pl/maps/tourist-attractions/poi/agdz-_-4dc54fc87ea5
3. Oasis (three strata, the "oasis effect") — Wikipedia: https://en.wikipedia.org/wiki/Oasis
4. Moroccan oasis layers (olive the main middle storey; alfalfa and cereals as fodder) — JUNCO, Univ. of Turin: https://ojs.unito.it/index.php/junco/article/download/3672/3291 ; ICARDA/MEL, Sustaining Moroccan Oasis Agricultural System: https://repo.mel.cgiar.org/handle/20.500.11766/7375
5. Introduction to an oasis (Tafilalt) — Maghrebi Voices, Swarthmore: https://maghrebi-voices.swarthmore.edu/?p=744
6. Bayoud — Nature Middle East: https://nme.natureasia.com/en/nmiddleeast/article/10.1038/nmiddleeast.2010.220 ; APS Phytopathology 1996: https://www.apsnet.org/publications/phytopathology/backissues/Documents/1996Abstracts/Phyto_86_787.htm ; CORE: https://core.ac.uk/download/39852548.pdf
7. Drought and the oases — Bladi: https://en.bladi.net/morocco-historic-oases-vanish-drought-ravages-landscape,96474.html
8. Capparis spinosa in Morocco — BLACPMA: https://blacpma.ms-editions.cl/index.php/blacpma/article/download/315/323/627 ; Caper — Wikipedia: https://wikipedia.com/wiki/Caper
9. Capparis spinosa subsp. rupestris on old walls and towers — Herbari Virtual UIB: https://herbarivirtual.uib.cat/en/general/875/especie/taparera
10. Citrullus colocynthis (Morocco, moths, rarely to the coast) — Purdue NewCrop (Duke): https://hort.purdue.edu/newcrop/duke_energy/Citrullus_colocynthis.html ; Lloyd, Henriette's Herbal: https://henriettes-herb.com/eclectic/lloyd-hist/citrullus.html
11. Colocynth (handal, flowering, toxicity) — enature.qa: https://www.enature.qa/specie/handhal ; Abu Dhabi DoH leaflet: https://medicinalplants.doh.gov.ae/Public-education-plants-leaflets/Citrullus-colocynthis
12. Kelaat M'Gouna Valley of Roses — Lonely Planet: https://www.lonelyplanet.com/articles/valley-of-the-roses-discover-moroccos-floral-festival ; Journey Beyond Travel: https://www.journeybeyondtravel.com/blog/kalaat-mgouna-morocco.html ; The National: https://thenationalnews.com/mena/morocco-in-bloom-harvest-season-in-the-valley-of-the-roses-in-pictures-1.1216319
13. Mejhoul date origin, Tafilalt — ISHS: https://ishs.org/ishs-article/1371_1/ ; Morocco World News: https://moroccoworldnews.com/2025/11/268593/how-did-mejhoul-dates-become-world-famous-without-their-moroccan-identity/
14. Saharan wadis: Phragmites and Typha along channels and oases, Nerium and Tamarix thickets — BirdLife, Béni Abbès IBA: https://datazone.birdlife.org/site/factsheet/béni-abbès-iba-algeria ; Draa estuary Ramsar site: https://rsis.ramsar.org/fr/ris/1477
15. Cistanche phelypaea — Kew POWO: https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:661964-1 ; Wikipedia: https://wikipedia.com/wiki/Cistanche_phelypaea ; Temperate Plants: https://temperate.theferns.info/plant/Cistanche+phelypaea ; Libyan host study: https://journals.uot.edu.ly/index.php/ljagric/article/view/505
16. Henna in south-east Morocco (production areas, Maïder GI) — Sud-Est Maroc: https://sudestmaroc.com/en/henna-morocco-traditions-rituals/
17. Henna lawsone and temperature (Zagora, Foum Zguid) — HAL record: https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_hal_primary_oai_HAL_hal_03492968v1 ; quality study (Alnif, Tazzarine): https://pmc.ncbi.nlm.nih.gov/articles/PMC6556789
18. Henna harvests per year (personal site, weak) — https://lisa-butterworth.squarespace.com/whatishenna
19. Mediterranean riparian scrub (Tamarix, Nerium, Vitex) — EUNIS: https://eunis.eea.europa.eu/habitats/23162
20. House bunting — Wikipedia: https://en.wikipedia.org/wiki/House_bunting
21. House bunting photos, Drâa-Tafilalet (Ouarzazate) — oiseaux.net: https://oiseaux.net/photos/denis.chavigny/house.bunting.0.html
22. Laughing dove — Wikipedia: https://en.wikipedia.org/wiki/Laughing_dove
23. Laughing dove in desert date palms — NHMC Crete: https://mobile.nhmc.uoc.gr/node/176
24. Laughing dove spread in Morocco — Moroccan Birds (magornitho): https://magornitho.org/2013/02/streptopelia-senegalensis-tetouan/
25. Trithemis annulata — Wikipedia: https://en.wikipedia.org/wiki/Trithemis_annulata ; JungleDragon: https://www.jungledragon.com/specie/1142/violet-dropwing.html ; BDI: https://thebdi.org/2020/05/07/violet-dropwing-trithemis-annulata/
26. Sahara frog — Wikipedia: https://en.wikipedia.org/wiki/Sahara_frog ; Amphibian Species of the World: https://amphibiansoftheworld.amnh.org/Amphibia/Anura/Ranidae/Pelophylax/Pelophylax-saharicus
27. Pelophylax saharicus in Morocco (review) — CORE: https://core.ac.uk/download/228522067.pdf
28. Blue-cheeked bee-eater breeding in southern Morocco — Go-South Bulletin 13: https://go-south.grepom.org/wp-content/uploads/2016/01/gsb_13_36-42.pdf
29. Blue-cheeked bee-eater — BirdForum Opus: https://www.birdforum.net/opus/merops_persicus
30. White storks on minarets and kasbahs — Moroccan Birds (magornitho): https://magornitho.org/?p=262
31. White stork nest on the Kasbah Taourirt, Ouarzazate — Photo12: https://www.photo12.com/en/image/brk19e58_309 ; FLPA: https://prints.aap.com.au/flpa/white-stork-ciconia-ciconia-adult-pair-6555921.html
32. Apis mellifera sahariensis in south-eastern Morocco — PMC (2022): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8953116/ ; Apidologie (2023): https://link.springer.com/10.1007/s13592-023-01009-9
33. Apis mellifera sahariensis — Wikipedia: https://en.wikipedia.org/wiki/Apis_mellifera_sahariensis
34. Papilio saharae — Wikipedia: https://en.wikipedia.org/wiki/Papilio_saharae
35. Washingtonia in Moroccan cities — Bladi: https://en.bladi.net/morocco-environmentalists-slam-invasive-palm-species-call-native-tree,104730.html ; Morocco World News: https://www.moroccoworldnews.com/2024/07/16590/a-complete-environmental-crime-the-controversy-surrounding-palm-tree-proliferation-in-moroccan-cities/
36. FAO GIAHS, Oases System in Atlas Mountains (cold oases, for contrast) — https://www.fao.org/giahs/giahs-around-the-world/morocco-cold-oases-system/en
37. Alfalfa, etymology — Wiktionary: https://www.wiktionary.com/wiki/alfalfa ; Etymonline: https://www.etymonline.com/word/alfalfa
38. Caper flower lasts a day — Flowers in Israel: https://www.wildflowers.co.il/english/plant.asp?ID=1 ; Guide Me Malta: https://www.guidememalta.com/en/did-you-know-that-the-flowers-from-which-malta-get-its-capers-only-live-for-one-day
39. Typha spike gap — iNaturalist journal, Cattail morphology: https://inaturalist.ala.org.au/journal/pastabaum ; Florida Plant Atlas: https://florida.plantatlas.usf.edu/Genus/1263
40. Oleander nectarless flowers — Bugwoman London: https://bugwomanlondon.com/2019/05/15/wednesday-weed-oleander/ ; iNaturalist ALA: https://inaturalist.ala.org.au/posts/53352-july-2021-ecoquest-oleander-occurence
41. Cistanche phelypaea, March–April (Algarve) — First Nature: https://mail.first-nature.com/flowers/cistanche-phelypaea.php
42. Henna flowering — Mother Earth Gardener: https://www.motherearthgardener.com/plant-profiles/henna-tree-ze0z2001zbut/
43. Rose picking in the early morning — Leica (Rena Effendi): https://leica-camera.com/fr-CH/blog/rena-effendi-kelaat-mgouna-rose-festival ; Best Regards From Far: https://bestregardsfromfar.com/2025/06/06/valley-of-the-roses-morocco-trekking-guide/
44. Böhme's gecko — Wikipedia: https://en.wikipedia.org/wiki/B%C3%B6hme%27s_gecko ; Reptile Database: https://reptile-database.reptarium.cz/Tarentola/boehmei
45. Tarentola in the Oued Drâa area (T. boehmei replaces T. mauritanica inland) — Acta Herpetologica 2010: https://oaj.fupress.net/index.php/ah/article/download/1578/1578/1568
46. Storks sacred in popular belief — Yabiladi: https://en.yabiladi.com/articles/details/99706/whatsapp:/send
47. Draa River (the six oasis stretches) — Wikipedia: https://en.wikipedia.org/wiki/Draa_River
48. How pigeons and doves drink — PBS Nature: https://www.pbs.org/wnet/nature/group/birds/pigeon ; Montana FWP, mourning dove: https://fwp.mt.gov/binaries/content/assets/fwp/montana-outdoors/outdoor-portraits/2024/mourningdove.pdf
49. Hoopoe — BirdForum Opus: https://www.birdforum.net/opus/upupa_epops ; Wikipedia: https://en.wikipedia.org/wiki/Eurasian_hoopoe ; EcoRegistros (Morocco records): https://www.ecoregistros.org/sheet/Upupa-epops?idpais=76
