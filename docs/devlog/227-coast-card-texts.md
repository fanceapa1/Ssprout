# 227 · GA2: The coast's card texts

## What
The text items of the coast's acceptance (devlog 225, open items 2, 14, 15 and 22):
1. **Shared plants in each garden's words (ADR 0385).** The caper, southern maidenhair, grapevine,
   pomegranate and oleander showed the oasis's Darija names and notes about seguias, palm trunks and
   oueds at the coast. A species may now give one garden its own native name (always with its
   language) and card line: optional `SpeciesDef.in`, read through `speciesWords(def, sceneryId?)`,
   which falls back word by word to the species' own. The plant card, Your plant, the herbarium and
   the planting sheet ask with the plant's (or the garden on view's) garden; the studio asks with
   none. The five got Greek names checked in the Greek Wikipedia (references 33–37 added to
   `docs/research/coast-biome.md`, §4), and the three whose lines or notes named oasis places got
   coast lines and notes.
2. **One house style on the coast's cards.** The other three gardens write names in title case
   ("Japanese Iris", "Wild Jujube", "Southern Cattail"; only the oasis's "Date palm" is not, and it
   was left alone) and lead the line with the name and an em dash. Nine coast names and seven lines
   followed another style and now follow this one (table below). Greek native names lost their
   stress accents, as the research writes them (Eliá, Péfko, Kyparíssi); the two the research marks
   *(verify)* show the Latin instead (ice plant: Lampranthus; sea holly: Eryngium maritimum), as the
   tree spurge and the Jerusalem sage already did. The Aleppo pine's is the research's πεύκη
   (pefki), not πεύκο.
