# ADR 0350: The night edge is freed by day and built again on idle before the evening

- Status: accepted
- Date: 2026-11-12
- Amends: ADR 0184 (the night edge), ADR 0337 (one edge per seed for the page)

## Context
The night edge (ADR 0184) keeps two field-sized canvases: the lift and the pooled rim. They are
about 9.6 MB at a 1412×846 stage (1440×900 window), at any DPR, since the field is one CSS px per
pixel. Once built, at the first dark frame, they stayed for the life of the page, although only
the sunset, the night and the sunrise draw them (`edgeStrength` is 0 at midday). Building them is
one 40–60 ms task on a quiet machine (100–150 ms under load).

## Decision
- **Wanted or not, each frame.** The engine asks `edgeWanted(light, at)`. The edge is wanted
  while the light has any sunset, sunrise or night weight. It is also wanted when the evening's blend out of
  midday begins within `EDGE_LEAD_MS` (30 min) of `at`, the light's clock time. `at` is the frame's
  time, an hour override's time of today, or null for a pinned light, which has no evening coming.
  The engine passes the answer to the shared edge with `keep(wanted, canvas)`. It does this at the top of
  `drawLighting`, before the reveal's alpha check, so a load at night starts the build while the
  light is still hidden.
- **Not wanted: freed.** Every built size is dropped, and each canvas's backing is set to 0×0 so
  the memory goes at once, not at the next GC.
- **Wanted and missing: built on idle, in parts.** The field build runs a band of rows per idle
  callback (`EDGE_PART_PX`, 120,000 field pixels per part). Each band is written straight into
  the image bytes. The last part puts both images. A part that runs after a free does nothing.
- **A frame never waits and never lacks the edge.** A draw at a dark strength that finds no
  canvases finishes the build at once, in that frame: the rest of a build under way, or a whole
  one. This covers a jump of the clock into the dark (`setTime`, a wake from sleep), a resize and
  the studio. The pixels are the same either way: the parts run the same arithmetic in the same
  order.

## Consequences
- By day the page holds no night-edge memory: −9.56 MB at 1440×900 (DPR 1 and 2). A load at
  noon never builds it.
- On a live clock the evening's edge is ready 30 minutes before its blend begins. It takes ~10 idle parts of 5–25 ms
  (longest 19–29 ms under load, total ~105 ms). The evening's first dark frame builds nothing.
- A jump straight into the dark still costs the one build in a frame, as before this ADR. A load
  at night usually does too: the reveal starts before the idle parts have run.
- `sprout.ambience().nightEdge` reports the bytes held, the sizes, a build under way, the last
  build's parts and timings, and how often the edge was freed.
