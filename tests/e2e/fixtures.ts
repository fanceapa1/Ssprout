import { test as base, expect, type Page } from '@playwright/test';

/**
 * `test` that fails on any console error or uncaught page error.
 * Runs automatically for every test; use `errors` to assert explicitly mid-test.
 */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
      });
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      await use(errors);
      expect(errors, 'page logged errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Open the app with the debug API and wait until every system has initialised. */
export async function openDev(page: Page, query = ''): Promise<void> {
  await page.goto(`./?dev${query ? `&${query}` : ''}`);
  await page.waitForFunction(() => window.sprout !== undefined);
  await page.evaluate(() => window.sprout!.ready());
}

/**
 * Wait for `n` rendered garden frames (the renderer's own frame counter, `sprout.frameStats()`),
 * instead of sleeping for a wall-clock time: on a loaded machine frames simply arrive later.
 */
export async function waitFrames(page: Page, n: number): Promise<void> {
  await page.evaluate(() => window.sprout!.resetFrameStats());
  await page.waitForFunction((count) => window.sprout!.frameStats().frames >= count, n, { polling: 'raf' });
}

/** Average RGB + spread of the garden canvas, read back from the page. */
export async function canvasStats(page: Page, selector = '#garden') {
  return page.evaluate((sel) => {
    const c = document.querySelector<HTMLCanvasElement>(sel);
    if (!c) throw new Error(`no canvas ${sel}`);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let n = 0;
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 97) {
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      a += data[i + 3]!;
      seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      n++;
    }
    return { r: r / n, g: g / n, b: b / n, a: a / n, distinctColours: seen.size, w: c.width, h: c.height };
  }, selector);
}
