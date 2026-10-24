# 52 — P13: Latin-only fonts, declared once

The load report (P0b, "Fonts" and T4) found the build shipping 54 font files, in every subset and as
woff2 and woff. `src/widget/index.ts` imported fontsource's all-script CSS, which added 21 unused
`@font-face` rules to the render-blocking CSS. The per-subset files that `src/ui/index.ts` imported
have no `unicode-range`, so the first view fetched both the latin and the latin-ext file of each face
(5 files, about 117 kB).

**What changed** (ADR 0239, owner decision: Latin only):
- `src/ui/fonts.css` (new): our own `@font-face` rules for exactly the faces in use.
  - Faces: Shippori Mincho 500; Cormorant Garamond 400, 400 italic, 500, 500 italic and 600.
  - Each face has a latin-ext rule and a latin rule, with fontsource 5.3's `unicode-range`s.
  - woff2 only, `font-display: swap`. Sources are `url('@fontsource/…/files/….woff2')`, which
    Vite hashes.
  - The 1.5 kB Shippori latin-ext file carries `?no-inline`, so that Vite does not inline it into
    the CSS.
- `src/ui/index.ts`, `src/widget/index.ts`, `src/widget/widget.studio.ts` and `src/studio/main.ts`
  import it instead of fontsource CSS (one line each).
- **The audit.** I checked every CSS `font-*` and canvas `ctx.font` string, and the computed
  family, weight and style of every text element in the dock, the planting sheet and the calendar's
  three views.
  - The app uses Shippori 500, Cormorant 500, 500 italic and 600.
  - The PiP card uses the same set.
  - The studio adds Cormorant 400 and 400 italic: its body type and canvas mock-ups such as
    `italic 16px` and `12px`.
  - Shippori 400 was imported by the app but used nowhere, so it is dropped. The studio's canvas
    strings that ask for it already drew with the 500 face.
- `src/main.ts`, `vite.config.ts` and `public/sw.js` are untouched.

**Results** (production build, Chromium):

| | Before | After |
|---|---|---|
| Font files in dist | 54 (27 woff2, 27 woff; 30 Cyrillic or Vietnamese) | 12 woff2 (248 kB) |
| `@font-face` rules | 31 in the app, 26 in the studio | 12 (one shared CSS chunk) |
| Fonts fetched on the first view | 5: Shippori 500 latin; Cormorant 500 and 500 italic, latin and latin-ext (117 kB) | 3: Shippori 500, Cormorant 500 and 500 italic, latin only (76 kB) |

The dock panel, the planting sheet (previews ready), the calendar's week view and the studio's
`widget`, `ui-shell` and `calendar` sections are pixel-identical before and after (0 differing
pixels). I looked at them: the text is in Shippori and Cormorant.

**Tests**: `tests/e2e/fonts.spec.ts` (TESTING P13.1, P13.2) has two tests. Both fail against the
old build: 6 files fetched and 31 rules.
- First view: every family, weight and style that a text element computes to loads and passes
  `document.fonts.check`. At most 5 font files are fetched, all latin woff2, with no failed request.
- The shipped CSS has exactly 12 `@font-face` rules: woff2, latin or latin-ext, each with a
  `unicode-range` and swap. Every declared file loads.

**Left open**
- P12 (preloading): the three first-view files are Shippori Mincho latin 500 and Cormorant
  Garamond latin 500 and 500 italic, all in `src/ui/fonts.css`. A preload must use the hashed
  URLs from the build.
- The studio's canvas mock-ups in `shell.studio.ts` ask for Shippori at weight 400 (no weight in the
  string), which resolves to 500. Writing `500` there would state what they draw.
- A Cyrillic or Vietnamese task name renders in the system serif (owner decision). This holds in
  the PiP card too.
- The full gate passed except one e2e test, 248 of 249: `ui-shell › the custom scrollbar shows the
  position and drags…` failed once, while another agent was running its suite. Run alone it passed
  3 of 3. The test waits on a real idle delay, so it is sensitive to load. It does not involve fonts.
