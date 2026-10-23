import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';
import { calmUiMotion, plantSession, setMinutes } from './ui-helpers';

/**
 * Q1 (SPEC §2 step 4, §3 Placement): the lotus — a `large` water plant, real species — can be
 * planted through the real start flow: sheet → Lotus → only the large open-water spots glow →
 * choose one → Begin → its seedling grows (and paints) in the pond. When every spot it fits holds
 * another session's seedling, the sheet says so instead of offering a dead end (ADR 0205).
 */

/** A fresh seeded garden with the real species (no `?fixtures`). */
async function openReal(page: Page): Promise<void> {
  await calmUiMotion(page);
  await openDev(page, 'uitime=0.02');
  await page.evaluate(() => {
    window.sprout!.reset();
    window.sprout!.seed(7);
    window.sprout!.ui.refresh();
  });
}

test.describe('lotus · plantable through the real flow', () => {
  test('choose Lotus, a large open-water spot glows, Begin plants its seedling in the pond', async ({ page }) => {
    await openReal(page);
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet).toBeVisible();
    await setMinutes(page, 60);
    const lotus = sheet.locator('.plant-card[data-species-id="lotus"]');
    await expect(lotus).toHaveAttribute('data-locked', 'false');
    await expect(lotus).toHaveAttribute('data-full', 'false');
    await lotus.click();
    await expect(lotus).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('button', { name: 'Choose a spot' }).click();
    await expect(sheet).toBeHidden();

    // only open-water spots that take a large plant glow, and every one is on screen
    const markers = page.locator('button.marker[data-slot-id]');
    await expect(markers.first()).toBeVisible();
    const ids = (await markers.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slotId))).sort();
    expect(ids).toEqual(['water-1', 'water-3']);
    for (const id of ids) await expect(page.locator(`button.marker[data-slot-id="${id}"]`)).toBeVisible();
    expect(await page.evaluate(() => window.sprout!.plants.state().highlight)).toMatchObject({ active: true, slots: 2 });

    await page.locator('button.marker[data-slot-id="water-3"]').click();
    await expect(page.locator('.placement-prompt')).toContainText('Lotus will grow');
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'focus');

    const session = await page.evaluate(() => window.sprout!.state().session);
    expect(session).toMatchObject({ speciesId: 'lotus', slotId: 'water-3' });

    // the seedling is in the pond and its sprite paints
    await page.evaluate(() => window.sprout!.plantsReady());
    const growing = await page.evaluate(() => window.sprout!.plants.state().growing);
    expect(growing).toMatchObject({ speciesId: 'lotus', slotId: 'water-3', drawn: true });
    expect(growing!.shown).toBeGreaterThan(0);
    const hit = await page.evaluate(() => {
      const b = window.sprout!.plants.bounds(window.sprout!.state().session!.id);
      return b ? window.sprout!.plants.hitTest({ x: b.x + b.w / 2, y: b.y + b.h * 0.9 }, 30) : null;
    });
    expect(hit).toMatchObject({ kind: 'growing', speciesId: 'lotus', slotId: 'water-3' });
  });

  test('when seedlings hold both large water spots, the sheet shows the lotus has no spot instead of a dead end', async ({ page }) => {
    await openReal(page);
    // two water lilies growing in the two spots a lotus fits (parallel sessions hold their slots)
    await plantSession(page, { task: 'Lilies 1', minutes: 30, species: 'water-lily', slot: 'water-1' });
    await plantSession(page, { task: 'Lilies 2', minutes: 30, species: 'water-lily', slot: 'water-3', another: true });

    await page.locator('.session-list').getByRole('button', { name: 'Plant another' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet).toBeVisible();
    await setMinutes(page, 60);
    const lotus = sheet.locator('.plant-card[data-species-id="lotus"]');
    await expect(lotus).toHaveAttribute('data-locked', 'false');
    await expect(lotus).toHaveAttribute('data-full', 'true');
    await expect(lotus).toHaveAttribute('aria-disabled', 'true');
    await expect(lotus.locator('.plant-desc')).toHaveText('Its spots all hold growing seedlings just now');
    await lotus.click({ force: true });
    await expect(lotus).toHaveAttribute('aria-pressed', 'false');
    await expect(sheet.getByRole('button', { name: 'Choose a spot' })).toBeDisabled();

    // other water plants still have a spot
    await expect(sheet.locator('.plant-card[data-species-id="water-lily"]')).toHaveAttribute('data-full', 'false');
  });
});
