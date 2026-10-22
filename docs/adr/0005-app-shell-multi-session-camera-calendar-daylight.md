# ADR 0005 — App shell, parallel sessions, camera, calendar, daylight (v2)

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner (interview, 10 questions), recorded by the orchestrator

## Context
v1 is a full-window canvas with a small overlay panel. The owner wants a functional app around
the garden: a scrollable page with a UI below the canvas, more focus on the plant being grown,
several sessions in flight, a calendar to schedule study, a real day cycle, and a bolder look.

## Owner requests (verbatim intent)
1. The page is no longer just a canvas. The garden canvas stays the centrepiece; **the GUI sits
   below it** and the page scrolls with a **custom smooth scroll animation and custom scrollbar**
   (not browser default). A **small margin between the browser tab edge and the canvas**; the
   canvas **transitions seamlessly** into the UI. First UI components: **a view of the plant
   currently being watered** and **a calendar of study sessions, toggleable daily / weekly /
   monthly, default daily**. More features will come later and will likely live in this UI, so
   it must be built to grow.
2. **Switch between plants / study sessions.** Only one is active at a time; switching pauses
   the one that is no longer active.
3. **More focus on the plant being grown.** The canvas **zooms onto it when a session starts**
   (the user can zoom back out); a **watering animation every now and then**; **click any plant
   to zoom onto it and read its description**.
4. **Schedule study sessions** from the calendar.
5. **The garden follows the system clock with 4 phases: sunrise, midday, sunset, night.** A big
   drawing task.
6. The top-right icons are not intuitive or visible enough: **make them better and duplicate
   them in the UI below the canvas**.
7. **Slightly bigger, more contrasted fonts** everywhere.
8. **Plants about 1.25× bigger** everywhere in the garden.
9. **More saturated colours** everywhere, tying in with the day cycle.

## Decisions (interview answers)
| Topic | Decision |
|---|---|
| Canvas size | The garden stage is **~88 % of the viewport height** on first load (below a small top margin), so the top of the UI peeks out and invites scrolling. |
| Session controls | All controls (start studying, timer, plan line, pause/resume, skip break, cancel, water) **move into the UI below**. The canvas keeps only a **small floating timer pill with pause/resume** (and a start pill when idle). |
| Parallel sessions | **Up to 3 sessions in progress.** Exactly one is active; switching pauses the previous one (its paused time does not count, as with any pause). Each holds its own garden spot. |
| Camera | **Focus + gentle free zoom.** The camera glides to the session's plant on start and to any plant the user clicks. Pinch / zoom gestures and drag-to-pan within limits. A **"Whole garden"** control glides back out. |
| Scheduling contents | A scheduled session has a **name, and optionally a length and plan** (they may be left open and chosen at start). **Plant and spot are chosen when it actually starts**, so no spot is held for days. |
| At the scheduled time | **Soft notification + a waiting card with one-tap Start** that opens the start flow prefilled. Never auto-starts. If not started it is quietly marked missed, with no guilt. |
| Repeats | One-off, or repeat **daily / weekdays / weekly**. |
| Watering during focus | **Automatic watering animation at random 4–10 min intervals of focus time**, in the garden and the plant view; nothing to tap. Breaks keep tap-to-water. |
| Sun times | **Real sunrise/sunset for today's date at a rough location guessed from the timezone**. No permission prompt. Phases blend over ~40 min. |
| Plant description | **Species + its story**: name, Japanese name, a short note on its place in Japanese gardens, its poetic line; plus that plant's history (task, minutes studied, date planted; progress if still growing). |

## Orchestrator decisions
- **Wheel over the canvas scrolls the page** (the page is a scrolling document now). Zoom is
  **pinch (trackpad pinch arrives as ctrl+wheel), ctrl/⌘+wheel, double-click/tap, and on-canvas
  + / − / Whole-garden buttons**. Drag pans only while zoomed in. Touch: one finger scrolls the
  page unless zoomed in; two fingers pinch.
- **Touch scrolling stays native** (momentum is the platform's); the custom smooth scroll drives
  wheel, keyboard and scrollbar input. `prefers-reduced-motion` → no smoothing.
- The UI below the canvas is a **dock of sections** registered by features (plant view,
  calendar, garden tools, …) so later features plug in without rewriting the page.
- The calendar shows **both past sessions** (completed, and cancelled faintly) **and scheduled
  ones**.
- History needs a session log (completed/cancelled sessions with times), a persisted-state
  schema change; migrations go through the existing chain (v1 → v2).
- Plants scale 1.25× in the garden; slot spacing is re-checked so neighbours still read.
- Saturation is raised in the shared pigments and species palettes, then balanced per daylight
  phase, so the whole painting stays coherent rather than tinted.

## Consequences
SPEC gains sections for the app shell, parallel sessions, camera, calendar and daylight phases
(written by the tasks that build them). Work is split into phases 6–8 in `docs/ROADMAP.md`.
