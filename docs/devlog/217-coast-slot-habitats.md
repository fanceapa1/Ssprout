# 217 · Where plants grow on the coast (GL1a, phase 15)

The owner saw land plants growing out of the sea on the Greek coast. Every coast `rock` slot, the
splash rocks standing in the sea among them, took every `rock` plant, so an ivy-leaved cyclamen or
an ice plant could stand on a rock in the water. The review also saw a cyclamen on the beach.

## What was wrong
- `rock` covers three kinds of place: the terrace walls' copings and cracks, the bastion's headland
  ledge (`shelf-1`) and three splash rocks in the sea. A species could only say "rock".
- `scrub-2` (80, 826), "by the pine's rock" when it was laid out, lies on the beach's sand since the
  pine moved (G4b). It was a `back` slot, so the cyclamen and the rock rose grew on the beach.
- The southern maidenhair takes `shore` for the oasis's spring margin, so it was offered on the
  coast's pebble beach too.

No existing habitat fits the splash rocks honestly (as `shore` they take the dune plants, as `water`
the algae), so the fix is a contract change, additive and optional (ADR 0383).

## The change
- `Site` (`wall`, `ledge`, `sea-rock`, `beach`), `Slot.site?` and `SpeciesDef.sites?`. A slot with a
  site takes only species that list it (`fitsSite` in `isCompatible`).
- Every reader of the fit goes through `isCompatible`: placement options and markers, the planting
  sheet's "nowhere to go" (both through `controller.placementOptions`), the reducer at
  `session/start`, `sprout.addPlants`. The planting sheet's habitat line drops a habitat whose
  slots' sites the species lacks, so the maidenhair reads "on the walls and rocks" on the coast.
- The coast's walls and cracks are `wall`, `shelf-1` is `ledge`, the splash rocks `sea-rock`, the
  beach `beach`. `scrub-2` becomes a `shore` slot with the site `beach` under its old id.

## Coast species and their places (from docs/research/coast-biome.md)

| Species | splash rock | wall | ledge (bastion) | beach | other |
|---|---|---|---|---|---|
| caper | yes | yes | yes | – | path |
| rock samphire | yes | – | yes | yes | – |
| sea lavender | yes | – | – | – | – |
| cyclamen | – | yes | – | – | beds, scrub |
| ice plant | – | yes | – | – | beds, path |
| southern maidenhair | – | yes | – | – | – |
| rock rose | – | – | yes | – | path, scrub |
| Jerusalem sage | – | – (medium) | yes | – | beds, scrub |
| sea holly, sea daffodil | – | – | – | yes | – |
| oleander | – | – | – | yes (`beach-2`) | `scrub-1` |
| tree spurge | – | – | – (large) | – | `scrub-1` |

The rock samphire stays off the terrace walls (a sea-cliff and shingle plant), the sea lavender is
on "salty rock" only, the ice plant never on a cliff, the beach or a splash rock (research §6). The
rock rose and the Jerusalem sage got `rock` back for the bastion's ledge. The tree spurge did not:
the one ledge is `medium`, and giving it `rock` would have put "on the walls and rocks" on its card
with no slot behind it.

## Proof the other gardens are unchanged
A throwaway test listed, for all four gardens, every slot with the offered species that fit it,
before and after. The two listings differ only in coast lines (beach, rock and `scrub-2` slots, and
the species line of the rock rose and the Jerusalem sage). The Japanese garden, the waterfall and
the oasis have no sited slot; the offers (21 coast, and each other garden's) are the same, since
flora does not read sites. `src/scenery/coast/sites.test.ts` keeps both facts: the other gardens'
slots have no site, and every coast species' slots are pinned.

## More room for large plants: none found
I looked for one to three places for another large wild plant and planted the candidates:
- **The bastion (`shelf-1`) as `large`**: a tree spurge's dome hangs over the cove from the water's
  edge and reads as a shrub growing in the sea (scratchpad `gl1a-rejected-bastion-large.png`); it
  also covers `shallows-3`. Kept `medium`.
- **The cliff top left of the olive**: the goats' cliff-top track (x 884–1040) and their ledges run
  there, and it lies behind the tree slot `top-1`'s crown (an olive or the grapevine pergola there
  hides it); further left is the temple.
- **The cliff foot at the top terrace's east end** (x 1507–1530, the painted phrygana at 1500): a
  large box from y 300 hides the goats' east ledges (y 360–404) and the cat's top walk.
- **The terrace beds**: any large bed hides a raised bed behind it (`mid-3`, `mid-5`, `low-3`) or
  the scenery olive's trunk (`top-2`, `top-3`); the left ends sit in front of or behind `mid-1`'s
  large box. The foreground is in the paper margin's fade (not this task).
So `scrub-1` stays the one place for the Aleppo pine, the tree spurge and the oleander off the beach,
and `top-1`/`mid-1` the cypress's. A second large place needs a painting or layout decision: a
cliff-top pocket clear of the goats in the background repaint, or giving up a bed.

## Checked
- Shots at noon, desktop: the full garden on seeds 11 and 23 (`gl1a-full-seed11.png`,
  `-seed23.png`), the splash rocks close with sea lavender, rock samphire and the beach plants
  (`gl1a-splash-rocks.png`), the tree spurge on `scrub-1` (`gl1a-scrub1-spurge.png`). A third seed
  (5) checked by the API: every planted plant in a slot its species fits. Nothing planted wrongly.
- No wildlife pin moved: no slot moved, and the heron, perches and ground tests pass with `scrub-2`
  as a beach slot.
- Unit: the contract (placement, reducer, fill-garden, planting sheet, registry), the coast's sites,
  the rock rose's, Jerusalem sage's and sea lavender's coast slots. E2E: a coast test in
  `sceneries.spec.ts` (placement options, the real placement markers for the sea lavender, the
  maidenhair's habitat line, `addPlants` keeping to the sites).

## Left open
- One large wild place on the coast (above).
- `src/main.ts` untouched.
