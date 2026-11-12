# 172 · Ice plant (GP2, phase 15)

## What
The Greek coast's loudest colour: the **ice plant** (*Lampranthus*, a South African garden succulent),
a tier-1 `small` plant. It adds only files:
- `src/plants/species/ice-plant.ts`: the definition and the plan (`planIcePlant`).
- `src/plants/lib/ice-plant-paint.ts`: new helpers (dome geometry, the lobe body with its fingers,
  the flower field, the spilling fingers). Imported only by the species. No shared `lib/` helper
  was edited; `plantFrame`, `groundShadow`, `seedMound`, `shadowSide` and the growth easings are
  only imported.
- `src/plants/species/ice-plant.test.ts`, `src/plants/notes/ice-plant.ts`.
- Rows in `docs/TESTING.md` (GP2.1) and `docs/systems/plants-species-a.md`.

Fields: tier 1, `small`, box 86×86 drawn in the 70-unit design box, anchor .5/.7; habitats
`meadow`, `rock`, `path`; `nativeName: 'Mesimvrianthemo'`, `nativeLang: 'el-Latn'` (the research
doc marks the Greek name "verify"); bloomColor `#c42b93`; `pollinators: true`.

## Range decision
`range: { realms: [], biomes: [], climates: [], cultivatedIn: ['mediterranean'] }`, the same shape as
the alfalfa's. It has no wild range, so no wild garden offers it, and the `mediterranean` realm
exists already in `REALMS`. Only a *cultivated* scenery in that realm offers it. A test shows that
none of the three existing gardens' profiles offer it and that a cultivated `mediterranean` profile
does. No new climate or biome word was needed. The scenery task still has to give the coast a
`cultivated: true` profile with realm `mediterranean`, and a `rock`/wall slot for the plant. The
Note says it is a *Lampranthus* garden plant and not the invasive *Carpobrotus edulis*.

## How it is painted
- **Ground view** as the colocynth: depth shrinks to 0.42 (about 25° up). The plant is 4–5 flattened
  domes (a main one with 2–3 satellites and sometimes one behind), each planned in unit-disc
  coordinates, profile `Z = h (1 − s)^q`, so a cushion rather than a ball.
- **Lobe body** (one wet layer per lobe): a pale sage fill of the dome's outline (the farthest
  surface point in each of 40 directions, wobbled and rounded) and 29–35 fleshy finger leaves
  (`petal` dabs, grey-green `#8aa88a` to deep `#5f8068`) pointing along the dome's normal. Fingers
  near the crown get shorter as the flowers cover them.
- **Flower field** (one wet layer per lobe, source-over): a deep violet-magenta wash, light and
  shadow blotches clipped to the dome, then every flower back to front. A flower is a star of 15–21
  satin rays, a lighter inner star offset to the light and a pale-yellow eye, squashed to the dome's
  slope. Plain fills in the layer, so the whole mat of 240–340 flowers is 8–10 drying passes.
- **Tone:** a shading value from the dome's light (upper left), the rim and the blotches picks
  shade → mid → pale, so the top left of each cushion glows and the folds go deep violet-crimson.
- **Colour by seed:** magenta (50 %), hot pink (22 %), crimson (28 %), picked in the plan. The same
  mechanism as the chrysanthemum's colourways: a table and one rng draw.
- **Spill:** a front-half ring of short fingers over the rim, in one layer over all lobes.
- **Growth** (continuous over 200 steps, tested): earth and a seed, then a few green fingers
  (0–0.15), the green cushions swell (main by 0.5, satellites by 0.56–0.64), the first buds open on
  the green (0.4–0.6), the wash and the flowers fill in (0.55–1), all open by 1.
- **Cost:** 36 ms median (29–42) at growth 1, 1.6×, seeds 2–9, on the main thread in headless
  Chromium against the dev server, on a loaded machine. White clover measured 43 ms (31–55) in the
  same run. Inside the 4–127 ms budget and the brief's 60 ms.

## Looked at
Shots are in the scratchpad (not committed): the six-seed sheet, the ten-stage sheet, a 10× close
view, the studio card and the tier-1 line-up (`plants-a-review/lineup-t1`).
- Round 1: stars with sharp saw teeth, a wash too dark so the gaps read as dark berries, big
  laurel-like leaves lying over the flowers, lobes with ghost blotches sticking out of their outline.
- Round 2: softer rays, a lighter wash, blotches clipped to the dome, fingers much smaller. It then
  read as a flowering cushion.
- Round 3: more saturated mid, the pale kept for the lit side, the crimson deepened; growth: fingers
  on the earth at 0.1 (they only showed from 0.16 before), body fill fading in later.
- On the line-up it is the only mat and the loudest colour, clearly not the white clover (white
  pompoms), alfalfa (upright violet clumps), violet (heart leaves) or colocynth (yellow gourd vine).
- Ids after `anemone` do not change `ui-shell` or `widget` (they draw `allSpecies()[0]`).

## Left open
- The lobes still read a little as separate heaps; a real mat is more continuous.
- Flowers are all the same star; no half-closed flowers, no dull-weather closing.
- No wall or gravel edge under it: the spilling fingers are the only hint; the scenery's wall slot
  has to carry it. Not seen in a garden yet (the coast scenery is not in this tree).
- The crimson reads slightly coral in the lit patches.
- A few fingers float beside the young cushion at growth 0.2 before their lobe's body exists.
- The sprite uses only the lower half of its box (a wide low mat).
- Greek name and the spring flowering months are unverified (research doc "verify").

## For the orchestrator to place
`| 172 | [GP2: Ice plant](172-ice-plant.md) | A low cushion of 4–5 grey-green finger-leaf domes buried under 240–340 satin-rayed daisies with pale-yellow eyes, magenta, hot pink or crimson by seed, sunlit pale on the upper left and deep violet in the folds; Mediterranean gardens only, cultivated | Range shape as the alfalfa (`cultivatedIn: ['mediterranean']`); lobes read as heaps; not seen in a garden yet |`
