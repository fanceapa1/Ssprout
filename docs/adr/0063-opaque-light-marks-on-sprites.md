# ADR 0063 — Light marks on plant sprites are painted source-over; overlaps that would knot merge

- Status: accepted
- Date: 2026-10-22

## Context
The engine composites by multiply (ADR 0021): perfect for glazing greens over greens, but a
white anemone or a cream clover floret multiplied over a stem, a leaf or the grass behind the
sprite simply disappears, and a red berry over a leaf turns brown. Conversely, many small
overlapping multiplied marks (five tiny forget-me-not petals, three sepals, a dozen florets)
darken where they overlap until they read as dark knots or "x-ray" seams.

## Decision
- Petals of light colour (`white: true`, used when a colourway's lightness > 0.8), the
  strawberry berry, flower eyes and stamen dots that sit on petals are dried with
  `blend: 'source-over'`: they are opaque paint over what is behind, like reserved paper with a
  light wash, and still receive the paper texture multiplied over the whole frame.
- Marks too small to read as separate overlaps are merged into one wet layer (`smallBlossom`,
  merged sepals in `paintBud`, fern leaflet rows, susuki hairs, toothed leaves with their
  teeth); petals of normal-size flowers stay separate layers so their overlaps glaze.
- No `lift` on sprites (it paints paper colour); pale midribs are bled in wet-in-wet inside the
  same layer, or a thin source-over stroke (susuki).

## Consequences
White and pale flowers stay luminous over any ground — garden, water, reward card — without
outlines; colour flowers keep their transparent watercolour overlaps. Source-over marks hide
what is behind them, so they are kept to flower parts drawn last.
