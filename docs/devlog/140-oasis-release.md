# 140: The oasis is released (O8)

Lines for the orchestrator to place:

- Devlog index: `| 140 | [O8: The oasis is released](140-oasis-release.md) | The Ksar oasis leaves ?dev&scenery=oasis: every visitor's Gardens section offers it as the third garden; the flora invariants for released sceneries now cover it | Done |`
- TESTING, §1a, after O14.2:
  - `| O8.1 | The oasis is offered to everyone: the registry lists the Japanese garden, the waterfall and the oasis under any flags, and the released-scenery flora invariants (10–30 species, two per tier, two per habitat) hold for it | scenery/registry › holds the oasis, offered to everyone…; scenery/flora › released: oasis (all); scenery/oasis › is offered to everyone (released, O8) | gardens › released: without ?dev the Gardens section offers all three…; › lists the three gardens…; › phone width: the cards stack…; sceneries › the three gardens are offered without a flag… | ✔ |`

## What
The owner looked at the finished oasis (ksar, bluff, falls, the beds behind the basin and 17
plants) and asked for it on the site.
- `src/scenery/oasis/index.ts`: `available` is `() => true`, like the waterfall's;
  `oasisAvailable` is gone.
- Tests: the registry, flora and oasis unit tests now expect the oasis without a flag; the
  released-scenery invariants in `src/scenery/flora.test.ts` run for it and hold (17 species,
  every tier and habitat covered twice). The gardens and sceneries e2e specs expect three cards;
  an oasis not yet visited shows its painted thumbnail (`source: 'painted'`).
- Docs: ARCHITECTURE, scenery and fauna system docs no longer say it hides behind the flag.

## Left open
- The wildlife queue is not finished: only the house bunting (OK1) and the creatures shared
  with the other gardens visit. The laughing dove (OK2) is paused mid-task in its worktree, and
  OK3–OK8 are queued. Their unlock rows skip until a module exists (devlog 127), so the oasis
  works without them.
- The Darija names of the oasis plants still need checking with a speaker.
