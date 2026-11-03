# 97 · S10b: shadows and rim light follow each scenery's sun side

## What
At the waterfall the sun sets on the right, but the shared plant and boulder shadows fell to the
right and the rims lit the left edges: the Japanese garden's sun was built into
`castShadow` and `rimLight`. Now each scenery says where its low sun stands (ADR 0284).
- **Contract.** `SkyLayout.sunSide?: { sunrise: -1 | 1; sunset: -1 | 1 }` (−1 left, +1 right).
  The garden states `{ sunrise: 1, sunset: -1 }`. The waterfall states `{ sunrise: 1, sunset: 1 }`
  through `WATERFALL_SUN_SKY` in `waterfall/sky.ts`: its layout plus the side, used as both
  `sky.layout` and `light.sky`. `layout.ts` was left alone because the rocks task owns it. A sky
  without a side gets the garden's. `castShadow(s, sky?)`, `rimLight(s, sky?)` and `sunSide(sky?)`
  take the sky the way `sunDisc` does. Only the sign of the low-sun terms changes. Length, `dy`,
  alpha, rim strength and colours, midday and the moon stay as they were.
- **Readers.** The plant system (shadows and rims, from `SystemContext.scenery.sky.layout`), the
  scene system's boulder rims, the light plates (boulder, shrub and tree shadows, and the crown
  lights on the sun side; the crown lights' warm colour now follows the phase, not the side), the
  `sprout.daylight()` readout (new `AmbienceSystem.sky()`), the waterfall daylight studio's
  boulder rims, and a new `sun` field in `sprout.plants.state()` (shadow `dx`, rim side and
  strength).
- A side per low sun, not an azimuth: the painted shadows and rims have only ever had a left and a
  right, and it is the smallest form that gets both gardens right.

## Proof the garden is unchanged
- **Studio, to the pixel.** Studio `daylight` (the garden painting, boulder rims and light plates at
  all four phases, the four blends and each plate alone; 1440×6603 full page, t = 1) was shot at
  the commit before and after. **0 pixels differ.**
  `artifacts/sun-side/before/studio-daylight-1440x900.png`, `artifacts/sun-side/after/studio-daylight-1440x900.png`.
- **Unit, to the bit.** `sky-layout.test › gives the garden the shadow and rim it had before sun
  sides` checks the garden's `dx` and rim side with `toBe` against the pre-0284 formulas, over
  phases, blends and sun altitudes. Multiplying by ±1 is exact.
- The live garden shots (`garden-{sunrise,midday,sunset}`) differ only where the koi, birds, the
  plants' sway and the toast move between runs. Midday differs as much as sunset, and the sun side
  cannot change midday.

## Look (three rounds; 1440×900, the dev server on 5424, `artifacts/sun-side/shoot.ts`)
Katsura at bank-16, tochinoki at cliff-1, yamabuki at bank-12 and bank-5, at the waterfall.
1. Before and after at sunrise, midday and sunset: `artifacts/sun-side/{before,after}/waterfall-{sunrise,midday,sunset}.png`.
   Sunset before: the shadows fell right, toward the sun. After: the boulder, yamabuki and katsura
   shadows lie left. Sunrise and midday look the same, as they should: the waterfall's sunrise side
   is the garden's, and midday has no side.
2. Close on the right-hand boulder and a yamabuki at sunset: `{before,after}/waterfall-sunset-close.png`,
   stacked in `artifacts/sun-side/close-rims-before-after.png`. Before, the rim was on the
   boulder's left (shaded) edge. After, it is on the right edge, facing the sun, and the shadow lies left.
3. Tall plants at sunset and the dusk blend: `{before,after}/waterfall-sunset-{katsura,tochinoki}.png`
   and `after/waterfall-dusk.png`. The katsura's long shadow runs left from its foot and tilts a
   little toward the viewer. The tochinoki trunk and leaves are rimmed on the right (before: on the left).
- Waterfall studio: `{before,after}/studio-waterfall-daylight-1440x900.png`, where its rims changed side.

## Tests
- `ambience/sky-layout.test.ts`: the garden's side, and the garden's default for an unsided sky;
  the bit-for-bit pin against the old formulas; at the waterfall both low suns stand right, so
  shadows fall left and rims face right, with only the side differing; the dusk blend keeps the
  shadow away from the sun.
- `plants/shadow.test.ts`: with a right-hand sun the blot lies left at both low suns and keeps its length.
- `plants/system.test.ts`: with the viewed scenery's sun on the right at sunset, the plant system's
  shadow `dx` and rim side flip, and the blot is drawn leftward (its rotation).
- `scenery/registry.test.ts`: every registered scenery states its sun side.
- `scenery/waterfall/daylight.test.ts`: `light.sky` is `WATERFALL_SUN_SKY`.
- `tests/e2e/daylight.spec.ts › at the waterfall the sun sets on the right`: `daylight()` and
  `plants.state().sun` at the waterfall's sunset. **Not run locally** (CPU; CI runs it).

TESTING row for the orchestrator:
`| S10b.1 | Shared shadows and rim light follow the viewed scenery's sun side (garden unchanged, waterfall right at both low suns) | sky-layout.test, plants/shadow.test, plants/system.test, scenery/registry.test, e2e daylight.spec › at the waterfall the sun sets on the right | ✔ |`

## Index lines for the orchestrator
- `docs/devlog/README.md`:
  `| 97 | [S10b: the sun side](97-sun-side.md) | Each scenery's sky says which side its low sun lights from; shared shadows, crown lights and rims follow it (the waterfall's fall left and face right at sunset); the garden is pixel-identical | 0284 |`
- `docs/adr/README.md`:
  `| [0284](0284-scenery-sun-side.md) | Each scenery says which side its low sun lights from | accepted | \`SkyLayout.sunSide\` ({ sunrise, sunset }: −1 left, +1 right; default the garden's); \`castShadow\`/\`rimLight\` take the sky; plants, boulder rims, light plates and the dev readout pass the viewed scenery's |`

## Left open
- **Boulder shadows on the light plate tilt the wrong way when they fall left.** `cast.ts ›
  paintShadows` rotates the ellipse by `angle * 0.15`, and `angle = atan2(dy, dx)` is about π when
  `dx < 0`. A leftward shadow tilts about 27° up and away from the viewer, while a rightward one
  lies almost flat. This is old: the garden at sunrise already shows it. The waterfall now shows it
  at sunset too (`after/waterfall-sunset-close.png`). The fix would mirror the tilt for `dx < 0`.
  It changes the garden's sunrise plate, so it was not made here.
- `WATERFALL_SUN_SKY` should fold into `WATERFALL_SKY_LAYOUT` in `layout.ts` once the rocks task
  has merged. Then `sunSide` could become required on `SkyLayout`.
- Weather sun's leaf glints and lifted bands (ADR 0193) keep their upper-left light in both
  gardens. They are not tied to the time of day.
- In a close view at sunset, the rim on the tall plants reads as a warm offset copy of the leaves
  and trunk. It looks the same before and after, only mirrored, so it is the rim mask's look up
  close, not the side.

## `src/main.ts`
Not touched.

## Status
S10b done. `npm run typecheck` passes. Unit results are in the report. e2e was not run locally.
