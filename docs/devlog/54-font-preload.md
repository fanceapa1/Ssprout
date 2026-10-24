# 54 — P12: preload the first view's fonts

The load report (P0b, "Fonts" and T3) found that fonts were requested only once the JS had built
the page, so text showed in the fallback serif after the first paint and then reflowed (the tips
and the guiding path lay out again on `fonts.ready`). After P13 (devlog 52) the first view needs
exactly 3 files, in one wave, but that wave still started after the boot: 700 ms in on fast 4G,
2 000 ms on slow 4G.

**What changed** (ADR 0231):
- `src/build/font-preload.ts` (new, build-time only): `FIRST_VIEW_FONTS` names the 3 fontsource
  files. `fontPreloadHrefs` finds each hashed file in the bundle by its source name (`names`, else
  `originalFileNames`). A missing face throws, which fails the build.
- `vite.config.ts`: a `sprout:font-preload` plugin (build only, `transformIndexHtml` post hook,
  `index.html` only) appends `<link rel="preload" as="font" type="font/woff2" crossorigin href>`
  for the 3 files to `<head>`, after the entry script and the stylesheets. P9's `swManifest` and
  P7's `__PAINT_VERSION__` define are untouched. The source `index.html` is unchanged. The dev
  server and the studio get no preloads. The sw manifest already listed these files, and its
  version changes with the new HTML, as designed.
- `src/main.ts` and `public/sw.js` are untouched.

**Measurements.** Cold load, 1280×800 @2, headless Chromium, CDP throttling (fast 4G 9 Mbps/60 ms,
slow 4G 1.6 Mbps/150 ms), served by a Pages-like static server (gzip, ETag, max-age 600). Medians
of 5 runs, with the variants interleaved run by run. A second interleaved batch of 4 runs agreed
within 10 ms. Times are ms after navigation start. "Landscape" is `scenePainted`. First canvas
pixels coincide with FCP (within 10 ms) in every variant.

| | FCP | Landscape | Fonts done | JS done | Font requests start | Waves | Fallback after FCP |
|---|---|---|---|---|---|---|---|
| Fast 4G, before | 764 | 2201 | 922 | 380 | 701 | 1 | 158 |
| Fast 4G, 3 preloads | 820 | 2236 | 829 | 449 | 76 | 1 | 9 |
| Slow 4G, before | 2036 | 3468 | 2597 | 1666 | 1976 | 1 | 561 |
| Slow 4G, 3 preloads | 2412 | 3834 | 2421 | 2045 | 159 | 1 | 9 |

- **What the preloads buy:** the text is in its own fonts at the first paint on both profiles, with
  no reflow afterwards. The final text arrives 90 ms (fast 4G) and 176 ms (slow 4G) earlier.
- **What they cost:** the 76 kB share the link with the 254 kB of JS. On fast 4G the first paint
  and the landscape come about 50 ms later. On slow 4G they come about 370 ms later.
- **Variants measured and rejected** (details in ADR 0231):
  - *Shippori only*: on slow 4G the first paint comes about 190 ms later. Fonts done is unchanged
    (2640 against 2614 in the same batch), and there are two waves again, so the body text still
    reflows. A partial preload pays without the benefit.
  - *`fetchpriority="low"`*: identical to the default within 10 ms, because DevTools throttling
    shares bandwidth evenly.
  - *`document.fonts.load()` at the top of `main.ts`*: requests at 394 and 1679 ms, but the files
    land only when the boot task ends (fonts done at 919 and 2593 ms). No gain. This was a local
    experiment and was not committed.

The slow-4G cost was the condition for preloading fewer files. I kept all 3 because the measured
alternative of fewer files costs time and does not remove the reflow, which is the point of the
task. The owner can change this with one list (`FIRST_VIEW_FONTS`, see Left open).

**Tests**
- `src/build/font-preload.test.ts` (5): the three names; the hashed files found in order under the
  base; never the latin-ext file or another weight; the `originalFileNames` fallback; a missing face
  throws.
- `tests/e2e/font-preload.spec.ts` (TESTING P12.1, P12.2):
  - The built HTML has exactly the 3 preloads, with `as`, `type` and a bare `crossorigin`, after the
    stylesheets, and each is served. The studio page has none.
  - On the app: each file is requested once, by the link (the preload was reused). Its
    `@font-face` is `loaded` by `sprout.ui.dockReady()`. No console message mentions a preload.
  - Run against a build without `crossorigin`, both tests fail: 2 requests per file and Chromium's
    "credentials mode does not match" warning. Chromium's "preloaded but not used" warning fires
    seconds after load. The test checks its condition (one request, consumed by the face) rather than
    waiting for the warning.
- `fonts.spec.ts` and `sw-manifest.spec.ts` pass unchanged.
- Full gate (`nice -n 15`, `E2E_PORT=4337`): typecheck clean, unit 1529 of 1529 (126 files), e2e
  252 of 252. The e2e run took 32.6 min because the machine's load average was around 50.

**Left open**
- **The slow-4G trade-off needs an owner decision.** The lab shows about 370 ms later first paint
  and landscape on slow 4G, in exchange for no fallback flash and no reflow. DevTools throttling is
  the worst case. On HTTP/2 or HTTP/3 with server-side priorities, same-priority streams go in request
  order, so the fonts would follow the JS. This has not been measured on Pages (Fastly). Check it
  with a real-device or WebPageTest run on the deployed site. To back out, empty `FIRST_VIEW_FONTS`
  or drop the plugin. Partial lists keep the reflow.
- A connection-aware preload (an inline script that adds the links only when
  `navigator.connection` reports a fast link) could keep the fast-4G gain without the slow-4G cost.
  It is Chromium only, and the estimate is unreliable on a cold start. I did not build it.
- The fonts' `@font-face` rules stay in the render-blocking CSS: they share it with the app's styles,
  so making them non-blocking gains nothing.
