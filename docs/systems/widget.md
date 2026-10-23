# Widget, tab surfaces & notifications

`src/widget/` — everything that keeps the session visible outside the garden canvas (SPEC §2, §6):
a Web Worker ticker, the tab-title countdown and painted favicon, notifications for breaks /
focus / bloom, and the Document Picture-in-Picture floating card. `public/sw.js` is the
notifications-only service worker. `src/plants/view.ts` (`renderPlantView`) draws the session's
plant for the card.

| File | What |
|---|---|
| `index.ts` | `createTimerSurfaces(...)`: the one integration call |
| `contract.ts` | `WidgetController` / `WidgetStatus` / `WidgetBus`: the slice of core the widget uses (ADR 0003 API) |
| `ticker.ts` | `createWorkerTicker()`: `Ticker` backed by an inline Blob worker, `setInterval` fallback (ADR 0090) |
| `title.ts` | `titleFor()`: pure title text |
| `favicon.ts` | `faviconModel()` / `faviconKey()` / `drawFavicon()` / `faviconDataUrl()`: quantised brush-ring icon |
| `tab.ts` | `createTabSurfaces()`: applies title + icon, remembers an unseen bloom, restores on dispose |
| `notifications.ts` | policy (`decideNotification`, `reconcileSetting`, `shouldAsk`), `createNotifier`, browser env (ADRs 0091, 0092) |
| `view.ts` | `widgetView(status)`: pure card model (mode, task, times, state line, segments, buttons) |
| `card-art.ts`, `paper.ts`, `sprout.ts`, `brush.ts` | canvas painting: washi paper, backdrop, soil, plant, plan progress line; studio preview |
| `card.ts` | `mountCard(window)`: the card as DOM in any window; font-face copying |
| `pip.ts` | `createFloatingWidget()`: Document PiP plumbing, controller binding; `iframeHostOpener` for tests (ADR 0093) |
| `dev.ts` | `installWidgetDebug()`: `window.sprout.widget` (?dev) |
| `widget.studio.ts` | studio section **Widget** |
| `test-helpers.ts` | test builders: `session`, `timeline`, `status`, `fakeController`, `fakeBus`, `fakeStore`, `recordingContext` (tests only) |

## Wiring (`src/main.ts`, after the controller is created)

```ts
import { createTimerSurfaces } from './widget';
import { installWidgetDebug } from './widget/dev';

const surfaces = createTimerSurfaces({ controller, store, bus, clock });
// installs the worker ticker on the controller, the tab title/favicon, notifications and the widget

// UI: the "floating timer" button
//   button.hidden = !surfaces.widget.supported;
//   button.onclick = () => surfaces.widget.open();       // must run inside the click (user gesture)
//   surfaces.widget.isOpen() / surfaces.widget.onChange(open => …) for the pressed state
// UI (optional): call surfaces.requestPermissionFromGesture() in the Begin click. Not required:
//   the widget already asks synchronously inside `session:start`, which controller.start() emits
//   from within that same click.

if (speedClock) installWidgetDebug({ surfaces, controller, store, bus }); // window.sprout.widget
```
`createTimerSurfaces` also imports the card's web fonts (Cormorant Garamond 500/600/italics,
Shippori Mincho 500 latin). `surfaces.dispose()` restores the interval ticker, title and icon.

