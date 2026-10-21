# ADR 0042 — All boulders and foreground tufts are depth-sorted entity sprites

- Status: accepted
- Date: 2026-10-22

## Context
Plants grow in `shore` and `rock` slots right next to boulders, and in meadows near foreground
tufts. Baked into the background, a boulder could never be in front of a plant standing behind
it.

## Decision
- Every boulder (`scene.rocks`, 11) and the foreground tufts (`FOREGROUND_TUFTS`, 6) are painted
  once per paint view into their own transparent canvases (`sprites.ts`) and contributed via
  `entities()` with **depth = base y** — the same rule plants and ground fauna use. The stone
  recipe's paper reserve makes them opaque, so they genuinely occlude.
- The boulder silhouette is `stoneShape` seeded by `${seed}:${rock.id}` (`rockOutline`), shared by
  the sprite and its static reflection in the background, so they always match.
- Path stepping stones (flat, nothing stands behind them) and background tufts stay baked.

## Consequences
~17 extra `drawImage` calls per frame (cheap). Sprites are a third of the paint time; draft
quality was tried for them and rejected (granulation and rims wash out). Birds perching on rocks
should draw at `depth = rock.y + 0.1` to sit in front of their rock.
