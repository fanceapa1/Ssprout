import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openUi, plantSession } from './ui-helpers';

/**
 * The dock's Gardens section (ADR 0244): choosing a garden switches the one on view, and the
 * planting flow offers that garden's spots. The waterfall is behind its dev flag.
 */
const FLAG = 'scenery=waterfall';

const viewed = (page: Page) => page.evaluate(() => window.sprout!.scenery().viewed);
const ready = (page: Page) => page.evaluate(() => window.sprout!.showScenery(window.sprout!.scenery().viewed));
const section = (page: Page) => page.locator('.dock-section[data-section="gardens"]');
const card = (page: Page, id: string) => section(page).locator(`button.garden-card[data-scenery="${id}"]`);

async function shownSeedlings(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await window.sprout!.plantsReady();
    return window.sprout!.plants.state().seedlings.map((p) => p.id);
  });
}

test.describe('gardens · choosing the garden on view (ADR 0244)', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('only one garden: no Gardens section', async ({ page }) => {
    await openUi(page);
    await expect(section(page)).toHaveCount(0);
  });

  test('lists both gardens, the one on view marked; choosing the waterfall switches', async ({ page }) => {
    await openUi(page, FLAG);
    await expect(section(page).getByRole('heading', { name: 'Gardens' })).toBeVisible();
    await expect(section(page).locator('button.garden-card')).toHaveCount(2);
    await expect(card(page, 'japanese-garden')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 'japanese-garden')).toContainText('Japanese garden');
    await expect(card(page, 'waterfall')).toContainText('Rocky waterfall');
    await expect(card(page, 'waterfall')).toHaveAttribute('aria-pressed', 'false');
    await card(page, 'waterfall').click();
    await ready(page);
    expect(await viewed(page)).toBe('waterfall');
    await expect(card(page, 'waterfall')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 'japanese-garden')).toHaveAttribute('aria-pressed', 'false');
    // the garden left behind keeps a still of how it looked
    expect(await page.evaluate(() => window.sprout!.ui.gardenStills())).toContain('japanese-garden');
  });

  test('plants in the waterfall through the real flow, and switching back hides its seedling', async ({ page }) => {
    await openUi(page, FLAG);
    await card(page, 'waterfall').click();
    await ready(page);
    const waterfallSlots = await page.evaluate(() => window.sprout!.slots().map((s) => s.id));
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet.locator('.plant-card[data-species-id="fx-violet"] .plant-habitat')).toContainText(/plunge pool|by the pool|grassy banks|beside the trail|the cliff|mossy ledges/);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await plantSession(page, { species: 'fx-violet', begin: false });
    const markerIds = await page.locator('button.marker[data-slot-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-slot-id')!));
    expect(markerIds.length).toBeGreaterThan(0);
    for (const id of markerIds) expect(waterfallSlots).toContain(id);
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'focus');
    const session = await page.evaluate(() => window.sprout!.state().session!);
    expect(session.sceneryId).toBe('waterfall');
    expect(waterfallSlots).toContain(session.slotId);
    expect(await shownSeedlings(page)).toContain(session.id);

    await card(page, 'japanese-garden').click();
    await ready(page);
    expect(await viewed(page)).toBe('japanese-garden');
    expect(await shownSeedlings(page)).not.toContain(session.id);
    // the session keeps counting in its own garden
    expect(await page.evaluate(() => window.sprout!.state().session?.sceneryId)).toBe('waterfall');
  });

  test('keyboard operable: Tab to a card, Enter chooses it', async ({ page }) => {
    await openUi(page, FLAG);
    await card(page, 'japanese-garden').focus();
    await page.keyboard.press('Tab');
    await expect(card(page, 'waterfall')).toBeFocused();
    await page.keyboard.press('Enter');
    await ready(page);
    expect(await viewed(page)).toBe('waterfall');
    await page.keyboard.press('Shift+Tab');
    await expect(card(page, 'japanese-garden')).toBeFocused();
    await page.keyboard.press('Space');
    await ready(page);
    expect(await viewed(page)).toBe('japanese-garden');
  });

  test('phone width: the cards stack, inside the page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openUi(page, FLAG);
    await page.evaluate(() => window.sprout!.ui.dockReady());
    const boxes = await section(page).locator('button.garden-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
    expect(boxes).toHaveLength(2);
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(390);
    }
    expect(boxes[1]!.top).toBeGreaterThanOrEqual(boxes[0]!.bottom - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await card(page, 'waterfall').click();
    await ready(page);
    expect(await viewed(page)).toBe('waterfall');
  });
});
