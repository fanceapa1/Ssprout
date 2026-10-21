# ADR 0053 — One scrolling planting sheet, then placement, then Begin

- Status: accepted
- Date: 2026-10-21
- Context: ADR 0003 (the plant is chosen at session start)

## Decision
"Plant a session" opens one calm sheet with four quiet steps in a single scroll: the task name,
the total time (slider, 25/50/90, tier earned), a recommended plan (`controller.recommendPlans`,
radio cards drawn as segmented brush lines) and the plant (`controller.selectableSpecies`; locked
species dimmed with "Needs N min+", the earned tier tinted). A sticky footer summarises the choice
and offers "Choose a spot". Placement mode then shows the compatible markers
(`controller.placementOptions(speciesId)`); choosing one selects it (double-click begins) and the
bar's vermilion "Begin" calls `controller.start({ taskName, goalMinutes, planId, speciesId, slotId })`.

The selections live in one `PlantingDraft` shared by the sheet and placement, so Back loses
nothing; after a successful start the task, plant and spot reset but time and plan are kept.

## Rejected
- A multi-page wizard: more clicks, and it hides how time, plan and plant relate (changing the time
  immediately re-filters the plans and locks/unlocks plants in view).
- Choosing the spot inside the sheet: the garden itself is the map; markers must sit on it.
