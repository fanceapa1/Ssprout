# ADR 0120 — A creature is announced when it is first in view

- Status: accepted; amended by ADR 0240 (`faunaSeen` per garden: `<scenery>:<id>` outside the Japanese garden) and ADR 0248 (`fauna:arrived { id, sceneryId }`, rows matched by kind and variant)
- Date: 2026-10-22

## Context
SPEC §4: "When a new creature first appears, a single quiet line may appear". The UI watched the
garden for newly *unlocked* creatures (core `newlyArrived`) and said "A koi has found your pond."
the moment the third plant bloomed — often before any koi had been spawned, and for visitors
(dragonfly, heron) long before one came by.

## Decision
- The fauna system owns the moment: every 0.5 s it maps the creatures in `viewport.visible`
  (`sightedFauna`: kind → unlock id, koi counted so the second koi is `koi-2`; hand-spawned
  dev/studio creatures ignored) and emits `fauna:arrived { id }` once per run for each unlocked,
  announceable, not-yet-seen id.
- The quiet line only queues and shows it; when shown it records it with
  `controller.announceFauna(id)` (`state.faunaSeen`), which re-emits the event (the line ignores
  its own echo; audio just adds the creature again).
- `QuietLine.check()` no longer looks at unlocks; it only flushes the queue when the garden is calm.

## Consequences
- A line can arrive minutes after an unlock (a visiting heron), which is the point.
- If the page closes before the line is shown, the creature is announced on its next sighting.
- `newlyArrived` stays in core (tested) but the UI no longer uses it.
