# ADR 0201 — Helper lines under the headings, and one primary action per state

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner ("clear headings, aligned columns, and short helper lines that say what
  each section is for and what to do next"), designed in dock wayfinding (devlog 25)
- Amends: ADR 0130 (dock contract), ADR 0133 (session controls), ADR 0176 (waiting card)

## Context
Nothing in the dock said what a section is for. When a planned session was due, two vermilion
seals competed in the Study section (the card's Start and Start studying). While a session ran,
Pause and End were the same quiet words, with no lead.

## Decision
- **Contract.** `DockSectionDef.helper?: string`, `DockSection.helper` (the `p.dock-helper`) and
  `DockSection.setHelper(text | null)`, and `DockSectionInfo.helper`. The helper sits with the
  heading in a `header.dock-head`. It describes the section (`aria-describedby`) and is hidden when
  empty. `setHelper` is a no-op when the text is unchanged, so it can run on every tick.
- **Copy** (`ui/dock-guide.ts`, pure, tested). One sentence, or two short ones, in the quiet italic
  voice: what the section is for, what to do next. No exclamation marks, no guilt words, and no
  copy a tip already says (ADR 0124: a tip explains a control; the helper says where you are).
  - Study follows the state: idle, waiting sessions, a planned session due (or due at the limit),
    focus, a break before and after watering, paused, the long pause, and the end question.
  - Your plant: growing, bloom or empty.
  - Calendar: the current view.
  - Garden tools: one line.
  The idle line under the controls no longer repeats the helper ("Your garden is ready for its
  first plant."). The empty bed's caption is "Waiting for its first seed."
- **One primary action** in the Study section, marked `data-primary`:
  - idle: Start studying (the seal);
  - focusing: Pause, as the **calm lead** (`.calm`, a washi slip with an inked edge; vermilion is
    kept for beginnings);
  - a break: Water, then Skip break once watered;
  - paused: Resume;
  - the long pause: Resume;
  - nothing active, sessions waiting: the suggested Resume;
  - a planned session due with Start: **the first card's Start**, and the panel's controls step
    back (the seal becomes an ink slip, the lead becomes quiet).
  Secondary words (End, Skip break, Not this time, Plant another, Switch, Today, Schedule a session)
  recede to the soft ink until pointed at (ADR 0204).

## Consequences
The helper lines take one line on wide screens and two on phones. `syncGuide` in `ui/index.ts`
runs in a microtask after refreshes, ticks and `ctx.changed()` (a calendar view change, for
example).
