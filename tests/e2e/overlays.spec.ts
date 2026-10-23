import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openUi } from './ui-helpers';

/**
 * Sheets over the page (ADR 0190): a leaf of washi behind every sheet (the page is only a ghost,
 * no dock text reads beside or below it), the page locked while a sheet is open — wheel, keys and
 * the custom smooth scroll move the sheet, never the page under it — and unlocked again on close.
 */

const pageY = (page: Page) => page.evaluate(() => window.scrollY);

async function lockedWhileOpen(page: Page, sheet: ReturnType<Page['locator']>): Promise<void> {
  await expect(sheet).toBeVisible();
  const y0 = await pageY(page);
  // paper laid over paper: the backdrop is the page's washi, nearly opaque
  const veil = await sheet.evaluate((d) => {
    const cs = getComputedStyle(d, '::backdrop');
    return { opacity: Number(cs.opacity), image: cs.backgroundImage };
  });
  expect(veil.opacity).toBeGreaterThanOrEqual(0.95);
  expect(veil.image).toContain('url(');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe('hidden');

  // the wheel over the backdrop, beside the sheet
  const box = (await sheet.boundingBox())!;
  await page.mouse.move(Math.max(4, box.x / 2), 400);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 500);
  // keys that scroll a page
  await page.keyboard.press('PageDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Space');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await pageY(page)).toBe(y0);
  expect((await page.evaluate(() => window.sprout!.ui.scroll())).animating).toBe(false);
}

test.describe('sheets over the page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the planting sheet: paper behind it, the page locked, the wheel scrolls the sheet itself', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.ui.scrollTo(600, { instant: true }));
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await lockedWhileOpen(page, sheet);
    expect(await pageY(page)).toBe(600);

    // the wheel over the sheet scrolls the sheet's own paper, still not the page
    const inner = sheet.locator('.sheet-inner');
    await inner.evaluate((el) => (el.scrollTop = 0)); // End (above) took the sheet to its foot
    const before = 0;
    const box = (await inner.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 300);
    await expect.poll(() => inner.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
    expect(await pageY(page)).toBe(600);

    // the torn edge is drawn over the content, so the sticky footer never hides the bottom edge
    const edge = await sheet.evaluate((d) => getComputedStyle(d, '::after').backgroundImage);
    expect(edge).toContain('svg');

    // closed: the page scrolls again, from where it was
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
    expect(await pageY(page)).toBe(600);
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => pageY(page)).toBeGreaterThan(600);
  });

  test('every other sheet locks the page too: the schedule editor, pressed flowers, garden data, hints', async ({ page }) => {
    await openUi(page);
    const opens: Array<[string, () => Promise<void>]> = [
      ['schedule', () => page.locator('.cal-add').click()],
      ['herbarium', () => page.locator('.tool-list').getByRole('button', { name: /Pressed flowers/ }).click()],
      ['data', () => page.locator('.tool-list').getByRole('button', { name: /Garden data/ }).click()],
      ['hints', () => page.locator('.tool-list').getByRole('button', { name: /Hints/ }).click()],
    ];
    for (const [name, open] of opens) {
      await page.evaluate(() => window.sprout!.ui.scrollTo('calendar', { instant: true }));
      await open();
      const sheet = page.locator('dialog.sheet[open]');
      await expect(sheet, name).toHaveCount(1);
      await lockedWhileOpen(page, sheet);
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
    }
  });
});
