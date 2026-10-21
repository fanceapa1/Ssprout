import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build served by `vite preview`, so tests exercise exactly
 * what ships to GitHub Pages (base path included). See docs/adr/0010-e2e-against-preview-build.md.
 *
 * E2E_PORT overrides the port (use it when several checkouts run e2e at the same time).
 * E2E_REUSE=1 reuses an already running server on that port (fast local iteration; make sure
 * it serves a fresh build).
 */
const port = Number(process.env.E2E_PORT ?? 4173);
const ci = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
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
