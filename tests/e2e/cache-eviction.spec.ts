import type { Page } from '@playwright/test';
import { expect, openDev, test, waitFrames } from './fixtures';
import { storedOf } from './paint-store';

/**
 * Paint-cache eviction tiers at DPR 2 (ADR 0351): close views go before the daylight plates and
 * the gardens' landscapes. With the gardens pre-painted and a close view over a small cap
 * (`paintcachemb`), a warm repeat visit still takes the garden from the cache and loads no painters.
 */

function scripts(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script' || r.url().endsWith('.js')) urls.push(r.url());
  });
  return urls;
}

test.describe('paint cache eviction at DPR 2 (ADR 0351)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });

  test('after the pre-paint and a close view over the cap, a repeat visit still hits the cache', async ({ page }) => {
    test.setTimeout(240_000);
    const first = scripts(page);
    await openDev(page, 'paintcachemb=26');
    await page.evaluate(() => window.sprout!.camera.autoFocus(false));
    await page.evaluate(() => window.sprout!.ui.scrollTo('gardens', { instant: true }));
    await page.evaluate(() => window.sprout!.gardens.prepaintReady());
    await page.evaluate(() => window.sprout!.ui.scrollTo(0, { instant: true }));
    await page.evaluate(() => window.sprout!.camera.glideTo({ zoom: 2, x: 500, y: 600 }, { animate: false }));
    await page.evaluate(() => window.sprout!.camera.settle());
    await page.evaluate(() => window.sprout!.paintCache.settle());
    const s = await page.evaluate(() => window.sprout!.paintCache.stats());
    // the cap was reached: the close view was evicted or not stored, nothing else
    expect(s.evictions + s.skipped).toBeGreaterThan(0);
    expect(s.bytes).toBeLessThanOrEqual(s.maxBytes);
    expect((await storedOf(page, 'scene')).map((e) => e.key.split('|')[0]).sort()).toEqual(['japanese-garden', 'oasis', 'waterfall']);
    expect((await storedOf(page, 'sky-plate')).length).toBeGreaterThan(0);

    const painters = [...new Set(first.filter((u) => /\/assets\/painters-[^/]+\.js$/.test(u)))];
    const bodies = await Promise.all(painters.map(async (u) => ({ u, text: await (await page.request.get(u)).text() })));
    const garden = bodies.filter((b) => b.text.includes('pond-reserve')).map((b) => b.u);
    expect(garden).toHaveLength(1);

    const repeat = scripts(page);
    await openDev(page, 'paintcachemb=26');
    await page.evaluate(async () => {
      const sp = window.sprout!;
      await sp.camera.settle();
      sp.settleAmbience();
    });
    await waitFrames(page, 4);
    expect(await page.evaluate(() => window.sprout!.sceneStats())).toMatchObject({ paints: 0, cacheHits: 1, cacheMisses: 0 });
    expect(repeat).not.toContain(garden[0]);
  });
});
