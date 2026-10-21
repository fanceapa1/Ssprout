import type { Page } from '@playwright/test';
import { canvasStats, expect, openDev, test } from './fixtures';

/** Colour of the garden canvas at a world point (after the frame is frozen). */
function pixelAtWorld(page: Page, x: number, y: number) {
  return page.evaluate(
    ([wx, wy]) => {
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const ctx = c.getContext('2d')!;
      // cover scaling around the pond focus, like the viewport (landscape test screens show all)
      const scale = Math.max(c.width / 1600, c.height / 1000);
      const ox = (c.width - 1600 * scale) / 2;
      const oy = Math.min(0, Math.max(c.height - 1000 * scale, c.height / 2 - 560 * scale));
      const d = ctx.getImageData(Math.round(wx! * scale + ox), Math.round(wy! * scale + oy), 1, 1).data;
      return { r: d[0]!, g: d[1]!, b: d[2]! };
    },
    [x, y],
  );
}

test.describe('scene', () => {
  test('paints the garden: pale paper sky, celadon pond, varied painted marks', async ({ page }) => {
    await openDev(page);
    // lighting follows the local clock: pin daylight so the colours do not depend on when tests run
    await page.evaluate(() => {
      window.sprout!.setTime('noon');
      return window.sprout!.freeze();
    });
    const stats = await canvasStats(page);
    expect(stats.distinctColours).toBeGreaterThan(200); // a painting, not flat fills
    const sky = await pixelAtWorld(page, 800, 120);
    const pond = await pixelAtWorld(page, 830, 600);
    // sky stays close to washi paper; the pond is cooler (green/blue above red) and darker
    expect(sky.r).toBeGreaterThan(215);
    expect(sky.r).toBeGreaterThanOrEqual(sky.b);
    expect(pond.g).toBeGreaterThan(pond.r);
    expect(pond.r + pond.g + pond.b).toBeLessThan(sky.r + sky.g + sky.b - 60);
    const scene = await page.evaluate(() => window.sprout!.sceneStats());
    expect(scene.paints).toBe(1);
    expect(scene.painting).toBe(false);
  });

  test('exposes 50–60 slots across all habitats', async ({ page }) => {
    await openDev(page);
    const slots = await page.evaluate(() => window.sprout!.slots());
    expect(slots.length).toBeGreaterThanOrEqual(50);
    expect(slots.length).toBeLessThanOrEqual(60);
    expect(new Set(slots.map((s) => s.habitat))).toEqual(new Set(['water', 'shore', 'meadow', 'path', 'back', 'rock']));
    // the controller sees the same slots
    const ids = await page.evaluate(() => window.sprout!.slots().map((s) => s.id));
    expect(new Set(ids).size).toBe(slots.length);
  });

  test('?dev&slots draws the slot overlay over the scene', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => window.sprout!.freeze());
    const plain = await canvasStats(page);
    await openDev(page, 'slots');
    await page.evaluate(() => window.sprout!.freeze());
    const overlay = await canvasStats(page);
    expect(Math.abs(overlay.r - plain.r) + Math.abs(overlay.g - plain.g) + Math.abs(overlay.b - plain.b)).toBeGreaterThan(0.5);
  });

  test('small resizes rescale the cached painting; big ones repaint', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openDev(page);
    await page.setViewportSize({ width: 1240, height: 775 }); // −3 %: reuse
    await page.waitForFunction(() => window.sprout!.sceneStats().rescales >= 1);
    expect((await page.evaluate(() => window.sprout!.sceneStats())).paints).toBe(1);
    await page.setViewportSize({ width: 1600, height: 1000 }); // +25 %: repaint in the background
    await page.waitForFunction(() => window.sprout!.sceneStats().paints >= 2, null, { timeout: 15_000 });
    await page.evaluate(() => window.sprout!.scenePainted());
    await page.evaluate(() => window.sprout!.freeze());
    expect((await canvasStats(page)).distinctColours).toBeGreaterThan(200);
  });
});
