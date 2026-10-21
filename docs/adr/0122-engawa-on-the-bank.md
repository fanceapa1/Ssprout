# ADR 0122 — The engawa stands on the bank; a walked stone path

- Status: accepted
- Date: 2026-10-22

## Context
The pond's lobe ran under the pavilion deck (the engawa looked built over the water), and the
stepping stones were five small ovals on a pale band. The owner's reference has the pond as a
self-contained kidney with the building on the bank, and broad stones leading to the water.

## Decision
- `POND`'s right end turns back in a soft bay at x ≈ 1256, well short of the pavilion (x 1290+).
  The bank between gets the deck's crawl-space shadow, footing stones, a cast shadow and a
  kutsunugi-ishi; the deck no longer reflects. Boulders and slots near the old lobe moved
  (water-6, shore-4/5/6, rock-5, rock-lobe, rock-front-right-small); all scene invariants hold.
- The lantern's light only spills onto water within 70 units of its mirror image, so the
  garden's lantern (over dry bank) has no reflection.
- `PATH` is six broad stones winding gently (rx 92 → 45), bedded in a worn, warm earth path with
  grass-nibbled edges; the near mounds roll down into it. Stones are painted after the paper
  margins (`paintStones` step) so the near ones stay crisp where the grass dissolves.

## Consequences
- `gardenScene` geometry changed (values, not shape): fauna, ambience and plants read it and
  needed no code changes beyond one lighting test.
- docs/systems/scene.md's composition map still describes the lobe — to be refreshed by the docs
  owner.
