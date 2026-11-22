# ADR 0381: Ground creatures keep off each other through one shared helper

- Status: accepted
- Date: 2026-11-22
- Builds on: ADRs 0346 (creatures per garden), 0373 (the coast's wildlife places)

## Context
The coast has several creatures on the ground at once: the cat, a tortoise or two, the green lizard
on the wall tops, the rock crab, the goats. Each read the others only to take fright (the tortoise
tucks in from a moving cat; the lizard, the crab and the owl react to the cat), and birds kept off
each other's `spot()` through `heldSpots`. Nothing kept two walkers apart: the cat strolled
straight through a dozing tortoise, and in a close view the two were drawn on top of each other.
A special case in each pair of creatures would grow with every new walker.

## Decision
- **One helper, `src/fauna/creatures/lib/ground.ts`**, read from `FaunaWorld.creatures` and
  `perspective` only (no contract change):
  - `GROUND_ROOM`: the ground creatures by kind and the room each keeps (world units at
    perspective 1): cat 14, tortoise 13, goat 16, green lizard 8, rock crab 6.
  - `groundBodies(w, self)`: the others in sight (not `done`, `alpha` ≥ 0.05, so a lizard in its
    gap or a tortoise in its scrub does not count), where each is, where it rests or is going (its
    `spot()`), and its room at its depth.
  - `groundFree(q, r, bodies)`: a place is free when it is clear of where each body is and where
    it rests.
  - `blockerOn(a, b, r, bodies)`: the nearest body in the way from `a` to `b`.
  - `stepsRound(a, b, body, long, wide, side)`: two points beside a body to step round it, toward
    the viewer or away.
- **The rule for a creature that walks from place to place on the ground:** it never settles where
  `groundFree` says no; it does not set off on a way `blockerOn` finds blocked; walking, it reacts
  to a body close ahead (stops, goes round, or gives the way up). Creatures that keep to one spot
  and flee (the lizard, the crab) are listed with their room so the walkers keep off them, and
  need not call the helper themselves.
- A new ground creature adds its kind and room to `GROUND_ROOM` and, if it walks between places,
  follows the rule.

## Consequences
- The cat follows the whole rule (devlog 212): it chooses a resting place off every ground body,
  refuses a stroll through one, and when one is close ahead it stops to look (`wait`), then steps
  round it on its walk's ground or gives the stroll up and sits.
- The tortoise keeps off where ground creatures stand as well as their spots, and stays put rather
  than plod through one (`nextPlod`).
- The goats live on the cliff ledges and never meet the terrace walkers; they are listed so a
  future walker there keeps off them. The scops owl and the birds keep using `heldSpots`.
- No contract change: `FaunaWorld` and the scenery places are untouched.
