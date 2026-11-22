# 221 · Red CI: the studio's smoke test and the light plates' wait (GC3)

## What
CI on `main` failed in four of seven runs on 2026-11-22. Two causes, both in tests, neither a hang
or an app regression:

1. `studio › every entry renders without errors and paints something`, shards 4/6 and 5/6, timed
   out at 60 s in `settle()` in every red run (also on retry).
2. `light-plates-wait › … (oasis)` timed out once (both tries) polling 40 s for 8 stored plates.

Fixes: the studio check is split into 30 small parts instead of 6 shards, and the light-plates spec
waits on explicit readiness instead of idle time. No app code changed.

## The studio: measured
The studio spec on the production build, 2 workers, a temporary per-entry timer in
`src/studio/main.ts` and a timer in `paintSceneSync` (both reverted), load average about 4–5.

- The six shards took 42, 44, 32, 47, 41 and 27 s locally; shard 4/6 timed out once in two runs,
  as on CI. CI's passing shards took 43–56 s that day, 33–48 s on 2026-11-17 and 24–35 s on
  2026-11-10: the spec grew towards its limit for two weeks, and phase 15 pushed it over.
- The 179 sections took 233 s in all. Garden paints were 174 s of it: 171 calls, each 0.5–3 s.
  The heaviest sections: `plants-a-review` 12 s, `oasis-water` 11 s, `oasis-motion` 9–12 s,
  `oasis-veg`, `oasis-rock`, `coast-rock`, `coast-motion`, `oasis-map` 6–7 s each.
- A crop of a garden costs a whole garden: the paint job runs every mark of every step and only
  the canvas is cropped. A 280 × 100 crop of the oasis at 4 px a unit took 2.4 s, the whole oasis at
  0.5 px a unit 2.7 s; the coast takes 0.5–1.8 s a paint, the oasis 1.6–3.1 s. So the cost is the
  marks, not the pixels.
- No entry repaints its garden on later frames (re-renders of animated entries cost under 100 ms),
  and no section paints the same view twice. Across sections, identical paints (the whole garden
  at 0.5 for several `*-scene` entries) only repeat in different pages.

## Why not cheaper entries
The task preferred cheaper entries to new shards. The measurements rule out the cheap ways:
painting at a smaller scale saves almost nothing (the marks dominate); one shared painting per
garden would need one scale, while a section's crops use 1–9 px a unit, and a whole garden at the
finest of them is 100 MB of canvas or more; a per-page cache of identical paints finds nothing to
share inside a section. The real lever is the paint job culling marks outside its view (shared
scene code, every garden; it may also help the app's close-view detail paints, which paint a view
rect the same way). That is left to the scene system's owner.

## The fix: 30 parts
`PARTS = 30` in `tests/e2e/studio.spec.ts`: section *i* goes to part *i* % 30, each part opens the
studio once and shows its sections one `#section` at a time, with the same assertions (every entry
has a canvas, no errors, no blank canvas). Measured locally (whole spec, 2 workers): parts took
3.4–20.5 s (median about 7.5 s), the whole spec 2.3 min as before. The heaviest part (20.5 s) is
`plants-a-review` with three fauna sections; at CI's speed (1.25–1.55 × local, from the shard
times above) that is about 26–32 s, against the 60 s limit. More parts would not help much: the
heaviest single sections (11–12 s) set the floor (simulated: 36 parts 18.8 s, 45 parts 18.2 s).

## The light plates
Run 10 times in a row on `main` (oasis, 2 workers): 10 passed, 55–61 s each, and in every run the
8 plates were stored 20.5–21.7 s after the phase loop. That fixed delay is the paint cache's put
queue: one entry at a time, each after `requestIdleCallback` (1 s timeout), and a garden drawing
every frame leaves no idle time, so each entry of the first visit (landscape, thumbnail, plates)
waited about 1 s plus its encoding; a plate prepared rather than drawn is also painted in idle
time (20 s timeout). On a loaded runner that passes 40 s. The test took 59 s on 2026-11-17 and 38–72 s on green runs that day, before and
after the suspect merges, so it is a timing flake, not a regression (ADR 0362's one line passes the
daylight to a motion the oasis ignores).

Fix (spec only): the first visit draws one frame in each phase (`setTime` then `freeze()`, which
waits for the lookups and the painters and draws, so each phase's plates are painted then), then
holds the garden still and awaits `paintCache.settle()`, and checks the 8 plates once. After: 12
of 12 passed (each garden 4 times, 2 workers), the oasis in 30–34 s instead of 55–61 s, the
Japanese garden in 15 s, the waterfall in 25–26 s.

## Rules for authors (`docs/systems/studio.md`)
An entry that paints a garden crop costs a whole garden paint; paint it once per entry and cache it
across frames; smaller scales save nothing; keep a section under about 10 s (about six oasis crops
or a dozen coast crops) and split a bigger one.

## Verified
- Typecheck clean; unit suite 3029 of 3029 (283 files) after the last rebase.
- Full local e2e once, in CI's three shards one after another (2 workers, niced, under the shared
  browser lock): shard 1 116 passed (12.2 min), shard 2 116 passed (12.6 min), shard 3 113 passed
  and 2 failed (7.0 min). The two failures, `tips-dismiss › Esc inside a note dismisses that tip,
  not the sheet around it` (the planting sheet closed) and `wayfinding · motion › with reduced
  motion the path is simply there…` (one animation found), passed 3 of 3 alone and pass on CI; they
  are UI tests under load, not phase 15, and were left. In that run the 30 studio parts took
  3.3–17.5 s (median 7.2 s), the light-plates tests 18, 28 and 35 s. After rebasing on GL1b and
  GK13, both specs again (41 passed) at a higher load (6.4): parts 4.4–26.0 s (median 9.2 s; every
  part about 1.5 × slower, the coast-free ones too), light plates 19, 33 and 41 s.

## Left open
- Paint-job view culling (above), for the scene system's owner.
- `plants-a-review` (44 entries, 12 s) is the heaviest section; splitting it in two would lower the
  heaviest part.