**Controller requirements** (`contract.ts`, from ADR 0003): `status()` returning
`{ phase: 'idle'|'focus'|'break'|'paused', timeline, session, sessions? }` (`session`/`phase`/`timeline`
are the **active** session's; `sessions` lists every session in progress as `{ session: { id, taskName },
active, lastLeft? }`, ADR 0150) with
`timeline = { blockIndex, block, blockRemainingMs, totalRemainingMs, growth, progress, watered, complete }`
and `session = { id, taskName, plan: { id, name, blocks }, speciesId, seed }`; `onTick`, `pause`, `resume`,
`water`, `skipBreak`, `switchTo?(id)` (optional: without it the card offers no switch), `setTicker`,
`updateSettings`. Bus events used: `session:start | break | focus | water | complete | cancel |
switch` and `schedule:due` (payloads read defensively; `sessionId` used when present).

**Several sessions** (ADRs 0150, 0157): every surface follows the **active** session — the title and
favicon, the notifications (only the active session has breaks, focus blocks and completions) and
the card. With none active (after a bloom, others waiting) the title and icon rest (or say
`Bloomed` until seen).
If core's `status()` names differ, adapt in `contract.ts` only.

## Surfaces

### Worker ticker
`controller.setTicker(createWorkerTicker())`: one dedicated worker (Blob URL, no build entry)
runs `setInterval` per subscription and posts `{ type: 'tick', id }`. Background tabs throttle
main-thread timers (Chrome: down to once a minute), not dedicated-worker timers, so breaks, focus
and completion fire on time and the notification is not late. Worker creation failure, CSP or an
`error` event moves every subscription to `setInterval`. `mode` is `'worker' | 'interval'`.
`main.ts` also hands this ticker (`surfaces.internals.ticker`) to the scheduler, which subscribes while
any schedule exists, so a background tab notices a scheduled session on time (ADR 0174).

### Tab title & favicon (always on, every browser)
| Phase | Title | Favicon |
|---|---|---|
| focus | `24:13 · Study Sprout` (time left in the block) | ring = session progress, olive |
| break | `Break 4:12 · Study Sprout` | ring, pond celadon |
| paused | `Paused · Study Sprout` | ring, stone grey |
| completed while away | `Bloomed · Study Sprout` until the tab is visible + focused | full ring + vermilion dot |
| idle | original title | original icon |

Updated on each controller tick and store change; written only when the text or the quantised
icon (48 ring steps × tone) changes, icons cached by key — at most once per tick. The favicon is a
32×32 canvas → PNG data URL on the existing `<link rel="icon">` (created if missing); dispose
restores title, href and type.

### Floating card (Document Picture-in-Picture)
`documentPictureInPicture.requestWindow({ width: 260, height: 340 })` — called synchronously in
`open()`, so `open()` must be called from a click. The card:
- top ~60 %: the session's plant at the live `timeline.growth` (`renderPlantView`, cached growth
  steps), on washi paper with a faint wash and soil; the generic seeded sprout is the fallback
  for unknown species;
- task name (italic), time left in the block (Shippori Mincho numerals), a thin brush progress
  line with plan segments (breaks are gaps holding a water drop), one state line
  (`focus 1 of 2 · 52:10 in all`, `growing quietly` for a plan with one focus block,
  `Break — your Japanese Iris is thirsty`, `Watered — your Japanese Iris is resting`, `paused`,
  `Your Japanese Iris has bloomed — return to your garden`, `No session running`);
- buttons: Pause / Resume, and **Switch** when another session is in progress (focus or paused;
  not in breaks, where the row is full): it makes the next session in start order active
  (`controller.switchTo`), cycling through all of them; with none active the idle card says who is
  waiting ("“Essay” is waiting" / "2 sessions are waiting") and offers **Resume** on the one left
  last — it never resumes on its own (ADR 0152), beside **Open garden**; in breaks **Water** (the
  primary, a small tilted vermilion square before the word; `controller.water()` + a 2.5 s
  watering animation, also played on every `session:water` — from the garden, and the automatic
  focus watering every 4–10 focused minutes, ADR 0153 — with nothing to tap), **Skip break**, Pause;
  after completion **Open garden** (focuses the opener — best effort — and closes the widget; on
  the idle card it only focuses the opener).

Updates every tick and on store changes; growth eases toward its target (0.6 s), and a freshly
opened card grows the plant in from seed. Closing the PiP window (`pagehide`) tears down; `open()`
again works. Fonts are copied as `@font-face` rules (URLs made absolute) from the app document.
Reduced motion: no easing, no watering animation.

**Type** (v2 polish, the app's "bigger, darker" rule of ADR 0136 brought to the card): task 17 px
italic, time 38 px Shippori Mincho, state 15 px italic, buttons 15.5 px, all in solid inks from the
app's palette (`CARD_INK`: `#3b352e` / `#5c5449`, `#6b6256` for a paused time; ≥ 4.5 : 1 on the
paper) instead of faded opacities. The footer is 150 px of the 340 px card. The state line keeps the
session total only when it fits (`fitStateLine`), so "Break — your Japanese Iris is thirsty" is never
cut mid-word. The DOM card and the studio preview share `CARD_FONTS`, `CARD_INK` and `LAYOUT`.

