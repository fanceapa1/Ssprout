# 30 — v2 acceptance coverage (Q8)

## What
Checked every owner request and decision in ADR 0005 and the later owner requests (marks not
dots, the lazy studio, dock wayfinding, the lotus dead end) against the code and the tests. The
result is the **v2 acceptance** table in `docs/TESTING.md`: 41 rows, **36 ✔, 3 ◐, 2 ✘**, plus a
list of what needs a human. Real gaps got tests. Two bugs are recorded as `test.fail()` tests,
and the UI code is unchanged.

## New tests
`tests/e2e/v2-acceptance.spec.ts` (12 tests). Each one drives the `?dev` API or the real UI and
waits on `ready` / `plantsReady` / `plants.settle` / `camera.settle` / `freeze` / `expect.poll`,
never on time:
- **Cancelling one session leaves the others untouched.** Three in progress, the active one ended
  through the dock, then a waiting one by id. The others keep their elapsed time, spot, growth and
  seedling, and nothing resumes on its own.
- **The `switch` tip.** No tip with one session. With a second one waiting, one note shows by
  Switch. Switching retires it, and it is listed as learned under Hints.
- **A planned session due during a long pause.** `data-primary` goes to the due card's Start
  (passes). A second test asserts one vermilion seal in Study and is a known gap
  (`test.fail()`).
- **Double tap.** Two synthetic touch taps in one task zoom 2× about the point. Two taps far
  apart do not, and the browser's follow-up `dblclick` adds nothing.
- **The replaced-plant line** on a growing seedling's card ("steps aside… comes back") and on a
  finished plant's card ("took the place of… pressed in your herbarium"). There is also
  `src/ui/plant-card.test.ts` for `plantStory` / `storyLines` (4 tests).
- **Hover families** beyond Pause and End. Covered: the seal (lift, deeper vermilion), sprout
  leaves, dock tools, a calendar view word, a corner chip, a zoom chip, the idle pill, and the
  sheet's plan cards, quick picks and plant cards. Keyboard focus is checked on a seal, a
  calendar word, a corner chip and a quick pick. Tools and sheet cards on focus are a known gap
  (`test.fail()`).
- **Type.** Base 21 px ≥ 20 at weight 500, headings ≥ 24 px. Every visible dock text node (with
  two sessions and the demo calendar) is ≥ 4.5 : 1 against the paper; seal labels are
  measured against the vermilion.
- **1.25× plants.** `boundsFor` / (species size × slot scale) = 1.25 for three fixture species
  in every slot they fit. In a seeded garden of 20 real plants, painted pixels (found by the
  hit-test) fall outside the box the same plant had at 1×.
- **Chroma.** The midday garden below the sky has mean OKLab chroma > 0.04 (measured 0.047) and
  p90 > 0.055 (0.063), stays < 0.12 (not neon), and night is < 0.7 × midday.

## Bugs found (recorded, not fixed)
1. **Two seals during a long pause** (ADR 0201, open since devlog 25). The long pause's Resume
   (`timer-panel.ts`, `button.seal.long-resume`) keeps its seal class when a due card's Start takes
   the lead. `data-primary` is right, but Study shows two vermilion seals.
2. **Keyboard focus without the lift** (ADR 0204). `hover.css` has `:focus-visible` rules for
   seals, calm slips, quick picks, chips and corner chips, but none for `.tool::before`,
   `.plan-card` or `.plant-card::before`. These show only the focus ring.

## Left for a human
Real touch (pinch, native scroll momentum, a real double tap), listening to the audio, real
devices and browsers, real OS notifications with the tab closed, and a real PiP window.

## Suites
`npm run typecheck` passes. `npm test`: 107 files, 1309 tests pass. `nice -n 10 env E2E_PORT=4198
npm run e2e` (2 workers): 192 passed in 11.2 min, the two known gaps among them as expected failures.
