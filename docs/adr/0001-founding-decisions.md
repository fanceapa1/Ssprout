# ADR 0001 — Founding decisions

- Status: accepted
- Date: 2026-10-21
- Decided by: project owner (interview), recorded by the orchestrator

## Context
Study Sprout is a browser study timer that rewards completed sessions with plants in a
Japanese watercolour garden. Before building, the owner answered six scoping questions.

## Decisions

1. **Art is generated procedurally in code.** Every element (scene, plants, fauna, effects)
   is painted at runtime by our own watercolour engine (`src/paint`): wet-edge blobs, layered
   glazes, granulation, paper grain, tapered ink strokes. No external image assets.
   *Why:* guarantees one coherent painted style, per-instance variety (seeded), correct
   occlusion and pond reflections. *Rejected:* stock CC0 art (patchwork), using the owner's
   reference image as background (copying, poor integration).
2. **Session rules:** slider 10–180 min (step 5) + presets 25/50/90; four reward tiers
   (10–24, 25–49, 50–89, 90+). Cancel grows nothing (no penalty). Pause unlimited, paused time
   excluded, gentle prompt after 30 min paused. *Rejected:* presets-only, seedling-on-cancel,
   auto-ending long pauses.
3. **Timer surfaces:** Document Picture-in-Picture floating widget on Chromium; title +
   favicon countdown elsewhere; Notification API while the tab is open. **No server**, so a
   closed tab gets no notification; the reward waits. *Rejected:* push server.
4. **Garden capacity:** single fixed scene with ~50–60 habitat-typed slots. When full:
   swap (old plant → Pressed Flowers collection) and upgrade by replanting a higher tier.
   Lighting follows the local clock subtly; no seasons. *Rejected:* expanding garden.
5. **Persistence:** localStorage + JSON export/import. Dev speed-up mode for testing.
   *Rejected:* cloud sync.
6. **Extras:** procedural ambient sound muted by default; desktop-first but mobile works;
   public repo `fanceapa1/Ssprout`, deployed on GitHub Pages.

## Technical choices (orchestrator)
- Vite + TypeScript (strict), no UI framework: canvas 2D for the garden, small DOM layer for UI.
- Vitest for logic, Playwright (Chromium) for behaviour + screenshots.
- GitHub Actions: test → build → deploy to Pages on every push to `main`.
- Conventional Commits; **no AI/Claude attribution anywhere** (commits, PRs, docs, code).
