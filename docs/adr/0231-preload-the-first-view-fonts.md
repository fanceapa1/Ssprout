# ADR 0231 — Preload the first view's fonts

- Status: accepted
- Date: 2026-10-25

## Context
All the markup is built by JS, so the browser finds out which fonts the page needs only when the
first boot task has built the dock and laid it out. On a cold load the three first-view fonts
(Shippori Mincho latin 500, Cormorant Garamond latin 500 and 500 italic, ADR 0239, about 76 kB) were
requested 700 ms (fast 4G) and 2 000 ms (slow 4G) after navigation. They arrived after the first
paint, so text showed in the fallback serif for 160 ms (fast 4G) and 560 ms (slow 4G) and then
reflowed: the tips and the guiding path lay out again on `fonts.ready`. Since P13 they come in one
wave (the latin-ext files no longer load), so the problem is the late start, not a second wave.

The load report warned that preloads in `<head>` share the link with the 254 kB of JS on slow
connections.

## Decision
- **The built `index.html` preloads the three files**: `<link rel="preload" as="font"
  type="font/woff2" crossorigin href="…">`, after the entry script and the stylesheets.
  `crossorigin` is required: `@font-face` fetches in CORS mode, and a preload without it is
  fetched a second time.
- **A build-only plugin** (`sprout:font-preload` in `vite.config.ts`, a `transformIndexHtml` post
  hook) adds them. `src/build/font-preload.ts` finds each file in the bundle by its fontsource name
  (`names`, else `originalFileNames`), so no hash is written down. A face missing from the bundle
  fails the build. The studio page and the dev server get no preloads.
- **All three, at the default priority.** Measured cold, 1280×800 @2, Chromium with CDP network
  throttling against a Pages-like server, medians of 5 interleaved runs:

  | | FCP | Landscape | Fonts done | JS done | Fallback text after FCP |
  |---|---|---|---|---|---|
  | Fast 4G, before | 764 | 2201 | 922 | 380 | 158 ms |
  | Fast 4G, 3 preloads | 820 | 2236 | 829 | 449 | 9 ms |
  | Slow 4G, before | 2036 | 3468 | 2597 | 1666 | 561 ms |
  | Slow 4G, 3 preloads | 2412 | 3834 | 2421 | 2045 | 9 ms |

  With the preloads, the text is in its own fonts at the first paint on both profiles, in one wave
  that starts with the HTML's own requests (at about 70 ms and 160 ms). The cost is bandwidth: on
  slow 4G the 76 kB delay the JS, so the first paint and the landscape come about 370 ms later. On fast 4G the cost is about 50 ms.

- **Alternatives measured and rejected:**
  - *Preload only Shippori 500* (the headings): slow 4G first paint about 190 ms later, and no gain,
    because the two Cormorant files still start after the boot and the text still reflows (two waves).
    Cost scales with the bytes preloaded. A partial preload pays without removing the reflow.
  - *`fetchpriority="low"` on the preloads*: identical to the default in the lab. DevTools
    throttling shares bandwidth evenly, whatever the priority.
  - *`document.fonts.load()` at the top of the entry module* (the report's other option): the requests
    start when the JS has arrived, but the files only land when the first boot task ends. Fonts done
    919 and 2593 ms: no gain.
  - *Non-blocking fonts CSS*: the `@font-face` rules share the render-blocking CSS with the app's
    styles, which must block anyway. Nothing to gain.

## Consequences
- No fallback-font flash and no reflow of tips and the guiding path on a cold first view.
- On slow 4G the first paint and landscape come about 370 ms later in the lab. DevTools throttling
  shares the link evenly, so this is the worst case. A server that honours HTTP/2 or HTTP/3
  priorities sends same-priority streams in request order, which puts the fonts after the JS, but
  this has not been measured on Pages. If the cost shows up in the field, list fewer files in
  `FIRST_VIEW_FONTS` or remove the plugin. Dropping only some files keeps the reflow.
- A new first-view face means adding its fontsource file name to `FIRST_VIEW_FONTS`, and the matching
  regex to `tests/e2e/font-preload.spec.ts`.
- On repeat visits the files come from the HTTP cache, or from the service worker once P10 caches.
  The preload then costs nothing.
