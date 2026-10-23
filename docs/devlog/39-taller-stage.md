# 39 — Q17: a taller garden stage

The owner asked for the skyline a bit higher, "extend the canvas by 7% more vertically": the
garden stage is now **94svh** (94vh fallback), up from 88, with the same top margin, `svh` choice,
320 px floor and dissolving edge (ADR 0212, amends 0130); only `src/style.css` and a doc comment in `src/ui/stage.ts` changed (no
`main.ts`, no viewport change). Cover scaling fits the width on landscape screens, so the extra
height shows more of the world around the pond, clamped to the world: at 1440×900 the overview now
starts at world y ≈ 41 instead of 103 (all of it sky, the tree crowns now fit), at 1920×1080 and
1280×720 the gain splits between the sky and the foreground. Phones take the same 94 %: the
ADR 0123 width floor is untouched, so the same garden sits on a ~50 px taller stage with the sky
filling it. Before/after shots at 1440×900, 1920×1080, 1280×720 and 390×844 (`artifacts/shots/
before-stage-*`, `after-stage-*`) show nothing overlapping: corner tools, pill, zoom chips and the
guiding path's start below the stepping stones are where they were relative to the stage, and the
dock still peeks out (~29–40 px). Tests: `ui-shell` and `ui-menu · phone` assert 0.94 and
`ui-shell` checks the 1280×720 overview shows the world from above y 140; SPEC §12, ARCHITECTURE,
TESTING and the ui/render system docs say 94 %. Left: the dock is one short scroll further down on
first load; nothing open.
