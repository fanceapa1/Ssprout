import type { Page } from '@playwright/test';
import { canvasStats, expect, openDev, test } from './fixtures';

/** Mean colour of the garden canvas around a world point (after the frame is frozen), via the live viewport. */
function pixelAtWorld(page: Page, x: number, y: number) {
  return page.evaluate(
    ([wx, wy]) => {
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const d = window.sprout!.plants.toDevice({ x: wx!, y: wy!, w: 1, h: 1 })!;
      // a 9×9 device-pixel average, so a passing water strider cannot decide the colour
      const px = c.getContext('2d')!.getImageData(Math.round(d.x) - 4, Math.round(d.y) - 4, 9, 9).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < px.length; i += 4) {
        r += px[i]!;
        g += px[i + 1]!;
        b += px[i + 2]!;
      }
      const n = px.length / 4;
      return { r: r / n, g: g / n, b: b / n };
    },
    [x, y],
  );
}

/** A point of open water: the pond polygon's vertex average (the scene keeps boulders on its rim). */
function pondCentre(page: Page) {
  return page.evaluate(() => {
    const pond = window.sprout!.fauna.pond();
    return { x: pond.reduce((a, p) => a + p.x, 0) / pond.length, y: pond.reduce((a, p) => a + p.y, 0) / pond.length };
  });
}

test.describe('scene', () => {
  test('paints the garden: a pale clear midday sky, celadon pond, varied painted marks', async ({ page }) => {
    await openDev(page);
    // lighting follows the local clock: pin daylight so the colours do not depend on when tests run
    await page.evaluate(() => {
      window.sprout!.setTime('noon');
      return window.sprout!.freeze();
    });
    const stats = await canvasStats(page);
    expect(stats.distinctColours).toBeGreaterThan(200); // a painting, not flat fills
    // a sky point in view: the garden stage is ~88 % of the window (ADR 0130), so a short
    // landscape window crops a little more of the sky's top
    const top = await page.evaluate(() => window.sprout!.fauna.view().y);
    const sky = await pixelAtWorld(page, 800, Math.max(120, top + 40));
    const centre = await pondCentre(page);
    const pond = await pixelAtWorld(page, centre.x, centre.y);
    // the midday sky is a light, clear wash of blue (ADR 0145); the pond is cooler (green above
    // red) and darker than bare paper
    expect(sky.r + sky.g + sky.b).toBeGreaterThan(500);
    expect(sky.b).toBeGreaterThanOrEqual(sky.r);
    expect(pond.g).toBeGreaterThan(pond.r);
    expect(pond.r + pond.g + pond.b).toBeLessThan(650);
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
