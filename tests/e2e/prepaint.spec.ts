import type { Page } from '@playwright/test';
import { expect, test, waitBrowserFrames } from './fixtures';
import { openUi } from './ui-helpers';
import { storedOf } from './paint-store';

/**
 * Pre-painting the gardens not on view (ADR 0339): once the Gardens section comes near the window,
 * the other gardens' overview paintings go into the paint cache in idle time, so a switch to one
 * paints no landscape. Skipped on save-data; paused while a session runs.
 */

const prepaint = (page: Page) => page.evaluate(() => window.sprout!.gardens.prepaint());
const stats = (page: Page) => page.evaluate(() => window.sprout!.scenePrepaint());
const overviews = async (page: Page) => (await storedOf(page, 'scene')).map((e) => e.key.split('|')[0]).sort();
const toGardens = (page: Page) => page.evaluate(() => window.sprout!.ui.scrollTo('gardens', { instant: true }));

test.describe('gardens · pre-painting the gardens not on view (ADR 0339)', () => {
  // a small stage paints quickly; the pre-paint works the same at any size
  test.beforeEach(({ page }) => page.setViewportSize({ width: 960, height: 600 }));

  test('scrolling to the Gardens pre-paints the other gardens; a switch afterwards paints no landscape', async ({ page }) => {
    test.setTimeout(180_000);
    await openUi(page);
    await page.evaluate(() => window.sprout!.paintCache.settle());
    expect(await overviews(page)).toEqual(['japanese-garden']);
    expect((await prepaint(page)).state).toBe('waiting');
    await toGardens(page);
    await page.evaluate(() => window.sprout!.gardens.prepaintReady());
    expect(await prepaint(page)).toEqual({ state: 'done', reason: null });
    expect(await stats(page)).toMatchObject({ painted: 2, cancelled: 0, painting: null });
    expect(await overviews(page)).toEqual(['japanese-garden', 'oasis', 'waterfall']);
    // the cards' thumbnails come from those paintings
    expect(await page.evaluate(() => window.sprout!.ui.gardenThumbs().filter((t) => t.id !== 'japanese-garden'))).toEqual([
      { id: 'waterfall', source: 'painted' },
      { id: 'oasis', source: 'painted' },
    ]);
    // once per paint version: asked again, nothing is painted
    await page.evaluate(() => window.sprout!.gardens.prepaintReady());
    expect((await stats(page)).painted).toBe(2);
    const before = await page.evaluate(() => window.sprout!.sceneStats());
    await page.evaluate(() => window.sprout!.showScenery('oasis'));
    const after = await page.evaluate(() => window.sprout!.sceneStats());
    expect(after.paints).toBe(before.paints);
    expect(after.cacheHits).toBe(before.cacheHits + 1);
  });

  test('nothing is pre-painted on save-data', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'connection', { get: () => ({ saveData: true }), configurable: true }));
    await openUi(page);
    await toGardens(page);
    await page.evaluate(() => window.sprout!.gardens.prepaintReady());
    await page.evaluate(() => window.sprout!.ui.gardenThumbsReady());
    expect(await prepaint(page)).toEqual({ state: 'skipped', reason: 'save-data' });
    expect(await stats(page)).toMatchObject({ painted: 0, cached: 0, painting: null });
    expect(await overviews(page)).toEqual(['japanese-garden']);
    expect(await page.evaluate(() => window.sprout!.ui.gardenThumbs().filter((t) => t.id !== 'japanese-garden').map((t) => t.source))).toEqual(['waiting', 'waiting']);
  });

  test('a session start pauses the pre-paint; it goes on once the session ends', async ({ page }) => {
    test.setTimeout(180_000);
    await openUi(page);
    await toGardens(page);
    await expect.poll(async () => (await stats(page)).painting, { timeout: 30_000 }).not.toBeNull();
    await page.evaluate(() => window.sprout!.start(25));
    await expect.poll(async () => (await prepaint(page)).state).toBe('paused');
    const held = await stats(page);
    await waitBrowserFrames(page, 60);
    expect(await stats(page)).toEqual(held);
    expect((await prepaint(page)).state).toBe('paused');
    await page.evaluate(() => window.sprout!.cancel());
    await page.evaluate(() => window.sprout!.gardens.prepaintReady());
    expect(await stats(page)).toMatchObject({ painted: 2, painting: null });
    expect(await overviews(page)).toEqual(['japanese-garden', 'oasis', 'waterfall']);
  });
});
