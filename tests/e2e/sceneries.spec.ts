import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';
import { storedOf } from './paint-store';

/**
 * Switching the garden on view at runtime (ADR 0243): the waterfall is behind its dev flag, so
 * every test opens `?dev&scenery=waterfall`. docs/systems/scenery.md › Switching.
 */
const FLAG = 'scenery=waterfall';

const show = (page: Page, id: string) => page.evaluate((id) => window.sprout!.showScenery(id as never), id);
const viewed = (page: Page) => page.evaluate(() => window.sprout!.scenery().viewed);
const sceneStats = (page: Page) => page.evaluate(() => window.sprout!.sceneStats());

/** Ids of the finished plants and seedlings the plant system shows, once their sprites are in. */
async function shownPlants(page: Page): Promise<{ finished: string[]; seedlings: string[] }> {
  return page.evaluate(async () => {
    await window.sprout!.plantsReady();
    const s = window.sprout!.plants.state();
    return { finished: s.finished.map((p) => p.id).sort(), seedlings: s.seedlings.map((p) => p.id).sort() };
  });
}

/** An FNV-1a hash of the still frame at a pinned noon: only the scene's painting and the paper. */
async function frameHash(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = window.sprout!;
    s.setTime('noon');
    await s.camera.settle();
    const ids = s.mute({});
    const mute: Record<string, readonly string[] | '*'> = Object.fromEntries(ids.filter((id) => id !== 'scene' && id !== 'paper').map((id) => [id, '*']));
    mute.scene = ['waterSurface'];
    s.mute(mute);
    await s.freeze();
    const c = document.querySelector<HTMLCanvasElement>('#garden')!;
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i += 16) h = Math.imul(h ^ data[i]!, 0x01000193);
    s.mute({});
    s.unfreeze();
    return (h >>> 0).toString(16);
  });
}

test.describe('sceneries · switching the garden on view (ADR 0243)', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('the dev flag offers the waterfall; without it only the Japanese garden', async ({ page }) => {
    await openDev(page);
    expect(await page.evaluate(() => window.sprout!.scenery())).toMatchObject({ viewed: 'japanese-garden', available: ['japanese-garden'] });
    await expect(show(page, 'waterfall')).rejects.toThrow(/not available/);
    await openDev(page, FLAG);
    expect(await page.evaluate(() => window.sprout!.scenery().available)).toEqual(['japanese-garden', 'waterfall']);
  });

  test('switches to the waterfall and back, cross-fading, without a reload', async ({ page }) => {
    await openDev(page, FLAG);
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    const garden = await frameHash(page);
    await show(page, 'waterfall');
    expect(await viewed(page)).toBe('waterfall');
    expect(await page.evaluate(() => window.sprout!.scenery().fade)).toBeGreaterThan(0);
    await page.waitForFunction(() => window.sprout!.scenery().fade === 0);
    expect(await page.evaluate(() => window.sprout!.camera.state().overview)).toBe(true);
    const falls = await frameHash(page);
    expect(falls).not.toBe(garden);
    await show(page, 'japanese-garden');
    await page.waitForFunction(() => window.sprout!.scenery().fade === 0);
    expect(await frameHash(page)).toBe(garden);
    // the same page all along
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  });

  test('the second switch to the same garden comes from the paint cache', async ({ page }) => {
    await openDev(page, FLAG);
    await show(page, 'waterfall');
    const first = await sceneStats(page);
    expect(first.cacheMisses).toBeGreaterThanOrEqual(1);
    await page.evaluate(() => window.sprout!.paintCache.settle());
    await show(page, 'japanese-garden');
    const back = await sceneStats(page);
    expect(back.cacheHits).toBeGreaterThan(first.cacheHits);
    await page.evaluate(() => window.sprout!.paintCache.settle());
    await show(page, 'waterfall');
    const again = await sceneStats(page);
    expect(again.cacheHits).toBeGreaterThan(back.cacheHits);
    expect(again.paints).toBe(back.paints);
  });

  test('each garden shows only its own plants', async ({ page }) => {
    await openDev(page, FLAG);
    await page.evaluate(() => {
      window.sprout!.addPlants(3, undefined, 'japanese-garden');
      window.sprout!.addPlants(2, undefined, 'waterfall');
    });
    const ids = await page.evaluate(() => window.sprout!.state().plants.map((p) => [p.id, p.sceneryId] as const));
    const of = (s: string) => ids.filter(([, x]) => x === s).map(([id]) => id).sort();
    expect((await shownPlants(page)).finished).toEqual(of('japanese-garden'));
    await show(page, 'waterfall');
    expect((await shownPlants(page)).finished).toEqual(of('waterfall'));
    await show(page, 'japanese-garden');
    expect((await shownPlants(page)).finished).toEqual(of('japanese-garden'));
  });

  test('a session keeps counting while another garden is on view; switching to it brings its garden back', async ({ page }) => {
    await openDev(page, FLAG);
    const pond = await page.evaluate(() => window.sprout!.start(25, { taskName: 'Pond' })!.id);
    expect((await shownPlants(page)).seedlings).toEqual([pond]);
    await show(page, 'waterfall');
    expect((await shownPlants(page)).seedlings).toEqual([]);
    const before = await page.evaluate((id) => window.sprout!.sessions().find((s) => s.id === id)!.elapsedMs, pond);
    await page.evaluate(() => window.sprout!.advance(5 * 60_000));
    const after = await page.evaluate((id) => window.sprout!.sessions().find((s) => s.id === id)!.elapsedMs, pond);
    expect(after - before).toBeGreaterThanOrEqual(5 * 60_000 - 1000);

    // a session in the waterfall becomes active (the pond one waits), then the pond one again
    const falls = await page.evaluate(() => window.sprout!.start(25, { taskName: 'Falls', sceneryId: 'waterfall' })!.id);
    expect(await viewed(page)).toBe('waterfall');
    expect((await shownPlants(page)).seedlings).toEqual([falls]);
    await page.evaluate((id) => window.sprout!.switchTo(id), pond);
    expect(await viewed(page)).toBe('japanese-garden');
    await show(page, 'japanese-garden'); // already on view: waits for it to be ready
    expect((await shownPlants(page)).seedlings).toEqual([pond]);
  });
});

