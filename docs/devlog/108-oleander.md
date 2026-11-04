# 108 · Oleander (P9)

## What
The oasis's riverbed shrub: **oleander** (*Nerium oleander*, defla in Darija, ilili in Tamazight,
the latter unverified). A tier-3 `large` shrub. It adds only files, plus one id in a test list:
- `src/plants/species/oleander.ts`: the definition, the structure (`buildOleander`) and the pose at
  a growth (`poseOleander`), on the taniutsugi pattern.
- `src/plants/lib/oleander-paint.ts`: new helpers `knifeBlade`/`paintKnifeLeaves`, `paintStems` and
  `pinwheelShape`/`paintPinwheels`. No shared `lib/` helper was edited; `ribbonInto`, `inPlantSpace`,
  `groundShadow`, `seedAndShoot`, the `shrub-growth` maths and the `small-structure` stems are only
  imported.
- `src/plants/species/oleander.test.ts`: `shrubSuite` plus the checks below.
- `src/plants/notes/oleander.ts`: the Note from the brief, with the Tamazight name.
- `src/scenery/flora.test.ts`: `'oleander'` added to the pinned oasis list (now `date-palm`,
  `oleander`).

Fields:
- tier 3, `large`, box 200×220, anchor .5/.93; habitats `shore`, `back`;
- `range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'wetland'], climates: ['arid', 'warm-temperate'] }`,
  wild. The garden (25) and the waterfall keep their pinned lists: their realm is `japan`;
