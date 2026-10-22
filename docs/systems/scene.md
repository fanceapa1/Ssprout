# Scene

`src/scene/` — the fixed garden landscape (SPEC §1): its shared geometry and planting slots, the
watercolour painting of it (made only with the paint engine), the foreground boulders and tufts
that plants can stand behind, the living water surface, the paper layer and the `?dev&slots`
overlay.

Look at it: studio → **Scene · painted garden** (`npm run shots -- --studio scene`, or
`npm run shots -- --entry scene/full`), and the app itself (`npm run shots`,
`npm run shots -- --query slots` for the overlay).

## Files
| File | What |
|---|---|
| `geometry.ts` | `SceneGeometry` contract types and `gardenScene`: `POND`, `ROCKS`, `PATH`, `PAVILION`, `WATERLINE`, sky band |
| `slots.ts` | `GARDEN_SLOTS` (52), `perspectiveScale(y)`, `PLANT_SIZES` (canonical plant sizes) |
| `layout.ts` | painting-only composition: trees, shrubs, tufts, foreground tufts, hill ridges (not a contract) |
| `paint-land.ts` | sky, hills, far tree line, banks, path, background tufts, pond reserve, paper margins |
| `paint-pond.ts` | water body, static reflections, water detail (sky band, ripples, far-shore ink) |
| `paint-trees.ts` | trees (stems, limbs, twigs, cloud pads) and shrubs |
| `paint-pavilion.ts` | engawa corner: roof, eave, posts, wall, shoji, deck, hanging lantern |
| `sprites.ts` | foreground sprites: boulders (+ moss, base tufts, contact shadow) and tufts |
| `background.ts` | `GARDEN_ART`, ordered `backgroundSteps`, `paintJob` generator, `paintSceneSync`, cooperative `paintScene` |
| `water.ts` | `createWaterSurface`: shimmer bands, ripple rings, glints (per frame) |
| `overlay.ts` | `drawSlotOverlay` (dev) |
| `system.ts` | `createSceneSystem` (background + entities + water + overlay), `createPaperSystem`, `paintViewFor`, `canReuse` |
| `debug.ts` | `?dev` hooks: `sprout.slots()`, `sprout.sceneStats()`, `sprout.scenePainted()` |
| `scene.studio.ts` | studio section `scene` |

## Composition map (world 1600 × 1000)
```
y    0 ┌──────────────────────────────────────────────────────────────────────┐
       │  (paper sky, a barely-there cool wash at the top, warm haze low)      │
   60  │   big leaning tree ~(40–660, 60–480)           two slim trees   ┌────┤ roof/eave 160–250
       │   + slim tree behind (100–240)                  (1000–1240,    │engawa
  300  │ ~~~~~ far hills 300–420 (two pale ridges) ~~~~~~ 100–450)       │ lantern (1352,300)
  400  │ ── far bank 400–470 · far tree line (470–1180) ─────────────────│posts
  452  │  shrub    rocks·rocks  ╭──── pond (460–1256 × 452–713) ──╮  rocks │1322,1484
       │  (146,470)            │ far edge ≈ y 455 (waterline 456) │ bay    │deck 578–612
  560  │ left bank             │      ripples · sky band          │ x≈1256 │engawa on the bank
       │ (0–480, 450–800)  big rock (506,654)        big rock (1060,722) │ (shadow, footings,
  713  │              ╰─────────── near edge ≈ y 711 ──────────╯   step stone) shrub (1548,694)
  760  │  near mound (lip ~750)  ▒ 6 stepping stones ▒  near mound (lip ~760)│
       │                         ▒ (780,744)…(804,968) ▒                   │
 1000  └────────── paper margins: edges dissolve, bottom corners most ─────┘
```
- **Focus**: the pond (renderer focus `(800, 560)`). Portrait phones show at least 600 world units
  (x ≈ 500–1100, ADR 0123): the pond, back boulders, the path and foliage edges of both tree
  groups framing the top.
- **Engawa on the bank** (ADR 0122): the pond's right end turns back in a soft bay at x ≈ 1256,
  short of the pavilion (x 1290+); the deck stands on dry bank with a crawl-space shadow, footing
  stones under the posts, a cast shadow and a kutsunugi-ishi, and nothing of it reflects. The
  lantern's light only reaches water within 70 units of its mirror image, so it has no reflection.
- **Path**: six broad stepping stones (`PATH`, rx 92 → 45) winding gently from the bottom centre
  up to the water, bedded in a worn earth path with grass-nibbled edges; painted after the paper
  margins (`stones` step) so the near ones stay crisp.
- **Depth**: far things are paler, cooler and smaller (`atmos(pigment, distance)` lightens and
  mixes toward a blue-grey haze); near banks are warmer; detail (ink, granulation) is spent on
  stones, trunks and the pavilion.
- **Value structure**: lightest = paper (sky, path, pond rim, margins); darkest = small accents —
  boulder contact shadows, trunk shadow lines, the eave line.

## Layers
| Layer | What the scene draws |
|---|---|
| `background` | the cached painting (everything except boulders and foreground tufts), cross-faded in |
| `waterSurface` | `water.ts`, clipped to the pond, every frame (still under reduced motion) |
| `entities` | 11 boulders + 6 tufts as `Drawable`s, **depth = base y** (`Rock.y`, tuft base) |
| `lighting` | the slot overlay, only with `?dev&slots` |
| `paper` | `createPaperSystem`: `paperTexture(pixelW, pixelH)` multiplied over the frame (ADR 0040) |

