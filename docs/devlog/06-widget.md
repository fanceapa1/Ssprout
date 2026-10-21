# 06 — Widget, tab surfaces & notifications

## What
- `src/widget/`: everything that keeps a session visible outside the garden canvas, installed with
  one call, `createTimerSurfaces({ controller, store, bus, clock })`.
  - **Worker ticker** on the controller (inline Blob worker, `setInterval` fallback) so breaks,
    focus and completion are on time in background tabs.
  - **Tab title** (`24:13 · Study Sprout`, `Break 4:12 · …`, `Paused · …`, `Bloomed · …` after an
    unseen completion) and a **painted favicon**: a brush ring that fills with session progress
    (olive / celadon in breaks / stone when paused) and gets a vermilion dot when the plant bloomed.
  - **Notifications** for break / back to focus / bloom: permission asked at the first start (in the
    Begin gesture), stored in settings, no notification while the page is visible and focused, one
    renotifying tag, delivered through a notifications-only service worker (`public/sw.js`).
  - **Floating card** in a Document Picture-in-Picture window: washi paper, the session's plant at
    the live growth (via the new shared `src/plants/view.ts` `renderPlantView`), task, block time,
    a brush progress line with plan segments (breaks as water drops), state line, Pause/Resume,
    **Water** + Skip break during breaks (with a watering animation), **Open garden** after the
    bloom. Reopen-safe; grows the plant in from seed when opened.
- `window.sprout.widget` (?dev) with an iframe harness rendering the card through the PiP path.
- Studio section **Widget**: the card at growth 0 / 0.3 / 0.7, break, watering, paused, bloom,
  idle, unknown-species fallback, favicons, and a 12 s whole-session loop.
- Tests: 90+ unit tests (ticker, title, favicon, tab, notification policy + permission flow, view,
  card DOM, PiP, integration, plant view), 11 Playwright specs in `tests/e2e/widget.spec.ts`.

## Why (non-obvious)
ADRs 0090 (worker ticker), 0091 (permission & notify policy), 0092 (notifications-only SW),
0093 (DOM text over a painted canvas, mountable in any window), 0094 (plant view seam).
Mid-task the product changed to plant-at-start sessions with plans and watering breaks (ADR 0003):
the widget was rebuilt around the session's plant and coded against a structural
`WidgetController` while core was reworked; a type test now checks the real controller fits.

## Art review
Several screenshot rounds (`npm run shots -- --studio widget`, plus the real DOM card through the
harness): a hard cog-edged backdrop blob → soft radial glazes and broken dry-brush ground; old-style
Cormorant figures jumping on the baseline → Shippori Mincho lining numerals; a dark sepal bar under
the bloom → lighter sepals; a uniform frame-like deckle → irregular, fainter edge; completion text
overlapping the progress line → moved up.

## Status
Done in `src/widget`, `src/plants/view.ts`, `public/sw.js`. **Not wired yet**: `main.ts` is the
orchestrator's/UI's — add the snippet from `docs/systems/widget.md › Wiring`; the UI's floating-timer
button uses `surfaces.widget`. The e2e specs skip themselves until `window.sprout.widget` exists and
were verified passing (11/11, full suite 22/22) with that wiring applied locally.

## Left for others
- Wire `createTimerSurfaces` + `installWidgetDebug` in `main.ts` (snippet in the system doc).
- Plants task: replace `renderPlantView` internals (growth-stage sprites, painted watering can);
  the card picks it up automatically.
- Optional: a web app manifest would enable notifications for installed iOS web apps.
