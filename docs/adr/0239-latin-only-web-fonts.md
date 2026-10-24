# ADR 0239 — Latin-only web fonts, declared once

- Status: accepted
- Date: 2026-10-24
- Decided by: the owner (2026-10-24): Latin only

## Context
The app, the timer surfaces and the studio each imported fontsource CSS on their own:
- `src/ui/index.ts` imported the per-subset files (`latin-500.css`, `latin-ext-500.css`, …). These
  files have no `unicode-range`, so the browser fetched the latin *and* the latin-ext file of every
  face it used. That made 5 fonts on the first view, about 117 kB.
- `src/widget/index.ts`, `src/widget/widget.studio.ts` and `src/studio/main.ts` imported the
  all-script files (`500.css`, `400-italic.css`, …): Cyrillic, Cyrillic-ext, Vietnamese, Latin-ext
  and Latin, each as woff2 and woff.

The build shipped 54 font files (30 of them Cyrillic or Vietnamese, 27 of them woff). The app's
render-blocking CSS held 31 `@font-face` rules. The text is English.

## Decision
- **One file declares the fonts**: `src/ui/fonts.css`. It holds our own `@font-face` rules. The app
  (`src/ui/index.ts`), the timer surfaces (`src/widget/index.ts`) and the studio (`src/studio/main.ts`,
  `src/widget/widget.studio.ts`) import it. Nothing imports fontsource CSS any more. The packages
  stay as the source of the files.
- **Latin and Latin-extended only** (the owner's decision). Cyrillic or Vietnamese text falls back to
  the system serif.
- **woff2 only.** Every browser the app supports (Document PiP, ES2022) reads woff2.
- **Only the faces in use**, found by auditing CSS `font-*` and canvas `ctx.font` strings:

  | Face | Used by |
  |---|---|
  | Shippori Mincho 500 | display type (`--ui-display`), the PiP card's time, studio mock-ups |
  | Cormorant Garamond 500, 500 italic | body type (`--ui-body`), the PiP card's task and state line |
  | Cormorant Garamond 600 | the calendar's chosen day and chip, the PiP card's buttons, studio headings |
  | Cormorant Garamond 400, 400 italic | the studio's own type and its canvas mock-ups |

  Each face is two rules: latin-ext, then latin, as fontsource orders them, with fontsource's
  `unicode-range`s. The latin-ext file loads only when a character needs it. Shippori Mincho 400
  was imported but nothing in the app used it, so it is dropped. The studio's canvas strings that
  ask for it already drew with the 500 face, and still do.
- `font-display: swap`. Sources are the fontsource woff2 files (`url('@fontsource/…/files/….woff2')`),
  hashed by Vite. The 1.5 kB Shippori latin-ext file carries `?no-inline` so that Vite does not inline
  it as a data URI into the render-blocking CSS.

## Consequences
- dist: 12 woff2 files (248 kB), was 54 font files. 12 `@font-face` rules, was 31 in the app and
  26 in the studio.
- First view: 3 fonts fetched (Shippori 500, Cormorant 500 and 500 italic, latin, about 76 kB), was 5
  (about 117 kB).
- Rendering is unchanged: the dock, the planting sheet, the calendar and the studio's widget,
  ui-shell and calendar sections are pixel-identical before and after in Chromium.
- A new weight or style means a new pair of rules in `src/ui/fonts.css`. `tests/e2e/fonts.spec.ts`
  pins the count of 12.
- P12 (preloading) can name the three first-view files from this one file.
