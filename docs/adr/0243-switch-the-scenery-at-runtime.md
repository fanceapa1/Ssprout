# ADR 0243: Switch the scenery at runtime

- Status: accepted; amended by ADR 0248 (every garden has wildlife: fauna re-inits with the scenery's `fauna`)
- Date: 2026-10-28
- Builds on: ADR 0240 (a garden per scenery), ADR 0241 (the scenery contract), ADR 0242 (cache keys carry the scenery)

## Context
`state.scenery` names the garden on view (ADR 0240) and every consumer already reads a scenery
(ADR 0241), but the systems were built once for the Japanese garden. Showing another garden has
to happen without a reload: a reload blanks the page, resets the dev clock and breaks e2e, and
recreating the systems would leave the UI and the dev hooks holding stale references and throw
away the plant sprite workers.

## Decision
- `SystemContext.scenery?: Scenery` (with `scene` = its geometry). `renderer.setScenery(s)`
  re-inits every system through the resize path: a new viewport with `s.view.focus`,
  `camera.setBase`, a new generation; then the camera cuts to the overview. Each system compares
  `ctx.scenery.id` with what it was built for and rebuilds only what belongs to the garden:
  - scene: drops paintings, jobs, sky and water, paints `art` with `sky` (the paint cache answers
    the second time, ADR 0242); its first painting shows without the paper fade-in;
  - ambience: a new engine with the scenery's `light` and `ambience`; weather stays global;
  - plants: `gardenOnView(state, id)`, the finished plants and seedlings of that garden only;
  - fauna: the new scene, `resetResidents()`, unlocks from that garden; no creatures outside the
    Japanese garden until per-scenery rosters (S11), so the koi never swim outside water.
- The renderer copies the canvas before the switch and draws it over every layer until the new
  generation is ready, then fades it out over 0.9 s (`SCENERY_FADE_S`). Reduced motion, a frozen,
  stopped or hidden renderer cut; `freeze()` ends a fade under way.
- `src/scenery/host.ts` follows `state.scenery` (only sceneries the URL flags offer) and calls
  `setScenery`. A session from another garden that becomes active dispatches `scenery/view` to
  its garden in the same store dispatch, before the controller emits `session:switch`/`start`,
  so the glide to its seedling (ADR 0168) runs after the cut.
- Dev API: `sprout.scenery()`, `sprout.showScenery(id)`.

## Consequences
- A first switch to the waterfall paints it (about 1.5 s at 1440×900 under the cover); a second
  one takes it from the paint cache.
- Systems that keep per-garden state must handle a re-init with a new scenery; a new system reads
  `ctx.scenery` in `init`, never a module constant.
- The UI still uses the Japanese garden's slots for placement, the camera's seedling framing and
  the dev `slots()` hook; S5 passes the viewed scenery's slots to it.
- Audio keeps the pond bed in every garden until the waterfall's sound (S15).
