import type { Page } from '@playwright/test';
import { expect, openAt, openDev, test, waitFrames } from './fixtures';

/**
 * The lantern's flame flickers with the ambience's own time, which `settleAmbience()` starts over:
 * with normal motion, two fresh loads at night give the same still frame however long each ran.
 */

/** An FNV-1a hash of the settled still frame at night: the painting, the sky, the light (with the flame) and the paper. */
async function nightHash(page: Page): Promise<{ hash: string; flame: number }> {
  return page.evaluate(async () => {
    const s = window.sprout!;
    s.setTime('night');
    await s.lightReady();
    await s.camera.settle();
    s.settleAmbience();
    const ids = s.mute({});
    const mute: Record<string, readonly string[] | '*'> = Object.fromEntries(ids.filter((id) => id !== 'scene' && id !== 'paper' && id !== 'ambience').map((id) => [id, '*']));
    mute.scene = ['waterSurface'];
    mute.ambience = ['waterSurface', 'ambience'];
    s.mute(mute);
    await s.freeze();
    const flame = s.ambience()!.flame;
    const c = document.querySelector<HTMLCanvasElement>('#garden')!;
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data[i]!, 0x01000193);
    s.unfreeze();
    s.mute({});
    return { hash: (h >>> 0).toString(16), flame };
  });
}

const flame = (page: Page) => page.evaluate(() => window.sprout!.ambience()!.flame);

test.describe('ambience · the lantern flame in a still frame', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('two fresh loads at night, with motion, freeze to the same frame', async ({ page }) => {
    test.slow();
    await page.addInitScript(openAt);
    // a first visit fills the paint cache, so both loads below draw from it
    await openDev(page, 'e2eat=22:00');
    await nightHash(page);
    await page.evaluate(() => window.sprout!.paintCache.settle());

    await openDev(page, 'e2eat=22:00');
    expect(await page.evaluate(() => window.sprout!.ambience()!.reducedMotion)).toBe(false);
    const first = await nightHash(page);
    expect(first.flame).toBe(0);

    // the second load runs longer before its still frame: the flame has burned on meanwhile
    await openDev(page, 'e2eat=22:00');
    await page.evaluate(() => window.sprout!.setTime('night'));
    await waitFrames(page, 30);
    expect(await flame(page)).toBeGreaterThan(0);
    const second = await nightHash(page);
    expect(second).toEqual(first);
  });
});
