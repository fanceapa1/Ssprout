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
| Sap / sage green | grass, foliage | `#a8b572`, `#8b9c5a`, `#c3c98a` |
| Olive shadow | foliage darks | `#6d7c44` |
| Pond celadon | water | `#9cc6ba`, `#7eb4ac`, deep `#5b9a91` |
| Stone grey | rocks | `#9d9787`, `#7e7a6e`, warm `#a89882` |
| Sumi ink | lines, trunks | `#4a443c` (never pure black) |
| Wood | pavilion | `#8e7960`, `#aa9478` |
| Sakura pink | flowers | `#f49ea4`, `#fbc2be` |
| Iris violet | flowers | `#7d65b9`, `#9c87d3` |
| Bellflower blue | flowers | `#7596db` |
| Off-white petals | anemone etc. | `#faf6ee` with grey-violet shading `#cac2d4` |
| Shadow | cast shadows, shade glazes | cool violet-grey `#8c89a1` |
| Accents (sparingly) | koi, lantern | vermilion `#d9623d`, gold `#e1b152` |
| Sky (daylight phases, thin washes) | skies, glows, night | cerulean `#5e98cc`, ultramarine `#4a59b0`, indigo `#2e3a6e`, rose `#d76a86`, crimson `#c2414f`, ochre `#e0a043`, apricot `#f2ad7e`, violet `#7c5fa8` |

Colours are **rich but transparent** (v2, ADR 0144: about 1.4× the v1 chroma for the shared
pigments, 1.3× for the species' own colours): watercolour pigment laid thinly, granulating, never
digital neon. `src/paint/pigments.test.ts` holds the ceilings: OKLab chroma < 0.135 for earth and
plant pigments, < 0.145 for gold and the sky pigments, < 0.17 for the crimson/vermilion accents. The brightest things in the scene are flower heads and
koi; each daylight phase balances the whole (night takes colour out before it darkens).

## Daylight phases (SPEC §5, docs/systems/daylight.md)
Four lights, each painted — a sky plate under the garden and a light plate over it — never a
filter:
| Phase | Sky | Light on the garden |
|---|---|---|
| Sunrise | cool violet-blue overhead into peach/apricot behind the right-hand hills; rose-lit cloud banks with lost lower edges; hills cool blue | thin lavender, warmer toward the sun; mist lying on the pond and lifting; long cool shadows to the left; light caught on the right of the crowns; dew |
| Midday | wet-in-wet cerulean graded to warm paper at the horizon, soft whites lifted out of the wet blue in drifts (lost edges, now and then a dried edge or bloom), never cloud shapes | almost bare paper — the most saturated, crisp moment; short pools of shadow; sparkle on the water |
| Sunset | rose-violet → crimson band → ochre-gold glow on the left; dark violet clouds with burning undersides; hills as violet silhouettes; the sun a pale disc sinking behind the far ridge | warm amber, gold rim light from the left, long violet shadows to the right, the pond reflecting the warm sky, the lantern and shoji coming on |
| Night | granulating indigo into a paler ultramarine horizon, darker hills, a few stars and the moon left as paper (its real phase) | a moonlit indigo glaze the paper breathes through — never black or muddy — colours faded first, the moon's broken path on the water, the lantern's pool and a warm window; the night wash stops short of the page with a ragged, pooled watercolour edge (the margin is paper, never a grey haze) |
The **sun weather** is a thin warm glaze over the garden (never the sky) with soft diagonal bands of
light lifted out of it, not shafts painted on top (ADR 0193). Phases blend over 40 minutes around
their boundaries on the real sun, so the light never jumps.
Lights are **reserved paper**, not added glow: the sun, the moon, stars, the lamp light and the
light on the crowns are where pigment was left out. Shadows are cool violet-blue glazes, soft at
the tip, never grey drop shadows.

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
- Glossy gradients, drop shadows, glow/bloom filters, neon, digital (opaque) saturation; lens
  flares, vector sunsets (concentric bands, a perfect sun disc with rays).
- "Particle confetti", sparkle emojis, bouncy cartoon animations, lens flares.
- Generic UI: pill buttons with gradients, glassmorphism, Inter font everywhere, emoji icons, the
  small round red "recording / live" dot beside actions or states (ADR 0194: an inked sprout marks
  what begins or grows, a brush stroke marks what is chosen), pulsing dots, glowing badges.
- Fading instead of painting: a milky haze or a CSS fade where a wash should stop with a
  watercolour edge (ADR 0184); cartoon cloud shapes in a midday sky.
- Visible repetition: every instance must be seeded-unique; clumps vary in count & angle.
- Close views that turn to vector: zoomed in, the painting, the light and the plants are painted
  again for the view (ADRs 0163, 0185–0187); never a blurred upscale or a hard tile seam.

## UI style
UI is calm paper and ink: small cards like washi slips with deckled edges, thin ink
borders, serif typography (*Shippori Mincho* for display, *Cormorant Garamond* for body; the
@fontsource files, Latin and Latin-ext only, declared in `src/ui/fonts.css`, ADR 0239), muted ink text, a vermilion seal-like accent for the one primary action of the moment
(ADR 0201). Small signs are drawn, not dotted: the inked sprout beside what begins a planting, a
brush stroke under a choice. Hover and focus speak one language: ink deepens with a brush stroke
drawn in under words, slips lift a hair (ADR 0204). The controls live in the dock below the garden;
on the painting only the timer pill and the corner tools stay, resting a small step back while you
focus, still readable (ADR 0180).

## Motion
Slow and organic: easing like breath (2–6 s), noise-driven sway, nothing snaps.
Respect `prefers-reduced-motion`.
