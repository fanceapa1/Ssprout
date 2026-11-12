import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';

/**
 * Species painters load per species on the main thread (ADR 0348): the registry there holds
 * metadata only and the sprites are painted in workers. A first visit requests no species
 * chunk; a started session loads its own species' painter, and its plant still paints.
 */

/** Every script the page asks for from now on. */
function scripts(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script' || r.url().endsWith('.js')) urls.push(r.url());
  });
  return urls;
}

test.describe('lazy species painters (ADR 0348)', () => {
  test('a first visit requests no species painter; planting loads only its own', async ({ page }) => {
    const urls = scripts(page);
    await openDev(page);
    await page.evaluate(() => window.sprout!.plantsReady());
    const ids = await page.evaluate(() => {
      const s = window.sprout!;
      return [...new Set((['japanese-garden', 'waterfall', 'oasis'] as const).flatMap((g) => s.flora(g)))];
    });
    expect(ids.length).toBeGreaterThan(20);
    const chunkOf = (u: string) => ids.find((id) => new RegExp(`/assets/${id}-[\\w-]+\\.js$`).test(u));
    expect(urls.filter((u) => chunkOf(u))).toEqual([]);

    const planted = await page.evaluate(async () => {
      const s = window.sprout!;
      const session = s.start(25);
      await s.plantsReady();
      return session!.speciesId;
    });
    // the store's new session asked for its painter, and for no other
    await expect.poll(() => urls.filter((u) => chunkOf(u) === planted).length).toBe(1);
    expect(urls.map(chunkOf).filter((id) => id && id !== planted)).toEqual([]);
    // the main thread's paint of it matches the worker's
    const r = await page.evaluate((speciesId) => window.sprout!.plants.view.parity({ speciesId, seed: 7, growth: 1, width: 240, height: 240 }), planted);
    expect(r.ink).toBeGreaterThan(2000);
    expect(r.maxDiff).toBeLessThanOrEqual(2);
  });
});
