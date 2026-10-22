# ADR 0141 — Four daylight phases with 40-minute blends

- Status: accepted (replaces the v1 hour keyframes of ADR 0082)
- Date: 2026-10-23

## Context
ADR 0005: "the garden follows the system clock with 4 phases: sunrise, midday, sunset, night",
blending over ~40 minutes. v1 had seven hour-based keyframes (morning, noon, evening, dusk, …)
that ignored the season and the place.

## Decision
- **Boundaries** (`dayBoundaries`, pure, `src/ambience/daylight.ts`), each the centre of a
  40-minute blend (`BLEND_MS`):

  | Boundary | Change |
  |---|---|
  | civil dawn | night → sunrise |
  | sunrise + 60 min (`GOLDEN_MS`) | sunrise → midday |
  | sunset − 60 min | midday → sunset |
  | civil dusk | sunset → night |

  Sunrise therefore spans the half hour of civil twilight plus the first golden hour; sunset the
  last golden hour plus civil dusk.
- **Odd days**: short winter days keep midday at least ±20 min around solar noon; white nights
  (no civil dusk) blend sunset straight into sunrise at solar midnight; polar day is midday all
  day; a polar night with civil twilight runs night → sunrise → (noon) → sunset → night; a polar
  night without it is night all day.
- **Weights** (`phaseAt`): boundaries of yesterday, today and tomorrow, sorted; within half a
  blend of a boundary the weights smoothstep from `from` to `to`, narrowed to half the gap to a
  neighbour so blends never overlap. Weights always sum to 1.
- **State** (`DaylightState`): weights, dominant phase, the blend in progress, the sun's altitude
  and side (rising/setting), the moon's progress across the night (dusk → dawn) and the lunar
  phase. A pinned phase (`pinnedState`) uses a typical sky (low sun at 3°, the moon high).
- **`setTime`** accepts `'sunrise' | 'midday' | 'sunset' | 'night'`, a blend
  `{ from, to, t }`, an hour of today (run through the real sun times) or null. The v1 names stay
  as aliases: `morning` → sunrise, `noon` → midday, `evening` → sunset, `dusk` → sunset/night
  halfway, `dawn` → night/sunrise halfway.
- **Fauna** follows the phases: diurnal creatures rest while the night weight is ≥ 0.5
  (`FaunaSim.nightSource`); `fauna.setHour(h)` still pins an hour, and `nightHours` remains the
  fallback without a daylight source. Audio keeps its own clock hour (ADR 0102).

## Consequences
- The day's look now changes with the season and the place, and setTime moves every system.
- `TYPICAL_DAY` (`timeofday.ts`) keeps an hour → weights mapping for hour-only callers.
