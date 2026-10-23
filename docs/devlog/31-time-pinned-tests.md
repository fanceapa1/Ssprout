# 31 — Tests that fail at some hours (Q9a)

## What
Two e2e tests failed when run at about 17:00 and passed at other hours: `marks › the sprout marks
what begins a planting…` and `calendar · a planned slip on a phone’s garden › …never overlap,
zoomed in`. Both build `sprout.schedule.demo()` and expect a planned session *due*.

**Root cause.** The dev clock starts at the real time. `demo()` moved it to 16:10 only when that
was still ahead; otherwise it stayed where it was. Its only session due at 16:10 is the 15:40
daily (open length), whose grace window ends at 16:40 (ADR 0172). After 16:40 nothing was due:
on weekdays until the 17:30 "Essay draft", at weekends and after 18:50 not at all. So both tests
failed after 16:40 and passed in the morning. Reproduced with the clock pinned (below) at 17:00
and 23:50; passed at 09:00.

## Changes
- **`sprout.advanceTo('HH:MM')`** (`src/dev/ui-debug.ts`, maths in `src/dev/local-time.ts` with
  unit tests): jumps the forward-only dev clock to the next local `HH:MM`, today or tomorrow. It
  steps calendar days, so a daylight-saving day still lands on the same wall time.
- **`E2E_CLOCK=HH:MM`** (`tests/e2e/fixtures.ts`): `openDev` jumps the clock there once the page
  is ready, so any spec can be run "at" an hour. A reload starts at real time again.
- **`schedule.demo()` always opens at the next 16:10** (today or tomorrow), so the 15:40 daily is
  due whenever it runs. The fix is in the demo, not in each test, because every demo caller
  expects the same afternoon.
- **Other specs with the same pattern:**
  - `v2-acceptance › bigger, higher-contrast type…` started two sessions *before* the demo. The
    demo's jump (up to a day) ended them. It now starts them after the demo.
  - `calendar.spec.ts`: `dayKeyIn` stepped 24 h per day, which is wrong across a daylight-saving
    change. It now steps calendar days. The `jumpTo` helper (also `+ 86_400_000`) now uses
    `advanceTo`. `openAt` waits for the hours to come to rest after the jump (`hoursAtRest`, also
    used by the scroll test) before redrawing the view (bug 2 below).
  - `plant-card-phone`: read `Date.now()` in the page. It now uses `sprout.now()`.

## Proof
The clock-sensitive specs (calendar, marks, wayfinding, tips-scroll, v2-acceptance,
plant-card-phone: 58 tests) were run with `E2E_CLOCK` = 00:30, 09:00, 17:00 and 23:50. The two
target tests pass at all four hours. Before the fix they failed at 17:00 and 23:50. Everything
else passes, except as noted under bug 1, and apart from the two `test.fail()` gaps known then (fixed on main since).

## Bugs found (UI, not fixed: outside this task's paths)
1. **Daylight saving: the day window opens an hour off.** `openingMinute` (and block positions)
   in `ui/calendar-model.ts` count ms since midnight, while following counts wall minutes. On
   Sunday 25 Oct 2026 (Europe falls back) `calendar · the day follows now › while the tab stays
   open…` fails. It is reached by `E2E_CLOCK=09:00` or `17:00` today, and by any run on that
   day. The test is right and is left unchanged. TESTING.md open gap 7.
2. **Following stops when the hours are redrawn mid-glide.** A scroll event from the replaced
   timeline arrives after the new one has set `lastSet`, and `follow` turns false. A run started
   just after midnight hit it in `openAt`. TESTING.md open gap 8.

## Docs
TESTING.md: a convention ("Never depend on the hour the suite runs at"), `E2E_CLOCK` under
Running, matrix row 11.3, open gaps 7–8. AGENTS.md: a known pitfall. ARCHITECTURE.md and
`docs/systems/calendar.md`: `advanceTo` and the new `demo()` behaviour.

## Left / for others
- The UI owner: the two bugs above.
- An hour-proof CI job (the suite under `E2E_CLOCK` = 00:30 and 17:00) would catch this class of
  failure. It is not added here: it doubles e2e time.
