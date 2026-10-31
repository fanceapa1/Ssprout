# 75 · Iwakagami (rock mirror), the waterfall's second own species (W3)

**What.** A new tier-1 small species, `iwakagami` (Rock Mirror · Iwakagami, *Shortia
soldanelloides*), on `rock` and `path`, with its `range` (Japan; wet cliff, temperate forest and
alpine; cool temperate and alpine; no `cultivatedIn`), so the waterfall offers it and the Japanese
garden does not. Bees visit it (`pollinators: true`), `bloomColor` `#e88ca8`.

**The look.** A low tuft of four to seven round, leathery leaves on short petioles, set round the
base in the ground plane and foreshortened (each blade is a disc seen at a slant: its ellipse is
squashed vertically, less for the leaves that lift toward us). Each leaf has a bronze rim with
shallow teeth, a darker shaded half (the blade is convex) and a sharp-edged pale crescent of shine
on the lit side plus a small glint: the "mirror". One older leaf in most tufts is flushed bronze all
over. A reddish scape rises from the centre and nods at the top with a one-sided raceme of three to
six rose-pink bells (a second, shorter scape with two or three bells in about a third of the larger
tufts). Each bell is a fused cup with three flaring lobes (the side view of five), deeper veins and
a fringe of fine strokes at every lobe's mouth, and a small calyx where it hangs. Three colourways:
rose, a deeper rose, and a rare blush-white.

- The leaf (`mirrorLeaf`, `src/plants/lib/iwakagami-paint.ts`): bronze rim dab, teeth and an
  inset green body dab (its `asym` makes the rim uneven), shade and midrib, in one wet layer dried
  **source-over**: these leaves are opaque and leathery, and multiplied leaves turned to dark
  smudges where they overlap. Then the shine in its own source-over layer. The teeth replay the
  rim dab's jitter (as iwatabako does) so they sit on its real margin.
- The bell (`fringedBell`): bud, cup, lobes, fringe, veins and calyx in one wet layer; the pointed
  bud shrinks into the cup as the lobes open from nothing, so nothing pops.
- The seed stage reuses iwatabako's `rockSeed` (imported, not edited).
- **Anchor `0.5 / 0.82`**: the base sits a little high so the front leaves can lie toward the
  viewer below it. A plan test keeps leaves, scape and bells inside the 70-unit design box.
- Growth follows the family windows: leaves unfurl 0.06–0.56 (folded up, rolled narrow, the
  smallest last), scape 0.34–0.7, buds from ~0.48 (lowest bell first), bells open 0.74–1.

**Paint time** (headless Chromium, main thread, growth 1 at 1.6×, 9 seeds): median 8.6 ms, max
12.4 ms (iwatabako in the same probe 8.7 / 10.7). Inside the 4–127 ms budget.

**Rounds.**
1. Leaves translucent and multiplied: overlapping blades stacked into dark lenses; the shade dab read
   as a second leaf inside each one; teeth long and spiky like a thistle; bells split into three
   separate tulip petals with a dark knob on top.
2. Leaves dried source-over, finer teeth, softer shade; a fused cup under the lobes, smaller calyx,
   less ink on the scape.
3. Leaves khaki and the shine stamped the same on every leaf; pedicels long and stiff, sticking out
   sideways. Cooler deeper green, varied shine, short drooping pedicels, more and shorter fringe
   strokes, veins over the cup.
4. In the waterfall (overview): the bronze rim read as a heavy dark outline round every coin and the
   bells as magenta, the shine lost. Thinner, lighter rim; wider shine; softer bell veins and base.
5. Close view: reads as shiny coins under nodding fringed bells. The rim was an even line (vector
   look) and every shine had the same slant: uneven rim, shine turned with the leaf.

**Looked at** (`artifacts/shots/`, gitignored):
- studio: `iwakagami-r1-1440x900.png`, `iwakagami-r1-g1-700x700.png`, `iwakagami-r2-g1-700x700.png`,
  `iwakagami-r3-g1-700x700.png`, growth stages `iwakagami-r6-1440x900.png`
- six seeds: `iwakagami-r3-seed1…6-400x400.png` (contact sheet in the scratchpad), `iwakagami-r7-seed1…6-400x400.png`
- line-up beside the waterfall's flora: `iwakagami-r6-flora-1440x900.png`
- waterfall overview (seven ledges plus neighbours, noon): `iwakagami-r4-wf-1440x900.png`,
  `iwakagami-r6-wf-1440x900.png`
- close views: `iwakagami-r5-close-1440x900.png` (noon, ledge-4), `iwakagami-r6-sunset-1440x900.png`
  (ledge-7), `iwakagami-r6-night-1440x900.png` (ledge-4)
- phone: `iwakagami-r6-wf-390x844.png`

**Files.** `src/plants/species/iwakagami.ts`, `iwakagami.test.ts`, `src/plants/notes/iwakagami.ts`,
`src/plants/lib/iwakagami-paint.ts` (new helpers; no shared helper changed); `src/scenery/flora.test.ts`
gets `'iwakagami'` in the waterfall's pinned list. `iwakagami` sorts after `anemone`, so the
`ui-shell`/`widget` studio cards are unchanged.

**For the orchestrator to place.**
- docs/systems/plants-species-a.md, species table:
  `| \`iwakagami\` | Rock Mirror · Iwakagami | 1 | rock, path | 86×86 · .5/.82 | \`#e88ca8\` | yes | tuft of 4–7 round glossy leathery leaves with bronze toothed rims and a lifted shine; reddish scape nodding with 3–6 rose-pink fringed bells |`
  and under Helper library: "`iwakagami-paint.ts` — `mirrorLeaf` (round leathery leaf, bronze
  toothed rim, source-over, lifted shine), `fringedBell` (nodding bell with fringed lobes, bud to
  bell in one layer)."
- docs/TESTING.md matrix:
  `| Iwakagami: smallSuite (determinism, continuous growth); 4–7 leaves, 3–9 hanging bells; leaves, scape and bells inside the design box | src/plants/species/iwakagami.test.ts |`

**Tests.** `npm run typecheck`; `npx vitest run src/plants src/scenery`;
`tests/e2e/studio.spec.ts` with `E2E_WORKERS=1 E2E_PORT=4372`.

**Left open.**
- At the overview on a ledge (slot scale ~0.7) the plant is about 25 px: it reads as dark coins
  with a pink sprig; the shine and the fringe only show in close views.
- The bells come out a little more magenta than `#e88ca8` at overview size (the deeper base and
  veins dominate when small).
- Leaf teeth are fine but regular; in the close view they read slightly bristly rather than
  crenate.
- The shaded half of each leaf has a visible edge rather than a soft gradation.
- Not checked in the browser with `sprout.flora('waterfall')`; `src/scenery/flora.test.ts` pins it.
