import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function openStudio(page: Page, query = '') {
  await page.goto(`./studio.html${query}`);
  await page.waitForFunction(() => window.studio?.ready === true);
}

/** Entries whose canvas has no painted pixel at all. */
function blankCanvases(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-entry]')]
      .filter((c) => {
        const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
        for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) return false;
        return true;
      })
      .map((c) => c.dataset.entry),
  );
}

/** Section ids from the nav, read on an empty view (`#…` naming no section renders nothing). */
async function sectionIds(page: Page): Promise<string[]> {
  await openStudio(page, '#__none__');
  await expect(page.locator('.empty')).toContainText('No studio section');
  return page.locator('nav a[href^="#"]').evaluateAll((as) =>
    as.map((a) => decodeURIComponent((a.getAttribute('href') ?? '').slice(1))).filter((id) => id !== ''),
  );
}

/**
 * Rendering every entry of every section at once is the heaviest page in the app (tens of
 * seconds under load: all species growth stages, the full scene, fauna sheets). The check is
 * split into shards that run in parallel, and each shard shows one section at a time
 * (`#<section>`, the studio's own section view), so no single step renders the whole studio.
 */
const SHARDS = 4;

test.describe('studio', () => {
  test('lists every section in the nav, including the scene and the species', async ({ page }) => {
    const ids = await sectionIds(page);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['scene', 'species-white-clover']));
    expect(ids.some((id) => id.startsWith('fauna'))).toBe(true);
    expect(ids.some((id) => id.startsWith('ambience'))).toBe(true);
  });

  for (let shard = 0; shard < SHARDS; shard++) {
    test(`every entry renders without errors and paints something (shard ${shard + 1}/${SHARDS})`, async ({ page }) => {
      const ids = (await sectionIds(page)).filter((_, i) => i % SHARDS === shard);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        // a hash change re-mounts the grid with only that section, synchronously
        await page.evaluate((h) => (location.hash = h), id);
        await page.waitForFunction(
          (sid) => window.studio!.entries.length > 0 && window.studio!.entries.every((e) => e.startsWith(`${sid}/`)),
          id,
        );
        const entries = await page.evaluate(() => window.studio!.entries);
        await expect(page.locator('canvas[data-entry]'), id).toHaveCount(entries.length);
        expect(await page.evaluate(() => window.studio!.errors), id).toEqual([]);
        expect(await blankCanvases(page), id).toEqual([]);
      }
    });
  }

  test('reseed re-renders with a new seed', async ({ page }) => {
    // one section keeps this fast; every section's entries are covered by the shard tests
    await openStudio(page, '#scene');
    const seed = page.locator('#seed');
    const before = await seed.inputValue();
    const renders = await page.evaluate(() => window.studio!.renders());
    await page.locator('#reseed').click();
    await expect(seed).not.toHaveValue(before);
    expect(await page.evaluate(() => window.studio!.renders())).toBeGreaterThan(renders);
    expect(await blankCanvases(page)).toEqual([]);
  });

  test('#section shows only that section', async ({ page }) => {
    await openStudio(page, '#scene');
    const entries = await page.evaluate(() => window.studio!.entries);
    expect(entries.every((e) => e.startsWith('scene/'))).toBe(true);
  });

  test('?entry shows a single entry large', async ({ page }) => {
    await openStudio(page, '?entry=scene/full&t=0');
    await expect(page.locator('canvas[data-entry]')).toHaveCount(1);
    const box = await page.locator('canvas[data-entry]').boundingBox();
    expect(box!.width).toBeGreaterThan(800);
    expect(await blankCanvases(page)).toEqual([]);
  });

  test('?seed and ?t start paused at that seed; Play animates, Pause holds the frame', async ({ page }) => {
    await openStudio(page, '?seed=7&t=0#scene');
    await expect(page.locator('#seed')).toHaveValue('7');
    await expect(page.locator('#play')).toHaveText('Play');
    // the animated water must be on screen to animate (off-screen cards are skipped)
    await page.locator('canvas[data-entry="scene/water"]').scrollIntoViewIfNeeded();
    const frames = () =>
      page.evaluate(async () => {
        const r0 = window.studio!.renders();
        for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
        return window.studio!.renders() - r0;
      });
    expect(await frames(), 'paused: nothing re-renders').toBe(0);
    await page.locator('#play').click();
    await expect(page.locator('#play')).toHaveText('Pause');
    expect(await frames(), 'playing: animated entries render every frame').toBeGreaterThan(0);
    await page.locator('#play').click();
    expect(await frames()).toBe(0);
  });

  test('speed, background and scale controls', async ({ page }) => {
    await openStudio(page, '?t=0#scene');
    await page.locator('#speed').fill('1');
    await expect(page.locator('label:has(#speed) output')).toHaveText('2×');
    await page.locator('#bg').selectOption('dark');
    await expect(page.locator('body')).toHaveAttribute('data-bg', 'dark');
    const canvas = page.locator('canvas[data-entry="scene/water"]');
    const w1 = (await canvas.boundingBox())!.width;
    await page.locator('#scale').selectOption('2');
    await expect.poll(async () => (await canvas.boundingBox())!.width).toBeCloseTo(w1 * 2, 0);
    expect(await blankCanvases(page)).toEqual([]);
  });
});
