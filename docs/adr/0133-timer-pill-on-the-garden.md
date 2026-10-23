# ADR 0133 — A timer pill is the only session control on the painting

- Status: accepted; amended by ADRs 0156 (“+N” when other sessions are in progress), 0194, 0201, 0203
- Date: 2026-10-23
- Supersedes: ADR 0127 (timer slip in the corner)

## Decision
- The session controls moved into the dock (ADR 0130). On the garden stays one small washi pill
  (`src/ui/pill.ts`): idle, "Start studying" with a vermilion seal dot (opens the same planting
  sheet); studying, the time left in the current block with a word (focus / break / paused),
  Pause or Resume, and "Session controls" (↓), which glides the page to the Study section and
  focuses the most useful control there (Water in an unwatered break, Resume, Pause).
- **Where:** ADR 0127's reasoning still holds — keep the stepping-stone path clear. On wide
  landscape screens the pill lies in the lower-left corner, inside the band where the painting
  has already dissolved; elsewhere bottom-centre, which on phones is the paper margin below the
  world (ADR 0123). The bottom panel that covered the near path on phones is gone.
- **Rest:** while focusing, after 4 s without input, the pill rests at 0.42 opacity and the corner
  tools at 0.32; the dock never fades (it is read on paper, not over the painting).
- **Focus:** after Begin, keyboard focus lands on the pill's Pause (on screen, where the seedling
  just appeared), not on the dock's (which would scroll the page away from the garden).
- The pill hides while a spot is being chosen.
