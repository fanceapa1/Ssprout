# ADR 0180 — The tools on the painting stay visible while they rest

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0135 (tools twice), devlog 16 (resting at 0.32)

## Context
While a session runs, the controls on the painting rest after a few idle seconds. Devlog 16 left
the corner tools at 0.32 opacity and the pill at 0.42 ("faint by design"). The owner's v2 request
(ADR 0005, item 6) says the opposite: the icons were "not at all intuitive or easily visible".
Measured from real pixels, the resting chips read at 1.7–2.3 : 1 in every daylight phase. The new
zoom chips (ADR 0164) had copied the same rule.

## Decision
- Resting is a small step back, not a fade-out. Tools (`.menu`, `.zoom-controls`) rest at
  `--rest-tools: 0.88`, the pill at `--rest-pill: 0.72`. The chips' own torn paper keeps the ink
  apart from the painting, so the icons stay calm without vanishing. The muted speaker's ink is
  0.9 (it was 0.8).
- The bar is WCAG 1.4.11 for graphical objects: each resting chip's ink is at least 3 : 1 against
  its own paper. It is measured from a screenshot in sunrise, midday, sunset and night
  (`tests/e2e/tools-visibility.spec.ts`). The old values fail it in every phase.

## Rejected
- Brighter chips with a dark halo or a drop shadow: generic UI, against ART_DIRECTION.
- No resting at all: the owner still wants a calm garden while focusing. A small step back for
  the pill and the tools is that calm.
