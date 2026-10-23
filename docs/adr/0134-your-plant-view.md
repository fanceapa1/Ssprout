# ADR 0134 — "Your plant": a live painted view in the dock, with a watering hook

- Status: accepted; amended by ADR 0184
- Date: 2026-10-23
- Context: ADR 0005 (more focus on the plant; automatic focus watering in phase 7), ADRs 0094/0118

## Decision
- `src/ui/plant-section.ts` draws the session's plant with `renderPlantView` (the widget's
  renderer: same growth steps, watering and wither), up to 300 px square at the device ratio,
  re-rendered on the controller's tick and on state changes. The canvas is `mix-blend-mode:
  multiply` over the page paper, so the grain shows through the pigment as in the garden.
- Behind it, a static pale round wash (a *marumado*, a garden's round window) gives the plant a
  place to stand; it is painted once per size with the paint engine.
- **Watering:** every `session:water` on the bus plays the 2.5 s animation; `ui.plantView.water()`
  plays it on demand (false when there is no plant or it is already pouring). Phase 7's automatic
  watering every 4–10 focus minutes should emit `session:water` (or call `water()`), and the
  garden, the widget and this view all follow. Like the widget, no animation under reduced motion.
- **Cancel:** the seedling wilts away over 3 s, with "It won't bloom this time. That's all right."
- **Idle:** the most recent bloom with its task, minutes and date ("Your latest bloom"); with no
  plants yet, an empty bed — a mound of earth and one seed — and "Start a session and its plant
  will grow here while you work." No counts, streaks or guilt.
