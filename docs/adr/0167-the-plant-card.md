# ADR 0167 — The plant card

- Status: accepted; amended by ADR 0190 and ADR 0240 (rename the study session)
- Date: 2026-10-23

## Context
ADR 0005: click any plant to zoom onto it and read its description — species, Japanese name, a
short note on its place in Japanese gardens, its poetic line, and that plant's history (task,
minutes studied, date planted; progress if still growing).

## Decision
- **Content** (`src/ui/plant-card.ts`, `plantStory()` is pure): the species name and Japanese
  name; the poetic line (`SpeciesDef.description`); **the note** — two or three quiet, specific
  sentences for every species, kept in `src/plants/notes.ts` (`SPECIES_NOTES`, apart from the
  definitions, which paint in workers; `notes.test.ts` checks every registered species has one);
  then "Its story": what it was planted for, focused minutes (the session log's when there is one,
  else the plant's minutes), the day planted; for a seedling its growth, time to go (or that it
  rests while paused, or waits while another session is active) and minutes so far; the plant it
  replaced (now pressed, matched by the bloom's moment) or the one stepping aside for a seedling.
  A seedling's card refreshes on every controller tick.
- **Look**: a dense washi slip with grain, Shippori Mincho name, Cormorant body, a brush rule
  before the story — the dock's language, not a generic card. Classes `.plant-story*` (the
  planting sheet already owns `.plant-card`).
- **Where**: on stages ≥ 640 px wide it stands on the side away from the plant (a plant on the
  left half of the garden gets the card on the right); the camera frames the plant in the rest of
  the stage (`framePose` inset) and may reach past the painting's edge under the card
  (`camera.setInset`), so a plant near an edge can still sit beside it. On phones it docks at the
  bottom of the stage (≤ 50 % of its height) and the pill and zoom chips step back behind it.
- **Opening**: a click or tap on a plant (ADR 0166); Enter on the focused garden opens the plant
  nearest the view's middle and moves focus to the card's close mark. **Closing**: Esc, the close
  mark, a click on bare garden or anywhere else on the page; focus returns to the garden when it
  was in the card. **The camera stays** where it is (no return glide: the gardener zoomed in to
  look; "Whole garden" is one click away) — only a view that relied on the card's inset glides
  back inside the painting. Entering placement or opening a sheet closes it.
- **The hover label stays** as the quick glance on desktop (task · minutes · date) and uses the same
  hit-test; taps no longer show it (a tap opens the card), and it hides while a card is open.

## Consequences
`camera.spec.ts` checks the card's content for a real species and a seedling, its placement
beside the plant and docked on phones, Esc/click-away/keyboard focus. `ui.state().plantCard`
reports the open card. The old "tap shows the label" phone test now expects the card.
