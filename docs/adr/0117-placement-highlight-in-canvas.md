# ADR 0117 — Placement highlight painted in the canvas

- Status: accepted
- Date: 2026-10-22

## Decision
The UI publishes `ui.placement` (slots, focused, selected, species). The plant system paints
breathing wash dabs under compatible slots and a 34 % ghost of the species at the focused (else
selected) slot. Input stays on the DOM markers (accessible, testable); the canvas only echoes
them, so a missing or late canvas never breaks placement.
