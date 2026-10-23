# 41 — Q10: the full e2e suite green three times in a row

## What
The full e2e suite (`nice -n 15 env E2E_PORT=4213 npm run e2e`, 2 workers) passed three runs in a
row on main 0ea6657 (PR #1 included), rebased, and also passed once each with `E2E_CLOCK=17:00` and
`E2E_CLOCK=00:30`. Six root causes were fixed: five in tests and one real UI race. Devlog 40 is
the sound mixer's.

## Failures → causes → fixes
1. **`backdrops › every text on the sheets reads at ≥ 4.5 : 1 · …`, "2.21 “Start”"**: failed
   locally, passed in CI. **A test issue.** `busy()` started three sessions *before*
   `schedule.demo()`. The demo moves the dev clock to the next 16:10, which is up to a day ahead.
   Unless the run began between 15:20 and 16:10, that jump carried the sessions to their end. The
   active one bloomed on a later tick, in the middle of the measurement, and the waiting card
   re-rendered from "See them" to its seal "Start". `textContrast` paired lines across its two
   passes by text-node index, so one text's ink colour was measured on the vermilion under another.
   The seal's real cream on vermilion reads about 4.8 : 1, so no colour changed.
   - The demo now runs first.
   - Lines are paired by element identity, and both passes must agree. Otherwise the test fails
     with "the dock changed while it was measured". The guard fired when the old order was put back.
   - The desktop checks assert the limit card. The phone checks start two sessions and measure the
     seal "Start" (row 12.34).
2. **Reload specs under `E2E_CLOCK=17:00`**: `core-loop › … persisted across reloads`,
   `parallel-sessions › a reload continues every session…` and `session-rules › a session that ended
   while the app was closed…` failed. **The fixture was the cause.** `E2E_CLOCK` was a dev-clock jump
   made after the page was ready, so a reload or a second page booted at the real hour again. Now an
   init script (`fixtures.ts › shiftDate`) shifts `Date` in every page of the context. It uses one
   offset, computed in the page's time zone and kept in the origin's storage. Without `E2E_CLOCK`
   nothing changes.
3. **`polish › keyboard: focus lands on Pause after Begin…`**: focus fell to `<body>` once, under
   load. **A real UI race and the only app change** (`src/ui/index.ts`). Choosing a spot glides the
   page up to the garden. The `pill-aside` IntersectionObserver hears about that only frames later.
   A Begin in between found the pill still aside (inert and hidden), so `pause.focus()` did
   nothing. Begin now settles the aside state for the scroll target (`settleAside`) before it
   focuses Pause. The new test `polish › keyboard: a Begin that comes before the glide…` clicks the
   spot and Begin in one task. It fails without the fix.
4. **`wayfinding · motion › a gentle draw-in…`**: failed once under load average 33. **A test
   issue.** The draw-in state and `getAnimations()` were read in two round trips, and the 3.8 s
   draw-in ended between them. Both are now read in one `page.evaluate`.
5. **`calendar › not started within its window…`** (in a run that began at 23:11) and **`calendar ›
   past sessions show in the calendar…`** (in one that began at 23:30). **Test issues:** the hour was
   not pinned. Late in the evening the plan's hour-long window, or the 31 minutes of sessions, ended
   the next day, and `calendar.go(now)` showed a day without the block. Both now pin 10:00 first.
   After that, full sweeps at `E2E_CLOCK` 23:30 and 23:50 passed 230 of 230.

TESTING › Flakiness › Q10 has one row per cause: symptom → root cause → fix. No sleeps were added
and no timeouts were raised.

## Runs (`nice -n 15`, 2 workers, port 4213)
| Run | Code | Clock (start) | Result | Playwright | Wall (incl. build) |
|---|---|---|---|---|---|
| baseline | a97d6f1 | real (21:08) | 213 / 218, 5 failed (cause 1) | 11.2 m | 671 s |
| — | + cause 1 | real ×3 (21:28–21:51) | 218 / 218 each | 11.1–11.2 m | 665–676 s |
| — | + cause 1 | 17:00 | 215 / 218 (cause 2) | 10.3 m | 617 s |
| — | + cause 2 | 17:00 | 218 / 218 | 10.1 m | 608 s |
| — | + cause 2 | 00:30 | 217 / 218 (cause 3) | 11.2 m | 671 s |
| — | + cause 3 | real (22:44) | 217 / 218 (cause 4) | 14.3 m | 860 s |
| — | rebased on 0ea6657 | real (23:11), (23:30) | 229 / 230 each (cause 5) | 11.4 m | 682–684 s |
| sweep | + cause 5 | 23:30, 23:50 | 230 / 230 each | 11.5 m, 11.4 m | 688 s, 686 s |
| **1** | final | real (00:05) | **230 / 230** | 11.3 m | 680 s |
| **2** | final | real (00:16) | **230 / 230** | 11.3 m | 681 s |
| **3** | final | real (00:28) | **230 / 230** | 11.2 m | 672 s |
| **17:00** | final | 17:00 | **230 / 230** | 10.2 m | 616 s |
| **00:30** | final | 00:30 | **230 / 230** | 11.0 m | 663 s |

Typecheck and unit tests pass (1390).

## Left open
- `E2E_CLOCK` shifts `Date` in pages, not in workers. No worker reads the time today: the ticker
  only ticks, and the sprites only paint.
- Hour-proofing is still a manual run, not a CI job (row 11.3). The two calendar tests above show
  that a run started after 23:00 still finds tests that forgot to pin the hour.
