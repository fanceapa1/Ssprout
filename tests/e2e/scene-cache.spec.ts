import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';
import { storedOf } from './paint-store';

/**
 * The landscape from the persistent paint cache (ADR 0228). The e2e server is the production
 * build, where the cache is on. Every test has its own browser context, so it starts with an
 * empty store; the loads inside one test share it, like repeat visits.
 */

/**
 * The garden frame at a pinned noon with only the scene's painting, its sprites, the sky plate and
 * the paper drawn: nothing that moves. `hash` returns an FNV-1a hash of the pixels instead of them.
 */
async function sceneFrame(page: Page, hash = false): Promise<{ w: number; h: number; data: string }> {
  return page.evaluate(async (hash) => {
    const s = window.sprout!;
    s.setTime('noon');
    await s.camera.settle();
    const ids = s.mute({});
    const mute: Record<string, readonly string[] | '*'> = Object.fromEntries(ids.filter((id) => id !== 'scene' && id !== 'paper').map((id) => [id, '*']));
    mute.scene = ['waterSurface']; // the water animates with time
    s.mute(mute);
    await s.freeze();
    const c = document.querySelector<HTMLCanvasElement>('#garden')!;
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    if (hash) {
      let h = 0x811c9dc5;
      for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data[i]!, 0x01000193);
      return { w: c.width, h: c.height, data: (h >>> 0).toString(16) };
    }
    let bin = '';
    for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return { w: c.width, h: c.height, data: btoa(bin) };
  }, hash);
}

function differingPixels(a: { data: string }, b: { data: string }): number {
  const x = Buffer.from(a.data, 'base64');
  const y = Buffer.from(b.data, 'base64');
  expect(x.length).toBe(y.length);
  let n = 0;
  for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2] || x[i + 3] !== y[i + 3]) n++;
  return n;
}

const sceneStats = (page: Page) => page.evaluate(() => window.sprout!.sceneStats());

/** Load, paint (a miss) and wait until the painting is stored. */
async function firstVisit(page: Page) {
  await openDev(page);
  const stats = await sceneStats(page);
  expect(stats).toMatchObject({ paints: 1, cacheHits: 0, cacheMisses: 1 });
  expect(stats.timings.length).toBeGreaterThan(10);
  await page.evaluate(() => window.sprout!.paintCache.settle());
  return stats;
}

test.describe('scene · landscape from the paint cache (ADR 0228)', () => {
  // a landscape screen whose overview is the whole world: one painting per load, no extension
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('a repeat visit draws the landscape from the cache, pixel for pixel what a fresh paint gives', async ({ page }) => {
    // the reference: painted, with the cache off
    await openDev(page, 'nopaintcache');
    const fresh = await sceneFrame(page);
    expect(await sceneStats(page)).toMatchObject({ paints: 1, cacheHits: 0 });

    const first = await firstVisit(page);
    // the painting and the atlas of its sprites (the daylight plates are stored beside them, ADR 0236)
    expect(await page.evaluate(() => window.sprout!.paintCache.stats())).toMatchObject({ enabled: true, errors: 0 });
    expect((await storedOf(page, 'scene', 'scene-sprites')).length).toBe(2);

    // repeat visit: no paint step at all, one hit
    await openDev(page);
    const repeat = await sceneStats(page);
    expect(repeat).toMatchObject({ paints: 0, cacheHits: 1, cacheMisses: 0, painting: false });
    expect(repeat.timings).toEqual([]);
    expect(repeat.lastView).toEqual(first.lastView);
    const cached = await sceneFrame(page);
    expect([cached.w, cached.h]).toEqual([fresh.w, fresh.h]);
    expect(differingPixels(cached, fresh)).toBe(0);
  });

  test('a size not in the cache paints as before, and is cached in turn', async ({ page }) => {
    await firstVisit(page);
    await openDev(page);
    expect(await sceneStats(page)).toMatchObject({ paints: 0, cacheHits: 1 });
    // +25 %: a scale never painted in this browser
    await page.setViewportSize({ width: 1800, height: 1125 });
    await page.waitForFunction(() => window.sprout!.sceneStats().paints >= 1, null, { timeout: 15_000 });
    await page.evaluate(() => window.sprout!.scenePainted());
    const after = await sceneStats(page);
    expect(after).toMatchObject({ paints: 1, cacheHits: 1, cacheMisses: 1 });
    expect(after.timings.length).toBeGreaterThan(10);
    await page.evaluate(() => window.sprout!.paintCache.settle());
    expect(await page.evaluate(() => window.sprout!.paintCache.stats())).toMatchObject({ errors: 0 });
    expect((await storedOf(page, 'scene', 'scene-sprites')).length).toBe(4);
  });

  test("the camera's detail painting of a resting view comes from the cache on a repeat visit", async ({ page }) => {
    const rest = async () => {
      await page.evaluate(() => window.sprout!.camera.glideTo({ zoom: 3, x: 300, y: 300 }, { animate: false }));
      await page.evaluate(() => window.sprout!.camera.settle());
      return page.evaluate(() => window.sprout!.sceneDetail());
    };
    await openDev(page);
    const painted = await rest();
    expect(painted).toMatchObject({ paints: 1, cacheHits: 0, cacheMisses: 1 });
    await page.evaluate(() => window.sprout!.paintCache.settle());
    await openDev(page);
    const again = await rest();
    expect(again).toMatchObject({ paints: 0, cacheHits: 1, cacheMisses: 0 });
    expect(again.view).toEqual(painted.view);
  });
});

test.describe('scene · landscape from the paint cache at DPR 2 (ADR 0228)', () => {
  // the paint scale is capped at 1.5 there, so the painting is drawn upscaled
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  test('the cached landscape draws upscaled exactly like a fresh one', async ({ page }) => {
    await openDev(page, 'nopaintcache');
    const fresh = await sceneFrame(page, true);
    await firstVisit(page);
    await openDev(page);
    expect(await sceneStats(page)).toMatchObject({ paints: 0, cacheHits: 1, lastView: { scale: 1.5 } });
    const cached = await sceneFrame(page, true);
    expect(cached).toEqual(fresh);
  });
});
