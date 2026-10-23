import { test, expect } from './fixtures';

test('the audio studio paints and plays every new Standard bed', async ({ page }) => {
  await page.goto('./studio.html#audio');
  await page.waitForFunction(() => window.studio?.ready === true);
  await page.evaluate(() => window.studio!.settle());
  expect(await page.evaluate(() => window.studio!.errors)).toEqual([]);
  for (const id of ['waves', 'fire', 'cafe', 'lofi', 'white', 'brown']) {
    const canvas = page.locator(`canvas[data-entry="audio/standard-${id}"]`);
    await expect(canvas).toHaveCount(1);
    expect(await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
    })).toBe(true);
    await canvas.click();
    await canvas.click();
  }
});

test('the shell studio icon sheet includes its final row', async ({ page }) => {
  await page.goto('./studio.html?entry=ui-shell/icons');
  await page.waitForFunction(() => window.studio?.ready === true);
  await page.evaluate(() => window.studio!.settle());
  const ink = await page.locator('canvas[data-entry="ui-shell/icons"]').evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const y = Math.floor(c.height * 2 / 3);
    const data = c.getContext('2d')!.getImageData(0, y, c.width, c.height - y).data;
    return { height: c.height, painted: data.some((v, i) => i % 4 === 3 && v > 0) };
  });
  expect(ink.height).toBeGreaterThan(120);
  expect(ink.painted).toBe(true);
});
