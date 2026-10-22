# ADR 0014 — Deploy to GitHub Pages only after CI has passed

- Status: accepted
- Date: 2026-10-22

## Context
`pages.yml` ran on every push to `main` with its own typecheck, unit tests and build. It ran next
to `ci.yml`, not after it, so a commit whose e2e suite failed could still be deployed. E2E is the
only layer that checks the production bundle in a browser (ADR 0010).

## Decision
- `pages.yml` is triggered by `workflow_run` of **CI** (`types: [completed]`, `branches: [main]`)
  and its build job runs only when that run concluded `success` for a `push` event. It checks out
  `github.event.workflow_run.head_sha` (exactly the commit CI verified) and only builds; CI already
  ran the checks.
- `workflow_dispatch` stays for manual deploys of the current `main`.
- CI keeps the HTML report for every run that was not cancelled and uploads `test-results/` (traces,
  screenshots) on failure. Playwright retries once in CI only (`playwright.config.ts`).

## Consequences
A deploy starts a few minutes later (after e2e). A red CI run never reaches the live site. Pull
requests run CI but never deploy.
