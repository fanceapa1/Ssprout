# Plant species — tier 3 flowering shrubs (set B)

Six tier-3 species (50–89 min sessions), painted only with the paint engine
(`docs/systems/paint.md`). Each one grows live during a session, from seed to full bloom.

Look at them: studio → **Plants · tier 3 shrubs review** (`shrubs-b`: every tier-3 species from the registry side by side at
preview and garden scale, a ten-step growth strip per species, five seeds per species) and
each species' own section (`species-<id>`).
`npm run shots -- --entry shrubs-b/bloom` · `--entry shrubs-b/grow-lotus` · `--entry shrubs-b/seeds-camellia`.

## Species

| id | name · native | habitats | size class · box (w×h) · anchor | bloom colour | the look |
|---|---|---|---|---|---|
| `tree-peony` | Tree Peony · Botan | meadow, back | large · 200×220 · (0.5, 0.93) | `#f29aae` | loose dome of three-lobed compound leaves, 2–4 huge ruffled blooms in 3 rings (shell pink, rose, white or deep peony) with a magenta flare and gold stamens; most seeds keep one fat bud |
| `hydrangea` | Hydrangea · Ajisai | meadow, shore, back | large · 200×210 · (0.5, 0.93) | `#989ddd` | broad mound of oval leaves in opposite pairs, 5–8 mopheads of ~50 four-lobed florets; per-seed "soil" shades the heads from blue through violet to pink; heads start lime-green and colour as they open |
| `azalea` | Azalea · Tsutsuji | meadow, rock, path | medium · 140×120 · (0.5, 0.9) | `#e77ca9` | clipped low mound of small dark leaves covered in patches of five-lobed flowers (magenta-pink, soft pink, coral or white) with dark throat spots and a few long stamens |
| `camellia` | Camellia · Tsubaki | back, meadow | large · 180×220 · (0.5, 0.94) | `#da4d58` | upright oval evergreen on 2–3 grey stems, dark foliage with glossy lifted leaf highlights, 8–12 cupped flowers (red, pink or white) with a brush of yellow stamens; one or two whole flowers fall to the ground at the very end |
| `chrysanthemum` | Chrysanthemum · Kiku | meadow, path | medium · 125×110 · (0.5, 0.92) | `#edb946` | grey-green cushion of 34–42 small ray-floret blooms (gold, rust, white or mauve) with a deeper inner rosette and a disc |
| `lotus` | Lotus · Hasu | water | large · 200×220 · (0.5, 0.84) | `#f5a0b7` | 3–5 floating pads and 2–4 raised bowl-shaped leaves with radial veins, one or two tall pink-tipped blooms, often a bud, usually a ripening seed pod |

All have `pollinators: true`; lotus and hydrangea reflect (water/shore habitats). The lotus fits
exactly two garden slots, the large open-water `water-1` and `water-3`; when seedlings of other
sessions in progress hold both, the planting sheet shows it full instead of offering it (ADR 0205,
`src/plants/plantable.test.ts`).
Each species file exports its pure builder (`buildPeony`, `buildHydrangea`, …) for tests.

## Approach: build once, reveal by growth (ADR 0064)
`draw(p, rng, { growth })` first builds the **whole plant** from `rng` — stems, foliage clumps,
leaves, flower positions and petal patterns — with the same draws in the same order at every
growth. Every element gets its own `seed` and a growth window `[t0, t1]`; painting uses
`createRng(seed)` per element and only scales / extends / opens it by `ramp(growth, t0, t1)`.
So consecutive growth steps are frames of one plant: the sprite cache's ~24 steps cross-fade
without anything jumping. A unit test checks the species rng is left at the same position
whatever the growth.

