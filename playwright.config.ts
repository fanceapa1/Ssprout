import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build served by `vite preview`, so tests exercise exactly
 * what ships to GitHub Pages (base path included). See docs/adr/0010-e2e-against-preview-build.md.
 *
 * E2E_PORT overrides the port (use it when several checkouts run e2e at the same time).
 * E2E_REUSE=1 reuses an already running server on that port (fast local iteration; make sure
 * it serves a fresh build).
 * E2E_WORKERS sets local parallelism (default 2): the owner's laptop runs two agents' suites at
 * once, so a local run keeps to two browsers (docs/TESTING.md › CPU budget).
 *
 * Timeouts are sized for a loaded machine (several agents, CI runners): the garden paints in
 * workers and the planting sheet paints every species preview synchronously, which can take
 * seconds under CPU contention. Tests never sleep; they wait for explicit readiness signals
 * (docs/TESTING.md). CI retries once and keeps traces, screenshots and the HTML report.
 */
const port = Number(process.env.E2E_PORT ?? 4173);
const ci = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : Number(process.env.E2E_WORKERS ?? 2),
  reporter: ci ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}/Ssprout/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/Ssprout/`,
    reuseExistingServer: process.env.E2E_REUSE === '1',
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
