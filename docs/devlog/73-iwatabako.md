# 73 · Iwatabako (rock tobacco), the waterfall's first own species (W1)

**What.** A new tier-1 small species, `iwatabako` (Rock Tobacco · Iwatabako, *Conandron
ramondioides*), on `rock` and `path`, with its `range` (Japan; wet cliff and montane stream;
cool and warm temperate; no `cultivatedIn`), so the waterfall offers it and the Japanese garden
does not. Bees visit it (`pollinators: true`), `bloomColor` `#9468b0`.

**The look.** One to three big puckered leaves hang down from the base like tongues, the first
always the big one hanging almost straight down; a thin red-brown scape arches out over them and
nods, carrying a loose umbel of five to ten violet-pink five-pointed stars on thread pedicels,
each with a yellow anther cone. A second, shorter scape sometimes follows. Three colourways
(violet, a pinker violet, a paler lilac).

- The leaf (`puckeredLeaf`, `src/plants/lib/iwatabako-paint.ts`): an oval tongue with a wedge base,
  irregular forward-pointing teeth riding the margin, a sunken midrib and lateral veins bled in
  wet, all in one wet layer; then a source-over layer of broken lights on the bulges between the
  veins (mostly on the lit flank) and two sheen streaks, which is what reads as glossy and quilted.
  The teeth replay the blade dab's own jitter (its `rng.fork('blade')` draws) so they sit on its
  real margin instead of floating beside it.
- The floret (`starFloret`): bud and five pointed petals in one wet layer; the bud body shrinks
  into the centre as the petals swing open (`petalPose`), so nothing pops. The anther cones of an
  umbel share one opaque layer (`antherCones`), keyed by floret so cones never re-key as more open.
- The seed stage (`rockSeed`): the earth patch clears completely once the leaves cover it (the
  shared `seedMound` leaves a pale patch that floated above the hanging leaves).
- **Anchor `0.5 / 0.5`** (not the family's 0.9): the base sits at the box centre so the leaves can
  hang below it. On a ledge they drape over the lip; on a path they read as leaves lying toward
  the viewer. A plan test keeps leaves, scape and stars inside the 70-unit design box.
- Growth follows the family windows: leaves unfurl 0.07–0.56 (folded up and out, then sagging into
  place), scape 0.32–0.72 (straight, then arching), buds from ~0.48, stars open 0.75–1.

**Paint time** (headless Chromium, main thread, growth 1 at 1.6×, 9 seeds): median 8.0 ms, max
18.3 ms (violet 8.2 / 10.6). Inside the 4–127 ms budget.

**Rounds.**
1. Teeth floated as a row of beads beside the margin; leaves pale and small next to a tall
   lollipop scape with a tight ball of stars; gloss spots in neat rows like polka dots; the seed
   mound left a grey cloud above the leaves.
2. Oval tongue blade, teeth replaying the blade's jitter, broken gloss; shorter scape, loose spray
   on long threads; own seed patch.
3. In the waterfall: leaves clamped short by the box, so 2–3 equal leaves read as a clover fan.
   Moved the anchor to the centre, made the first leaf dominant, darker cooler green.
4. Close view: reads as a tongue over the ledge lip. Leaves looked like rose leaflets (regular saw
   teeth, fishbone veins): irregular teeth and vein spacing, a wedge base, broader blade, split sheen.

**Looked at** (`artifacts/shots/`, gitignored):
- studio: `iwatabako-r1-1440x900.png`, `iwatabako-r1-g1-1440x900.png`, `iwatabako-r2-g1-1440x900.png`,
  `iwatabako-r2b-1440x900.png`, `iwatabako-r4-1440x900.png`
- six seeds: `iwatabako-r6-seed1…6-700x700.png`, sheet `iwatabako-r6-seeds.png`
- line-up beside the waterfall's tier 1: `iwatabako-r6-flora-1440x900.png`
- waterfall overview (11 ledges, noon): `iwatabako-r3-wf-1440x900.png`, `iwatabako-r5-wf-1440x900.png`
- close views: `iwatabako-r3-close-1440x900.png`, `iwatabako-r4-close-1440x900.png`,
  `iwatabako-r6-close-1440x900.png` (noon), `iwatabako-r5-sunset-1440x900.png`,
  `iwatabako-r5-night-1440x900.png`
- phone: `iwatabako-r5-phone-390x844.png`

**Files.** `src/plants/species/iwatabako.ts`, `iwatabako.test.ts`, `src/plants/notes/iwatabako.ts`,
`src/plants/lib/iwatabako-paint.ts` (new helpers; no shared helper changed); `src/scenery/flora.test.ts`
gets `'iwatabako'` in the waterfall's pinned list (as asked at rebase). `iwatabako` sorts after
`anemone`, so the `ui-shell`/`widget` studio cards are unchanged.

**For the orchestrator to place.**
- docs/systems/plants-species-a.md, species table:
  `| \`iwatabako\` | Rock Tobacco · Iwatabako | 1 | rock, path | 86×86 · .5/.5 | \`#9468b0\` | yes | 1–3 puckered glossy toothed leaves hanging like tongues; arching red-brown scape, loose umbel of violet-pink stars with yellow anther cones |`
  and under Helper library: "`iwatabako-paint.ts` — `puckeredLeaf` (bullate toothed leaf with
  gloss on the bulges), `starFloret` (tiny pointed star with bud, one layer), `antherCones`,
  `rockSeed`."
- docs/TESTING.md matrix:
  `| Iwatabako: smallSuite (determinism, continuous growth); 1–3 leaves with the first hanging down, 6–16 stars; leaves, scape and stars inside the design box | src/plants/species/iwatabako.test.ts |`

**Tests.** `npm run typecheck`; `npx vitest run src/plants src/scenery` (50 files, 365 tests);
`tests/e2e/studio.spec.ts` (12) with `E2E_WORKERS=1 E2E_PORT=4369`.

**Left open.**
- On a `path` slot (flat ground) the hanging leaves sit below the slot point, so the plant looks a
  little sunk compared with ground plants (seen in the flora line-up). On ledges, its real home,
  this is what makes it work. A per-habitat pose would need the habitat in `draw`.
- At the overview the stars are 3–5 px: the spray reads as violet dots on threads, the star shape
  only shows in close views.
- The pucker is subtle at garden size; the gloss is what carries "wet leaf" from afar.
- Not checked in the browser with `sprout.flora('waterfall')`; `src/scenery/flora.test.ts` pins the
  same lists (waterfall offers it, the Japanese garden does not).
