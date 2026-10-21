# ADR 0003 — The plant is chosen at session start; study plans with watering breaks

- Status: accepted (supersedes ADR 0002 and the end-of-session reward picker in ADR 0001 §2)
- Date: 2026-10-21
- Decided by: project owner; details recorded by the orchestrator

## Context
The owner wants the plant to *be* the task: you see it grow while you study, not receive it
afterwards. Breaks should feel like caring for it.

## Decisions (owner)
1. Each session = one plant. At start the user names the task, picks the total time, picks a
   recommended study plan, picks the species and picks its spot.
2. The spot is chosen at start; a seedling grows **live in place** in the garden (and in the
   floating widget). Cancel → it withers away; a displaced plant returns.
3. Selectable species: every species with tier ≤ the tier earned by the total time.
4. Time = total session length; breaks are inside it. Plans are recommended per total;
   "Unbroken" always offered.
5. Breaks start automatically with a notification; the user **taps to water** (watering
   animation, plant perks up); the next focus block starts automatically; "skip break" exists.

## Orchestrator details
- Growth = focused ms ÷ total focus ms; breaks don't grow.
- Skipping a break removes its remainder; the session ends sooner; tier stays.
- Not watering has no penalty (calm product, no guilt).
- `pendingReward` and the end picker are removed; completion directly finalises the plant.
- Schema stays `version: 1` with the new shape because no public build has stored state yet
  (Pages only served placeholders). Any later shape change needs a migration.
- The floating widget's focus is the plant: species artwork at the live growth value, timer,
  progress line, plan segments, water button in breaks.

## Consequences
- Core state/actions change (`ActiveSession` gains task, plan, species, slot, seed, waterings).
- A shared `PlantView` renderer (species at arbitrary growth + watering animation) is used by
  the garden, the start sheet previews and the widget.
