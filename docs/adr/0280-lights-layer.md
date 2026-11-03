# ADR 0280: Living lights draw after the light plate

- Status: accepted
- Date: 2026-11-03
- Builds on: ADRs 0021 (paper multiplied last), 0147 (light plates), 0206 (night backing), 0248 (creature contract)

## Context
The Genji firefly is the waterfall's night signature: its light must read as paper left in a night
wash with a warm yellow-green bloom (ART_DIRECTION, research brief §3.7). Creatures draw on
`underwater`, `waterSurface`, `entities` and `air`, all under `lighting`, which desaturates the frame
and multiplies it by the night plate (indigo, about 0.6 / 0.65 / 0.83 per channel). A multiply can
only darken, so the brightest a creature can be at night is the plate itself: a white dab comes out
pale blue-grey, a yellow-green one a dull olive, and over the near meadow (thin paint, almost bare
paper) it does not show at all. Devlog 91 round 1 measured exactly that: khaki blots on the pool
that read as floating leaves, not lights. The scene's own lights (lantern, moon, stars, the falls at
night) are reserved in the light plate, but they are fixed or computed by the ambience; nothing lets
a moving creature keep its light out of the glaze.

## Decision
- A new frame layer **`lights`** between `lighting` and `paper` (`render/types.ts › LAYERS`). What is
  drawn there is not glazed by the daylight, and the paper still multiplies it last, so a pale dab
  there ends as warm washi: reserved paper, as the brief asks. It is meant for small living lights,
  not for brightening things (no glow fills, nothing large).
- Creatures opt in with an optional **`Creature.drawLights?(ctx, w)`**. `FaunaSim.draw('lights')`
  calls only that; no existing creature sees the new layer. `FaunaSystem` draws it.
- Studio stages: `Stage.render(canvas, t, dt, light?)` takes an optional stand-in for the light plate,
  drawn after `air` and before `lights`, so a night stage composes in the game's order.
- Other systems ignore the layer (each draws only the layers it names).

## Consequences
- One more pass over the systems per frame; only the fauna draws in it (two `drawImage` per lit
  firefly).
- `src/render` is a paint root, so the paint version changes once (cached landscapes repaint once).
- The renderer's layer-order test lists `lights`.
- If this is dropped, `firefly.ts` has to draw its light on `air` again (its `drawLights` body moved
  into `draw('air')`), and it reads only as a pale fleck over the water at night.