### Notifications
| Moment | Title | Body |
|---|---|---|
| break starts | `Time for a break — your <plant> is thirsty.` | `Tap the watering can when you are ready.` |
| next focus | `Back to focus — <task>.` | `Your <plant> is growing again.` |
| complete | `Your session is complete` | `Your <plant> has bloomed — return to your garden.` |
| a scheduled session's time (`schedule:due`, ADR 0174) | `It’s time for “<name>”.` | `Whenever you are ready, a card in your garden will start it.` |

Policy (ADR 0091):
- **Ask** once, at the first `session:start` with `settings.notifications === 'unasked'` and
  browser permission `default`. `controller.start()` emits `session:start` synchronously, so when
  the UI calls `start()` in the Begin click the request runs inside the user gesture (verified in
  unit tests). `requestPermissionFromGesture()` is exported for the UI to call explicitly.
- **Store** the answer with `controller.updateSettings({ notifications })`. Dismissed → stays
  `unasked`, not asked again this page load. A browser-side grant/deny is mirrored passively, but
  an in-app `denied` is never flipped to `granted` without an explicit request.
- **Notify** only when permission is `granted`, the setting is not `denied`, the page is **not
  visible-and-focused** (otherwise the in-page flow — chime, garden, widget — already shows it),
  and that moment (session × kind × block) was not notified before.
- **Deliver** via `ServiceWorkerRegistration.showNotification` (SW at `${BASE_URL}sw.js`, scope
  `BASE_URL`, registered once permission is granted; waits ≤ 4 s for activation), else
  `new Notification`. One tag `study-sprout-session` with `renotify`, so each message replaces
  the previous one. Click → the SW focuses an open app tab (same path preferred) or opens the app.
- Closed tab → nothing (no server); the garden completes the session on return.

## Browser support

| Browser | Floating card | Title / favicon | Notifications | Worker ticker |
|---|---|---|---|---|
| Chrome / Edge 116+ desktop | ✓ Document PiP | ✓ | ✓ via SW | ✓ |
| Chrome Android | — (`supported: false`) | title only | ✓ via SW only | ✓ |
| Firefox | — | ✓ | ✓ (SW) | ✓ |
| Safari 16.4+ macOS | — | ✓ (favicon may not repaint) | ✓ (callback/promise permission) | ✓ |
| Safari iOS | — | — | — (needs an installed web app; no manifest yet) | ✓ |

## Debug API (`?dev`, `window.sprout.widget`)
`supported()`, `isOpen()`, `open()`, `close()`, `tickerMode()`, `title()`, `favicon()`,
`bloomed()`, `lastNotification()` (`{ kind, decision }`), `mountHarness()` (renders the card in
`iframe#sprout-widget-harness`, fixed bottom-right, through the same code path as PiP), `closeHarness()`,
`harnessMode()`, `harnessWatering()`.

## Tests
- Unit (`src/plants/view.test.ts` for the plant view): `ticker.test.ts` (fake worker, fallback,
  errors, the worker script, driving the real controller), `title.test.ts`, `favicon.test.ts`
  (model + drawing), `tab.test.ts`, `notifications.test.ts` (policy, permission flow, per-moment
  notifications), `view.test.ts` (view model), `card-art.test.ts` (card type sizes, line stacking,
  `fitStateLine`), `pip.test.ts` (card DOM via `mountCard`, PiP
  open/close/reopen/actions/bloom), `index.test.ts` (integration install/dispose).
- E2E (`tests/e2e/widget.spec.ts`): worker ticker, title countdown with `?speed=60`, favicon
  changes, pause, `Bloomed` while away, background notification via the SW (stubbed
  `showNotification`), no notification when attended, denied respected, PiP support detection,
  a faked PiP window (open / pause / resume / close), the iframe harness (plant painted, bloom), in
  a break the card waters the plant and skips the break. They run against the wired app (`main.ts`
  installs `window.sprout.widget` under `?dev`). Headless Chromium reports `Notification.permission === 'denied'`
  even after `grantPermissions`, so the spec's init script owns the permission value.
- Studio: section **Widget** (`#widget`): card at focus growth 0 / 0.3 / 0.7, break, watering
  mid-animation, paused, bloom, idle, another session waiting (Switch), two waiting (Resume), unknown-species fallback, favicons (enlarged + tab size on
  light/dark strips) and a 12 s loop of a whole session.
