# Art Direction

The garden must look like a **real hand-painted Japanese watercolour** — the kind of quiet
illustration found in a botanical sketchbook or a Ghibli background painting — not like
vector clip-art, not like a "generative art" demo.

## Mood
Serene, airy, warm paper, lots of breathing room. The paper itself is part of the painting:
large areas (sky, path) are barely tinted. Detail is concentrated where the eye rests
(stones, plant heads); edges dissolve toward the margins (vignette of unpainted paper).

## Palette (pigments, not hex-perfect UI colours)
| Pigment | Use | Approx |
|---|---|---|
| Washi paper | ground | `#f3ecd9` – `#efe6cf` |
| Sap / sage green | grass, foliage | `#a9b386`, `#8d9a6c`, `#c3c79d` |
| Olive shadow | foliage darks | `#6f7a52` |
| Pond celadon | water | `#a9c3bb`, `#8fb0ab`, deep `#6f9690` |
| Stone grey | rocks | `#9b978d`, `#7d7a72`, warm `#a39a8b` |
| Sumi ink | lines, trunks | `#4a443c` (never pure black) |
| Wood | pavilion | `#8a7a68`, `#a69580` |
| Sakura pink | flowers | `#e8a7a9`, `#f1c6c3` |
| Iris violet | flowers | `#7b6ba8`, `#9a8cc4` |
| Bellflower blue | flowers | `#7f97c8` |
| Off-white petals | anemone etc. | `#faf6ee` with grey-violet shading |
| Accents (sparingly) | koi, lantern | vermilion `#d0694a`, gold `#d9b36c` |

Saturation stays low; the brightest things in the scene are flower heads and koi.

## Techniques the paint engine must provide
- **Wet-edge washes**: each shape is many low-alpha layers of a jittered polygon; pigment
  pools at edges (darker rim, lighter centre). Edges are irregular, never vector-clean.
- **Glazing**: overlapping translucent washes produce depth; shadows are cooler glazes.
- **Granulation**: pigment settles in the paper grain (noise-modulated speckle) — strong on
  stones and water, light on foliage.
- **Blooms/backruns**: occasional cauliflower edges inside larger washes.
- **Wet-in-wet bleeds**: soft colour transitions (e.g. stone grey into green moss).
- **Dry brush**: broken strokes for grass, bark, path edges.
- **Ink line work**: thin, tapered, slightly wobbly sumi strokes for stems, trunks, eaves,
  water ripple lines — pressure varies, lines sometimes break. Used sparingly.
- **Leaf / petal dabs**: single brush-shaped dabs (tapered ellipse with a pooled edge), the
  basic unit for foliage clumps and petals.
- **Paper**: fibrous washi texture + subtle grain, applied by multiply over the whole frame.
- **Lost edges**: shapes fade into paper on one side; not every outline closes.

## Anti-tropes (do NOT do these)
- Flat fills, hard vector outlines, perfect circles/ellipses, symmetric flowers.
- Glossy gradients, drop shadows, glow/bloom filters, neon, high saturation.
- "Particle confetti", sparkle emojis, bouncy cartoon animations, lens flares.
- Generic UI: pill buttons with gradients, glassmorphism, Inter font everywhere, emoji icons.
- Visible repetition: every instance must be seeded-unique; clumps vary in count & angle.

## UI style
UI is calm paper and ink: small cards like washi slips with deckled edges, thin ink
borders, serif typography (bundled via @fontsource — e.g. *Shippori Mincho* / *Cormorant
Garamond*), muted ink text, a single vermilion seal-like accent for primary actions.
Controls hug the bottom/edges and fade to low opacity when idle during a session.

## Motion
Slow and organic: easing like breath (2–6 s), noise-driven sway, nothing snaps.
Respect `prefers-reduced-motion`.
