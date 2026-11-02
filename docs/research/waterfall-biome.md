# B0 — Waterfall biome research

Read-only research for phase 12. Sources are listed at the end and cited as [n]. Facts marked
*(verify)* came from memory and were not confirmed during this task.

**What the repo already has:**
- The waterfall scenery is painted: cliff, moss ledges, crown woods with spires, fern sprays, pool and stream.
- It has 49 slots: water 4 (2 L, 2 M), shore 9, meadow 12 (1 tree), path 6, back 7 (1 tree), rock 11 (2 M, 9 S).
- The roadmap already queues a "trout" (S12) and a dipper (S13).
- Each species has two texts:
  - `description`: the poetic line, e.g. "Violet — small courage at the foot of stones."
  - `SPECIES_NOTES`: two or three plain sentences about the plant's place in Japanese culture or gardening.

  The proposals below copy both voices.

---

## 1. Candidate regions

| | **A. Japanese montane gorge (keikoku) with a taki** | **B. Pacific Northwest rainforest falls** (Columbia Gorge, Olympics) | **C. Yunnan–Himalayan gorge** (Hengduan, Gaoligong) |
|---|---|---|---|
| Spray zone, wet cliff | Iwatabako on shaded wet rock faces [1][2]; daimonjisō on wet rocks along mountain streams [3][4]; mosses (Oirase has 200–300 kinds) [5] | Maidenhair fern (*Adiantum aleuticum*) in falls spray [6]; filmy ferns, mosses and liverworts in the mist zone [7]; yellow monkeyflower (*Erythranthe guttata*) on seeps *(verify)* | *Begonia*, *Bergenia*, *Rodgersia* and ferns on wet cliffs *(verify)*; the sikkimensis-group primulas on streamsides and bog margins at 3200–4400 m [8] |
| Pool and stream | Baikamo in cold, clear running water [9]; wasabi on stream beds [10]; kurinsō in boggy streamsides [11]; mizubashō [12] | Western skunk cabbage, piggyback plant, bleeding heart, red columbine *(verify)* | *Primula secundiflora* and *P. sikkimensis* in ditches and on stream banks [8]; *Arisaema* *(verify)* |
| Banks, cliff foot, cliff top | Yamabuki along riversides and in gorges [13]; tani-utsugi [14]; katsura, a riparian canopy tree [15]; tochinoki on valley terraces [16]; satsuki on river rocks (central and southern Japan) [17] | Vine maple, bigleaf maple dripping with moss and licorice fern, western redcedar, Douglas fir, salmonberry, devil's club *(verify)* | Rhododendrons, *Magnolia campbellii*, Himalayan birch, lilies *(verify)* |
| Fauna | Brown dipper [18]; Japanese wagtail [19]; crested kingfisher (yamasemi) [20]; Asian house martin (iwatsubame) on gorge cliffs [21]; kajika frog [22]; iwana char [23]; Genji firefly [24]; miyama-kawatombo [25]; sawagani [26]; giant salamander [27]; serow [28] | Black swift, which nests behind waterfalls [29]; American dipper; harlequin duck; coastal tailed frog; Pacific giant salamander; coho and steelhead; banana slug; river otter *(verify)* | Plumbeous and white-capped water redstarts [30]; brown dipper [18]; crested kingfisher [20]; forktails; snow trout; red panda; Himalayan monal *(verify)* |
| Distinct from the Japanese garden | Medium-high. It is the wild source of the garden: spray-zone rock flora, cold-stream wildlife, cool wet greens and greys instead of pinks. Same country, a different world | Very high, but it reads as "another continent". Dark conifer mass, few flowers | Very high and colourful (primulas, rhododendrons, redstarts). It reads as an alpine or rhododendron scenery more than a waterfall |
| Paintability in this style | Excellent. It is the scene the art direction describes (Ghibli backgrounds, sumi ink, moss bleeding wet-in-wet). The S6–S10 painting already looks like this | Good, but heavy dark greens fight the "airy, warm paper" mood (ART_DIRECTION › Mood) | Good. Saturated primula and rhododendron colours press against the chroma ceilings |
| Overlap with the garden | Real wild sharing: maidenhair fern, momiji, violet, wild strawberry, susuki; striders, aka-tombo, wagtail, heron | Mostly look-alikes in the same genus (the *Adiantum* complex, *Acer*, *Lysichiton*), not the same species | Almost none (*Rhododendron* is the same genus but other species). Brown dipper and crested kingfisher are shared with A, not with the garden |

**Recommendation: A, a cool-temperate (beech-zone) gorge of central and northern Honshū, about
500–1500 m, on the snowy Sea of Japan side.**
- **Reference sites:** Oirase Gorge for the riparian forest of katsura, tochinoki and moss with dippers [5]; Nikkō for the big falls.
- **Sacred taki:** the tradition comes from Nachi no Taki, where the falls themselves are the object of worship and shide hang at Hiro-jinja [31]. Use it only as atmosphere (see §6).

**Why A:**
1. It fits the art direction, the painted scene and the voice of the notes, which are all about Japanese culture.
2. The roadmap's dipper and fish are native here.
3. It turns sharing into a story: the garden's maple, fern and violet came from places like this.
4. B and C are worth more as future sceneries of their own. C becomes the Himalayan rhododendron gorge (§5). B is a second waterfall in another realm and could come much later.

**Range consistency:** every pick below occurs in central Honshū's montane zone. Mizubashō reaches south only to central Honshū [12]. Tani-utsugi is snow-country only [14]. Iwatabako runs from Fukushima southward [1].

---

## 2. Twelve waterfall plants

Hex values are watercolour mixes kept under the ART_DIRECTION chroma ceilings. Each card says how
it differs from the garden species it might be confused with.

### 1. Rock tobacco — *Conandron ramondioides* — Iwatabako (イワタバコ)
- **Habitat and slot:** shaded wet rock faces and mossy cliffs up to about 1300 m [1][2]. Rock (ledge), path.
- **Tier and size:** 1, small.
- **Bloom:** violet, July–August. bloomColor `#9468b0`.
- **Illustrator:**
  - **Leaves:** one to three big puckered, wrinkled leaves pressed flat against the rock and hanging down it like tongues. Oval, toothed, glossy wet green (`#7f9a4e`, shade `#5e7140`).
  - **Flowers:** from the leaf base a thin red-brown scape (`#7a4a52`) arches out with a loose umbel of 5–12 small flowers. Each is a flat five-pointed star, violet-pink (`#9468b0`, paler `#b897c8`), with a yellow cone of anthers (`#e1b152`).
  - **Small size:** "a dark green tongue on the rock with a spray of violet stars".
  - **Unmistakable:** the leaf hangs downward and the stars are on threads. It is not the iris's purple, which is big falls on a stalk.
