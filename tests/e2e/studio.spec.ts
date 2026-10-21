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

test.describe('studio', () => {
  test('every entry renders without errors and paints something', async ({ page }) => {
    await openStudio(page);
    const entries = await page.evaluate(() => window.studio!.entries);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toEqual(expect.arrayContaining(['scene/full', 'species-placeholder-sprout/growth-1']));
    await expect(page.locator('canvas[data-entry]')).toHaveCount(entries.length);
    expect(await page.evaluate(() => window.studio!.errors)).toEqual([]);
    expect(await blankCanvases(page)).toEqual([]);
  });

  test('reseed re-renders with a new seed', async ({ page }) => {
    // one section keeps this fast; re-rendering every entry of every section is covered by the load test
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
});
