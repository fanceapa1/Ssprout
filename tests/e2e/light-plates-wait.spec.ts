import type { Page } from '@playwright/test';
import { expect, openAt, openDev, test, waitFrames } from './fixtures';
import { storedOf } from './paint-store';

/**
 * A light plate the paint cache lacks waits for the garden's lazy painters (ADR 0341, devlog 155).
 * A repeat visit takes the landscape and the plates from the cache, so the painters chunk is not
 * loaded. The visits open at night and frame at noon, whose light plate is dropped from the store,
 * and the chunk is held back like a slow network: until it lands the plate is the grade wash alone.
 */

const PHASES = ['sunrise', 'midday', 'sunset', 'night'] as const;

/** The garden at a pinned noon with the painting, the sky, the light plate and the paper drawn. */
async function lightFrame(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = window.sprout!;
    s.setTime('noon');
    await s.camera.settle();
    s.settleAmbience();
    const ids = s.mute({});
    const mute: Record<string, readonly string[] | '*'> = Object.fromEntries(ids.filter((id) => id !== 'scene' && id !== 'paper' && id !== 'ambience').map((id) => [id, '*']));
    mute.scene = ['waterSurface']; // the water animates with time
    mute.ambience = ['waterSurface', 'ambience'];
    s.mute(mute);
    await s.freeze();
    const c = document.querySelector<HTMLCanvasElement>('#garden')!;
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    let bin = '';
    for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return btoa(bin);
  });
}

function differingPixels(a: string, b: string): number {
  const x = Buffer.from(a, 'base64');
  const y = Buffer.from(b, 'base64');
  expect(x.length).toBe(y.length);
  let n = 0;
  for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2] || x[i + 3] !== y[i + 3]) n++;
  return n;
}

/** Remove the stored midday light plate, straight from IndexedDB (from a page whose cache is off). */
async function dropMiddayLight(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((done, fail) => {
      const req = indexedDB.open('studysprout-paint');
      req.onsuccess = () => done(req.result);
      req.onerror = () => fail(req.error);
    });
    try {
      const all = await new Promise<Array<{ id: string; kind: string }>>((done, fail) => {
        const req = db.transaction('meta', 'readonly').objectStore('meta').getAll();
        req.onsuccess = () => done(req.result);
        req.onerror = () => fail(req.error);
      });
      const ids = all.filter((m) => m.kind === 'light-plate' && m.id.includes('|midday|')).map((m) => m.id);
      const t = db.transaction(['meta', 'blobs'], 'readwrite');
      for (const id of ids) {
        t.objectStore('meta').delete(id);
        t.objectStore('blobs').delete(id);
      }
      await new Promise<void>((done, fail) => {
        t.oncomplete = () => done();
        t.onerror = () => fail(t.error);
      });
      return ids.length;
    } finally {
      db.close();
    }
  });
}

test.describe('light plates wait for the lazy painters (devlog 155)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  test.beforeEach(({ context }) => context.addInitScript(openAt));

  for (const scenery of ['japanese-garden', 'waterfall', 'oasis'] as const) {
    test(`a repeat visit missing its light plate, with a slow painters chunk, gives a fresh paint's lit frame (${scenery})`, async ({ page }) => {
      test.slow();
      const at = 'e2eat=02:00';
      if (scenery !== 'japanese-garden') {
        // that garden on view from then on (saved), so every visit below opens on it
        await openDev(page, `${at}&nopaintcache`);
        await page.evaluate(async (id) => {
          await window.sprout!.showScenery(id);
          window.sprout!.flush();
        }, scenery);
      }
      // the reference: painted, with the cache off
      await openDev(page, `${at}&nopaintcache`);
      expect(await page.evaluate(() => window.sprout!.scenery().viewed)).toBe(scenery);
      const fresh = await lightFrame(page);

      // first visit: the landscape and every phase's plates painted and stored
      await openDev(page, at);
      for (const time of PHASES) {
        await page.evaluate((t) => window.sprout!.setTime(t), time);
        await waitFrames(page, 2);
      }
      await expect.poll(async () => (await storedOf(page, 'sky-plate', 'light-plate')).length, { timeout: 40_000 }).toBe(8);
      await page.evaluate(() => window.sprout!.paintCache.settle());
      await openDev(page, `${at}&nopaintcache`);
      expect(await dropMiddayLight(page)).toBe(1);

      // repeat visit: everything from the cache but the midday light plate; the painters slow
      await page.route(/\/assets\/painters-[^/]+\.js$/, async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      await openDev(page, at);
      expect(await page.evaluate(() => window.sprout!.sceneStats())).toMatchObject({ paints: 0, cacheHits: 1 });
      const cached = await lightFrame(page);
      expect(differingPixels(cached, fresh)).toBe(0);
      // the midday light plate was looked up in vain, then painted once its painters had landed
      const stats = await page.evaluate(() => ({ sky: window.sprout!.skyStats()!.cacheHits, light: window.sprout!.lightPlates() }));
      expect(stats.sky).toBeGreaterThan(0);
      expect(stats.light.cacheMisses).toBeGreaterThan(0);
      expect(stats.light.painted).toBeGreaterThan(0);
    });
  }
});
