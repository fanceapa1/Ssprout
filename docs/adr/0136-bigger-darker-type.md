# ADR 0136 — Bigger, darker type, checked against the paper

- Status: accepted; amended by ADR 0200
- Date: 2026-10-23
- Context: ADR 0005 (slightly bigger, more contrasted fonts everywhere)

## Decision
- The UI base goes from 18 px to **21 px** (+17 %; 20 px on phones), and every other size in
  `ui.css` scales with it (planting sheet, tips, labels, herbarium, quiet line, placement).
  Cormorant Garamond is set at weight **500** (upright and italic; the 500 italic files are now
  bundled) so small italics keep their strokes; Shippori Mincho stays for headings and numerals.
- **Ink tokens:** `--ui-ink #3b352e` (10.3:1 on washi), `--ui-ink-soft #5c5449` (6.3:1) for
  secondary text, `--ui-ink-mute #6b6256` (5.1:1) for the quietest text (placeholders, tier words).
  `--ui-ink-faint` / `--ui-ink-ghost` are for rules and strokes only. The seal's vermilion deepens
  to `#ad452d`, so its cream label reads at about 5:1.
- `src/ui/ink.test.ts` reads the tokens from `ui.css` and checks them: ≥ 4.5:1 on both paper tones,
  body ≥ 9:1, the seal label ≥ 4.5:1, no faint/ghost ink used as a text colour, base ≥ 20 px.

## Consequences
The floating widget's card (src/widget) keeps its own type; it was not part of this task.
