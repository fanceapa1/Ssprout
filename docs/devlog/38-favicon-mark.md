# 38 · Q16: no round dot in the favicon

The docs audit (35) found the last round red dot: a session that bloomed while the tab was away
closed the favicon ring with a vermilion dot, and the bloom notification's 96 px icon shares that
drawing. `drawFavicon` now closes the full olive ring around the house sprout mark of ADR 0194: the
`ICON_STROKES.sprout` glyph from `ui/icons.ts`, sampled into points (`glyphPath`) and painted with the
widget brush, so it sits in the ring's watercolour (sap-green `MARK_LEAF` leaves with an olive rim
and an ink outline, a firm sumi stem, a faint ground stroke, all heavier than the UI mark so they
read at 16 px). The tab now gets a 64 px PNG, the 32 px grid at 2×, so a 2× tab stays sharp. To test
pixels under Node, `test-helpers.ts` gained `rasterContext`, a small software rasteriser behind the
2D context API. The unit tests use it at 16, 32, 64 and 96 px on light and dark tab strips: no red
pixel anywhere, sap-green leaves and ink where the dot was, and paper between the strokes. A
detector check proves that the old dot is caught (12 to 474 red pixels). `marks.spec.ts` decodes the
real favicon in the page and checks the same at tab sizes. The studio entry is `widget/favicon-sizes`
(16 / 32 / 64 px at 1× and 2× DPR, light and dark strips). ADR 0194 is amended ("the favicon too"),
and `docs/systems/widget.md` and the test matrix (L9, 12.17) are updated. Left open: at 16 px on a
1× screen the sprout reads as a small inked "Y" with green, which is legible but not detailed. The
favicon is not checked in Firefox or Safari, which may not repaint it (TESTING 10.2).