Paint order of the background (`backgroundSteps`): sky → hills (+ far tree line) → banks → far
trees → pond reserve (thin rim far, wider near) → water → reflections → water detail → path →
shrubs → near trees → tufts → margins → stones → pavilion (after the margins so the stones and the
engawa stay crisp). Sky, hills, banks and margins are painted with a `draft` painter (soft washes:
no visible difference, about half the cost).

**Reflections** (static, in the background): the far-bank green band, tree pads and stems (about
their shore line `reflectAbout`), the near shrub, boulders (their own silhouette — seeded by rock
id via `rockOutline`, so sprite and reflection agree — flipped about the base and foreshortened
×0.72); the pavilion stands on the bank and casts none. All in one soft clipped wet layer,
then broken by ~26 horizontal lifted strokes.

## Slots
52 slots, all with `scale = perspectiveScale(y)` = linear from **0.55 at y 400** to **1.15 at y 960**.

| Habitat | n | Where | maxSize |
|---|---|---|---|
| `water` | 7 | open water, ≥ 30 from the edge | medium (2 small) |
| `shore` | 9 | pond rim between boulders, ≤ 45 from the edge | medium (2 large) |
| `meadow` | 16 | left/right banks and the near mounds | large / medium |
| `path` | 7 | on the grass beside the stepping stones, never on them | small (2 medium) |
| `back` | 7 | far bank behind the pond | **tree ×3** (`back-1/4/6`), large, medium |
| `rock` | 6 | at the feet of boulders | small |

Tree slots sit in the sky gaps (x 70, 650, 944) so full-size trees (≈ 220 wide at scale 0.58)
don't collide. Plants in `rock`/`shore` slots sort against the boulder sprites by base y.

### Canonical plant sizes (`PLANT_SIZES`, world units at slot scale 1)
| sizeClass | w × h |
|---|---|
| small | 86 × 86 (tier-1 flowers draw in a 70-unit box scaled up, ADR 0125) |
| medium | 120 × 160 |
| large | 200 × 220 |
| tree | 380 × 460 |

Plant agents: use these for `SpeciesDef.size` (± ~15 % for character); the slot's `scale` is
applied on top. The overlay draws each slot's max-size box so you can check fit.

## Caching, repaint and fade (ADR 0041)
- The painting covers `paintViewFor(viewport)`: the visible world rect + 60 units margin, at
  `min(viewport.pixelScale, 1.5)` bitmap px per world unit (above that the bitmap is upscaled;
  the paper grain stays crisp because the paper layer is full resolution).
- On resize: if the scale changed ≤ 10 % and the visible rect is inside the painted rect, the
  bitmap is just rescaled (`stats.rescales++`); otherwise a repaint starts.
- The **first** paint blocks `init` (so `sprout.ready()` means painted). Meanwhile the paper layer
  already shows (no blank flash). Later repaints run in the background with the old painting on
  screen, then cross-fade in (1.2 s). A frame with `dt = 0` (freeze/renderOnce) or reduced motion
  settles a fade at once, so screenshots are never half-faded.
- Paint runs as a generator (`paintJob`) driven cooperatively: it yields to the browser every
  ~20 ms, so the frame loop and input stay alive during a paint.
- `createSceneSystem({ invalidate })` needs `renderer.invalidate` to redraw the cached
  background while fading.

### Performance (headless Chromium, Apple M3, machine shared with other jobs — load avg ≈ 4)
| Viewport | paint view | painting (CPU) | wall incl. yields |
|---|---|---|---|
| 1440×900 @2 | world @1.5 | 1.4–1.9 s | 1.6–2.3 s |
| 1920×1080 @2 | world (y ≥ 40) @1.5 | 1.6–2.1 s | 2.0–2.7 s |
| 390×844 @3 | strip 584×1000 @1.5 | 1.1–1.3 s | 1.2–1.5 s |
| 1440×900 @1 | world @0.9 | 1.2–1.3 s | 1.4 s |
Biggest steps: boulder sprites (~0.35–0.5 s for 11), the big tree (~0.2 s), pavilion, banks.
Uncapped scale 1.8 cost ~2.3 s for an identical-looking result. Draft-quality boulders were tried
and rejected (granulation and rims wash out). `sprout.sceneStats()` returns per-step timings.

## How to tweak
- **Move things**: geometry in `geometry.ts` (contract — slots, rocks, pond are read by other
  systems), painting-only things in `layout.ts`. Run `npx vitest run src/scene` — the invariants
  (slot counts, water slots inside the pond, shore near the edge, spacing, world bounds) will
  tell you if a move broke something.
- **Look**: change a step in `paint-*.ts`, then `npm run shots -- --entry scene/full` (fast) and
  `npm run shots` (real viewports). Every element has its own studio entry.
- **Variation**: `GARDEN_ART.seed` (7) picks the painting; the studio's Reseed shows others.
- **Speed**: `maxPaintScale`, `quality`, and the `soft` flag on steps (draft painter).

## Tests
- `geometry.test.ts`: slot counts per habitat, unique ids, world bounds (incl. max-size box),
  water slots inside the pond ≥ 30 from the edge, shore ≤ 45 from it, land slots off the water,
  perspective, tree-slot spacing, slot spacing, path slots beside (not on) the stones, "never
  plants on a stepping stone or inside a boulder", rock slots at a boulder's foot, simple pond
  polygon, 8–12 boulders with perches, stepping stones, lantern and sky band, "keeps the painted
  trees and foreground tufts inside the world".
- `system.test.ts`: paint view (cap, portrait strip) and the 10 % repaint rule.
- `tests/e2e/scene.spec.ts`: painted (pale sky, celadon pond, many colours), 50–60 slots across
  all habitats, `?dev&slots` overlay, rescale vs repaint on resize.
