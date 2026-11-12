import type { Page } from '@playwright/test';
import { expect, openAt, openDev, test, waitFrames } from './fixtures';

/**
 * The night edge's canvases are freed by day and built again on idle, in parts, before the
 * evening needs them (ADR 0350). At night the frame is pixel for pixel a fresh load's.
 */

const edge = (page: Page) => page.evaluate(() => window.sprout!.ambience()!.nightEdge);

/** An FNV-1a hash of the still frame with the painting, the sky, the light and the paper drawn at night. */
async function nightHash(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = window.sprout!;
    s.setTime('night');
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

test.describe('ambience · the night edge by day (ADR 0350)', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('freed at noon, built at night, and the night frame matches a fresh load at night', async ({ page }) => {
    test.slow();
    // still frames: the lantern's flame does not flicker between the loads
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(openAt);
    // a first visit fills the paint cache, so both loads below draw from it
    await openDev(page, 'e2eat=13:00');
    await nightHash(page);
    await page.evaluate(() => window.sprout!.paintCache.settle());

    // a load at noon never builds the edge
    await openDev(page, 'e2eat=13:00');
    await waitFrames(page, 2);
    expect(await edge(page)).toMatchObject({ bytes: 0, sizes: [], building: false, last: null });
    const first = await nightHash(page);
    expect((await edge(page)).bytes).toBeGreaterThan(0);
    // back to noon: freed
    await page.evaluate(() => window.sprout!.setTime('noon'));
    await waitFrames(page, 2);
    const noon = await edge(page);
    expect(noon).toMatchObject({ bytes: 0, sizes: [], building: false, frees: 1 });

    // night again: built again, the same frame as before, and a fresh load's
    expect(await nightHash(page)).toBe(first);
    expect((await edge(page)).bytes).toBeGreaterThan(0);
    await openDev(page, 'e2eat=13:00');
    expect(await nightHash(page)).toBe(first);
  });

  test.describe('at DPR 2', () => {
    test.use({ deviceScaleFactor: 2 });

    test('before the evening blend the edge is built on idle, so the evening builds nothing at once', async ({ page }) => {
      await openDev(page);
      await page.evaluate(() => window.sprout!.setTime('noon'));
      await waitFrames(page, 2);
      expect((await edge(page)).bytes).toBe(0);
      // the clock 15 minutes before the evening's blend begins (sunset − 60 min − 20 min)
      await page.evaluate(() => {
        const s = window.sprout!;
        s.setTime(null);
        const sunset = new Date(s.daylight().sunTimes!.sunset!);
        const at = new Date(sunset.getTime() - (60 + 20 + 15) * 60_000);
        s.setTime(at.getHours() + at.getMinutes() / 60);
      });
      await page.waitForFunction(() => {
        const e = window.sprout!.ambience()!.nightEdge;
        return e.bytes > 0 && !e.building;
      });
      const built = await edge(page);
      expect(built.last).toMatchObject({ sync: false });
      expect(built.last!.parts).toBeGreaterThan(1);
      console.log(`night edge: ${(built.bytes / 1e6).toFixed(2)} MB, ${built.last!.parts} idle parts, longest ${built.last!.longestMs.toFixed(1)} ms, total ${built.last!.totalMs.toFixed(1)} ms`);
      // the evening: drawn from the canvases built on idle, nothing built at once
      await page.evaluate(() => window.sprout!.setTime('sunset'));
      await waitFrames(page, 2);
      expect((await edge(page)).last).toEqual(built.last);
    });
  });
});