test.describe('sceneries · reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the switch is a cut', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDev(page, FLAG);
    await show(page, 'waterfall');
    expect(await page.evaluate(() => window.sprout!.scenery())).toMatchObject({ viewed: 'waterfall', fade: 0 });
  });

  test('the waterfall has its own daylight: night is darker and bluer than noon, and its plates come from the cache', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDev(page, FLAG);
    await show(page, 'waterfall');
    /** The frame's mean colour at a pinned time, the ambience settled. */
    const mean = (time: 'noon' | 'night') =>
      page.evaluate(async (time) => {
        const s = window.sprout!;
        s.setTime(time);
        await s.camera.settle();
        s.settleAmbience();
        await s.freeze();
        const c = document.querySelector<HTMLCanvasElement>('#garden')!;
        const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
        const sum = [0, 0, 0];
        let n = 0;
        for (let i = 0; i < data.length; i += 4 * 97, n++) for (let k = 0; k < 3; k++) sum[k]! += data[i + k]!;
        s.unfreeze();
        return sum.map((v) => v / n) as [number, number, number];
      }, time);
    const noon = await mean('noon');
    const night = await mean('night');
    expect(night[0] + night[1] + night[2]).toBeLessThan((noon[0] + noon[1] + noon[2]) * 0.85);
    expect(night[2] / (night[0] + 1)).toBeGreaterThan(noon[2] / (noon[0] + 1));
    // its plates are stored under its own keys (ADR 0242); a second load takes them from the cache
    await expect.poll(async () => (await storedOf(page, 'sky-plate')).filter((e) => e.key.startsWith('waterfall|')).length, { timeout: 40_000 }).toBeGreaterThanOrEqual(2);
    await openDev(page, FLAG);
    await show(page, 'waterfall');
    await mean('night');
    expect((await page.evaluate(() => window.sprout!.skyStats()!)).cacheHits).toBeGreaterThanOrEqual(1);
  });
});