- **Note:** Its name means rock tobacco, for the broad, puckered leaves that hang flat against wet stone. It grows on shaded cliffs and mossy stone walls in ravines and flowers in midsummer, when the spray keeps the rock cool, and it is now scarce in several prefectures.
- **Line:** "Rock tobacco — small violet stars where the spray never dries."

### 2. Daimonji saxifrage — *Saxifraga fortunei* var. *incisolobata* — Daimonjisō (ダイモンジソウ)
- **Habitat and slot:** wet rocks along mountain streams, from low hills to alpine [3][4]. Rock, path.
- **Tier and size:** 1, small.
- **Bloom:** white, sometimes pink or red, September–November. bloomColor `#f6f1ea`.
- **Illustrator:**
  - **Leaves:** a low rosette of round, palmately lobed leaves (`#8b9c5a`) on reddish stalks (`#9a5a4a`).
  - **Flowers:** a sparse panicle of small flowers. Each has three short upper petals and two long lower ones, so it looks like the character 大. Use petal white `#faf6ee` with violet-grey shading `#cac2d4`, and seed a variety with pink-flushed tips (`#e7a3ae`), like the iris's VARIETIES.
  - **Small size:** a cloud of tiny white "大" marks above a dark rosette.
  - **Unmistakable:** the two long lower petals splaying down like legs.
- **Note:** Two long petals and three short ones make each flower the character 大, dai, "great", as on the bonfire mountain of Kyoto's Daimonji. It grows on wet rocks beside mountain streams and flowers late, in autumn, when little else in the gorge is in bloom.
- **Line:** "Daimonjisō — the gorge writes 'great' in small white hands."

### 3. Iwakagami — *Shortia soldanelloides* — Iwakagami (イワカガミ)
- **Habitat and slot:** rock faces and rocky montane places from southern Hokkaido to Yakushima, including steep canyon slopes beside streams [32]. Rock, path.
- **Tier and size:** 1, small.
- **Bloom:** pink, May–July. bloomColor `#e88ca8`.
- **Illustrator:**
  - **Leaves:** a tuft of round, very glossy leathery leaves (`#6d7c44`) with toothed red-bronze rims (`#a8574f`). Leave a lifted paper highlight on each: these are the "mirrors".
  - **Flowers:** a short reddish scape with 3–8 nodding bells, rose-pink (`#e88ca8`, deep `#c9607f`). The bell mouths are deeply fringed, so the edge reads as a fine broken line.
  - **Small size:** shiny dark coins with a few pink fringed bells.
  - **Unmistakable:** the fringed bell, and leaves that shine.
- **Note:** Iwakagami means rock mirror, for its round leaves that shine like polished bronze on the rock. In early summer it lifts a few pink bells, each fringed at the mouth, on mountain rocks from Hokkaido to Yakushima.
- **Line:** "Iwakagami — a rock mirror, holding up its small pink bells."

### 4. Wasabi — *Eutrema japonicum* — Wasabi (ワサビ)
- **Habitat and slot:** stream beds and banks of shaded mountain streams [10]. Shore (stream banks, pool rim).
- **Tier and size:** 1, small.
- **Bloom:** white, March–May. bloomColor `#f6f2e6`.
- **Illustrator:**
  - **Leaves:** a clump of long-stalked, round heart-shaped leaves with wavy edges (`#7f9a52`, young `#a8b572`). The stalks are pale green, flushed purple at the base. Paint the clump standing in water, with the base lost in a celadon glaze.
  - **Flowers:** short racemes of small four-petalled white crosses (`#f6f2e6`).
  - **Small size:** a fountain of green hearts at the water's edge.
  - **Unmistakable:** heart leaves on stalks rising from running water. There is no flower mass.
- **Note:** Wasabi grows wild along shaded mountain streams, where the water stays cold all summer. In places like Azumino and Okutama it is grown in terraced beds of flowing spring water; its small white flowers in spring show it is a cousin of the mustards.
- **Line:** "Wasabi — heart leaves in the cold current, the sharpness kept below."

### 5. Japanese primrose — *Primula japonica* — Kurinsō (クリンソウ)
- **Habitat and slot:** boggy ground beside mountain streams [11]. Shore, meadow.
- **Tier and size:** 2, medium.
- **Bloom:** magenta, May–June. bloomColor `#c9568a`.
- **Illustrator:**
  - **Leaves:** a basal rosette of long, spoon-shaped, crinkled leaves (`#8fae5e`).
  - **Flowers:** one stout stem with 2–5 separate whorls of flowers stacked up it like rings on a pole. Each whorl is a ring of flat five-lobed flowers, magenta (`#c9568a`, light `#e08aae`), with a dark eye (`#7a2b4f`). Seed a white variety (`#f6eef0`, pink eye).
  - **Small size:** a candelabrum of pink rings.
  - **Unmistakable:** the stacked tiers. No garden species is built like this.
- **Note:** Kurinsō means nine-ring plant, for its tiers of flowers stacked up the stem like the rings on a pagoda's spire. It grows in wet, boggy ground beside mountain streams and flowers as the beech leaves fill out in early summer.
- **Line:** "Kurinsō — a pagoda's spire of flowers, one ring at a time."

### 6. Baikamo — *Ranunculus nipponicus* var. *submersus* — Baikamo (バイカモ)
- **Habitat and slot:** cold, clear streams and spring-fed water; flowers June–September [9]. Water (pool, its calm right half).
- **Tier and size:** 2, medium. Water plant.
- **Bloom:** white, June–September. bloomColor `#f8f4ea`.
- **Illustrator:**
  - **Leaves:** long tresses of thread-fine, forked leaves streaming in one direction under the surface. Paint them in the underwater register, blurred and cool (`#6f9a6a` under a `#9cc6ba` glaze).
  - **Flowers:** at the surface, small white five-petalled flowers like plum blossom (`#f8f4ea`) with gold centres (`#e1b152`), each on a short stalk just above the water.
  - **Small size:** scattered white specks over a green streak.
  - **Unmistakable:** there are no pads at all. It must never read like the water lily.
