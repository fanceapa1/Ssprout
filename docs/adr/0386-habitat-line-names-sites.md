# ADR 0386: The habitat line and the placement prompt name a slot's site

- Status: accepted
- Date: 2026-11-22
- Amends: ADR 0383 (slot sites)

## Context
The planting sheet's habitat line named each habitat where a species can grow in the garden's words
(`habitatWords`), dropping a habitat whose sited slots the species may not take (ADR 0383). The
coast's `rock` covers three sites, the walls, the bastion's ledge and the splash rocks, and its word
is "on the walls and rocks". So the sea lavender, which grows only on the splash rocks, read "on the
walls and rocks"; the cyclamen and the ice plant, wall plants only, read the same; and the placement
prompt said "will grow on the walls and rocks" for a splash rock.

## Decision
- **`SITE_WORDS`** (`src/ui/format.ts`): wall "on the walls", ledge "on the rock ledge", sea-rock
  "on the splash rocks", beach "on the beach". One set for every garden: a site is already a
  particular kind of place, and only the coast sets sites.
- **`placesPhrase(def, slots, words)`** builds the habitat line: per habitat of the species with a
  slot it fits, the habitat's word when the species takes every site the habitat's slots have (or
  the habitat has slots without a site); otherwise the words of the sites it takes, in `SITES`
  order. Repeated words are said once.
- **`slotPlace(slot, words)`** names one slot: its site's word, else its habitat's. The placement
  markers' labels and the prompt ("will grow on the splash rocks") use it.

## Consequences
- The sea lavender reads "on the splash rocks", the cyclamen "on the walls · in the terrace beds · in
  the scrub", the rock rose and the Jerusalem sage "on the rock ledge"; the caper keeps "on the walls
  and rocks", having all three.
- The Japanese garden, the waterfall and the oasis have no sited slot, so every line and prompt
  there reads as before (devlog 227's dump of every card in all four gardens).
- A garden that later sets sites gets these words; if it needs its own, `SITE_WORDS` can move onto
  the scenery then.
