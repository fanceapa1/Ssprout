# Roadmap & task ownership

The project is built by an orchestrator delegating to agents. Each task below lists its owner
area so parallel work never edits the same files. Status is updated by each agent when done.

ADR numbering ranges (to avoid collisions in parallel work):
0001–0009 orchestrator · 0010–0019 foundation · 0020–0029 paint · 0030–0039 core logic ·
0040–0049 scene · 0050–0059 UI · 0060–0069 plants · 0070–0079 fauna · 0080–0089 ambience/lighting ·
0090–0099 widget/notifications · 0100–0109 audio · 0110+ integration/polish.

| Phase | Task | Area (owned paths) | Status |
|---|---|---|---|
| 1 | Foundation: repo, tooling, CI/Pages, render skeleton, contracts as code, studio page | root config, `src/render`, `src/studio`, `src/main.ts`, stubs | done |
| 2 | Watercolour paint engine + gallery page | `src/paint`, `gallery.html` | todo |
| 2 | Core logic (session, rewards, state, persistence, unlocks, tips) + unit tests | `src/core` | todo |
| 3 | Painted landscape scene + geometry + slots | `src/scene` | todo |
| 3 | UI shell: timer panel, reward picker, placement, menu, dev API, e2e | `src/ui`, `src/dev`, `tests/e2e` | todo |
| 3 | **First playable → deploy to Pages** | — | todo |
| 4 | Plant species tiers 1–2 | `src/plants/species/*` (assigned ids) | todo |
| 4 | Plant species tiers 3–4 + sprite cache + bloom anim + reflections | `src/plants` | todo |
| 4 | Fauna | `src/fauna` | todo |
| 4 | Ambience (weather, motes) + time-of-day lighting | `src/ambience` | todo |
| 4 | Widget (PiP), title/favicon, notifications, timer worker | `src/widget` | todo |
| 4 | Procedural audio | `src/audio` | done |
| 5 | Tooltips, herbarium, polish, mobile, reduced motion | `src/ui` | todo |
| 5 | Art review loop (screenshots → fixes) | all art | todo |
| 5 | Full e2e + visual test pass, docs audit | `tests`, `docs` | todo |