3. **The habitat line (ADR 0386).** It was derived from the species' habitats, so the sea lavender
   (splash rocks only) read "on the walls and rocks". A habitat whose sites a species takes only
   some of is now named by those sites (`SITE_WORDS`: "on the walls", "on the rock ledge", "on the
   splash rocks", "on the beach"), and the placement markers and prompt name a slot by its site.
4. **Notes checked against the research.** Every coast note was read claim by claim against the
   brief; unsupported claims were cut or replaced with supported ones (list below).
5. **Arrival lines.** Five coast lines named one perch of a creature that chooses among several.
6. **`inSentence`** kept only "Japanese" capitalised, so the coast read "the greek coast", "your
   mediterranean cypress", "aleppo pine", "jerusalem sage"; it now keeps Greek, Mediterranean,
   Aleppo and Jerusalem. (The waterfall's "Asian Skunk Cabbage" still reads "asian skunk cabbage" in
   a sentence; left, as the other gardens' texts were not to change.)

## The other gardens are unchanged
A throwaway Vitest file dumped, for every species each garden offers, its name, the name in a
sentence, native name, language, line, habitat line and note (`speciesNote(id, garden)`), before
and after: the Japanese garden, the waterfall and the oasis, 60 lines, are identical except one
deliberate change, the oasis's olive (below). Only coast lines differ (21 lines, every one of the
coast's species touched by at least one item above).

**One deliberate oasis change** (its own commit, easy to drop): the olive's native name was the
Greek "Eliá" in the oasis too, the same fault the other way round. The oasis now reads "Zitoun"
(`ary-Latn`), the Darija name its own note and the oasis research give.

## Table: card words that changed
Coast unless said. Lines are the card's poetic line.

| Species | Garden | Old name · native · line | New |
|---|---|---|---|
| Caper | coast | Caper · Kebbar (`ary-Latn`) · "Caper — a flower for a single day, on the crumbling wall." | Caper · **Kappari** (`el-Latn`) · same line |
| Southern maidenhair | coast | Southern Maidenhair · Qesbour l-bir · "Southern maidenhair — green hair spilling where the wall weeps." | Southern Maidenhair · **Polytrichi** · same line; coast note (Aphrodite's hair; springs, rock cracks, wells, damp places by the sea) |
| Grapevine | coast | Grapevine · Dalia · "Grapevine — a green roof on palm posts, sweet bunches in its shade." | Grapevine · **Ampeli** · "Grapevine — a leafy roof over the terrace, sweet bunches in its shade."; coast note (pergola, κληματαριά) |
| Pomegranate | coast | Pomegranate · Rremman · "Pomegranate — little crowns ripening in the palms’ shade." | Pomegranate · **Rodia** · "Pomegranate — little crowns ripening red by the terrace wall."; coast note (Persephone, a gift to a new home) |
| Oleander | coast | Oleander · Defla · "Oleander — pink pinwheels in the dry bed of the oued." | Oleander · **Pikrodafni** · "Oleander — pink pinwheels at the back of the beach."; coast note (Greek stream beds, coastal gardens, poisonous) |
| Olive | oasis | Olive · Eliá (`el-Latn`) | Olive · **Zitoun** (`ary-Latn`) |
| Olive | coast | Olive · Eliá | Olive · Elia |
| Aleppo pine | coast | Aleppo Pine · Péfko | Aleppo Pine · Pefki |
| Cypress | coast | Mediterranean Cypress · Kyparíssi | Mediterranean Cypress · Kyparissi |
| Ice plant | coast | Ice Plant · Mesimvrianthemo (`el-Latn`) | Ice Plant · Lampranthus (`la`) |
| Sea holly | coast | Sea holly · Eryngio · "Sea holly: a frosted, spiny clump crowned with blue thistle heads." | Sea Holly · Eryngium maritimum (`la`) · "Sea holly — a frosted, spiny clump crowned with round blue heads." |
| Cyclamen | coast | Ivy-leaved cyclamen · "Ivy-leaved cyclamen: silver-marbled leaves…" | Ivy-leaved Cyclamen · "Ivy-leaved cyclamen — silver-marbled leaves…" |
| Jerusalem sage | coast | Jerusalem sage · "Jerusalem sage: tiers of hooded gold…" | Jerusalem Sage · "Jerusalem sage — tiers of hooded gold…" |
| Pink rock rose | coast | Pink rock rose · "Pink rock rose: crumpled silk blooms…" | Pink Rock Rose · "Pink rock rose — crumpled silk blooms…" |
| Rock samphire | coast | Rock samphire · "Rock samphire: a fleshy green cushion…" | Rock Samphire · "Rock samphire — a fleshy green cushion…" |
| Sea lavender | coast | Sea lavender · "Sea lavender: a lilac froth…" · habitat "on the walls and rocks" | Sea Lavender · "Sea lavender — a lilac froth…" · "on the splash rocks" |
| Tree spurge | coast | Tree spurge · "Tree spurge: a lime-yellow dome…" | Tree Spurge · "Tree spurge — a lime-yellow dome…" |
| Sea daffodil | coast | Sea daffodil | Sea Daffodil |
| Peacock's tail | coast | Peacock's tail | Peacock's Tail |

Habitat lines that changed at the coast: cyclamen, ice plant and southern maidenhair "on the walls"
(was "on the walls and rocks"); rock rose and Jerusalem sage "on the rock ledge"; rock samphire "on
the rock ledge · on the splash rocks · on the beach"; sea lavender "on the splash rocks". The caper
keeps "on the walls and rocks" (it takes all three).

## Notes: what was cut or changed
Read against `docs/research/coast-biome.md`; a claim the brief did not hold was cut, or kept with a
checkable source added to the brief.
- **Olive:** "yet it keeps fruiting" → "like wrung rope" (the brief's image of the old trunks).
- **Aleppo pine:** "a habit kept from the days when resin sealed the wine jars" cut; the retsina
  line kept and the cones rephrased ("open slowly over several years, sooner in the heat of a
  fire") with Wikipedia added as source [40].
- **Cypress:** "grows wild in the hills of Crete" → "grows wild on Crete" [41].
- **Cyclamen:** "olive groves" → "pine woods" (the brief: under pines and scrub); flowers come up
  *before* the leaves (the brief), where the note had them nodding above them.
- **Ice plant:** "fleshy leaves hold water through the summer" and "spring colour" (the flowering
  months are *(verify)*) cut; the flowers close at dusk and in dull weather; Carpobrotus named as
  the one that has run wild on Greek cliffs [8].
- **Lavender:** "thrives on poor, sun-baked soil", "cut to scent linen and drawers" and "from
  morning until the heat of the afternoon" cut; now: a garden plant in Greece, the wild Greek
  lavender another species, worked by bees and the hummingbird hawk-moth.
- **Sea daffodil:** "a white lily" (it is an amaryllis) → "a white-flowered bulb"; "opens towards
  evening" → most fragrant towards evening; "only ever painted, never picked" → protected by Greek
  law, declining where beaches are built on.
- **Sea holly:** "thistle", "a taproot as long as a forearm", "a chalky bloom against salt and sun"
  and "protected on many coasts" cut; now the brief's leaves, heads, bracts and visitors.
- **Sea lavender:** "stay in colour long after they dry" and "in summer" *(verify)* cut; Greek coasts
  hold many kinds, several endemic [14].
- **Rock samphire:** "salty", "turn olive and purple as the seed ripens" cut; July to October, the
  quays and shingle, krethmon [10].
- **Posidonia:** "shelter young fish and keep the water clear" → roots, flowers and fruit [16].
- **Cystoseira:** "shelter young fish", "their loss is a warning" cut; forests in shallow clear water.
- **Peacock's tail:** "one of the few seaweeds that lay down lime" → it lays down lime [11].
- **Jerusalem sage:** "wrinkled" cut.
- **Pink rock rose and ladanum:** kept, as "its sticky leaves give ladanum, a fragrant resin once
  combed from the beards of the goats that browsed it", with two sources added to the brief:
  Wikipedia's *Labdanum* (Cistus creticus a source; collected by combing goats' and sheep's beards,
  citing Rhind 1857) [38] and Herodotus, *Histories* 3.112, read in Rawlinson's translation on
  Wikisource (ladanum gathered from the beards of he-goats) [39]. "Aromatic" was cut.
- The shared species' coast notes use only the brief and the Greek Wikipedia pages [33]–[37]; the
  maidenhair's "water rolls off its leaflets" (in its oasis note, not in either research) is not in
  its coast note.

## Arrival lines (item 14)
The lizard's line at night is **shared behaviour, by design**, not a coast bug: the fauna system
emits `fauna:arrived` the first time an unlocked creature is in view, and the quiet line queues
the line until the garden is calm and shows it for about 6 s, whether or not the creature is still
there, in every garden (`src/ui/quiet-line.ts`). After `addPlants` many creatures unlock at once,
so their lines queue for minutes; a jump to night (or a real dusk) during that queue says a day
creature's line at night. Most likely that is what the acceptance saw; it was not reproduced. A fix
(drop a queued line whose creature has gone) needs the fauna system to answer "is it still here",
a new UI dependency, the `main.ts` wiring, and a choice about rare creatures whose line would be
lost: not small, and not clearly right, so it is not done; `docs/systems/fauna.md › Arrivals`
says it now.

Each coast line was checked against what the creature does (`docs/systems/fauna.md`):
- cicada: lives on both trees' bark → "A cicada sings on the trunk of a tree." (was "the olive's").
- scops owl: olive, pine and wall copings → "A scops owl calls after dark." (was "from the olive").
- blue rock thrush: the temple, copings and ledges → "…sings from a high stone." (was "the
  temple's columns").
- rock crab: the splash rocks and the pools' rims → "…sidles over the rocks by the sea."
- swallows: the sky over the cove (no village nest) → "Swallows sweep through the sky over the cove."
- true as they were: gull, lizard (the terrace walls, by day), cabbage white, bees, swallowtail,
  goats, tortoise, damselfish (the shoal is painted juvenile blue), octopus, heron, dolphins. The cat
  is not announced; the hoopoe and the gecko have no module yet, so their lines are never said.

## Still unverified, still shown
- The rock rose's "Kistos" and the sea daffodil's "Krinos tis thalassas" are from the brief
  without a *(verify)* mark, but no Greek speaker has read any of the Greek names.
- The damselfish (*Chromis chromis*) and the Balkan green lizard's Ionian record stay *(verify)* in
  the brief; their arrival lines name them ("A shoal of blue damselfish…", "A Balkan green lizard…").
- The caper is offered "along the path" at the coast (its `path` habitat, from the oasis); the brief
  lists only walls and splash rocks for it. That is its habitats, not its text: left for a slot or
  species task.

## Tests
- Unit: `plants/words.test.ts` (new: the fallback rule; every species' garden words name a garden
  that offers it, a native name with its language, a line under 80 characters led by the name);
  `ui/plant-card.test` and `ui/planting-sheet.test` (a shared species in each garden's words);
  `ui/format.test` (`placesPhrase`, `slotPlace`, `inSentence`, two coast arrival lines).
- E2E: `sceneries.spec` › "a shared species’ card speaks the coast’s words…" (the sheet, the card,
  Your plant and the herbarium in the coast and the oasis); the slot-sites test now reads the sea
  lavender's "on the splash rocks", the maidenhair's "on the walls" and a marker's label.
- Screenshots looked at: see the session scratchpad (`ga2/shots/`).

## Left open
- `SITE_WORDS` is one set for every garden; a second garden with sites may want its own.
- Queued arrival lines have no expiry (above).
- "Asian Skunk Cabbage" lower-cased in a sentence at the waterfall.
