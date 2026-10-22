# ADR 0115 — Wither and bloom are driven by store actions

- Status: accepted; amended by ADR 0155 (any session in progress can wither or bloom)
- Date: 2026-10-22

## Decision
The plant system subscribes to the store and looks at the action: `session/cancel` captures the
seedling's current (cross-faded) image into its own canvas and withers it for 3 s;
`session/complete` hands the displayed growth to the new finished plant (bloom). Any other way a
session disappears (reset, import) just re-syncs, without animation. Capturing the image means
the wither never depends on cache entries that might be evicted meanwhile.