- **Note:** Baikamo means plum-blossom water weed: in summer its small white flowers ride just above long green tresses that stream in the current. It needs cold, clear running water fed by springs, and it has vanished from many rivers as the springs have weakened.
- **Line:** "Baikamo — plum blossom in the current, in the middle of summer."
- **Biology:** baikamo is a plant of spring-fed streams more than of plunge pools. It belongs on the calm outflow side of the pool, toward the stream.

### 7. Asian skunk cabbage — *Lysichiton camtschatcensis* — Mizubashō (ミズバショウ)
- **Habitat and slot:** fens, wet woods and stream margins, from northern Japan south to central Honshū; flowers right after snowmelt [12]. Water (shallow margin), shore.
- **Tier and size:** 2, medium. Water plant.
- **Bloom:** white spathe, April–June. bloomColor `#f7f3e6`.
- **Illustrator:**
  - **Spathe:** a pure white hood, a pointed boat-shaped leaf curled around a stubby yellow-green club (`#c9c27a`). The white is reserved paper with a cool shade `#cac2d4` and a pooled edge.
  - **Leaves:** fresh, paddle-shaped leaves rise behind the spathe (`#8fae5e`) and grow large as the flower fades. Use the growth stages: spathe first, then the leaves.
  - **Small size:** a white sail standing in the shallows.
  - **Unmistakable:** a single upright hood. No other garden flower is shaped like it.
- **Note:** Mizubashō is the flower of the snowmelt: its white hood, a leafy spathe rather than a petal, rises from cold, wet ground in spring. The song "Natsu no Omoide" made the mizubashō of Oze a memory every schoolchild in Japan knows.
- **Line:** "Mizubashō — a white sail raised the week the snow lets go."

### 8. Toad lily — *Tricyrtis hirta* — Hototogisu (ホトトギス)
- **Habitat and slot:** shaded rocky cliffs and stream banks, low mountains from SW Hokkaido to Kyushu [33]. Rock (the 2 medium ledges), back (cliff foot).
- **Tier and size:** 2, medium.
- **Bloom:** white, spotted purple, September–October. bloomColor `#d9c7dc`.
- **Illustrator:**
  - **Stems:** arching or hanging hairy stems that lean out from the rock, with alternate clasping lanceolate leaves (`#8b9c5a`).
  - **Flowers:** upward-facing, star-shaped, 2–3 cm, in the leaf axils. Paint them as wet-in-wet white petals (`#f3ecef`) dotted all over with small purple spots (`#6b4a8c`). Dab the spots; do not stipple evenly. A central column of styles, also spotted.
  - **Small size:** freckled stars along a leaning stem.
  - **Unmistakable:** the spots. No garden flower is speckled.
- **Note:** Its speckled flowers are named after the lesser cuckoo, hototogisu, whose breast is barred the same way. It grows on shaded rocky slopes and stream banks, leaning its stems out from the stone, and flowers in autumn.
- **Line:** "Toad lily — freckled like the cuckoo's breast, leaning from the rock."

### 9. Japanese kerria — *Kerria japonica* — Yamabuki (ヤマブキ)
- **Habitat and slot:** mountain thickets, especially riversides and gorges [13]. Shore (the large rim slot), meadow, back.
- **Tier and size:** 3, large (shrub).
- **Bloom:** golden yellow, April–May. bloomColor `#e5b02f`.
- **Illustrator:**
  - **Shape:** a fountain of thin, arching green stems (`#8fa456`; stems stay green in winter) bending over toward the water.
  - **Leaves:** bright, sharply double-toothed, veined and pointed (`#9bb25a`).
  - **Flowers:** single five-petalled golden-yellow flowers (`#e5b02f`, shade `#c78f24`) spaced along the arches, not clustered.
  - **Small size:** yellow dots on green arches.
  - **Unmistakable:** the arching green canes. The chrysanthemum's yellow is a dense cushion.
- **Note:** A famous story tells of the warrior Ōta Dōkan asking at a cottage for a straw raincoat, a mino, and being handed a spray of yamabuki without a word. The girl was recalling an old poem lamenting that its flowers bear not a single seed, mi no hitotsu; it leans its yellow arches over mountain streams in spring.
- **Line:** "Yamabuki — gold leaning over the stream, keeping no seed."

### 10. Valley weigela — *Weigela hortensis* — Taniutsugi (タニウツギ)
- **Habitat and slot:** endemic to Japan, from western Hokkaido down the Sea of Japan side of Honshū; sunny mountain slopes and valleys [14]. Meadow (large), back (cliff-2, the crown).
- **Tier and size:** 3, large (shrub).
- **Bloom:** pink, May–June. bloomColor `#e992ab`.
- **Illustrator:**
  - **Shape:** an open, vase-shaped shrub of upright-to-arching branches, not a mound.
  - **Leaves:** opposite, oval, pointed, soft green (`#9cb46a`), slightly downy grey-green underneath.
  - **Flowers:** funnel-shaped, 2–3 at each leaf pair along the branch. Pale pink inside (`#f4bccb`), deeper rose outside (`#d9708f`).
  - **Small size:** pink trumpets in pairs along leaning wands.
  - **Unmistakable:** trumpets along branches. The azalea is a clipped mound covered evenly in open flowers.
- **Note:** Taniutsugi means valley utsugi, and it is native only to Japan, from Hokkaido down the snowy Sea of Japan side. In late spring its pink trumpets cover the sunny slopes above mountain rivers, pale inside and deeper rose outside.
- **Line:** "Taniutsugi — pink trumpets for the valley, when the snow is gone."

### 11. Katsura — *Cercidiphyllum japonicum* — Katsura (カツラ)
- **Habitat and slot:** a canopy tree of riparian forests, in valley bottoms and along streams [15]. Back (`cliff-1`), meadow (`bank-16`).
- **Tier and size:** 4, tree.
- **Bloom:** foliage. bloomColor `#e3a24c`, its autumn gold.
- **Illustrator:**
  - **Trunk:** several trunks from one base (it often sprouts a ring of stems), with grey, slightly shaggy bark (`#7e7a6e`).
  - **Crown:** a broad, rounded crown.
  - **Leaves:** small round heart-shaped leaves in pairs on short spurs. Dab them as round petals, never fans.
  - **Seasonal colour:**
    - spring: wine-red young leaves (`#b5525c`);
    - summer: blue-green (`#8ea870`);
    - autumn: apricot-gold with pink (`#e3a24c`, `#e9b46a`, `#e38f7e`).
  - **Small size:** a round, multi-stemmed cloud.
  - **Unmistakable:** the many trunks and the round leaves. The ginkgo is a single column of fans.
