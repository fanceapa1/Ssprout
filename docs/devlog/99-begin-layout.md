# 99: S18, Begin's forced layout

Index line for the orchestrator:

`| 99 | [S18: Begin's forced layout](99-begin-layout.md) | Begin measures the pill's aside before its DOM writes, and the page paper reaches CSS as a blob URL instead of a 551 KB data URL; Begin's click 27–108 ms → 31–36 ms on the loaded laptop | — |`

`deferred-dock › Begin only marks “Your plant”` requires Begin's click handlers to finish in under
100 ms. On the owner's loaded laptop they took 105–110 ms (devlog 95).

## Cause
There were two parts.

1. **Where the read sat.** At the end of `begin()`, `settleAside(scroller.state().target)` read
   `scrollHeight` (in `state().max`) and the Study body's `getBoundingClientRect` after the mode
   change and the renders. That forced a full style and layout pass inside the click.
2. **Why the pass was slow.** In the trace it was almost all style (`UpdateLayoutTree`: 45–95 ms
   for 358 elements). Layout took only 1–2 ms, and selector matching took 0.4 ms in total
   (selector stats). The time went into `--page-paper`. It held the paper tile as a **551 KB PNG
   data URL**, and every restyled element that uses `var(--page-paper)` re-parses that value. Those
   elements are the `html` background and the `.backdrop-leaf` of each dock section. The Gardens
   section added one more leaf, which explains the extra ~16 ms in devlog 95. A test that set
   `--page-paper: none` before Begin dropped the forced pass from ~85 ms to ~20 ms.

Moving the read (part 1) alone did not help much. Focusing the pill's Pause (`pill.pause.focus()`)
then forced the same style pass, because the mode change dirties the pill's ancestors. Focus has to
stay synchronous: `polish › a Begin that comes before the glide … still lands on Pause` checks
`document.activeElement` right after the click.

## Fix
- `begin()` measures with `asideAt(scroller.target())` before any write and applies the result
  with `settleAside(on)` where it used to measure. `SmoothScroll.target()` is `state().target`
  without reading `scrollHeight`. The pill settles to the same answer as before. The Study body's
  top does not move during Begin, and the IntersectionObserver still corrects it once the page
  arrives.
- `page-paper.ts` turns the tile's data URL into a blob URL (`paperUrl`) before setting
  `--page-paper`. It does this synchronously in the same idle callback, so nothing waits longer.
  It falls back to the data URL where blob URLs are missing. The paper looks the same: the
  screenshot of the dock was checked, and the tile is 512×512.

## Numbers
The spec's own Event Timing measure (`processingEnd - processingStart` of Begin's click). Each was
run 5 times with `nice -n 19`, `E2E_WORKERS=1 E2E_PORT=4385`, on the loaded laptop:

| | runs (ms) | result |
|---|---|---|
| before | 90, 108, 105, 27, 67 | 2 of 5 over 100 |
| after | 31, 32, 36, 32, 31 | all pass |
| final spec run | 27 | |

CPU trace of the click (`devtools.timeline` with stacks):
- Before: `UpdateLayoutTree` 44–71 ms plus `Layout` 1–2 ms, both from `g` (`scroller.state`) ← `begin`.
- After: `begin` has no `Layout`. The only forced style pass is `pill.pause.focus()`, at 16–17 ms
  (it was 59–92 ms with the data URL). The click took 34–39 ms under tracing.

## Tests
- `src/ui/page-paper.test.ts`: the blob URL holds the PNG bytes, and the code falls back to the
  data URL without `URL.createObjectURL`.
- Locally, with `E2E_WORKERS=1`: `deferred-dock`, `wayfinding`, `ui-shell` and `gardens` pass
  (36 tests). The polish test `a Begin … still lands on Pause` also passes.
- `npm run typecheck`, `VITEST_WORKERS=1 npx vitest run src/ui`.

## Left open
- The sheets' `--sheet-mask` and `--sheet-shadow` are SVG data URLs too, 16–38 KB each and five
  sheets in all. They likely make up much of the 16 ms that remain. Turning them into blob URLs
  needs the backdrop's revocation on redraw and changes to `backdrop.test.ts` and
  `backdrops.spec.ts`, which check for `data:image/svg+xml`.
- The UI's store render (a microtask in the same click) still forces about 2–4 ms of layout in the
  calendar's render (`getComputedStyle` and `clientWidth` for the column width, and
  `scrollTop`/`scrollHeight` on the timeline).
- The style pass now forced by focus is real work. Without the click it would happen in the next
  frame anyway. What shrinks it is the paper fix above.
