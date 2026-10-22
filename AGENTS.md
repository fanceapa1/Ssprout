# Study Sprout — contributor onboarding

You are working on **Study Sprout**, a study timer that grows a procedurally painted Japanese
watercolour garden. `README.md` is the human-facing overview. This file is for whoever (person or
agent) picks up the work next.

## Reading order
1. `docs/SPEC.md`: what the product does. Behaviour is defined here. *Status* notes mark where
   the code differs or a rule is not met yet.
2. `docs/ART_DIRECTION.md`: how it must look. The quality bar is real watercolour, not generic
   vector or stock-art looks.
3. `docs/ARCHITECTURE.md`: modules, contracts, layers, coordinates, the `?dev` debug API.
   **Contracts are binding.**
4. `docs/TESTING.md`: test layers, conventions (no sleeping, explicit readiness signals) and
   the SPEC → tests matrix with open gaps.
5. `docs/ROADMAP.md`: phases, who owns which paths, ADR number ranges. Only the orchestrator
   edits it.
6. `docs/adr/README.md`: every decision with status and a one-line summary. Read the ADRs of
   the area you touch.
7. `docs/systems/<system>.md`: the system you are about to change.
8. `docs/devlog/README.md`: what each task did and left open. Read the latest entries
   (14 polish, 15 QA & docs) for the current state.

## How work is organised
- An orchestrator splits work into tasks and runs them in parallel, one **git worktree per
  task** (`.claude/worktrees/<agent>/`, branch `worktree-<agent>`; the folder is gitignored in the
  main checkout).
- In your worktree: `npm install`, then work and commit there. Never push and never merge.
  Several agents run at once, so stay inside the paths you own (ROADMAP) and use a separate
  `E2E_PORT`.
- The orchestrator merges finished branches into `main`. If `main` moved while you worked, it
  asks you to `git rebase main` and re-run the suites before it merges.
- `main` is deployed to GitHub Pages after CI passes (ADR 0014).

## Rules
- **No tool or assistant attribution anywhere**: no `Co-Authored-By` trailers, no "Generated
  with" lines, and no mention of the tools used to write the code, in commits, PRs, code comments
  or docs. Commit as the configured git user.
- **Conventional Commits**, small and focused: `feat(scene): paint pond boulders`,
  `test(core): cover pause maths`, `docs(adr): 0031 offer generation`. One logical change per commit.
- **Stay in your owned paths** (see ROADMAP). Need a contract change? Make it minimal, update
  `docs/ARCHITECTURE.md` in the same commit, and add an ADR.
- **Every sprite, creature, effect and paint primitive you add must have a studio entry in a
  colocated `*.studio.ts` file** (see `docs/systems/studio.md`; view at `/Ssprout/studio.html`).
- **Every behaviour is tested.**
  - Logic → Vitest.
  - User-visible behaviour → Playwright via the `?dev` debug API (never real waiting).
  - Art → screenshots you actually look at (`npm run shots`, images in `artifacts/`).

  Add the test to the matrix in `docs/TESTING.md`.
- **Determinism**: time only via `Clock`, randomness only via seeded `Rng`.
- **Document as you go**:
  - Update or create `docs/systems/<system>.md`.
  - Add ADRs for non-obvious decisions, and add each one to `docs/adr/README.md`.
  - Write a short `docs/devlog/<NN>-<slug>.md` for your task (what, why, what's left), and add it
    to `docs/devlog/README.md`.
  - Report status in your devlog. The orchestrator updates `docs/ROADMAP.md`.
- Before finishing: `npm run typecheck && npm test && npm run e2e` must pass.

## Known pitfalls
- **Vitest's fs module cache hides new files** from `import.meta.glob` (e.g. a new species is
  missing from the registry). `vite.config.ts` sets `fsModuleCache: false`; keep it (ADR 0004).
- **Plant sprites paint asynchronously in workers.** A screenshot or pixel check taken right after
  `addPlants`/`start` shows empty slots. Await `sprout.plantsReady()` (sprites painted) or
  `sprout.plants.settle()` (also snaps growth/fades), then `sprout.freeze()`:
  `npm run shots -- --eval "sprout.addPlants(25); await sprout.plantsReady()"`.
- **Lighting follows the app clock.** `sprout.advance(…)` also moves the time of day. Pin it with
  `sprout.setTime('noon')` when comparing pixels across time jumps. The light also eases in once
  the painting is ready (ADR 0121); `freeze()` and `settleAmbience()` skip that.
- **Paint on white; paper is multiplied last** (ADR 0021). Never fill backgrounds with washi
  colour or paint "paper" yourself. The paper layer multiplies the whole frame, and a second
  paper tint turns muddy.
- **`src/main.ts` is a shared integration file.** Every system is wired there, and parallel tasks
  all touch it. Keep your change to a few lines, rebase before you finish, and mention it in your
  devlog.
- **`?speed` only works with `?dev`** (`?dev&speed=60`). Without `?dev` there is no `window.sprout`.
- **The planting sheet paints every species preview synchronously**, so opening it is the slowest
  UI step, and its 900 ms rise animation makes Playwright wait for cards to settle. UI specs use
  `openUi`, which applies `calmUiMotion` (docs/TESTING.md).
- **The `placeholder-sprout` is a unit-test fixture** (`src/dev/placeholder-sprout.ts`), not in the
  registry. Use `?fixtures` (`fx-*`) species for UI flows and real species for art.
- **The e2e server is the production build.** With `E2E_REUSE=1`, rebuild after every `src/` change
  or you are testing stale code.

## Commands
`npm run dev` · `npm run build` · `npm run preview` · `npm run typecheck` · `npm test` ·
`npm run e2e` · `npm run shots`

- `npm run e2e` builds and serves on port 4173. Set `E2E_PORT=<n>` when another checkout may be
  running e2e at the same time.
- `npm run shots` options are documented at the top of `scripts/shots.ts` (`--name`, `--query`,
  `--eval`, `--viewports`, `--studio [section]`, `--entry <id>`, `--url`, `--out`).