- **Note:** Katsura grows along mountain streams and valley bottoms, often as a ring of trunks around an old stump. In autumn its fallen heart-shaped leaves smell of burnt sugar, from maltol released as the leaves break down [34].
- **Line:** "Katsura — round hearts that turn gold and smell of caramel."

### 12. Japanese horse chestnut — *Aesculus turbinata* — Tochinoki (トチノキ)
- **Habitat and slot:** slopes and terraces of riparian valleys; floods do not harm it [16]. Back (`cliff-1`), meadow (`bank-16`).
- **Tier and size:** 4, tree.
- **Bloom:** cream with a pink blotch, May. bloomColor `#f1e6d2`.
- **Illustrator:**
  - **Trunk:** a straight, massive trunk (`#8e7960` into `#4a443c`).
  - **Leaves:** huge palmate leaves of 5–7 leaflets, like big green hands (`#7e9550`, shade `#6d7c44`). Paint each as a fan of long dabs from one point.
  - **Flowers:** in May, upright candle panicles stand on top of the leaf hands (`#f4ecd8`, blotch `#d47a6a`).
  - **Seasonal:** autumn ochre-brown (`#c79a4e`) and round spiny-less husks.
  - **Small size:** dark hands with white candles.
  - **Unmistakable:** the candles and the hands. Nothing in the garden is palmate at this scale; the momiji's hands are small and red.
- **Note:** Tochinoki, the Japanese horse chestnut, grows on the terraces of mountain valleys, and its great leaves and upright candles of flowers make it the largest presence in a gorge. Its bitter nuts were soaked and leached for days to make tochi-mochi, still sold in mountain villages *(verify)*.
- **Line:** "Tochinoki — great green hands, and white candles over the water."

### Summary and alternates

| Tier | Plants |
|---|---|
| 1 | iwatabako, daimonjisō, iwakagami, wasabi |
| 2 | kurinsō, baikamo, mizubashō, hototogisu |
| 3 | yamabuki, taniutsugi |
| 4 | katsura, tochinoki |

- **Two water plants:** baikamo and mizubashō.
- **Seasons:** spring (wasabi, mizubashō, yamabuki), early summer (kurinsō, iwakagami, taniutsugi, tochinoki), summer (iwatabako, baikamo), autumn (daimonjisō, hototogisu, katsura).
- **Pollinators:** all are pollinator plants except katsura (wind-pollinated) *(verify)*.

**Fern:** none in the twelve, because the scene already paints fern sprays and the garden's
maidenhair fern is shared (§4). For a 13th, take the **ostrich fern, *Matteuccia struthiopteris* —
kusasotetsu (クサソテツ)**. It is a streamside shuttlecock of upright plumes whose spring fiddleheads
(kogomi) are a mountain vegetable *(verify)*. It reads very differently from maidenhair.

**Other alternates:**
- iwagiboshi (*Hosta longipes*, lilac bells on cliffs, autumn) *(verify)*
- yama-ajisai (*Hydrangea serrata*, a lacecap of mountain streams [35]), but it is the same genus as the garden's hydrangea
- sugi (*Cryptomeria*), the sacred cedar of the taki approach [31]
- kawara-nadeshiko (*Dianthus superbus*, river gravel)
- yukinoshita (*Saxifraga stolonifera*), which blurs with daimonjisō (§6)

---

## 3. Eight creatures

Suggested order (garden counts as in `fauna-unlocks.ts`):

| # | Creature | Where | When | Unlock (suggestion) |
|---|---|---|---|---|
| 1 | Brown dipper | wet rocks, falls foot, stream | day, all year | always (resident; S13) |
| 2 | Miyama-kawatombo damselfly | air over the stream | day, May–Oct [25] | 2 plants |
| 3 | Iwana char (+ yamame variety) | pool | day, more at dusk | 3 plants (fish 1), 7 plants (fish 2) |
| 4 | Sawagani crab | stream stones, banks at the waterline | dusk and night, rainy days; Mar–Nov [26] | 8 plants |
| 5 | Kajika frog | a stone in the stream | evening, May–Aug [22] | 10 plants (a stone, not a pad) |
| 6 | Iwatsubame (Asian house martin) | air, sweeping the cliff face | day, summer [21] | 14 plants (in place of swallows) |
| 7 | Genji firefly | air over the stream and pool | night, late May–July [24] | 16 plants, night only |
| 8 | Yamasemi (crested kingfisher) | perch on the overhang, the pool | day, rare [20] | 20 plants, rare |

Optional "legend" tier for 25 plants: **kamoshika (Japanese serow)**, which stands motionless on the
crown for minutes. It is a special natural monument [28]. **Ōsanshōuo** (giant salamander) could be a
very rare night visitor at the pool edge, but see §6.

**1. Brown dipper — *Cinclus pallasii* — kawagarasu (カワガラス, "river crow")**
- **Behaviour:** stands on a wet stone and bobs (the dip) every second or two. Flies low and straight over the water, whirring. Wades, then walks under and vanishes for 5–15 s, reappearing nearby. Blinks a white eyelid [18]. Seen at Oirase [5].
- **Illustrator:**
  - **Body:** plump, wren-shaped, about 22 cm, entirely chocolate brown (`#5a4536`, back with a wet sheen `#6b5646`). Short cocked tail and strong grey legs.
  - **Eye:** a white eyelid flash, two frames.
  - **Read:** a dark round stub on a pale wet rock, the only bird that walks into the water. Not the sparrow: no pale belly, no streaks.

