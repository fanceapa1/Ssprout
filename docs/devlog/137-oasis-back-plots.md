# 137: Plots behind the basin (O12)

Lines for the orchestrator to place:

- Devlog index: `| 137 | [O12: Plots behind the basin](137-oasis-back-plots.md) | The empty band between the basin and the ksar gets four irrigated beds with low bunds, furrows and a head ditch from the first fall's pool, and seven slots (bed-1…4, foot-1/2, talus-3), none covering a tower or the basin; 55 oasis slots | Done |`
- TESTING, §1a, after O11.2:
  - `| O12.1 | Ground behind the basin: 50–60 slots; bed-1…4 (meadow, small/medium) inside the beds, foot-1/2 (back) above the head ditch, at most one large there; every box there under the ksar's seat and above the far rim; clear of the seguia and its falls; the beds in front of the ditch, off the bluff and apart; the oasis's species take the new slots (barley, alfalfa, henna, pomegranate, caper) | scenery/oasis › the ground between the basin and the ksar (all), › oasis slots (has 50–60…) | — | ✔ |`
  - `| O12.2 | The beds read as tended, plantable ground at backdrop weight, empty and planted, at 1440×900, 1920×1080 and 390×844 and close up; planted with the largest species that fit (pomegranate on foot-1), no tower or basin is covered | — (looked at: artifacts/o12) | — | ✔ |`

## What
- `layout.ts`: `BACK_BEDS` (four beds; fronts at y 552, backs at 514, sides to `BASIN_VP`) and
  `BACK_RUNNEL` (the head ditch, from the pool at the first fall's foot along the beds' heads).
- `slots.ts`: seven new slots, 55 in all (SPEC §3 asks ~50–60):

  | id | habitat | size | where |
  |---|---|---|---|
  | `bed-1` | meadow | medium | left bed (608, 536) |
  | `bed-2` | meadow | small | second bed (735, 538) |
  | `bed-3` | meadow | medium | third bed (866, 536) |
  | `bed-4` | meadow | small | right bed (966, 538) |
  | `foot-1` | back | large | bluff's foot above the ditch (668, 494) |
  | `foot-2` | back | medium | bluff's foot above the ditch (918, 492) |
  | `talus-3` | rock | small | under the bluff between them (790, 482) |

- `paint-land.ts`, at the end of the `plots` step (`paintBackBeds`): a faint worked strip at the
  bluff's foot, the head ditch (a dark cut, a broken sky-teal glint, a lit far lip), and per bed
  damp tilled earth (one just watered, one dry, two greened by a young crop with sparse blades),
  broken furrows toward the basin's vanishing point, and low bunds on the front and both sides
  (raised earth, a shade on the bed side, a lit ridge). The two ripple sets behind the basin
  went, as the beds now cover that sand.
- `map.studio.ts`: draws the beds and the ditch; the "basin" label moved onto the water.
- Tests: `oasis.test.ts` slot count 50–60, the `bed`/`foot` prefixes and a new block (O12.1).
  Land recording pins are now `65c786eb` (overview) and `0dec365d` (detail), from a fresh
  process (checked twice). Daylight, water, veg, rock, motion and wildlife pins did not move.

## Why
- **Beds, not open sand.** A tended palmeraie keeps its small irrigated plots near the water,
  bunded and fed from the seguia. The ditch starts at the first fall's pool, so the water has a
  visible source.
- **The slots stay in front of the ditch or above it.** Beds take small and medium crops (barley,
  alfalfa, henna); the bluff's foot takes the shrubs (pomegranate, grapevine, rose, oleander,
  jujube, retama). One large only: a large plant at y 494 reaches y 324, just under the ksar's
  seat (318). The ksar blocks' feet run on to y 332 inside the rock, so the test uses the seat
  and not the blocks' bounds.
- **No water slots moved.** The basin's cattails stand in front of the beds and hide part of
  them. The new slots sit between the basin slots' x where they can.
- The wildlife needed no change: no perch, plot or stand lies in the band, and every perch
  test still passes.

## Looked at (artifacts/o12)
- `base-empty-1440x900.png` (before), `r1…r3-empty-crop.png` (rounds), `r3-full-*` (60 random
  plants, three viewports), `r3-big-1440x900.png` and `r3-big-390x844.png` (pomegranate on
  `foot-1`, henna on `foot-2` and `bed-3`, barley on `bed-1`, alfalfa, caper), `r4/r5-close-empty`
  (close view on `bed-2`), `r3-close` (close view planted), `map-top.png` (composition map),
  `final-*` (the finished paint, empty and planted).
- Round 1: the beds read as soft rugs with dark dots. Round 2: added bunds and furrows. Round 3:
  varied the beds' wetness. Round 4: broke up the furrows, which read as corduroy in the close
  view. Round 5: brought them back to show.
- Planted, the pomegranate on `foot-1` crowns under the ksar's houses on desktop and phone, and the
  basin stays clear.

## Left open
- In the close view the beds still have rounded, mat-like corners. Crisper corners at the bunds
  would help.
- The ditch is painted land, not a `stream`, so it has no motion or sound and the wildlife does not
  drink from it.
- The hoopoe could walk the beds: add a ground spot in `wildlife.ts` (not my path).
- The basin's cattails hide much of the beds when planted. Fixing that would mean moving the
  basin's water slots.
- The bluff's foot and scree are left as they were for the bluff rework.
