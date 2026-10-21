# ADR 0055 — Dev fixture species for UI tests (`?dev&fixtures`)

- Status: accepted
- Date: 2026-10-21

## Context
The registry holds one placeholder species until the plants tasks land, but the UI must be tested
with locked tiers, several plans, water/shore/back habitats and swaps.

## Decision
`src/dev/fixture-species.ts` defines twelve simple, softly painted `fx-*` species across all tiers
and habitats. With `?dev&fixtures`, `main.ts` appends them to the species list used for the
reducer world, the controller and the UI. They are never used outside `?dev`. E2E specs use them
so tests do not depend on how many real species exist; the studio's UI section uses them as a
fallback.
