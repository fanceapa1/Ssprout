# 119 · Oasis polish (O1b, phase 13)

## What
Five small fixes to the oasis that earlier tasks left open, one commit each.
1. **Medium sand slots** (`slots.ts`). All six `path` slots were `small`, so the desert hyacinth
   (devlog 118) only grew on the two medium back slots. `walk-3` and `walk-4` are now `medium`,
   one each side of the footpath. To keep them from standing straight in front of the small slots
   behind them, the middle pair moved outward and the back pair inward, all still 50–120 from the
   footpath:
   - `walk-3` (750, 850) small → (714, 852) medium; `walk-4` (920, 846) small → (950, 848) medium;
   - `walk-5` (770, 760) → (796, 758); `walk-6` (930, 762) → (900, 764).
2. **Medium shallows slot**. A new `shallows-3` (1446, 722) `medium` stands mid-river at about
   `ouedAt(0.4, 0.5)`, above the big bar's head: 40+ from the oued's banks and 30+ from every one of
   `OUED_BARS`. The cattail can now stand in the oued. 47 → 48 slots.
3. **The moon** (`layout.ts`). The arc's middle point went from (960, 110) to (960, 150), so its
   top is about y 149 (it was 110). At 1920×1080 the moon was behind the paper's top edge; now it
   rides in open sky right of the east tower, clear of the controls.
4. **Far range** (`paint-land.ts`). The range's wash went from `lighten(lilac, 0.06)` →
   `mix(lilac, rose, 0.45)` at 0.42 to `mix(lilac, lilacDeep, 0.35)` → `mix(lilacDeep, rose, 0.5)`
   at 0.64, and its fade from start 0.3 / amount 0.9 to 0.45 / 0.6. The gully strokes went from
   0.16 to 0.22 and the lower glaze from 0.22 to 0.3 (fade amount 1 → 0.8). The dunes start from
   plain `sand` instead of `lighten(sand, 0.1)`, ending in a little `sandShade`, because most of the
   pale strip at sunset was the dunes under the range. Land hash pins updated.
5. **The basin as a mirror** (ADR 0302). `Scenery.pondSurface?: number` (0–1, default 1) reaches
   `createWaterSurface` as `strength`, which scales every shimmer, ring and glint blit's alpha.
   At 0 `draw` returns at once. The oasis sets 0, so the basin has only O6's inlet rings and its
   painted reflections. The mirrored sky plate and the scenery's motion are not drawn by
   `water.ts`, so they are unchanged.

## Why this shape for the opt-out
`SceneryMotion` is only created when reduced motion is off, so an option there would leave the
still shimmer on the basin under reduced motion. A field on the scenery covers both. A number
rather than a flag lets a later scenery keep a calmer pond (0.5) without a second option.
The garden and the waterfall leave it out. Before committing I ran the old `water.ts` and the new one side by side over 120 s for both
gardens' ponds (three lights): every blit, alpha and position was the same. Only the oasis
reads it.

