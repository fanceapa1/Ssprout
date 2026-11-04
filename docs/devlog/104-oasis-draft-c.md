# 104 · Oasis draft C, "gorge spring"

**Idea.** A mountain oasis like Chebika, Tamerza or the Todra gorge. A spring leaves a narrow cleft
in pale honey limestone and winds down stepped, walled terraces to a shallow turquoise pool with a
pebble beach. It is the rocky, flowing-water, layered-stone option, next to A (ksar bluff) and B
(dune lake).

**What's in it** (`src/scenery/oasis/drafts/c/`: `layout.ts` shapes, `paint.ts` steps, `palm.ts`,
`draft.studio.ts`):
- A temporary sky wash, cool high up and warm at the horizon. Open sky is left above the massif for the sun.
- To the right, on the open side: a lilac far range, a pale shimmering chott with lifted streaks,
  and the golden plain coming forward.
- The massif in two blocks, painted on reserved paper: a honey wash, alternating cream, honey and
  rose beds, broken shadow lips under the hard beds, shade on the right-facing faces (the light
  comes from the upper left), desert-varnish streaks, and its tail stepping down to the plain in shade.
- The cleft: a V notch to the sky. The near wall is in warm violet shade and the far wall is lit
  honey. Beds on both walls converge into the seam, and a dark grotto sits where the spring comes out.
- Four dry-stone terrace walls on each side, made of laid stones, each a small wet blot. Behind
  each wall is a tilled soil top with crop patches. Three stone-lined channels split off the
  stream, each with an irrigated green strip.
- The stream: a turquoise ribbon, deeper on its far bank, with lifted glints and stones along it.
  It flows gently, with no falls.
- The pool: damp sand around it, turquoise deeper at the back, pale sandy shallows at the front,
  lifted reflections, ripples where the stream comes in, and worn boulders on the rim.
  In front of it is a pebble beach with pebbles in drifts.
- About 28 date palms (ringed trunks, feathery drooping fronds, a few date clusters). They grow in
  clumps at the massif's foot, crowd the cleft's mouth (young ones by the spring), line the stream
  and frame both sides.

**Plantable ground** (about 25 slots, see the `map` entry): the three terrace tops on each side
(3+3, 3+3, 3+2), the pool rim (3), the shallows (2) and the pebble beach (3). All of it is in the
lower half, y 560–950.

**Focus:** (750, 730), the pool and the lowest terraces. The 600-wide phone crop around it holds
the cleft, the whole stream and most of the pool.

**Looked at** (`artifacts/oasis-draft-c/`, rounds in `r1`–`r4`):
1. The cleft was a thin dark slot hidden by palms, the massif was a flat wall, the palms were too
   many and too tall, and the terraces were flat stripes. I opened the cleft into a V, switched
   the light to the upper left (near wall in shade, far wall lit) and made the palms smaller and
   clumped.
2. The near wall was a cold grey, the vertical shade faces read as pillars, and the palm crowns
   were spiky mops. I warmed the palette (golden lit rock, rose-violet shade), cut the shade faces
   down, gave the palms long arching fronds with fine leaflets, and added boulders by the pool and
   pebble drifts.
3. The cleft walls were flat and the strata weak. I added converging beds on both walls,
   strengthened the massif's beds, added irrigated strips along the channels and moved the focus
   so the phone crop holds the cleft.

**Left open:**
- The cleft walls still have clean, book-page edges. A real slot has broken edges, chockstones
  and a sliver of far gorge.
- The terraces read as stepped but stay close to parallel bands, and the terrace tops are plain.
- The pool is a smooth oval, and its near edge needs more shape.
- Palms are evenly done. They lack trunk weight and bases, and the far ones lack haze.
- There is no reflection of the cliff or palms in the pool. Steps are not split into parts (ADR 0238).
- No daylight plates, motion or sound, as the brief says.

## Round 2: a close view (owner: "too zoomed out")

**Idea now.** You stand at the pool, near the foot of the cleft. The honey cliffs rise close
behind the water and fill the upper half, with the skyline at y 115–350. The cleft is off-centre
to the right (x 1000–1140), with a dark grotto at its foot. The spring spills over one terrace
wall into an irregular turquoise pool that spreads to the left (x 410–1080, near edge at
y 640–676). This avoids the waterfall garden's layout of cliff on the left and water in the centre.

**What changed:**
- `layout.ts` is a new layout. It adds `persp(y)` (the plant-box perspective) and `SLOTS`: 25 slots,
  each with a base point and a size class.
- Terrace walls, stones and channels are sized by perspective.
- The terraces are now the side banks: an upper and a lower wall on the right, a bank wall on the
  left, and a near wall corner at the bottom right.
- The far plain and the chott are only a sliver at the left, past the massif's tail.
- The palms are big. The two framing palms have crowns at the top edge, and a crowd of palms stands at the cleft's mouth.
- The pool has an irregular outline with a promontory, a warm reflection of the cliff, boulders,
  and an outflow channel toward the viewer.
- The ground in front is greener, with crop dashes and a paler sandy strip down the middle for the path.
- The studio has a new `ghosts` entry: the painting with the true-size plant boxes. The `map`
  entry now draws those boxes and the UI zones.

**Looked at:** two rounds (`artifacts/oasis-draft-c/v2r1`, then the top folder).
1. The back palms were bare poles with crowns cropped away, and the foreground was an empty sand
   plain. I shortened the palms so their crowns show, dropped two, and greened the near ground.
   I also added a near wall on the left.

**Left open:**
- The foreground is still quiet and a little empty under the plants.
- The weir spill is small.
- The cleft edges are still clean.
- The right terraces sit low next to the cliff's foot.