- `bloomColor: '#d9708f'`, `pollinators: false` (no nectar: keep bees off it);
- description "Oleander — pink pinwheels in the dry bed of the oued." (the brief's Line).

## How it is painted
- **Stems:** 11–14 from a narrow crown (feet within 25 units), a fountain. The inner stems rise
  straight and tallest; the outer ones lean out with a slight arch. About half the tall stems put out
  a side shoot under the top whorls, with its own cluster.
- **Leaves:** whorls of three from about a fifth of the way up. One leaf goes to each side and one
  points at us, foreshortened. They are long, narrow knives (length/width > 4, usually 6–8), angled
  up, more erect near the tip. Colour is the dark grey-green `#56683f` across three depth bands:
  back darker and cooler, front greyer. The shaded half takes a grey underside and the midrib is
  lifted pale.
  Leaves dry `source-over`: multiplied, the overlaps turned to black "x-ray" crosshatch, and later
  bands' leaves stained the earlier bands' flowers maroon (round 3).
- **Flowers:** a terminal cyme at every tip: 3–5 open pinwheels in a loose dome and 2–3 buds that
  stay buds.
  - Each pinwheel has five asymmetric, propeller-like petals swept one way, with a paler `#efb2c2`
    sliver along each curled leading edge (the reverse).
  - The mouth is pale, with five deep rose streaks and a fringe of forked threads (the corona).
  - Petals vary per flower between the pink, a paler pink and a deeper one.
  - Buds are twisted pale spindles.
- **Growth:** the seed and shoot (to 0.24); stems rise from 0.08, the inner ones first, and are
  done by about 0.7; each whorl unfolds as its stem grows past it; buds form 0.5–0.8; the pinwheels
  open 0.72–1, turning a little as they open. No mark pops in (tested).
- **Cost:** 95–99 ms median, 102–105 ms max at growth 1, 1.6×, seeds 1–12, on the main thread in
  headless Chromium on a loaded machine. Taniutsugi measured 66 ms median and 87 ms max in the same
  runs. It is inside the 4–127 ms budget but in its upper part. A version with three petal layers
  and denser whorls measured 110/128 ms, so both were cut.

## Tests
`src/plants/species/oleander.test.ts` (9 tests):
- `shrubSuite`: tier 3, habitats, native name, determinism, rng use independent of growth;
- pose continuity over 240 growths (no mark jumps, appears large or vanishes large), seeds 1, 3, 8;
- inside its box at growth 1, clear of the sides and top (40 seeds);
- a fountain: at least 11 stems from feet within 25 units, tips spread more than 4× the feet,
  tallest tip above −160;
- whorls of three (sides −1, 0, 1), knife ratio > 4 for the side leaves, at least 5 flowers per tip
  and at least one bud;
- stage order: no flowers at 0.3, more than 100 leaves and nothing open at 0.6, most open at 1 with
  buds left;
- the range, `pollinators: false`, description under 80.

`src/scenery/flora.test.ts`: the oasis pin includes `oleander`; the garden's 25 and the waterfall's
list are unchanged.

`npx vitest run src/plants src/scenery/flora.test.ts`: 56 files, 406 tests pass. `npm run typecheck`
passes. e2e was not run (CPU rule for this task).

## Looked at
All shots are in `artifacts/p9-oleander/` (gitignored).
- Round 1, `r1-studio-1440x900.png` (the studio section):
  - it read as a fountain with pink tips already, but the leaves were pale glass with hard dark
    rims, the V-pairs around each stem made a herringbone, and the shrub was see-through;
  - the flowers were narrow five-pointed stars, and the buds were dark maroon blades that read as
    leaves.
- Round 2, `r2-g1-1440x900.png`: broader propeller petals and pale buds; the leaves were still
  translucent, and the lower half was bare stems.
- Round 3, `r3-seeds.png` (seeds 1–6): denser and darker, and the structure holds across seeds. But
  the multiplied leaf overlaps made a black x-ray crosshatch, and maroon smears appeared where a
  front leaf crossed a flower.
- Round 4, `r4-seeds.png`: leaves `source-over`. The crosshatch and the smears were gone, but the
  mass was one flat mid green.
- Round 5, `r5-seeds.png`: back band darker and cooler, front greyer, so the mass has depth.
  - `r5-oasis-overview-1440x900.png`: two oleanders in the oasis overview (`high-1`, `palm-1`)
    read as dark knife fountains with pink bunches, in the same register as the date palms.
  - `r5-close-noon-1440x900.png`: up close, the flowers of a cluster merged into one pink mass with
    dark specks, closer to phlox than oleander.
- Round 6 (larger, fewer, more spaced flowers; a pale mouth with deep streaks):
  - `r6-close-noon-1440x900.png`: separate pinwheels with pale centres;
  - `r6-sunset-night.png` (crops of `r6-close-sunset` and `r6-close-night`): the gold rim light
    catches the left edges of the knives at sunset; at night it is muted, and the pink stays the
    brightest thing without glowing;
  - `r6-phone-close-390x844.png`: the phone close view reads well;
  - `r6-lineup-small-1440x900.png` and `r6-lineup-small-crop.png`: the tier-3 line-up at garden
    scale. It is the only tall, dark, upright fountain, far from the azalea's low pink mound, the
    hydrangea's lilac balls, the tree peony's cups and the taniutsugi's airy vase;
  - `r6-flora-oasis-1440x900.png`: the oasis flora board beside the date palm.
- `r7-studio-1440x900.png`: growth stages 0.1 → 1 read in order (stems, whorls, small buds, opening
  pinwheels).
- `r8-close-noon-1440x900.png` and `r8-close-crop.png`: after the budget cut (two petal layers, sparser
  whorls), the pinwheels still stand apart.

## Left open
- **No large shore slot in the oasis yet.** Shore slots there are at most `medium`, so today the
  oleander can only go in the two `back` tree slots (`high-1`, `palm-1`), where it competes with the
  date palm. The research places it on "the large oued-bank slot", and O2 is reworking the framing,
  so the oued bank needs a `large` slot. The phone overview crop (`r6-phone-390x844.png`) shows
  neither back slot.
- **The background was not judged** (O2 is reframing the oasis).
- The leaves are a touch greener than the brief's grey-green `#6f7f52` in daylight. Darker and
  greyer read muddy in round 3, so it stays a little green.
- The pinwheel twist and the corona fringe only read in close views. At overview size a flower is
  a pink dot with a pale centre, which is the intended small-size read.
- No seed pods (optional in the brief).
- The paint cost (about 100 ms) is the second-highest of the shrubs. If it matters, merge the
  throat layer into the petal layers.
- The Tamazight name `ilili` is unverified (as in the research).

## For the orchestrator
Species table row (`docs/systems/plants-species-b.md`):

| `oleander` | Oleander · Defla | shore, back | large · 200×220 · (0.5, 0.93) | `#d9708f` | a dense upright fountain of 11–14 stems from a narrow crown, some with a side shoot; long narrow dark grey-green knife leaves in whorls of three, angled up, the midrib lifted pale; terminal clusters of rose-pink five-petalled pinwheels with a pale curled reverse, a pale mouth with deep streaks and a fringed corona, and twisted pale buds; no pollinators (oasis only) |

TESTING row (`docs/TESTING.md`):

| P9.1 | Oleander: `shrubSuite` plus pose continuity over 240 growths, inside its box (40 seeds), a fountain (≥ 11 stems, narrow feet, wide tips), whorls of three knife leaves, a cluster with buds at every tip, stems → leaves → buds → pinwheels; wild range, no pollinators; the oasis pin gains `oleander`, the garden keeps its 25 and the waterfall its own | plants/species/oleander; scenery/flora | studio › every entry renders | ✔ |

Devlog index line (`docs/devlog/README.md`):

| 108 | [P9: oleander](108-oleander.md) | A dense fountain of dark knife leaves in whorls of three, with rose-pink pinwheel clusters at the tips | — |