| growth | what changes |
|---|---|
| 0 – 0.12 | soil mound, dark seed, a pale shoot with two seed leaves (lotus: a ripple and a rolled leaf) |
| 0.12 – 0.45 (to ~0.55) | stems extend from the ground (children start when the parent's tip passes the fork) and thicken; foliage fills in from the heart outward and upward (`growOutward`, `domeLeaves`); stems then tuck into the foliage (`hide`) |
| 0.45 – 0.75 | buds swell: petals folded up into a bud, mopheads as tight lime clusters, mum discs as green buttons; lotus stalks rise |
| 0.75 – 1 | flowers open, staggered per flower; colour goes from bud green to full; centres (stamens, discs) appear past half-open |

## Shared helpers (`src/plants/lib/`)
- `shrub-growth.ts` — `PHASES`, `ramp` (smoothstep window), `linear`, `lerp`, `stagger`.
- `shrub-structure.ts` (pure, tested) — `growSkeleton` (stems + side branches with timed
  windows), `terminalBranches`, polyline helpers (`partialPath`, `pointAt`, `angleAt`),
  `domeScatter` (spaced points over a mound, back → front, with a lit value), `leafSpray`
  (leaflets on a petiole, optional lobes), `domeLeaves` (sprays over a dome, timed by reach),
  `growOutward` (re-time elements heart-first), `petalVector` (3-D petal → screen angle and
  foreshortening for a tilted flower; a bud is just a small opening angle — ADR 0066).
- `shrub-paint.ts` — `inPlantSpace` (paint in world units with the origin at the anchor),
  `ribbonInto` (tapered brush ribbon into an open wet layer), `groundShadow`, `seedAndShoot`,
  `paintBranches` (all stems in one layer, broken shadow-side accents in another, twigs in a
  third; `hide` tucks stems into foliage), `paintClumps` (every clump's dabs merged into one
  foliage mass: light body with paper gaps, mid tone, cool underside + darks — 3 layers),
  `paintLeaves` (leaf dabs in alternating wet layers, optional gloss lift), `bloomMarks` /
  `paintBlooms` / `bloomState` (layered petal rings with ruffles, wet-in-wet tips, throat
  glaze, stamens / boss / camellia tuft, sepals; one set of passes shared by every flower in
  the call).
- `shrub-heads.ts` — `headFlorets` (packed florets on a dome, pure) and `paintHeads`
  (mopheads and blossom patches: body + lit florets merge in one layer, shadow florets and
  eyes dry in a second; alternate heads in separate sets).
- `shrub-gallery.studio.ts` — the review sheet.

Species-specific painting stays in the species file: chrysanthemum ray-floret stars
(`rayStar`, batched by depth), lotus pads (wet-in-wet heart flooded into the face, cupped
undersides, veins), stalks and seed pod, azalea stamens.

## Performance (ADR 0065)
Each wet layer's drying pass reads pixels back, so the shrubs batch marks into shared layers
instead of one layer per mark (peony went from ~70 dries to ~17). Measured in headless
Chromium (Apple M3, machine shared with other jobs, load ≈ 10), `quality: 'normal'`, 2 px per
world unit (400×440 px for a 200×220 box), median of 11 seeds:

| species | px | growth 0.3 | growth 0.6 | growth 1 |
|---|---|---|---|---|
| tree-peony | 400×440 | 17 ms | 46 ms | 53 ms |
| hydrangea | 400×420 | 26 ms | 44 ms | 47 ms |
| azalea | 280×240 | 22 ms | 30 ms | 32 ms |
| camellia | 360×440 | 17 ms | 46 ms | 57 ms |
| chrysanthemum | 250×220 | 20 ms | 30 ms | 33 ms |
| lotus | 400×440 | 9 ms | 20 ms | 26 ms |

All under the 60 ms target; on an idle machine they are ~20–30 % faster. Costs are
dominated by the drying passes (pixel read-back and rim blur), then polygon deformation.

## Known weaknesses
- Chrysanthemum is the plainest: the cushion reads, but the blooms are flat stars with little
  depth and the grey-green foliage is a bit dull.
- Batched layers merge marks inside one pass: neighbouring leaves of the same group and
  clumps of one plant lose their mutual edges (intended for the foliage mass, a compromise for
  leaves).
- Upper stems can show faintly through translucent foliage; raised lotus leaves let their
  stalks show through.
- Camellia flowers and rim leaves sometimes sit right at the crown's edge.

## Tests
`src/plants/lib/shrub-structure.test.ts` (growth timing, polylines, skeleton/dome/leaf/floret
determinism and invariants, petal projection) and `shrubSuite(id, build, { habitats, sizeClass? })`
(`src/plants/lib/suites.ts`, called from each `species/<id>.test.ts`, ADR 0251: registration with its
habitats and size, builder determinism, growth-independent rng use); `species/chrysanthemum.test.ts`
adds colourway variety and `species/camellia.test.ts` petal continuity from bud to bloom. Visuals: the studio sections above (the studio
e2e spec renders every entry).
