import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';

/**
 * A garden switch gets the new garden's light ready in parts (ADR 0337): the old light keeps
 * drawing under the renderer's cover while the new plates come from the paint cache, so the
 * switch paints no plate, and the settled frame is pixel for pixel what a fresh load shows.
 */

const show = (page: Page, id: string) => page.evaluate((id) => window.sprout!.showScenery(id as never), id);

/** An FNV-1a hash of the still frame with the painting, the sky, the light and the paper drawn at night. */
async function lightHash(page: Page): Promise<string> {
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
    const c = document.querySelector<HTMLCanvasElement>('#garden')!;
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data[i]!, 0x01000193);
    s.unfreeze();
    s.mute({});
    return (h >>> 0).toString(16);
  });
}

const settleCache = (page: Page) => page.evaluate(() => window.sprout!.paintCache.settle());

test.describe('ambience · the light on a garden switch (ADR 0337)', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('a warm switch takes its light from the paint cache and settles pixel for pixel like a fresh load', async ({ page }) => {
    test.slow();
    await openDev(page);
    // one visit of the oasis at night fills the paint cache with its painting and light
    await page.evaluate(() => window.sprout!.setTime('night'));
    await show(page, 'oasis');
    await lightHash(page);
    await settleCache(page);
    await show(page, 'japanese-garden');
    await settleCache(page);

    // a fresh page on the Japanese garden, then the switch
    await openDev(page);
    await lightHash(page);
    const before = await page.evaluate(() => window.sprout!.lightPlates().painted);
    await show(page, 'oasis');
    // the renderer's ready waits for the light: in place once the switch resolves
    expect(await page.evaluate(() => window.sprout!.ambience()!.switching)).toBe(false);
    const switched = await lightHash(page);
    expect(await page.evaluate(() => window.sprout!.lightPlates().painted)).toBe(before);
    await settleCache(page);

    // a fresh load on the oasis (the garden on view is kept)
    await openDev(page);
    expect(await page.evaluate(() => window.sprout!.scenery().viewed)).toBe('oasis');
    expect(await lightHash(page)).toBe(switched);
  });

  test('while the new light gets ready the old one keeps drawing; lightReady resolves when it takes over', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => window.sprout!.setTime('night'));
    const seen = await page.evaluate(async () => {
      const s = window.sprout!;
      const going = s.showScenery('waterfall');
      const during = s.ambience()!.switching;
      await s.lightReady();
      const after = s.ambience()!.switching;
      await going;
      return { during, after };
    });
    expect(seen).toEqual({ during: true, after: false });
  });
});