**2. Miyama-kawatombo damselfly — *Calopteryx cornelia* — ミヤマカワトンボ**
- **Range:** a large broad-winged damselfly of fast, shaded mountain streams, Honshū to Kyushu [25].
- **Behaviour:** perches on a twig or rock tip over the water. Slowly opens and claps its wings (a butterfly-like flutter, not the dragonfly's dart). Flies in short, fluttery hops back to the same perch. In courtship the wings make an X.
- **Illustrator:** a long thin metallic body, green-to-aquamarine (`#4f8f7e` with `#7eb4ac` lifts). Smoky amber-brown wings (`#a07a4e` at 40 %) with darker tips. Reads as two brown petals fluttering over the stream.

**3. White-spotted char — *Salvelinus leucomaenis* — iwana (イワナ)**
- **Habitat:** small, cold headwater streams [23]. The second fish is **yamame** (masu salmon, *Oncorhynchus masou*) *(verify)*.
- **Behaviour:** holds station in the pool's tail facing the falls' current (it does not wander like koi). Short sideways darts, a rare rise to sip an insect (ring), then drifts back. Under the `underwater` layer like koi.
- **Illustrator:**
  - **Iwana:** slim and torpedo-shaped. Olive-grey back (`#6f7258`) with pale cream spots (`#e8dfc8`), a warm buff-orange belly (`#d9a46a`), and white leading edges on the lower fins.
  - **Yamame variety:** silver-olive with a row of dark oval thumbprints along the flank (parr marks, `#5d5a6e`) and tiny black dots. The parr marks are ideal watercolour dabs.
  - **Read:** a dim, cool, spotted shadow in the deep. Never koi colours.
- **Roadmap:** rename S12 from "trout" to iwana or yamame (§6).

**4. Japanese freshwater crab — *Geothelphusa dehaani* — sawagani (サワガニ)**
- **Range:** endemic to Japan. Lives under rocks in the upper reaches of clean streams; mainly nocturnal, also active by day in rain [26].
- **Behaviour:** sidles out from under a stone, raises a claw, picks at the moss, and freezes when the camera or a bird comes near. Scuttles back sideways.
- **Illustrator:** carapace 2–3 cm, reddish-brown (`#b5614a`) with reddish legs and milky-white claws (`#efe6d8`) [26]. A blue-grey regional morph (`#7f8fa8`) is a nice rare variety. Reads as a red-brown comma with two white dots at the waterline.

**5. Kajika frog — *Buergeria buergeri* — kajika-gaeru (カジカガエル)**
- **Habitat:** mountain streams with many stones. Males sing from a stone in the current, May–June [22].
- **Behaviour:** sits flat on a stone in the stream. The throat sac swells and the head lifts as it calls, in evenings. Hops to another stone with a small splash.
- **Illustrator:** flat-bodied and grey-brown mottled like the rock (`#8a8070` with `#6b6458` blotches), with big toe pads and gold eyes (`#c99a3e`). Almost invisible until it moves.
- **Read:** it is not the garden frog. It is grey and lives on stone, not green on a pad. B1: its unlock should not need a water plant.

**6. Asian house martin — *Delichon dasypus* — iwatsubame (イワツバメ, "rock swallow")**
- **Habitat:** nests in colonies of mud cups under overhangs on vertical cliffs in mountain valleys and gorges [21].
- **Behaviour:** a loose flock of 3–8 swirls in arcs along the cliff face and through the falls' spray, now and then darting to the cliff (nest) and away.
- **Illustrator:** small, stubby swallow. Blue-black above (`#3a3f5c`), dusky white below (`#e6e1d8`), a bright **white rump patch**, and a short, shallow-forked tail. Not the barn swallow: no red face, no long streamers.

**7. Genji firefly — *Nipponoluciola cruciata* — Genji-botaru (ゲンジボタル)**
- **Habitat:** larvae live in clean streams and eat freshwater snails; adults fly in early summer [24].
- **Behaviour:** after dusk, 5–20 slow drifting lights over the stream and pool edge. Each pulses with a slow swell and fade of a few seconds, and they tend to flash together *(verify interval: eastern and western Japan populations differ)*. They rest on bank leaves.
- **Illustrator:** the light must be reserved paper with a warm yellow-green bloom (`#d8d97a`, rim `#b8c06a`). It is a painted soft dab whose opacity breathes, never a glow filter or sparkle (ART_DIRECTION anti-tropes). The body is a black speck with a red-orange pronotum (`#c9603e`) for close views.
- **Read:** night only, and the waterfall's own night signature.

**8. Crested kingfisher — *Megaceryle lugubris* — yamasemi (ヤマセミ)**
- **Range:** large, rare. Mountain rivers, including at waterfalls. Threatened in 32 of 47 prefectures [20].
- **Behaviour:** arrives fast and low along the stream. Perches on the overhanging branch or a high rock, raising and lowering its shaggy crest. Bobs its head, now and then hovers and plunges into the pool (big ring), returns, and leaves.
- **Illustrator:** pigeon-sized. Black-and-white finely barred all over, like sumi on paper (`#4a443c` dabs on reserved white), with a big shaggy crest and a heavy dagger bill. Reads as a speckled ink-wash bird. It is the most "suiboku" creature possible and suits the style.

---

## 4. Shared species

Rule: share only where the species really grows wild in a Honshū montane gorge, in the form the
sprite shows.

**Plants offered in the waterfall too:**

| Species | Why |
|---|---|
| Maidenhair fern (kujakushida) | The note itself says "grows in cool mountain woods… beside stones". *Adiantum pedatum* grows in spray and on wet rock [6] |
| Japanese maple (momiji) | Wild maples are dominant trees in gorges like Oirase [5]. The note already speaks of planting it "over moss and water" |
| Violet (sumire) | Many *Viola* grow in mountain woods and on rocks; the existing habitats already include rock. Borderline, because the true *V. mandshurica* is a sunny roadside violet. Fine if the sprite stays generic |
| Wild strawberry (no-ichigo) | The note: "small mountain berries… along forest paths". Path slots by the trail |
| Silver grass (susuki) | Grows on sunny banks and cliff tops everywhere in Japan. Meadow and back only, not at the pool |

**Plants not to share:**
- **Not wild in a gorge:**
  - black pine (coastal)
  - ginkgo (planted at temples)
  - plum and tree peony (Chinese, cultivated)
  - cosmos (Mexican)
  - white clover and the European dandelion (introduced)
  - chrysanthemum
  - balloon flower (sunny grassland)
- **Cultivated forms:**
  - hanashōbu (bred)
  - weeping cherry (planted)
  - wisteria (the sprite hangs from a bamboo trellis, though wild fuji grows on valley edges)
  - azalea (the sprite is a clipped karikomi mound; wild satsuki grows on river rocks, but in southern and western Honshū [17], outside the chosen region)
  - hydrangea (the mophead is a garden plant; the gorge has *H. serrata* instead)
- **Still water and paddies:**
  - lotus and water lily (still temple ponds; they do not grow in a cold plunge pool)
  - spider lily (paddy banks and graveyards)
  - shūmeigiku anemone (an old introduction that grows near habitation)
- **Invasive:** forget-me-not. *Myosotis scorpioides* is an invasive escape along Japanese rivers [36].
- **Southern range:** camellia (yabu-tsubaki is a warm, low-forest plant; the snow-country camellia is another species).

**Creatures shared:**

| Creature | Share? | Why |
|---|---|---|
| Water striders | yes | Pool margins only, never the stream |
| Dragonfly | partly | Share the **aka-tombo** variety only: it summers in mountains *(verify)*. Not the shiokara-tombo, a paddy and pond species |
| Butterflies | partly | The swallowtail, ideally as a mountain variety (miyama-karasuageha, *Papilio maackii*, which gathers on wet stream gravel *(verify)*). Not the cabbage white (farmland) |
| Bees | yes | Generic; Japanese honeybees and bumblebees live in mountain forests |
| Small birds | partly | The wagtail yes: the existing black-and-white wagtail is the Japanese wagtail, a bird of fast rivers and rocky streams [19]. The sparrow no: it lives with people |
| Heron | yes | Rare; grey herons fish mountain rivers |
| Falling leaf | yes | Make it a katsura or maple leaf |
| Koi | no | |
| Lily-pad frog | no | Replaced by kajika |
| Swallows | no | Barn swallows nest on houses; replaced by iwatsubame |

---

## 5. Habitat taxonomy for about 10 sceneries

**Tagging model.** Tags go on species and creatures; one profile goes on each scenery.

```ts
type Realm = 'japan' | 'east-asia' | 'himalaya' | 'europe' | 'mediterranean' | 'n-america-west' | 'neotropics' | 'n-africa-arabia';
type Biome = 'garden' | 'montane-stream' | 'wet-cliff' | 'temperate-forest' | 'bamboo' | 'wetland' | 'alpine' | 'coast' | 'heath' | 'desert' | 'cloud-forest';
type Climate = 'warm-temperate' | 'cool-temperate' | 'alpine' | 'oceanic' | 'arid' | 'tropical-montane';
interface Range { realms: Realm[]; biomes: Biome[]; climates: Climate[]; cultivatedIn?: Realm[] } // on SpeciesDef / creature
interface SceneryBiome { realm: Realm; biomes: Biome[]; climate: Climate; cultivated: boolean }   // on Scenery
// offered = realm ∈ realms && biomes ∩ scenery.biomes ≠ ∅ && climate ∈ climates
//        || (scenery.cultivated && realm ∈ cultivatedIn)      // gardens also host what people plant there
```

The existing slot habitats (`water`, `shore`, …) stay as they are: they decide *where in a scene* a
plant goes, and the tags decide *which scene*.

**Uniqueness test:**
- each scenery has at least 8 species offered nowhere else, and at least 60 % of its offer is exclusive;
- a curated per-scenery `exclude` list catches cases that are biologically true but blur the scenery (e.g. susuki).

| # | Scenery | Realm · biome · climate | Signature plants | Signature fauna | Shares (biology) |
|---|---|---|---|---|---|
| 1 | Japanese garden (exists) | japan · garden · warm-temperate, cultivated | peony, lotus, iris, plum, ginkgo | koi, heron | (hub: the cultivated ones stay here) |
| 2 | **Mountain waterfall** | japan · montane-stream, wet-cliff · cool-temperate | §2 | §3 | maple, maidenhair, violet, strawberry, susuki; striders, aka-tombo, wagtail, heron, bees |
| 3 | Bamboo grove and temple path (Arashiyama) | japan · bamboo, temperate-forest · warm-temperate | madake bamboo, shaga iris, camellia (wild), fuji | bush warbler, Japanese white-eye, tanuki | camellia, wisteria, maple, maidenhair → garden |
| 4 | Lotus marsh and rice terraces (Lake Biwa satoyama) | japan · wetland · warm-temperate | kakitsubata, water chestnut, nohanashōbu | egret, kingfisher (kawasemi), medaka, Tokyo daruma frog | lotus, water lily, spider lily, iris (wild form), striders, aka-tombo, heron |
| 5 | Alpine meadow (Japanese Alps) | japan · alpine · alpine | chinguruma, komakusa, kurumayuri, hakusan-ichige | rock ptarmigan (raichō), stoat, Parnassius | aka-tombo (summer), violet (other species), strawberry; mizubashō with the waterfall |
| 6 | Rocky coast and dunes (Izu, Sea of Japan) | japan · coast · warm-temperate | hamanasu, hamahirugao, gaku-ajisai, isogiku | black-tailed gull, osprey, shore crab | black pine, hydrangea (gaku-ajisai is its wild coastal form), susuki, camellia |
| 7 | Himalayan rhododendron gorge (Yunnan) | himalaya · montane-stream, cloud-forest · cool-temperate | rhododendrons, sikkimensis primulas [8], blue poppy, Magnolia campbellii | red panda, monal, plumbeous redstart [30] | brown dipper and crested kingfisher with the waterfall [18][20] |
| 8 | Highland moor and burn (Scotland) | europe · heath, montane-stream · oceanic | heather, bog cotton, foxglove, rowan | red grouse, red deer, curlew, Eurasian dipper | white clover, forget-me-not, dandelion: native in Europe; the garden's are introductions |
| 9 | Desert oasis (Sahara or Arabia) | n-africa-arabia · desert, wetland · arid | date palm, oleander, tamarisk, papyrus | fennec, sandgrouse, desert locust | almost nothing: maximally unique |
| 10 | Cloud forest (Monteverde) | neotropics · cloud-forest · tropical-montane | bromeliads, orchids, tree ferns, heliconia | quetzal, hummingbirds, glass frog, blue morpho | cosmos (Mexican, native nearby); fern relatives only |

Candidate B (Pacific Northwest falls) could later be an 11th scenery (n-america-west ·
montane-stream · oceanic). It would share only look-alikes, so it would feel unique.

---

## 6. Pitfalls

**Cultural sensitivity**
- **The taki is a shrine.** At Nachi the falls themselves are the object of worship, marked with shide [31].
  - If the painting hints at sanctity, keep it to a single shimenawa rope with shide across the lip.
  - No torii as decoration, no Fudō Myōō statue, no named real shrine, and no fauna or effects "playing" on the sacred rope.
  - Never use it as a reward prop.
- **Endangered plants and the "planting" metaphor.** Collecting is a named threat to iwatabako [2], iwakagami [32] and baikamo's habitat [9].
  - Notes must never suggest digging plants from the wild.
  - Avoid making rare orchids (iwachidori) or Shikoku's endangered jōrō-hototogisu signature plants.
- **Giant salamander.** It is a special natural monument [27], and in Kyoto's Kamo River most animals are hybrids with the introduced Chinese giant salamander [27]. If it appears, it is the native species, rare, at night, never handled, with no "catch" interaction.
- **Serow** is also a special natural monument [28]: same rule.
- **Fireflies are seasonal events in Japan**, with festivals and conservation drives. Keep them to night and early summer if seasons exist, rather than all year.

**Invasive associations**
- **"Trout."** Rainbow, brown and brook trout are invasives that have displaced iwana in headwaters such as Kamikochi [23]. Name S12 *iwana* or *yamame* and paint native markings.
- **Koi** in a mountain stream: carp are a classic invasive *(verify)*. They stay in the garden pond.
- **Forget-me-not** escapes along Japanese rivers [36]. Never share it to the waterfall, the marsh or the coast.
- **Itadori (Japanese knotweed)** grows natively on Japanese riverbanks but is notorious as an invasive in Europe *(verify)*. Leave it out of every scenery, and above all never offer it in the moor.
- **Skunk cabbage:** the *Lysichiton americanus* of candidate B is an invasive concern in Europe *(verify)*. Keep *L. camtschatcensis* in Japanese sceneries only.
- **No crayfish:** American and signal crayfish are invasive in Japan *(verify)*. The sawagani is the native crustacean.
- **Himalayan balsam** is native only to scenery 7 *(verify)*. Never share it to the moor.

**Too similar (blurs uniqueness)**

| Pair | Keep them apart by |
|---|---|
| Katsura vs ginkgo (both gold in autumn) | many trunks and round hearts vs one column of fans; katsura is also wine-red in spring |
| Baikamo vs water lily (white water flowers) | no pads, streaming tresses, tiny flowers |
| Iwatabako vs iris and violet (violet tones) | redder violet `#9468b0`, star umbels on threads, a hanging leaf |
| Taniutsugi vs azalea (pink shrubs) | open vase of arching wands with paired trumpets vs a clipped mound |
| Daimonjisō vs yukinoshita (same genus, same "大" flower) | ship only one (daimonjisō) |
| Maidenhair or ostrich fern vs the scenery's painted fern sprays | the ostrich fern's upright shuttlecock, not arching sprays |
| Dipper vs sparrow, both small brown birds | the dipper is uniformly dark, cocked, bobbing, and on wet rock in the water |
| Iwatsubame vs garden swallows | white rump, short tail, along the cliff |
| Kajika vs the garden frog | grey on stone vs green on a pad |
| Damselfly vs dragonfly | brown fluttering wings and a metallic green body |
| Kurinsō vs the garden's pinks | its stacked tiers are its identity: never show a single whorl |

**Habitat honesty and B1 concerns**
- Baikamo and mizubashō are stream and fen plants more than plunge-pool plants; place them on the calm, shallow outflow side.
- The current frog rule (a water plant, plus a pad) does not fit kajika (B1).
- Fireflies need a night-only visitor kind (B1).

---

## Sources
1. Conandron — Wikipedia: https://en.wikipedia.org/wiki/Conandron ; botanic.jp イワタバコ: https://botanic.jp/plants-aa/iwatab.htm ; Plant Delights: https://www.plantdelights.com/collections/conandron
2. Ishikawa Pref. Red Data, イワタバコ: https://www.pref.ishikawa.lg.jp/sizen/reddata/rdb_2010/data/documents/iwatabako2.pdf
3. botanic.jp だいもんじそう: https://botanic.jp/plants-ta/daimon.htm ; なめらだいもんじそう: https://botanic.jp/plants-na/nadaim.htm
4. Saxifraga fortunei — Temperate Plants DB: https://temperate.theferns.info/plant/Saxifraga+fortunei ; Oita Red Data: https://www.pref.oita.jp/10550/reddata2011/pdf/rdb/02/ss372.pdf
5. Oirase Gorge — towakomyu: https://towakomyu.com/en/oirase-gorge/ ; Towada walking map: https://towadako.or.jp/en/walking-map/oirase-gorge-nenokouchi/ ; More Than Tokyo: https://morethantokyo.com/waterfalls-oirase-gorge
6. Maidenhair fern — Sparrowhawk Native Plants: https://sparrowhawknativeplants.com/products/maidenhair-fern ; Friends of Silver Falls: https://www.friendsofsilverfalls.net/wildflowers-of-silver-falls-1/maidenhair-fern-adiatum-aleuticum
7. AskNature, mosses and ferns drink waterfall spray: https://asknature.org/strategy/mosses-and-ferns-drink-from-waterfall-spray/
8. Primula secundiflora — Wikipedia: https://en.wikipedia.com/wiki/Primula_secundiflora ; P. sikkimensis — naturelib: https://naturelib.net/plantae/primula-sikkimensis/ ; RBGE Notes (Kingdon-Ward): https://journals.rbge.org.uk/notes/article/download/2332/2152/12320
9. Ranunculus nipponicus — Wikipedia: https://en.wikipedia.org/wiki/Ranunculus_nipponicus ; Ishikawa Red Data バイカモ: https://www.pref.ishikawa.lg.jp/sizen/reddata/rdb_2010/data/documents/baikamo51.pdf
10. Wasabi — Wikipedia: https://en.wikipedia.org/wiki/Wasabi ; Japan Times: https://japantimes.co.jp/life/2015/03/17/food/wild-wasabi-proves-warrior-ingredient-many-dish ; Britannica: https://www.britannica.com/summary/wasabi
11. Primula japonica — Wikipedia: https://en.wikipedia.org/wiki/Primula_japonica ; Seattle Japanese Garden: https://www.seattlejapanesegarden.org/blog/2022/4/20/primula-japonica ; World Plants: https://worldplants.ca/display.php?id=3017
12. Lysichiton camtschatcensis — Hokkaido Univ.: https://hosho.ees.hokudai.ac.jp/tsuyu/top/plt/arum/lysichiton/cam.html ; MLIT Okubo Pond: https://www.mlit.go.jp/tagengo-db/common/001551398.docx
13. Kerria japonica — Wikipedia: https://en.wikipedia.org/wiki/Kerria_japonica ; WKD yamabuki: https://worldkigodatabase.blogspot.de/2012/05/yellow-rose-yamabuki.html
14. Weigela hortensis — Hokkaido Univ.: https://hosho.ees.hokudai.ac.jp/tsuyu/top/plt/honeysuckle/weigela/hor.html ; Rinya (Kinki): https://www.rinya.maff.go.jp/kinki/siga/mori-enjoy/okusimasyokubutu/taniutugi.html ; Kurashiki museum: https://www.city.kurashiki.okayama.jp/_res/projects/default_project/_page_/001/009/020/75.pdf
15. Cercidiphyllum — Springer, riparian forests: https://link.springer.com/10.1007/978-981-15-3009-8_4 ; Hokkaido Univ.: https://hosho.ees.hokudai.ac.jp/tsuyu/top/plt/katsura_tree/cercidiphyllum/jap.html ; Trees and Shrubs Online: https://www.treesandshrubsonline.org/articles/cercidiphyllum/cercidiphyllum-japonicum/
16. Aesculus turbinata — Kyoto Univ. (Ashiu): https://repository.kulib.kyoto-u.ac.jp/dspace/bitstream/2433/191984/1/frk_062_015.pdf ; Geographical Review of Japan: https://www.jstage.jst.go.jp/article/grj/88/5/88_431/_article/-char/en ; JaLTER Kanumazawa: https://db.cger.nies.go.jp/JaLTER/metacat/metacat/jalter-kanumazawa.3.2/jalter-en
17. Rhododendron indicum — Temperate Plants: https://temperate.theferns.info/plant/Rhododendron+indicum ; World Plants: https://worldplants.ca/display.php?id=10205 ; Wikipedia: https://en.wikipedia.org/wiki/Rhododendron_indicum
18. Brown dipper — Wikipedia: https://en.wikipedia.org/wiki/Brown_dipper ; Eguchi 1990, J. Ethology: https://link.springer.com/article/10.1007/BF02350282 ; BirdForum Opus: https://www.birdforum.net/opus/Brown_Dipper
19. Japanese wagtail — Japan Times: https://japantimes.co.jp/life/2005/03/24/environment/japanese-wagtail ; Ornithological Science 2008: https://www.jstage.jst.go.jp/article/osj/7/1/7_1_85/_article/-char/en
20. Crested kingfisher — Wikipedia: https://en.wikipedia.org/wiki/Crested_kingfisher ; oiseaux.net: https://oiseaux.net/birds/crested.kingfisher.html
21. Asian house martin — Wikipedia: https://en.wikipedia.com/wiki/Delichon_dasypus ; Japan Times "rock swallow": https://japantimes.co.jp/life/2007/07/11/environment/rock-swallow
22. Kajika frog — AmphibiaWeb: https://amphibiaweb.org/species/4634 ; Japan Times: https://japantimes.co.jp/life/2003/03/13/environment/singing-frog
23. White-spotted charr — Fausch et al. 2024 review: https://sites.warnercnr.colostate.edu/kanno/wp-content/uploads/sites/112/2024/11/Fausch-et-al-2024-Japanese-native-charr-review.pdf ; USGS: https://www.usgs.gov/publications/past-present-and-a-future-native-charr-japan
24. Genji firefly — Wikipedia: https://en.wikipedia.org/wiki/Nipponoluciola_cruciata ; Japan Times: https://japantimes.co.jp/life/2001/06/22/environment/genji-firefly ; JSCE study: https://www.jstage.jst.go.jp/article/jscejer/73/6/73_II_373/_article/-char/en
25. Calopteryx cornelia — Japan Times: https://japantimes.co.jp/life/2006/07/12/environment/jewelwing-damselfly ; mdwiki: https://mdwiki.org/wiki/Calopteryx_cornelia
26. Geothelphusa dehaani — Wikipedia: https://en.wikipedia.org/wiki/Geothelphusa_dehaani ; Orbis Pictus: https://orbis-pictus.jp/en/articles/sawagani.php
27. Japanese giant salamander — Wikipedia: https://en.wikipedia.org/wiki/Japanese_giant_salamander ; Hiroshima Univ.: https://www.hiroshima-u.ac.jp/node/77173 ; Sci. Rep. 2024: https://www.nature.com/articles/s41598-024-52907-6.pdf
28. Japanese serow — Wikipedia: https://en.wikipedia.org/wiki/Japanese_serow ; Gov. of Japan, Highlighting Japan Jul 2025: https://www.gov-online.go.jp/hlj/en/july_2025/july_2025-12.html
29. Black swift — BirdWeb: https://www.birdweb.org/BIRDWEB/bird/black_swift ; All About Birds: https://www.allaboutbirds.org/guide/Black_Swift/lifehistory
30. Plumbeous water redstart — Great Himalayan NP: https://www.greathimalayannationalpark.org/?p=1944 ; White-capped redstart — BirdForum: https://www.birdforum.net/opus/White-capped_Redstart
31. Nachi Falls and Hiro-jinja — MLIT multilingual DB: https://www.mlit.go.jp/tagengo-db/common/001548875.docx ; JNTO: https://www.japan.travel/en/spot/972/
32. Shortia soldanelloides — Wikipedia (Shortia): https://en.wikipedia.org/wiki/Shortia ; Oita Red Data: https://www.pref.oita.jp/10550/reddata2011/pdf/rdb/02/ss481.pdf ; botanic.jp いわかがみ: https://botanic.jp/plants-aa/iwakag.htm
33. Tricyrtis hirta — Wikipedia: https://en.wikipedia.org/wiki/Tricyrtis_hirta ; Japan Times: https://www.japantimes.co.jp/life/2000/12/13/environment/quest-for-the-yellow-flowered-toad-lily
34. Katsura scent — UW Hort. Library: https://depts.washington.edu/hortlib/pal/on-the-sweet-smell-of-katsura-leaves ; Popular Science: https://www.popsci.com/story/science/katsura-tree-fall/
35. Hydrangea serrata — botanic.jp やまあじさい: https://botanic.jp/plants-ya/yaajis.htm ; Landscape Planning & Horticulture (Rokko): https://www.jstage.jst.go.jp/article/keikanengei/23/0/23_31/_article/-char/en
36. Myosotis scorpioides — NIES Invasive Species of Japan: https://www.nies.go.jp/biodiversity/invasive/DB/detail/80950e.html
37. Deutzia crenata (considered and dropped: not a riparian plant) — NARO: https://www.naro.affrc.go.jp/org/nkk/m/111/09-01.pdf
