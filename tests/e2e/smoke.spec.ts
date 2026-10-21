import { canvasStats, expect, openDev, test } from './fixtures';

test.describe('smoke', () => {
  test('app loads with a visible, painted garden canvas', async ({ page, errors }) => {
    await page.goto('./');
    await expect(page).toHaveTitle('Study Sprout');
    const canvas = page.locator('canvas#garden');
    await expect(canvas).toBeVisible();
    await expect(page.locator('#ui')).toBeAttached();
    // without ?dev the debug API is not exposed
    expect(await page.evaluate(() => typeof window.sprout)).toBe('undefined');
    expect(errors).toEqual([]);
  });

  test('?dev exposes window.sprout and renders a stable frame', async ({ page }) => {
    await openDev(page);
    const api = await page.evaluate(() => Object.keys(window.sprout ?? {}));
    expect(api).toEqual(expect.arrayContaining(['state', 'ready', 'freeze', 'unfreeze', 'setSpeed']));

    const state = await page.evaluate(() => window.sprout!.state());
    expect(state.version).toBe(1);
    expect(state.plants).toEqual([]);

    await page.evaluate(() => window.sprout!.freeze());
    const stats = await canvasStats(page);
    expect(stats.w).toBeGreaterThan(0);
    expect(stats.a).toBeGreaterThan(250); // opaque
    expect(stats.distinctColours).toBeGreaterThan(2); // paper + pond + stones, not blank
  });

  test('?speed accelerates the app clock and setSpeed changes it', async ({ page }) => {
    await openDev(page, 'speed=3600');
    const ratio = (speed?: number) =>
      page.evaluate(async (sp) => {
        if (sp !== undefined) window.sprout!.setSpeed(sp);
        const c0 = window.sprout!.now();
        const p0 = performance.now();
        await new Promise((r) => setTimeout(r, 50));
        return (window.sprout!.now() - c0) / (performance.now() - p0);
      }, speed);
    expect(await ratio()).toBeGreaterThan(1000);
    const r1 = await ratio(1);
    expect(r1).toBeGreaterThan(0.5);
    expect(r1).toBeLessThan(2);
  });
});
