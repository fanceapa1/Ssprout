# 83 · Iwana char and yamame (C3)

## What
The waterfall's fish: the **iwana** (white-spotted char, イワナ, *Salvelinus leucomaenis*) and its
second row's **yamame** (masu salmon parr, ヤマメ, *Oncorhynchus masou*). Rows `iwana-1` (variant
`iwana`, 3 plants) and `iwana-2` (variant `yamame`, 7 plants) of `WATERFALL_FAUNA`. Only new files:
- `src/fauna/creatures/iwana.ts`: the art, the behaviour (`Iwana`), pure helpers (`iwanaProfile`,
  `poolAxis`, `chooseStation`, `stationOk`, `clearOfRocks`, `sidePoint`, `activity`,
  `nextVariant`) and the default-exported `CreatureDef` (kind `iwana`, role `resident`, rank 4,
  variants `iwana`/`yamame`, a parts `sheet`, `show` on the `falls` stage with a group of 2).
- `src/fauna/creatures/iwana.test.ts`: 12 tests (shape, variants, the current, stations, 30
  simulated minutes, the evening rise, determinism, reduced motion, the studio stage).

## How it is painted
Seen from above through the water, like the koi, on the `underwater` layer: a body strip cut into 7
segments laid along a spine, a caudal fan, pectoral and pelvic fins, each with a `deepCopy`
(blurred, cool celadon tint). Lengths at perspective 1: iwana 48, yamame 42 (± 8 %); koi are 56–76.
- **Shape**: a slim torpedo (half-width 0.095 of the length against the koi's 0.11), a rounded but
  narrow snout, widest a third of the way back, a long taper to a thin tail root. Caudal fin: one
  wash fan losing its edge toward the root, square-ish on the iwana, forked on the yamame, three
  faint rays.
- **Iwana**: a buff wash (`#d9a46a` toward grey) for the belly showing at the flanks, then the
  olive-grey back (`#6f7258` darkened) bled into it in one wet layer (soft edge, granulation,
  mottled flow), darkest over the head and along the spine. About 46 cream spots (`#e8dfc8`),
  small over the back and larger low on the flanks, laid in one wet layer so they dry together.
  Lower fins in buff-orange with a white leading edge (a `petalWhite` stroke, mirrored per side).
- **Yamame**: silver flank, a narrower silver-olive back, a pale sheen between, a row of 8–9 dark
  oval parr marks (`#5d5a6e` toward the back colour) on each flank in one wet layer that bleeds,
  and 9–13 tiny sumi dots. Plain pale fins.
- **Dorsal fin** edge-on along the back as one wet stroke; the eyes small and half lost in the dark
  cap; a pale gill line.
- **Its shadow on the bed**: the silhouette in one indigo-grey wash, blurred twice, drawn under the
  fish and offset down the screen, further off as the fish rises. This is what reads as "in the
  deep" rather than lying on the surface.
- **Depth**: it holds at depth 0.7, where the blurred copy and the crisp one are half and half
  (composed into one scratch canvas, laid down once at 0.72 opacity). It rises to 0.02 to sip
  (crisper, more opaque) and sinks back.

## Behaviour
- **Resident**, one per unlocked row (`resident: (n) => n`). The variant is the garden's row
  variant that has the fewest fish so far (`nextVariant`): iwana first, then the yamame. With no
  rows (a hand spawn in a garden that has not unlocked them) it alternates, so
  `sprout.fauna.spawn('iwana', 2)` gives one of each.
- **The current** (`poolAxis`): from the outflow (the pond edge nearest the streams) up to
  `w.scene.falls.foot`, in the pond plane. Without a stream or falls it falls back to the pool's
  far points. No coordinates of its own.
- **Station** (`chooseStation`): 15–50 % of the way up from the outflow (the pool's tail), up to 30 %
  of the axis length to either side, inside `w.pond.plane` with 0.85 body lengths of room, in view,
  and with head, middle, tail and shadow clear of the boulders (the water draws under the rocks).
  It faces the falls (± 0.08 rad). A second fish takes the candidate farthest from the first. A
  small pool (the studio's) relaxes the room and the band step by step until the fish are a body
  length apart.
- **Holding**: a slow noise drift of about 2 units round the station, its nose into the current
  with a slight sway, the tail sculling about 1 Hz, pectorals spread.
- **Moves**, every 5–16 s of activity:
  - **dart** (most): a quick sideways dash of 0.3–0.75 body lengths (75 u/s, the body bends with
    the turn, the nose swings up to 0.95 rad), a brake and a 0.5–1.8 s pause there;
  - **rise** (12 % by day, 25 % at night, 45 % in the evening rise): up and a little up-current, to
    the surface, a ring where the snout breaks it and a second, smaller one 0.3 s later (**sip**);
  - then **back**: it drops back to its station still facing the current, slowly (9 u/s).
- **Dusk**: for 20 minutes after nightfall (`DUSK_SECONDS`, the evening rise) the moves come 2.4 ×
  as often, and 1.4 × through the night. The fauna has no dusk signal before night (the world has
  only `mode.night`), so the rise starts when night does. It stays all night.
- **Never in the foam**: `w.pond.world` is the still water with the foam carved out; the stations,
  dart and rise points keep room, and `containPoint` holds it 0.3 body lengths inside.
- **Sizes**: `w.perspective(y, x)`. **Randomness**: only `w.rng`, noise from `w.noise`.
- **Reduced motion**: every speed, timer and gap runs at `w.speed`.
- **Leaving** (rows locked again): it sinks and fades.
- **Unlike the koi**: no wandering. It keeps to a station, slim, dark and cool, spotted, and moves
  in short darts instead of long arcs.

## Looked at
Probe shots from a small Playwright script against my own dev server (port 5408) under `nice -n 15`,
studio shots with `npm run shots -- --url`. Copies in `artifacts/shots/iwana-*.png`:
- r1 parts (`iwana-r1-parts-zoom.png`): read as a leaf or a flatfish (widest at the head), the
  adipose dab was a black eye at the tail, the dorsal a dark blot, the eyes cartoon dots, the
  caudal two petals like moth wings, the yamame's parr marks violet leopard spots with too many
  black dots → a narrower head, faint dorsal and adipose, small half-lost eyes, a wash fan for the
  tail, softer greyer parr marks, fewer and smaller dots.
- r2 garden (`iwana-r2-garden-crop.png`): at garden size two thin slivers in the pool's tail, facing
  the falls, only the blurred copy showing, no spots → longer (40 → 48), wider, held less deep so
  half the crisp copy shows.
- r3 close (`iwana-r3-close-a.png`, `iwana-r3-close-b.png`, zoom 3): fins like pale round turtle
  paddles, an arrow-tipped head, a pale rim round the body (outline and fill), the yamame's marks as
  bands → narrow translucent fins swept back, a rounder snout, no edge on the flank wash, marks
  pushed to the flanks.
- r4–r5 (`iwana-r4-close-crop.png`, `iwana-r5-close-crop.png`): it read as trout, but like a sticker
  laid on the water → the shadow on the bed; the iwana's back darker. At garden size
  (`iwana-r5-garden-crop.png`) two dim slim shapes with their shadows, nose to the falls.
- r6 studio `alive` (`iwana-r6-alive-crop.png`, t 30): the two fish shared one station on the small
  stage pool (no candidate had room), then one sat over the wet rock → relaxed search and the whole
  body clear of the rocks; stage test added.
- r7–r8 rise (`iwana-r8-rise-crop.png`): the sip ring was too small to see (and my first probe let
  it age away while the camera settled) → rings 1.1 and 0.6 body lengths. It is still faint.
- Sunset (`iwana-r8-sunset.png`): cool spotted shadows in the warm pool, beside the dipper swimming.
  Night (`iwana-r8-night-crop.png`): dim slate shapes in the blue water. Phone 390×844
  (`iwana-r8-phone.png`): the tail of the pool is at the right edge; the fish are small slivers but
  in view.
- Final close (`iwana-r9-close-crop.png`) and parts (`iwana-r9-parts-zoom.png`).

What reads well: at garden size, a still, slim, cool shadow with its own shadow under it, holding
against the current; close up, the char's cream spots and buff flanks and the yamame's thumbprints.

## Bench
`sprout.fauna.bench(300)` at the waterfall, 1440×900, DPR 2, headless Chromium, 25 plants, the
whole roster spawned (15 creatures: striders, dipper, leaf, damselfly, iwana + yamame, butterflies,
dragonfly, bees, wagtail, heron), art settled, one untimed `bench(60)` first. Two timed runs:
**update 0.02 ms + draw 0.58–0.60 ms = 0.60–0.63 ms a frame** (load about 4), under the 1.5 ms
budget. Before composing both depths in one scratch it was 0.78–0.81 ms. With 4 fish (2 extra by
hand) 1.19 ms.

## Status
- `npm run typecheck`: clean.
- `VITEST_WORKERS=1 npx vitest run src/fauna src/scenery/waterfall`: 18 files, 177 of 178 tests
  pass. The one failure, `scenery/waterfall/fauna.test.ts › shares only what lives in a gorge…`,
  is older than this task: its `shared` map also picks up the dipper and the damselfly
  (`dipper: undefined`, `damselfly: undefined`) and now the iwana (`iwana: 'yamame'`), because it
  keys on kinds that have a module. It needs to skip the waterfall's own kinds (shared file, left
  alone).
- No local e2e (CI runs it). `fauna-waterfall.spec.ts` picks the iwana up from the roster.
- Scratch files (probe script, setups, raw shots) are in the untracked `iwana/` folder.

## Rows for the orchestrator
fauna.md › Creatures and behaviour:

| Kind (unlock id) | Behaviour |
|---|---|
| `iwana` (waterfall: iwana-1, iwana-2) | resident, one per row: the char (`iwana`) and then the yamame (`yamame`; `nextVariant` gives the garden's row variant with the fewest fish). Holds a station in the pool's tail (15–50 % up from the outflow toward `scene.falls.foot`, `poolAxis`), nose into the current, sculling, the body clear of the rocks; two fish a body length apart. Every 5–16 s it darts aside 0.3–0.75 body lengths, pauses and drops back facing the current, or (12 % by day) rises to sip with two rings. In the evening rise (20 min after nightfall) 2.4 × as active, 1.4 × at night; stays at night. Only in `w.pond.world`, never in the foam. Seen from above with a blurred shadow on the bed. |

fauna.md › Layers: `iwana` → `underwater` (clipped to the water; the crisp and the deep copy mixed by
depth in one scratch, its shadow on the bed under it).

TESTING matrix:

| C3.1 | The iwana and the yamame: the iwana row brings the char and the second row the yamame; stations in the pool's tail, in the still water, clear of the foam and the rocks, nose to the falls; two fish a body length apart; over 30 minutes they hold, dart, pause, drop back, rise and sip, rises rarer than darts, head to tail always in the still water and out of the foam, never more than 1.3 body lengths from station; stay at night and livelier in the evening rise; deterministic; slower in reduced motion; two stations on the studio's falls stage | fauna/creatures/iwana (all) | fauna-waterfall › every creature on the roster can be spawned…; › a busy pool renders cleanly and stays cheap (roster-driven) | ✔ |

## Left open
- **The sip ring is faint**: it uses the sim's shared ripple sprite, which is thin against the
  pool's painted reflections. A splashier rise (a dimple, a fleck of light) would need its own
  sprite.
- **No dusk signal before night**: the world has only `mode.night`, so the evening rise begins at
  nightfall rather than at sunset. A `dusk` weight in `FaunaMode` would be a contract change.
- **Rocks**: the boulders are on the background layer and the water draws over them, so the fish
  keeps its body off them rather than slipping under one. Fish hiding under rocks would need the
  rocks above the water layers.
- **The body is a stiff strip**: it bends with turns and sculls, but there is no real S-curve or
  turnaround; it never turns to face downstream.
- **Phone**: at 390×844 the pool's tail is at the right edge, so the fish are small slivers there.
- **Studio stage**: the fish are large for the stage's little pool (the shared stage, scale 1).
- The white fin edges and the char's warm belly only read in close views.
