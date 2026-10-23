# 35 — Q9: docs audit

## What
The docs checked against the code after v2 (ADR 0005, ADRs 0130–0210, devlogs 16–34) and fixed
where they had drifted. Docs only; no code changed.

- **ADR index and statuses.** 33 ADRs were amended by later ones without saying so; each now has
  "amended by …" in its Status line and in the index. The index listed a second 0190
  (`0190-plant-card-reads-whole-on-phones.md`) for a file that was folded into 0190 and never
  existed; the row is gone and 0190's title and summary cover both halves. The number blocks now
  run past 0120.
- **SPEC.** Marks, not dots (ADR 0194); the day timeline on the wall clock (ADR 0210) and the now
  line's brush head; the planned slip by the pill (ADR 0203); the lazy studio; a status note for the
  audio weather on switch (below); the audit date.
- **ARCHITECTURE.** The dock's `dispose()`, `DockSectionInfo`, `createDock`, `orderSections`,
  `guideLines`/`GUIDE`; the wayfinding helpers; the camera controller and its pure pose maths; the
  `UIState` fields; `E2E_CLOCK`; `window.studio.settle()` and `pending()`; the growth framing's
  8× cap; the `dev/` and `ui/` layout. Every `sprout.*` helper was checked against `src/dev/**` and
  the modules that extend it.
- **AGENTS.** The reading order points at the latest devlogs; new pitfalls for the camera (settle,
  auto focus), schema v2 and the dock and wayfinding.
- **README.** v2 features (the page and dock, daylight, parallel sessions, calendar, camera and
  plant cards, wildlife, widget, sound, studio), a "How it's built" pointer, structure, e2e options.
- **ART_DIRECTION.** The palette and chroma ceilings as in `pigments.ts` and its test, the sun as a
  lifted glaze, v2 anti-tropes (fading instead of painting, close views that turn to vector) and
  the v2 UI (one primary, one hover language, controls in the dock).
- **Systems.** Every `docs/systems/*.md` checked against its code: missing files, constants,
  hooks, tests and studio sections added; stale v1 statements fixed (fauna's night follows the
  shared daylight; the mute tool lives in `tools.ts`; species bloom colours after the saturation
  pass; `MAX_GROWTH_ZOOM` 8; tips and reducer tables).
- **TESTING.** Structure only: the acceptance summary (38 ✔, 3 ◐, 0 ✘ since Q8a/Q8b) and the
  local worker count in Running.
- **Devlog index.** Numbers 24 and 32 were never used; noted.

Attribution grep (tracked files and every commit message): nothing found.

## Code issues found (not fixed, docs-only task)
1. **Audio weather with parallel sessions** (`src/audio/garden-audio.ts`, the bus handlers): no
   `session:switch` handler, so the weather bed keeps the session started last; `session:cancel`
   and `session:complete` clear weather and activity whichever session ended, so cancelling a
   waiting session silences the active one. SPEC §2 says the weather follows the active session.
2. **Favicon dot** (`src/widget/favicon.ts`): an unseen bloom paints a vermilion dot in the favicon
   (and the notification icon). ADR 0194 says no round red dot anywhere; it does not name the
   favicon. Owner call.
3. `src/ui/sheet.ts` header comment says only the herbarium, garden data and hints use the shell;
   every sheet does.

## Left / for others
- ROADMAP (orchestrator): the ADR block list stops at 0180–0189 (0190–0194, 0200–0207 and 0210 are
  in use); Q8's result still reads "36 ✔, 3 ◐, 2 ✘"; Q9a sits out of order after Q12.
- Docs for Q11 (dock backdrops) and Q12 (dismissible tips) land with those tasks.
