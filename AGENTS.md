# Study Sprout — agent onboarding

You are working on **Study Sprout**, a study timer that grows a procedurally painted Japanese
watercolour garden. Read these first, in order:

1. `docs/SPEC.md` — what the product does (behaviour is defined here).
2. `docs/ART_DIRECTION.md` — how it must look. Quality bar: real watercolour, no AI/vector tropes.
3. `docs/ARCHITECTURE.md` — modules, contracts, layers, coordinates. **Contracts are binding.**
4. `docs/ROADMAP.md` — phases, who owns which paths, ADR number ranges.
5. `docs/adr/` — decisions and why. `docs/systems/` — per-system docs. `docs/devlog/` — what each task did.

## Rules
- **No AI attribution anywhere**: no `Co-Authored-By`, no "Generated with", no mentions of
  Claude/AI in commits, PRs, code comments or docs. Commit as the configured git user.
- **Conventional Commits**, small and focused: `feat(scene): paint pond boulders`,
  `test(core): cover pause maths`, `docs(adr): 0031 offer generation`. One logical change per commit.
- **Stay in your owned paths** (see ROADMAP). Need a contract change? Make it minimal, update
  `docs/ARCHITECTURE.md` in the same commit, add an ADR.
- **Every sprite, creature, effect and paint primitive you add must have a studio entry in a
  colocated `*.studio.ts` file** (see `docs/systems/studio.md`; view at `/Ssprout/studio.html`).
- **Every behaviour is tested.** Logic → Vitest. User-visible behaviour → Playwright via the
  `?dev` debug API (never real waiting). Art → screenshots you actually look at
  (`npm run shots`, images in `artifacts/`).
- **Determinism**: time only via `Clock`, randomness only via seeded `Rng`.
- **Document as you go**: update/create `docs/systems/<system>.md`, add ADRs for non-obvious
  decisions, write a short `docs/devlog/<NN>-<slug>.md` for your task (what, why, what's left),
  and update your row in `docs/ROADMAP.md`.
- Before finishing: `npm run typecheck && npm test && npm run e2e` must pass.

## Commands
`npm run dev` · `npm run build` · `npm run typecheck` · `npm test` · `npm run e2e` · `npm run shots`

- `npm run e2e` builds and serves on port 4173; set `E2E_PORT=<n>` when another checkout may be
  running e2e at the same time.
- `npm run shots -- --help` style options are documented at the top of `scripts/shots.ts`
  (`--name`, `--query`, `--eval`, `--viewports`, `--studio [section]`, `--entry <id>`, `--url`).
