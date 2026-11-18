# 199 · Sea lavender (GP11, phase 15)

## What
The statice of the Greek rocky coast: **sea lavender** (*Limonium*, limonio), a tier-2 `small`
plant. It adds only files:
- `src/plants/species/sea-lavender.ts`: the definition, the plan (`buildSeaLavender`), the pose
  (`poseSeaLavender`, pure, every mark at a growth value) and `seaLavenderReach` (box test).
- `src/plants/lib/sea-lavender-paint.ts`: new helpers (the paddle leaf, wiry stems, a thin lilac
  haze, the tiny flowers). Only `ribbonInto` is imported from a shared helper; nothing shared was
  edited.
- `src/plants/species/sea-lavender.test.ts`, `src/plants/notes/sea-lavender.ts`.
- Rows in `docs/TESTING.md` (GP11.1), `docs/systems/plants-species-a.md` and the devlog index.

Definition: tier 2, `small` (86×86, anchor .5/.9), habitats `['rock']`, bloomColor `#c0a8d0`,
pollinators yes, `nativeName: 'Limonio'` (`el-Latn`, to check with a speaker). Range per ADR 0361:
`realms ['mediterranean']`, `biomes ['scrub', 'marine', 'coast']`, `climates ['mediterranean']`,
wild. The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged.

**Latin first.** The species has no Latin-name field, so the card note opens with *Limonium* and
says it is no kin of lavender; the name stays "Sea lavender".

## Slots
The research doc says medium, but the coast's `rock` slots are 9 small and 2 medium (`splash-1`,
`shelf-1`). As `small` it fits **all 11 `rock` slots**: `wall-1..5`, `crack-1/2` (wall copings and
cracks), `splash-1..3` and `shelf-1`. A test pins the 11. No `shore`, `path` or `back`: it is a
salt-rock plant.

## How it is painted
- **Rosette:** 12 to 14 obovate leathery leaves (blue-green, widest past the middle, tip curled
  up, a lifted midrib, a cooler shaded half) laid on a flattened ellipse round the base, back ones
  first; front ones shorter so the rosette stays inside the box.
- **Stems:** three or four wiry grey-green bare stems (zig-zag), forking at the top: 6 or 7 branches
  each, most with two sub-branches, fading to thin lighter wires.
- **Froth:** 210 to 330 tiny papery flowers strung along the branch ends (pale lilac mixed with
  paper white, some deeper, some with a lifted glint) over a thin lilac haze a stem. Buds are a
  greyer lilac and open to the pale colour.
- **Growth:** seed mound; leaves from 0.05 (a small rosette by 0.3); stems rise 0.34-0.6; branches
  fork to 0.85; flowers open 0.5-1.0.
- A dark crack wash under the rosette (as the rock samphire).

## Cost
`def.draw` at 1.6× (138 px), growth 1, seeds 2 to 11, main thread of headless Chromium on the dev
server (a throwaway probe): 13, 13, 11, 13, 12, 12, 10, 12, 10, 12 ms, median 12 ms (rock rose 21).

## Looked at
Scratchpad `gp11-*.png`, `gp11/`: the studio entries (growth 0.1, 0.3, 0.55, 0.8, 1), the close
view in `crack-1` and the overview with six plants on wall and splash slots.
- **Round 1:** a clover-like rosette of six short leaves; flowers in big grape-like clumps; dark
  grey sticks showing through them; a hard-edged haze disc.
- **Round 2 and 3:** longer, more numerous leaves; smaller flowers on both sides of each branch,
  in a wider panicle (branches at 45 to 60 degrees); lighter, thinner branch wires; a paler, ragged
  haze; a second fill on each flower so the wires show less; flowers only on the stem's tips.
- At overview size it is a pale lilac froth over a flat green rosette on the wall: not a violet
  spike, so it does not read as the lavender.

## Left open
- The branch wires still show dark through the flowers in places; a close view looks twiggy.
- The flowers are round blobs; a real *Limonium* has one-sided zig-zag spikelets, which only a
  close view would show.
- The rosette's overlapping leaves are a little regular, like a clover at overview size.
- Not checked: night, the phone view, the plant card in the garden, slots other than `crack-1`,
  the wall slots and `splash-1`, `shelf-1` in the overview.
- Not run: the full e2e suite (the task's CPU rules); only `planting-previews` (2 tests),
  `plants` (8), `plant-card-phone` (5) and `lazy-species-painters` (1), all passing. Unit suite:
  271 files, 2864 tests passing.