## Looked at
All in `artifacts/o1b/` (gitignored), 30 plants, `sprout.seed(7)`, through the dev API.
- `before-{noon,sunset,night}-{1440x900,1920x1080,390x844}.png` and the same `after-*`.
  The plants differ between them, because `addPlants` now draws from 48 slots.
  - Moon: in `before-night-1920x1080` there is no moon at all (it is behind the paper's top edge).
    In `after-night-1920x1080` it rides in open sky right of the east tower, under the top edge.
  - Far range: in `before-sunset-1920x1080` the band behind the grove is a cream strip under
    the coral sky. In `after-sunset-1920x1080` it is a mauve band that holds against the sky. It
    is still lighter than the sky, as a far range should be. At noon (`after-noon-1920x1080`) it
    is a clear lilac range that stays far behind the ksar; at night a violet-blue band.
  - Basin: no shimmer streaks or stray rings at noon; the reflections read as a still mirror.
- `planted-noon-{1440x900,390x844}.png`: desert hyacinths on `walk-3` and `walk-4`, a cattail on
  `shallows-3`, then 24 more plants. The hyacinths stand on open sand either side of the path,
  clear of the lavenders behind them. On the phone the right one sits by the pomegranate on
  `plot-6`, cut by the crop's edge.
- `planted-close-hyacinth-1440x900.png` (`focusSlot('walk-3')`, noon): both spikes on bare sand,
  the lavenders on `walk-5/6` behind and to the side. The `walk-4` clump touches the `plot-6`
  pomegranate's left edge (the spacing test allows it: 24% footprint overlap).
- `planted-close-cattail-1440x900.png` (`focusSlot('shallows-3')`, sunset): the clump stands in
  the river with the oued's drifting glints round it.
- `map-after-1920x1080.png` (studio `oasis-map/map`): `walk-3 M`, `walk-4 M` and `shallows-3 M`
  with their 1.25× boxes; the moon's circles now top out level with the towers' horns.

## Tests
- `oasis.test.ts`: medium sand slots each side of the footpath (O1b.1); a medium oued slot clear
  of every bar (O1b.2); the moon's disc 60+ under the top of a 16:9 view (O1b.3). The existing
  spacing tests pass with the new slots.
- `land.test.ts`: recording hash pins updated for the far range (O1b.4).
- `src/scene/water.test.ts` (new): strength 1 draws the same blits as leaving it out, 0 draws and
  clips nothing, 0.5 halves every alpha; the oasis sets 0 and the others leave it out (O1b.5).
- Targeted vitest (`src/scene`, `src/scenery`: 28 files, 295 tests), `npm run typecheck`, and
  `tests/e2e/sceneries.spec.ts` once with `E2E_WORKERS=1`.

## Left open
- At a close view the oued's milky water round `shallows-3` is pale, so the cattail's foot reads
  more as wet sand than as a river at sunset. The cattail's own water glaze helps. A deeper
  teal thread through the oued's middle would fix it (paint-water, O3's oued).
- The `walk-4` medium plant touches the `plot-6` large plant's footprint. That is within the
  spacing rule, but a bushy medium species there would crowd it.
- `ARCHITECTURE.md` still says "Only the waterfall has one" about `motion`. The oasis has one too
  since O6. I left that line alone.
- Rain rings, striders and floating leaves still use the basin as a pond. That is correct for
  rain, but a scenery may want to opt the striders out of a mirror later.

## For the orchestrator
- Devlog index: `| 119 | [Oasis polish](119-oasis-polish.md) | O1b: medium sand slots (walk-3/4) and a medium oued slot (shallows-3) for the desert hyacinth and the cattail, the moon lowered under the controls, a deeper far range, and the basin stilled with Scenery.pondSurface (ADR 0302) |`
- ADR index: `| [0302](0302-scenery-pond-surface.md) | A scenery can still the generic water surface on its pond | accepted | \`Scenery.pondSurface?\` (0–1, default 1) scales water.ts's shimmer, rings and glints; the oasis sets 0, so its basin is a mirror with only the inlet's rings; the garden's and the waterfall's blits are unchanged |`
- TESTING rows:
  - `| O1b.1 | The oasis offers medium plants open sand by the footpath, one medium path slot each side, without crowding at 1.25× | scenery/oasis/oasis (medium sand slots; spacing) | — | ✔ |`
  - `| O1b.2 | A medium oasis slot stands in the oued's open water, clear of its banks and every sand bar | scenery/oasis/oasis (medium oued slot) | — | ✔ |`
  - `| O1b.3 | The oasis moon stays in open sky, under the corner controls and the paper edge on a 16:9 screen | scenery/oasis/oasis (moon under the controls) | — | ✔ |`
  - `| O1b.4 | The oasis far range holds against the sunset sky on wide screens | scenery/oasis/land (hash pins) | — | ✔ (looked at: artifacts/o1b/after-sunset-1920x1080) |`
  - `| O1b.5 | A scenery can still the generic water surface on its pond (pondSurface); the oasis's basin is a mirror; the garden and the waterfall draw the same blits | scene/water (all) | — | ✔ |`
